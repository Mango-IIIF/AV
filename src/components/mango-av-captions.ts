import { AVControllerElement } from './controller-element';
import { componentTheme } from './component-styles';
import { loadCues } from './transcript-cues';
import type { AVPlayerEventMap, TranscriptCue } from '../types';
import { escapeHtml, resolveStrings } from '../utils';

/*
 * Colours are read with fallbacks rather than set on :host, so a player can
 * restyle captions it holds, as it does over video, from its own stylesheet.
 */
const styles = `${componentTheme}
  :host([hidden]) { display: none; }
  .captions {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--mango-av-captions-padding, 4px 16px 16px);
    text-align: center;
  }
  .line { margin: 0; max-width: 40em; }
  .line:empty { display: none; }
  .current {
    background: var(--mango-av-captions-background, transparent);
    border-radius: 4px;
    color: var(--mango-av-captions-color, var(--mango-av-text));
    font-size: var(--mango-av-captions-size, 18px);
    font-weight: 600;
    line-height: 1.4;
    padding: 2px 8px;
  }
  .current.changed { animation: rise 280ms ease-out; }
  .context {
    background: var(--mango-av-captions-background, transparent);
    border-radius: 4px;
    color: var(--mango-av-captions-color, var(--mango-av-muted));
    font-size: 14px;
    line-height: 1.4;
    opacity: .6;
    padding: 0 8px;
  }
  .speaker { display: block; font-size: 11px; font-weight: 700; letter-spacing: .05em; opacity: .75; text-transform: uppercase; }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
  @media (prefers-reduced-motion: reduce) { .current.changed { animation: none; } }
`;

const lineHtml = (cue: TranscriptCue | undefined): string =>
  cue ? `${cue.speaker ? `<span class="speaker">${escapeHtml(cue.speaker)}</span>` : ''}${escapeHtml(cue.text)}` : '';

/**
 * The line being spoken, as captions are shown on video, with the lines
 * either side faded. Reads the active Canvas transcript through the controller,
 * so it can sit anywhere: inside a player's `stage` slot, or in a layout of
 * the host's own.
 *
 * Attributes: `line` shows only the line being spoken; `audio-only` hides it
 * while a video plays, since video has captions of its own.
 */
export class MangoAVCaptionsElement extends AVControllerElement {
  static observedAttributes = ['line', 'audio-only'];

  #root: ShadowRoot;
  #cues: TranscriptCue[] = [];
  #loadToken = 0;
  #shown: string | undefined;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  protected controllerChanged(): void {
    this.#reset();
  }

  protected handleControllerEvent<K extends keyof AVPlayerEventMap>(type: K, _event: CustomEvent<AVPlayerEventMap[K]>): void {
    if (type === 'av-ready' || type === 'av-canvaschange') this.#reset();
    else if (type === 'av-configchange' || type === 'av-sourcechange') this.#render();
    else if (type === 'av-timeupdate' || type === 'av-seek' || type === 'av-statechange') this.#sync();
  }

  #reset(): void {
    this.#cues = [];
    this.#render();
    void this.#load();
  }

  async #load(): Promise<void> {
    const resource = this.controller.canvas?.transcripts[0];
    if (!resource) return;
    const token = ++this.#loadToken;
    try {
      const cues = await loadCues(this.controller, resource);
      if (token !== this.#loadToken) return;
      this.#cues = cues.filter((cue) => cue.type === 'cue' && cue.start !== undefined);
    } catch (cause) {
      if (token !== this.#loadToken) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
      this.#cues = [];
    }
    this.#render();
  }

  #render(): void {
    const ui = resolveStrings(this.controller.config.strings);
    const context = !this.hasAttribute('line');
    this.#root.innerHTML = `<style>${styles}</style><div class="captions" role="region" aria-label="${escapeHtml(ui.captions)}">
      ${context ? '<p class="line context" data-line="previous"></p>' : ''}
      <p class="line current" data-line="current"></p>
      ${context ? '<p class="line context" data-line="next"></p>' : ''}
    </div>`;
    this.#shown = undefined;
    this.#sync();
  }

  #sync(): void {
    const playingVideo = this.hasAttribute('audio-only') && this.controller.source?.kind === 'video';
    this.hidden = this.#cues.length === 0 || playingVideo;
    if (this.hidden) return;
    const time = this.controller.state.currentTime;
    // The line being spoken is the last one started, until the next begins or it ends.
    let current = -1;
    this.#cues.forEach((cue, index) => {
      if ((cue.start ?? 0) <= time && (cue.end === undefined || time < cue.end)) current = index;
    });
    const upcoming = this.#cues.findIndex((cue) => (cue.start ?? 0) > time);
    const next = current >= 0 ? current + 1 : upcoming;
    const previous = current >= 0 ? current - 1 : (upcoming >= 0 ? upcoming : this.#cues.length) - 1;
    const key = `${previous}:${current}:${next}`;
    if (key === this.#shown) return;
    const changed = this.#shown?.split(':')[1] !== String(current);
    this.#shown = key;
    const line = (name: string) => this.#root.querySelector<HTMLElement>(`[data-line=${name}]`);
    const currentLine = line('current');
    if (currentLine) {
      currentLine.innerHTML = lineHtml(this.#cues[current]);
      // Restart the entrance each time the spoken line changes.
      if (changed && current >= 0) {
        currentLine.classList.remove('changed');
        void currentLine.offsetWidth;
        currentLine.classList.add('changed');
      }
    }
    const previousLine = line('previous');
    if (previousLine) previousLine.innerHTML = lineHtml(this.#cues[previous]);
    const nextLine = line('next');
    if (nextLine) nextLine.innerHTML = lineHtml(this.#cues[next]);
  }
}

export const defineMangoAVCaptions = (tagName = 'mango-av-captions'): typeof MangoAVCaptionsElement => {
  if (typeof customElements === 'undefined') return MangoAVCaptionsElement;
  if (!MangoAVCaptionsElement.registeredTag && !customElements.get(tagName)) {
    customElements.define(tagName, MangoAVCaptionsElement);
    MangoAVCaptionsElement.registeredTag = tagName;
  }
  return MangoAVCaptionsElement;
};
