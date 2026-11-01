import type { TranscriptCue, TranscriptResource } from './types';
import { parseTime } from './utils';

export interface TranscriptParseOptions {
  showNotes?: boolean;
  showMetadata?: boolean;
}

const stripMarkup = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();

const cueFromBlock = (
  block: string[],
  index: number,
  isSrt: boolean,
): TranscriptCue | undefined => {
  const timestampIndex = block.findIndex((line) => line.includes('-->'));
  if (timestampIndex < 0) return undefined;
  const timestamp = block[timestampIndex];
  if (!timestamp) return undefined;
  const [rawStart = '', rawEnd = ''] = timestamp.split('-->').map((part) => part.trim().split(/\s+/)[0] ?? '');
  const start = parseTime(isSrt ? rawStart.replace(',', '.') : rawStart);
  const end = parseTime(isSrt ? rawEnd.replace(',', '.') : rawEnd);
  if (start === undefined || end === undefined) return undefined;
  const body = block.slice(timestampIndex + 1).join('\n');
  const text = stripMarkup(body);
  if (!text) return undefined;
  const cue: TranscriptCue = {
    id: `cue-${index}`,
    start,
    end,
    text,
    type: 'cue',
  };
  // A WebVTT voice tag, `<v Ana>` or `<v.loud Ana>`, names who is speaking.
  const speaker = /^<v(?:\.[^\s>]*)?\s+([^>]+)>/.exec(body.trimStart())?.[1]?.trim();
  if (speaker) cue.speaker = speaker;
  return cue;
};

export const parseTimedText = (
  input: string,
  format: 'vtt' | 'srt',
  options: TranscriptParseOptions = {},
): TranscriptCue[] => {
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (format === 'vtt' && !normalized.trimStart().startsWith('WEBVTT')) {
    throw new Error('Invalid WebVTT transcript: missing WEBVTT header.');
  }
  const lines = normalized.split('\n');
  const cues: TranscriptCue[] = [];
  let block: string[] = [];
  const flush = () => {
    if (block.length === 0) return;
    const first = block[0]?.trim() ?? '';
    if (/^NOTE(?:\s|$)/i.test(first)) {
      if (options.showNotes) {
        const text = stripMarkup(block.join('\n').replace(/^NOTE\s*/i, ''));
        if (text) cues.push({ id: `note-${cues.length}`, text, type: 'note' });
      }
    } else if (!block.some((line) => line.includes('-->'))) {
      const upper = first.toUpperCase();
      if (options.showMetadata && first && first !== 'WEBVTT' && upper !== 'STYLE' && upper !== 'REGION') {
        cues.push({ id: `metadata-${cues.length}`, text: stripMarkup(block.join('\n')), type: 'metadata' });
      }
    } else {
      const cue = cueFromBlock(block, cues.length, format === 'srt');
      if (cue) cues.push(cue);
    }
    block = [];
  };
  for (const line of lines) {
    if (line.trim() === '') flush();
    else block.push(line);
  }
  flush();
  return cues;
};

const parseJsonTranscript = (value: unknown): TranscriptCue[] => {
  if (!Array.isArray(value)) return [];
  const cues: TranscriptCue[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const object = entry as Record<string, unknown>;
    const spans = Array.isArray(object.spans) ? object.spans : [object];
    for (const spanValue of spans) {
      if (!spanValue || typeof spanValue !== 'object') continue;
      const span = spanValue as Record<string, unknown>;
      const textValue = span.text ?? span.value ?? span.chars;
      if (typeof textValue !== 'string') continue;
      const cue: TranscriptCue = {
        id: typeof span.id === 'string' ? span.id : `cue-${cues.length}`,
        text: stripMarkup(textValue),
        type: 'cue',
      };
      const start = parseTime((span.begin ?? span.start) as string | number | undefined);
      const end = parseTime((span.end ?? span.stop) as string | number | undefined);
      if (start !== undefined) cue.start = start;
      if (end !== undefined) cue.end = end;
      if (typeof object.speaker === 'string') cue.speaker = object.speaker;
      else if (typeof span.speaker === 'string') cue.speaker = span.speaker;
      cues.push(cue);
    }
  }
  return cues;
};

export const parseTranscript = (
  input: string | unknown,
  format: string,
  options: TranscriptParseOptions = {},
): TranscriptCue[] => {
  const normalizedFormat = format.toLowerCase().split(';')[0] ?? '';
  if (normalizedFormat.includes('json') || (typeof input !== 'string' && typeof input === 'object')) {
    const value = typeof input === 'string' ? JSON.parse(input) as unknown : input;
    return parseJsonTranscript(value);
  }
  if (typeof input !== 'string') return [];
  if (normalizedFormat.includes('vtt') || normalizedFormat === 'vtt') return parseTimedText(input, 'vtt', options);
  if (normalizedFormat.includes('srt') || normalizedFormat.includes('subrip') || normalizedFormat === 'srt') return parseTimedText(input, 'srt', options);
  return input
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}|\n/)
    .map((text) => stripMarkup(text))
    .filter(Boolean)
    .map((text, index) => ({ id: `text-${index}`, text, type: 'text' as const }));
};

const inferFormat = (resource: TranscriptResource, contentType: string | null): string => {
  if (resource.format) return resource.format;
  if (contentType) return contentType;
  const extension = resource.src?.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase();
  return extension ?? 'text/plain';
};

export const loadTranscript = async (
  resource: TranscriptResource,
  options: TranscriptParseOptions & { fetch?: typeof globalThis.fetch; requestInit?: RequestInit } = {},
): Promise<TranscriptCue[]> => {
  if (resource.cues) return resource.cues;
  if (!resource.src) return [];
  if (resource.format?.includes('wordprocessingml') || /\.docx(?:$|[?#])/i.test(resource.src)) {
    throw new Error('DOCX transcripts are not supported.');
  }
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error('No fetch implementation is available to load the transcript.');
  const response = await fetcher(resource.src, options.requestInit);
  if (!response.ok) throw new Error(`Unable to load transcript (${response.status} ${response.statusText}).`);
  const contentType = response.headers.get('content-type');
  const format = inferFormat(resource, contentType);
  if (format.includes('json')) return parseTranscript(await response.json(), format, options);
  return parseTranscript(await response.text(), format, options);
};
