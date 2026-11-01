/** RAMP 5.1.1 ships no TypeScript declarations. Only the public props used here. */
declare module '@samvera/ramp' {
  import type { ComponentType, ReactNode } from 'react';
  export const IIIFPlayer: ComponentType<{
    manifest?: object;
    manifestUrl?: string;
    startCanvasId?: string;
    startCanvasTime?: number;
    children?: ReactNode;
  }>;
  export const MediaPlayer: ComponentType<{
    enablePlaybackRate?: boolean;
    enablePIP?: boolean;
    enableFileDownload?: boolean;
    enableTitleLink?: boolean;
    withCredentials?: boolean;
    language?: string;
    resumeCache?: { enable?: boolean; ttlDays?: number; maxItems?: number };
  }>;
}

/** A stylesheet's text, for adopting inside a shadow root. */
declare module '*.css?inline' {
  const css: string;
  export default css;
}
