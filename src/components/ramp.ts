/*
 * RAMP (Samvera, React + Video.js) mounted as an island inside a custom
 * element. Loaded with a dynamic import, so React and Video.js are only
 * fetched once a player renders.
 *
 * RAMP owns the controls and the media element. The controller attaches to
 * that element, so its state, events and seeks work as they do for any media.
 */

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { IIIFPlayer, MediaPlayer } from '@samvera/ramp';
import type { JsonObject } from '../types';

/* RAMP's stylesheet as text, since the player renders inside a shadow root. */
export { default as rampCss } from '@samvera/ramp/dist/ramp.css?inline';

export interface RampMountOptions {
  manifest: JsonObject;
  language: string;
  playbackRate: boolean;
  playbackRates: number[];
  pictureInPicture: boolean;
  download: boolean;
  withCredentials: boolean;
  resume: { enable: boolean; ttlDays: number; maxItems: number };
  /** Seconds for the skip buttons; none when omitted. */
  skipSeconds?: number;
  /** Called with each media element RAMP plays through. */
  onMedia: (media: HTMLMediaElement) => void;
}

export interface RampHandle {
  destroy(): void;
}

interface Component {
  name(): string;
  el(): HTMLElement;
}

/** The slice of RAMP's Video.js player used here. */
interface Player {
  isDisposed(): boolean;
  ready(callback: () => void): void;
  removeClass(name: string): void;
  playbackRates?(rates: number[]): void;
  controlBar?: {
    children(): Component[];
    getChild(name: string): Component | undefined;
    addChild(name: string, options: JsonObject, index: number): Component;
  };
}

/* Video.js only offers these lengths; it hides a skip button set to any other. */
const skipLengths = [5, 10, 30];
const nearestSkip = (seconds: number): number =>
  skipLengths.reduce((best, value) => (Math.abs(value - seconds) < Math.abs(best - seconds) ? value : best));

/*
 * RAMP bundles its own Video.js, so its players are not in the registry of any
 * `video.js` this package could import. Video.js puts the player on its
 * element; finding it inside this island also keeps two players apart.
 */
const findPlayer = (host: HTMLElement): Player | undefined =>
  (host.querySelector('.video-js') as (HTMLElement & { player?: Player }) | null)?.player;

const findMedia = (host: HTMLElement): HTMLMediaElement | null =>
  host.querySelector<HTMLMediaElement>('video.vjs-tech, audio.vjs-tech');

const svg = 'http://www.w3.org/2000/svg';

/*
 * Video.js's skip icons are a large number with a small arrow in its corner,
 * heavier than the icons beside them. This draws the usual circular arrow
 * with the length inside, at the weight of the play and volume icons.
 */
const skipIcon = (direction: 'backward' | 'forward', length: number): SVGSVGElement => {
  const icon = document.createElementNS(svg, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('class', 'vjs-svg-icon');
  icon.setAttribute('aria-hidden', 'true');
  // An open circle round the number, its arrowhead at the top pointing the way it skips.
  const arrow = document.createElementNS(svg, 'path');
  arrow.setAttribute('d', 'M12 6A7 7 0 1 1 5.94 9.5M14.5 3.5 12 6l2.5 2.5');
  arrow.setAttribute('fill', 'none');
  arrow.setAttribute('stroke', 'currentColor');
  arrow.setAttribute('stroke-width', '2');
  arrow.setAttribute('stroke-linecap', 'round');
  arrow.setAttribute('stroke-linejoin', 'round');
  if (direction === 'forward') arrow.setAttribute('transform', 'matrix(-1 0 0 1 24 0)');
  const label = document.createElementNS(svg, 'text');
  label.setAttribute('x', '12');
  label.setAttribute('y', '15.6');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('fill', 'currentColor');
  label.setAttribute('font-family', 'system-ui, sans-serif');
  label.setAttribute('font-size', '7');
  label.setAttribute('font-weight', '700');
  label.textContent = String(length);
  icon.append(arrow, label);
  return icon;
};

const addSkipButtons = (player: Player, seconds: number): void => {
  const bar = player.controlBar;
  if (!bar || bar.getChild('SkipBackward')) return;
  const length = nearestSkip(seconds);
  const index = bar.children().findIndex((child) => child.name() === 'PlayToggle') + 1;
  // Video.js reads the length from player options it took at creation, so hand it over directly.
  const options = (direction: 'backward' | 'forward') => ({
    playerOptions: { controlBar: { skipButtons: { [direction]: length } } },
  });
  const backward = bar.addChild('SkipBackward', options('backward'), index);
  const forward = bar.addChild('SkipForward', options('forward'), index + 1);
  backward.el().querySelector('svg')?.replaceWith(skipIcon('backward', length));
  forward.el().querySelector('svg')?.replaceWith(skipIcon('forward', length));
};

export const mountRamp = (host: HTMLElement, options: RampMountOptions): RampHandle => {
  const root = createRoot(host);
  root.render(
    createElement(
      IIIFPlayer,
      { manifest: options.manifest },
      createElement(MediaPlayer, {
        enablePlaybackRate: options.playbackRate,
        enablePIP: options.pictureInPicture,
        enableFileDownload: options.download,
        withCredentials: options.withCredentials,
        language: options.language,
        resumeCache: options.resume,
      }),
    ),
  );

  let player: Player | undefined;
  let media: HTMLMediaElement | null = null;

  // RAMP creates its player asynchronously, and Video.js may swap the media element.
  const timer = setInterval(() => {
    const current = findPlayer(host);
    if (current && !current.isDisposed() && current !== player) {
      player = current;
      current.ready(() => {
        // Use Video.js's own skin, a solid bar under the picture, rather than RAMP's overlay theme.
        current.removeClass('vjs-theme-ramp');
        if (options.playbackRate && options.playbackRates.length > 0) current.playbackRates?.(options.playbackRates);
        if (options.skipSeconds) addSkipButtons(current, options.skipSeconds);
      });
    }
    const element = findMedia(host);
    if (element && element !== media) {
      media = element;
      options.onMedia(element);
    }
  }, 150);

  return {
    destroy() {
      clearInterval(timer);
      root.unmount();
    },
  };
};
