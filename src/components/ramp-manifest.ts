import type { AVCanvas, AVManifest, DownloadResource, JsonObject, MediaSource } from '../types';

export interface RampManifestOptions {
  /** The URL to play, after `resolveRequest`. */
  src: string;
  captions: boolean;
  download: boolean;
}

const text = (value: string): JsonObject => ({ none: [value] });

const renderingItems = (files: DownloadResource[]): JsonObject[] =>
  files.map((file) => ({
    id: file.id,
    type: 'Text',
    label: text(file.label),
    ...(file.format ? { format: file.format } : {}),
  }));

/*
 * RAMP reads Presentation 3 only, and plays every Canvas in the Manifest it is
 * given. It gets a Manifest holding just the active Canvas and source, rebuilt
 * from the normalized model, so Presentation 2 Manifests, `resolveRequest` and
 * the source selector work, and its own navigation can't drift from the
 * controller's. Transcripts, chapters and annotations stay with this package.
 */
export const rampManifest = (
  manifest: AVManifest,
  canvas: AVCanvas,
  source: MediaSource,
  options: RampManifestOptions,
): JsonObject => {
  const duration = canvas.duration ?? source.duration;
  // RAMP shows these through Video.js, which only knows caption and subtitle files.
  const tracks = options.captions
    ? canvas.tracks.filter((track) => track.kind === 'captions' || track.kind === 'subtitles')
    : [];
  const body: JsonObject = {
    id: options.src,
    type: source.kind === 'audio' ? 'Sound' : 'Video',
    ...(source.format ? { format: source.format } : {}),
    ...(source.width ? { width: source.width } : {}),
    ...(source.height ? { height: source.height } : {}),
    ...(duration ? { duration } : {}),
  };
  const rampCanvas: JsonObject = {
    id: canvas.id,
    type: 'Canvas',
    label: text(canvas.label),
    ...(duration ? { duration } : {}),
    ...(canvas.width ? { width: canvas.width } : {}),
    ...(canvas.height ? { height: canvas.height } : {}),
    items: [{
      id: `${canvas.id}/ramp/page`,
      type: 'AnnotationPage',
      items: [{
        id: `${canvas.id}/ramp/painting`,
        type: 'Annotation',
        motivation: 'painting',
        body,
        target: canvas.id,
      }],
    }],
  };
  if (tracks.length > 0) {
    rampCanvas.annotations = [{
      id: `${canvas.id}/ramp/captions`,
      type: 'AnnotationPage',
      items: tracks.map((track, index) => ({
        id: `${canvas.id}/ramp/captions/${index}`,
        type: 'Annotation',
        motivation: 'supplementing',
        body: {
          id: track.src,
          type: 'Text',
          // RAMP reads the format to choose the track kind, and fails without one.
          format: track.format ?? 'text/vtt',
          label: text(track.label),
          ...(track.language ? { language: track.language } : {}),
        },
        target: canvas.id,
      })),
    }];
  }
  if (canvas.poster && source.kind === 'video') {
    rampCanvas.placeholderCanvas = {
      id: `${canvas.id}/ramp/poster`,
      type: 'Canvas',
      items: [{
        id: `${canvas.id}/ramp/poster/page`,
        type: 'AnnotationPage',
        items: [{
          id: `${canvas.id}/ramp/poster/painting`,
          type: 'Annotation',
          motivation: 'painting',
          body: { id: canvas.poster, type: 'Image' },
          target: `${canvas.id}/ramp/poster`,
        }],
      }],
    };
  }
  if (options.download && canvas.rendering.length > 0) rampCanvas.rendering = renderingItems(canvas.rendering);
  return {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: manifest.id,
    type: 'Manifest',
    label: text(manifest.label),
    items: [rampCanvas],
    ...(options.download && manifest.rendering.length > 0 ? { rendering: renderingItems(manifest.rendering) } : {}),
  };
};
