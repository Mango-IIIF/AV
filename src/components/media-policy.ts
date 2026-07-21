import type { AVAudioVisualizerMode } from '../types';

export interface AudioMediaPolicy {
  crossOrigin?: 'anonymous' | 'use-credentials';
  implicitCors: boolean;
  visualize: boolean;
}

const isCrossOriginHttp = (sourceUrl: string): boolean => {
  try {
    const url = new URL(sourceUrl, document.baseURI);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== location.origin;
  } catch {
    return false;
  }
};

export const resolveAudioMediaPolicy = (
  sourceUrl: string,
  configuredCrossOrigin: 'anonymous' | 'use-credentials' | '',
  crossOriginExplicit: boolean,
  visualizerMode: AVAudioVisualizerMode | undefined,
  fallback: boolean,
): AudioMediaPolicy => {
  const crossOrigin = isCrossOriginHttp(sourceUrl);
  const implicitCors = Boolean(visualizerMode) && crossOrigin && !crossOriginExplicit && !fallback;
  const selectedCrossOrigin = implicitCors ? 'anonymous' : configuredCrossOrigin || undefined;
  // Explicit no-CORS loading is respected, but a cross-origin element loaded that
  // way cannot safely be connected to Web Audio without risking silent output.
  const visualize = Boolean(visualizerMode) && !fallback && !(crossOrigin && !selectedCrossOrigin);
  return {
    ...(selectedCrossOrigin ? { crossOrigin: selectedCrossOrigin } : {}),
    implicitCors,
    visualize,
  };
};

export const applyMediaSource = (
  media: HTMLMediaElement,
  sourceUrl: string,
  crossOrigin?: 'anonymous' | 'use-credentials',
): void => {
  if (crossOrigin) media.crossOrigin = crossOrigin;
  else media.removeAttribute('crossorigin');
  media.src = sourceUrl;
};
