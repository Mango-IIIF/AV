import type { AVStrings, JsonObject, LocalizedValue, TimeSpan } from './types';
import { defaultStrings } from './types';

export const asObject = (value: unknown): JsonObject | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;

export const asArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

export const readId = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  const object = asObject(value);
  const id = object?.id ?? object?.['@id'];
  return typeof id === 'string' ? id : undefined;
};

export const readType = (value: unknown): string | undefined => {
  const object = asObject(value);
  const type = object?.type ?? object?.['@type'];
  return typeof type === 'string' ? type : undefined;
};

export const languageValues = (value: unknown): LocalizedValue[] => {
  if (typeof value === 'string') return [{ value }];
  if (Array.isArray(value)) {
    return value.flatMap((item) => languageValues(item));
  }
  const object = asObject(value);
  if (!object) return [];
  if (typeof object['@value'] === 'string') {
    const result: LocalizedValue = { value: object['@value'] };
    if (typeof object['@language'] === 'string') result.language = object['@language'];
    return [result];
  }
  return Object.entries(object).flatMap(([language, values]) =>
    asArray(values).flatMap((item) =>
      typeof item === 'string'
        ? [{ language, value: item }]
        : languageValues(item).map((entry) => ({ ...entry, language: entry.language ?? language })),
    ),
  );
};

export const label = (
  value: unknown,
  preferredLanguages: string[] = ['en', 'none'],
  fallback = '',
): string => {
  const values = languageValues(value);
  for (const language of preferredLanguages) {
    const match = values.find((item) => item.language === language);
    if (match) return match.value;
  }
  return values[0]?.value ?? fallback;
};

export const parseTime = (value: string | number | undefined): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (!value) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const parts = value.replace(',', '.').split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return undefined;
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return undefined;
};

export const parseTemporalFragment = (target: unknown): TimeSpan | undefined => {
  let fragment: string | undefined;
  if (typeof target === 'string') fragment = target.split('#')[1];
  const object = asObject(target);
  if (!fragment && object) {
    const selector = asObject(object.selector);
    const value = selector?.value;
    if (typeof value === 'string') fragment = value.replace(/^#/, '');
    if (selector?.type === 'PointSelector' && typeof selector.t === 'number') {
      return { start: selector.t };
    }
  }
  const time = fragment?.match(/(?:^|&)t=([^&]+)/)?.[1];
  if (!time) return undefined;
  const [startValue, endValue] = time.split(',');
  const start = parseTime(startValue);
  const end = parseTime(endValue);
  if (start === undefined) return undefined;
  return end === undefined ? { start } : { start, end };
};

export const withoutFragment = (value: string): string => value.split('#')[0] ?? value;

export const isHls = (src: string, format?: string): boolean =>
  /(?:\.m3u8)(?:$|[?#])/i.test(src) ||
  format === 'application/vnd.apple.mpegurl' ||
  format === 'application/x-mpegURL';

export const mediaKind = (type?: string, format?: string, src = ''): 'audio' | 'video' | undefined => {
  const normalizedType = type?.toLowerCase().trim();
  const normalizedFormat = format?.toLowerCase().split(';', 1)[0]?.trim();
  const typeName = normalizedType?.split(/[:/#]/).pop();

  // IIIF type and MIME metadata are authoritative. Sound and MovingImage are
  // the Presentation 2/DCMI aliases for Audio and Video resources.
  if (typeName === 'audio' || typeName === 'sound' || normalizedFormat?.startsWith('audio/')) return 'audio';
  if (
    typeName === 'video' ||
    typeName === 'movingimage' ||
    normalizedFormat?.startsWith('video/') ||
    normalizedFormat === 'application/vnd.apple.mpegurl' ||
    normalizedFormat === 'application/x-mpegurl'
  ) return 'video';
  if (normalizedType || normalizedFormat) return undefined;

  // With no metadata, inspect only the resource path's extension. Directory
  // names such as `/video/poster.png` must not determine the media kind.
  const pathname = src.toLowerCase().split(/[?#]/, 1)[0] ?? '';
  if (/\.(?:mp3|m4a|wav|aac)$/.test(pathname)) return 'audio';
  if (/\.(?:mp4|webm|m3u8)$/.test(pathname)) return 'video';
  return undefined;
};

export const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return '0:00';
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remaining = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`;
};

export const resolveStrings = (strings: Partial<AVStrings> = {}): AVStrings => ({
  ...defaultStrings,
  ...strings,
});

export const formatString = (
  template: string,
  values: Record<string, string | number> = {},
): string => template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
  Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder,
);

export const mergeConfig = <T extends Record<string, unknown>>(base: T, update: Partial<T>): T => {
  const result = { ...base } as T;
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined && asObject(value) && asObject(result[key])) {
      result[key as keyof T] = mergeConfig(
        asObject(result[key]) as Record<string, unknown>,
        asObject(value) as Record<string, unknown>,
      ) as T[keyof T];
    } else if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;',
  })[character] ?? character);
