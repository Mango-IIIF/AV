import type {
  AVAnnotation,
  AVCanvas,
  AVManifest,
  AVStrings,
  AuthService,
  Chapter,
  DownloadResource,
  JsonObject,
  MediaSource,
  MetadataEntry,
  TextTrack,
  TranscriptCue,
  TranscriptResource,
} from '../types';
import {
  asArray,
  asObject,
  formatString,
  isHls,
  label,
  languageValues,
  mediaKind,
  parseTemporalFragment,
  readId,
  readType,
  resolveStrings,
  withoutFragment,
} from '../utils';

export interface NormalizeOptions {
  fetch?: typeof globalThis.fetch;
  requestInit?: RequestInit;
  preferredLanguages?: string[];
  loadExternalAnnotations?: boolean;
  strings?: Partial<AVStrings>;
}

const strings = (value: unknown): string[] =>
  asArray(value).flatMap((item) => (typeof item === 'string' ? [item] : []));

const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readFormat = (object: JsonObject): string | undefined =>
  typeof object.format === 'string' ? object.format : undefined;

const metadata = (value: unknown, languages: string[], ui: AVStrings): MetadataEntry[] =>
  asArray(value).flatMap((item) => {
    const object = asObject(item);
    if (!object) return [];
    const values = languageValues(object.value);
    if (values.length === 0) return [];
    return [{ label: label(object.label, languages, ui.metadata), values }];
  });

const downloads = (value: unknown, languages: string[], ui: AVStrings): DownloadResource[] =>
  asArray(value).flatMap((item) => {
    const object = asObject(item);
    const id = readId(item);
    if (!object || !id) return [];
    const result: DownloadResource = {
      id,
      label: label(object.label, languages, id.split('/').pop() ?? ui.download),
    };
    const format = readFormat(object);
    if (format) result.format = format;
    const filename = typeof object.filename === 'string' ? object.filename : undefined;
    if (filename) result.filename = filename;
    return [result];
  });

const services = (value: unknown, languages: string[]): AuthService[] =>
  asArray(value).flatMap((item) => {
    const object = asObject(item);
    const id = readId(item);
    if (!object || !id) return [];
    const profile = typeof object.profile === 'string' ? object.profile : undefined;
    const type = `${readType(object) ?? ''} ${profile ?? ''}`.toLowerCase();
    let serviceType: AuthService['serviceType'] = 'unknown';
    if (type.includes('probe')) serviceType = 'probe';
    else if (type.includes('token')) serviceType = 'token';
    else if (type.includes('logout')) serviceType = 'logout';
    else if (type.includes('access') || type.includes('login') || type.includes('clickthrough') || type.includes('kiosk')) serviceType = 'access';
    const result: AuthService = {
      id,
      serviceType,
      services: services(object.service, languages),
    };
    if (profile) result.profile = profile;
    const serviceLabel = label(object.label, languages);
    if (serviceLabel) result.label = serviceLabel;
    return [result];
  });

const firstContentId = (canvasValue: unknown): string | undefined => {
  const canvas = asObject(canvasValue);
  if (!canvas) return undefined;
  const v3Page = asObject(asArray(canvas.items)[0]);
  const v3Annotation = asObject(asArray(v3Page?.items)[0]);
  const v3Body = asObject(asArray(v3Annotation?.body)[0]);
  const v2Annotation = asObject(asArray(canvas.images)[0]);
  const v2Body = asObject(v2Annotation?.resource);
  return readId(v3Body) ?? readId(v2Body);
};

const bodyItems = (body: unknown): JsonObject[] => {
  const values = asArray(body).flatMap((item) => {
    const object = asObject(item);
    if (!object) return [];
    const type = readType(object)?.toLowerCase();
    if (type?.includes('choice') || Array.isArray(object.items) || Array.isArray(object.item)) {
      return asArray(object.items ?? object.item ?? object.default).flatMap((choice) => {
        const choiceObject = asObject(choice);
        return choiceObject ? [choiceObject] : [];
      });
    }
    return [object];
  });
  return values;
};

const sourceFromBody = (
  body: JsonObject,
  canvas: JsonObject,
  target: unknown,
  languages: string[],
  index: number,
  ui: AVStrings,
  annotationTimeMode?: unknown,
): MediaSource | undefined => {
  const originalId = readId(body);
  if (!originalId) return undefined;
  const format = readFormat(body);
  const kind = mediaKind(readType(body), format, originalId);
  if (!kind) return undefined;
  const result: MediaSource = {
    id: originalId,
    src: withoutFragment(originalId),
    kind,
    isHls: isHls(originalId, format),
  };
  if (format) result.format = format;
  const bodyLabel = label(body.label, languages, index === 0
    ? ui.autoSource
    : formatString(ui.sourceNumber, { number: index + 1 }));
  if (bodyLabel) result.label = bodyLabel;
  const width = number(body.width) ?? number(canvas.width);
  const height = number(body.height) ?? number(canvas.height);
  const duration = number(body.duration) ?? number(canvas.duration);
  if (width !== undefined) result.width = width;
  if (height !== undefined) result.height = height;
  if (duration !== undefined) result.duration = duration;
  const quality = typeof body.quality === 'string' ? body.quality : undefined;
  if (quality) result.quality = quality;
  const segment = parseTemporalFragment(originalId);
  if (segment) result.segment = segment;
  const canvasTarget = parseTemporalFragment(target);
  if (canvasTarget) result.canvasTarget = canvasTarget;
  const timeMode = body.timeMode ?? annotationTimeMode;
  if (timeMode === 'trim' || timeMode === 'scale' || timeMode === 'loop') result.timeMode = timeMode;
  return result;
};

const textualBodies = (body: unknown): JsonObject[] =>
  bodyItems(body).filter((item) => {
    const type = readType(item)?.toLowerCase();
    return type?.includes('textualbody') || typeof item.value === 'string';
  });

const annotationMotivations = (annotation: JsonObject): string[] => strings(annotation.motivation);

const annotationFrom = (
  value: unknown,
  canvasId: string,
  pageId: string | undefined,
  languages: string[],
  index: number,
): AVAnnotation | undefined => {
  const annotation = asObject(value);
  if (!annotation) return undefined;
  const bodies = textualBodies(annotation.body ?? annotation.resource);
  const text = bodies
    .flatMap((body) => (typeof body.value === 'string' ? [body.value] : languageValues(body.chars).map((entry) => entry.value)))
    .join('\n');
  if (!text) return undefined;
  const motivation = annotationMotivations(annotation);
  const purpose = bodies.flatMap((body) => strings(body.purpose));
  const tags = bodies
    .filter((body) => strings(body.purpose).includes('tagging'))
    .flatMap((body) => (typeof body.value === 'string' ? [body.value] : []));
  const id = readId(annotation) ?? `${canvasId}/annotation/${index}`;
  const result: AVAnnotation = {
    id,
    canvasId,
    motivation,
    purpose,
    text,
    tags,
  };
  const annotationLabel = label(annotation.label, languages);
  if (annotationLabel) result.label = annotationLabel;
  const time = parseTemporalFragment(annotation.target ?? annotation.on);
  if (time) result.time = time;
  if (pageId) result.sourcePageId = pageId;
  return result;
};

const classifySupplement = (
  body: JsonObject,
  annotation: JsonObject,
  canvasId: string,
  languages: string[],
  index: number,
  ui: AVStrings,
): { track?: TextTrack; transcript?: TranscriptResource } => {
  const id = readId(body);
  if (!id) return {};
  const format = readFormat(body);
  const bodyLabel = label(body.label, languages, formatString(ui.transcriptNumber, { number: index + 1 }));
  const language = typeof body.language === 'string' ? body.language : undefined;
  const purpose = strings(body.purpose);
  const lower = `${bodyLabel} ${id} ${purpose.join(' ')}`.toLowerCase();
  const isTimedTrack = format === 'text/vtt' || /\.vtt(?:$|[?#])/.test(id);
  let kind: TextTrack['kind'] = 'subtitles';
  if (lower.includes('caption')) kind = 'captions';
  if (lower.includes('description')) kind = 'descriptions';
  const result: { track?: TextTrack; transcript?: TranscriptResource } = {};
  if (isTimedTrack) {
    const track: TextTrack = { id, src: id, kind, label: bodyLabel };
    if (language) track.language = language;
    if (format) track.format = format;
    if (lower.includes('forced')) track.forced = true;
    result.track = track;
  }
  const transcript: TranscriptResource = {
    id: `${canvasId}/transcript/${index}`,
    src: id,
    label: bodyLabel,
    machineGenerated: /\(machine[ -]generated\)/i.test(bodyLabel),
  };
  if (format) transcript.format = format;
  if (language) transcript.language = language;
  result.transcript = transcript;
  return result;
};

const annotationPageItems = (page: JsonObject): unknown[] => asArray(page.items ?? page.resources);

const collectSupplementing = (
  pages: JsonObject[],
  canvasId: string,
  languages: string[],
  ui: AVStrings,
): { tracks: TextTrack[]; transcripts: TranscriptResource[]; annotations: AVAnnotation[] } => {
  const tracks: TextTrack[] = [];
  const transcripts: TranscriptResource[] = [];
  const annotations: AVAnnotation[] = [];
  let index = 0;
  for (const page of pages) {
    const pageId = readId(page);
    for (const item of annotationPageItems(page)) {
      const annotation = asObject(item);
      if (!annotation) continue;
      const motivations = annotationMotivations(annotation);
      const normalizedAnnotation = annotationFrom(annotation, canvasId, pageId, languages, index);
      if (normalizedAnnotation) annotations.push(normalizedAnnotation);
      for (const body of bodyItems(annotation.body ?? annotation.resource)) {
        const bodyId = readId(body);
        if (bodyId && (motivations.includes('supplementing') || motivations.includes('transcribing') || motivations.length === 0)) {
          const supplement = classifySupplement(body, annotation, canvasId, languages, index, ui);
          if (supplement.track) tracks.push(supplement.track);
          if (supplement.transcript) transcripts.push(supplement.transcript);
        }
      }
      const inline = textualBodies(annotation.body ?? annotation.resource);
      if (inline.length > 0 && (motivations.includes('supplementing') || motivations.includes('transcribing'))) {
        const cues: TranscriptCue[] = inline.flatMap((body, bodyIndex) => {
          const text = typeof body.value === 'string' ? body.value : label(body.chars, languages);
          if (!text) return [];
          const cue: TranscriptCue = {
            id: `${readId(annotation) ?? `${canvasId}/annotation/${index}`}/cue/${bodyIndex}`,
            text,
            type: 'cue',
          };
          const time = parseTemporalFragment(annotation.target ?? annotation.on);
          if (time) {
            cue.start = time.start;
            if (time.end !== undefined) cue.end = time.end;
          }
          return [cue];
        });
        if (cues.length > 0) {
          transcripts.push({
            id: `${pageId ?? canvasId}/inline-transcript`,
            label: label(page.label, languages, ui.transcript),
            machineGenerated: false,
            cues,
          });
        }
      }
      index += 1;
    }
  }
  return { tracks, transcripts, annotations };
};

const paintingAnnotations = (canvas: JsonObject, version: 2 | 3): JsonObject[] => {
  if (version === 2) {
    return asArray(canvas.images).flatMap((item) => {
      const object = asObject(item);
      return object ? [object] : [];
    });
  }
  return asArray(canvas.items).flatMap((page) => {
    const object = asObject(page);
    return object ? annotationPageItems(object).flatMap((item) => (asObject(item) ? [asObject(item) as JsonObject] : [])) : [];
  });
};

const inlineSupplementPages = (canvas: JsonObject, version: 2 | 3): JsonObject[] => {
  const raw = version === 2 ? canvas.otherContent : canvas.annotations;
  return asArray(raw).flatMap((item) => {
    const object = asObject(item);
    return object && (Array.isArray(object.items) || Array.isArray(object.resources)) ? [object] : [];
  });
};

const externalSupplementReferences = (canvas: JsonObject, version: 2 | 3): string[] => {
  const raw = version === 2 ? canvas.otherContent : canvas.annotations;
  return asArray(raw).flatMap((item) => {
    const object = asObject(item);
    if (object && (Array.isArray(object.items) || Array.isArray(object.resources))) return [];
    const id = readId(item);
    return id ? [id] : [];
  });
};

const posterFrom = (canvas: JsonObject): string | undefined => {
  const placeholder = asObject(canvas.placeholderCanvas);
  return firstContentId(placeholder);
};

const canvasFrom = (
  canvas: JsonObject,
  index: number,
  version: 2 | 3,
  languages: string[],
  ui: AVStrings,
): AVCanvas => {
  const id = readId(canvas) ?? `urn:mango:canvas:${index}`;
  const sources = paintingAnnotations(canvas, version).flatMap((annotation, annotationIndex) =>
    bodyItems(annotation.body ?? annotation.resource).flatMap((body, bodyIndex) => {
      const source = sourceFromBody(body, canvas, annotation.target ?? annotation.on, languages, annotationIndex + bodyIndex, ui, annotation.timeMode);
      return source ? [source] : [];
    }),
  );
  const supplementing = collectSupplementing(inlineSupplementPages(canvas, version), id, languages, ui);
  const result: AVCanvas = {
    id,
    index,
    label: label(canvas.label, languages, formatString(ui.sectionNumber, { number: index + 1 })),
    behavior: strings(canvas.behavior ?? canvas.viewingHint),
    sources,
    tracks: supplementing.tracks,
    transcripts: supplementing.transcripts,
    annotations: supplementing.annotations,
    rendering: downloads(canvas.rendering, languages, ui),
    metadata: metadata(canvas.metadata, languages, ui),
    authServices: services(canvas.service, languages),
  };
  const summary = label(canvas.summary ?? canvas.description, languages);
  if (summary) result.summary = summary;
  const duration = number(canvas.duration);
  const width = number(canvas.width);
  const height = number(canvas.height);
  if (duration !== undefined) result.duration = duration;
  if (width !== undefined) result.width = width;
  if (height !== undefined) result.height = height;
  const poster = posterFrom(canvas);
  if (poster) result.poster = poster;
  const accompanying = readId(canvas.accompanyingCanvas);
  if (accompanying) result.accompanyingCanvas = accompanying;
  const homepage = readId(asArray(canvas.homepage ?? canvas.related)[0]);
  if (homepage) result.homepage = homepage;
  return result;
};

const resolveRangeTarget = (value: unknown): { canvasId?: string; time?: { start: number; end?: number } } => {
  const id = readId(value) ?? readId(asObject(value)?.source);
  if (!id) return {};
  const result: { canvasId?: string; time?: { start: number; end?: number } } = { canvasId: withoutFragment(id) };
  const time = parseTemporalFragment(id);
  if (time) result.time = time;
  return result;
};

const chaptersFrom = (manifest: JsonObject, version: 2 | 3, languages: string[], ui: AVStrings): Chapter[] => {
  const rawStructures = asArray(manifest.structures).flatMap((item) => (asObject(item) ? [asObject(item) as JsonObject] : []));
  const byId = new Map(rawStructures.map((range) => [readId(range), range]));
  const seen = new Set<JsonObject>();

  const parseRange = (range: JsonObject, depth = 0): Chapter | undefined => {
    if (depth > 50 || seen.has(range)) return undefined;
    seen.add(range);
    const rangeBehavior = strings(range.behavior ?? range.viewingHint);
    if (rangeBehavior.includes('no-nav') || rangeBehavior.includes('thumbnail-nav')) return undefined;
    const id = readId(range) ?? `urn:mango:range:${seen.size}`;
    const members = version === 3
      ? asArray(range.items)
      : asArray(range.members ?? range.ranges ?? range.canvases);
    const children: Chapter[] = [];
    let target: ReturnType<typeof resolveRangeTarget> = {};
    for (const member of members) {
      const object = asObject(member);
      const memberId = readId(member);
      const memberType = readType(object)?.toLowerCase();
      const referencedRange = memberId ? byId.get(memberId) : undefined;
      if (referencedRange || memberType?.includes('range') || (object && (object.items || object.ranges || object.members))) {
        const child = parseRange(referencedRange ?? (object as JsonObject), depth + 1);
        if (child) children.push(child);
      } else if (!target.canvasId && memberId) {
        target = resolveRangeTarget(member);
      }
    }
    const result: Chapter = {
      id,
      label: label(range.label, languages, formatString(ui.chapterNumber, { number: seen.size })),
      behavior: rangeBehavior,
      children,
    };
    if (target.canvasId) result.canvasId = target.canvasId;
    if (target.time) result.time = target.time;
    const summary = label(range.summary ?? range.description, languages);
    if (summary) result.summary = summary;
    const homepage = readId(asArray(range.homepage ?? range.related)[0]);
    if (homepage) result.homepage = homepage;
    return result;
  };

  return rawStructures.flatMap((range) => {
    const chapter = parseRange(range);
    return chapter ? [chapter] : [];
  });
};

const startFrom = (manifest: JsonObject, version: 2 | 3): AVManifest['start'] => {
  const value = version === 2
    ? asObject(asArray(manifest.sequences)[0])?.startCanvas ?? manifest.startCanvas
    : manifest.start;
  const id = readId(value) ?? readId(asObject(value)?.source);
  if (!id) return undefined;
  const result: NonNullable<AVManifest['start']> = { canvasId: withoutFragment(id) };
  const time = parseTemporalFragment(value) ?? parseTemporalFragment(id);
  if (time) result.time = time.start;
  return result;
};

const manifestCanvases = (manifest: JsonObject, version: 2 | 3): JsonObject[] => {
  const raw = version === 3
    ? manifest.items
    : asObject(asArray(manifest.sequences)[0])?.canvases;
  return asArray(raw).flatMap((item) => (asObject(item) ? [asObject(item) as JsonObject] : []));
};

const detectVersion = (manifest: JsonObject): 2 | 3 => {
  const context = JSON.stringify(manifest['@context'] ?? '');
  if (context.includes('/presentation/2/')) return 2;
  if (Array.isArray(manifest.sequences) || readType(manifest)?.startsWith('sc:')) return 2;
  return 3;
};

export const normalizeManifest = async (
  input: JsonObject | string,
  options: NormalizeOptions = {},
): Promise<AVManifest> => {
  const ui = resolveStrings(options.strings);
  const fetcher = options.fetch ?? globalThis.fetch;
  let source: JsonObject;
  if (typeof input === 'string') {
    if (input.trim().startsWith('{')) {
      source = JSON.parse(input) as JsonObject;
    } else {
      if (!fetcher) throw new Error('No fetch implementation is available to load the IIIF manifest.');
      const response = await fetcher(input, options.requestInit);
      if (!response.ok) throw new Error(formatString(ui.unableToLoadManifest, {
        status: response.status,
        statusText: response.statusText,
      }));
      source = await response.json() as JsonObject;
    }
  } else {
    source = input;
  }
  const type = readType(source)?.toLowerCase();
  if (type && !type.includes('manifest')) throw new Error(formatString(ui.expectedManifest, {
    type: readType(source) ?? '',
  }));
  const version = detectVersion(source);
  const languages = options.preferredLanguages ?? ['en', 'none'];
  const canvases = manifestCanvases(source, version).map((canvas, index) => canvasFrom(canvas, index, version, languages, ui));
  if (canvases.length === 0) throw new Error(ui.manifestWithoutCanvases);

  if (options.loadExternalAnnotations !== false && fetcher) {
    const rawCanvases = manifestCanvases(source, version);
    await Promise.all(rawCanvases.map(async (canvas, index) => {
      const target = canvases[index];
      if (!target) return;
      const references = externalSupplementReferences(canvas, version);
      const loaded = await Promise.all(references.map(async (url) => {
        try {
          const response = await fetcher(url, options.requestInit);
          if (!response.ok) return undefined;
          return asObject(await response.json());
        } catch {
          return undefined;
        }
      }));
      const parsed = collectSupplementing(loaded.filter((page): page is JsonObject => Boolean(page)), target.id, languages, ui);
      target.tracks.push(...parsed.tracks);
      target.transcripts.push(...parsed.transcripts);
      target.annotations.push(...parsed.annotations);
    }));
  }

  const id = readId(source) ?? 'urn:mango:manifest';
  const result: AVManifest = {
    id,
    type: 'Manifest',
    version,
    label: label(source.label, languages, ui.untitledManifest),
    behavior: strings(source.behavior ?? source.viewingHint),
    canvases,
    chapters: chaptersFrom(source, version, languages, ui),
    metadata: metadata(source.metadata, languages, ui),
    rendering: downloads(source.rendering, languages, ui),
  };
  const summary = label(source.summary ?? source.description, languages);
  if (summary) result.summary = summary;
  const start = startFrom(source, version);
  if (start) result.start = start;
  if (typeof source.rights === 'string') result.rights = source.rights;
  const requiredStatement = metadata([source.requiredStatement ?? source.attribution], languages, ui)[0];
  if (requiredStatement) result.requiredStatement = requiredStatement;
  const homepage = readId(asArray(source.homepage ?? source.related)[0]);
  if (homepage) result.homepage = homepage;
  const logo = readId(asArray(source.logo ?? source.provider)[0]);
  if (logo) result.logo = logo;
  return result;
};
