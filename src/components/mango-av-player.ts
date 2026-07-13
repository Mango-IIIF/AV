import { AVControllerElement } from './controller-element';
import { componentTheme } from './component-styles';
import { ensureMediaChrome } from './media-chrome';
import type { AVCanvas, AVManifest, AVPlayerConfig, AVPlayerEventMap, JsonObject, MediaSource } from '../types';
import { escapeHtml, formatString, resolveStrings } from '../utils';

let hlsElementRegistration: Promise<unknown> | undefined;
const ensureHlsElement = (): Promise<unknown> => {
  hlsElementRegistration ??= import('hls-video-element');
  return hlsElementRegistration;
};

const styles = `${componentTheme}
  :host { --mango-av-player-aspect-ratio: 16 / 9; }
  .player { background: #08080a; border-radius: var(--mango-av-radius); color: white; overflow: clip; position: relative; }
  media-controller { display: block; width: 100%; }
  media-controller:not([audio]) { aspect-ratio: var(--mango-av-player-aspect-ratio); }
  video, hls-video { display: block; height: 100%; object-fit: contain; width: 100%; }
  audio { width: 100%; }
  media-control-bar { width: 100%; }
  .audio-art { align-items: center; aspect-ratio: 16 / 7; background: linear-gradient(135deg, var(--mango-av-accent), #111); display: flex; justify-content: center; padding: 2rem; text-align: center; }
  .audio-art span { font-size: clamp(1.1rem, 3vw, 2rem); font-weight: 700; }
  .toolbar { align-items: center; background: #151518; display: flex; flex-wrap: wrap; gap: .5rem; justify-content: space-between; padding: .55rem .7rem; }
  .toolbar button, .toolbar select { background: #29292e; border: 1px solid #44444a; border-radius: .35rem; color: white; padding: .4rem .55rem; }
  .group { align-items: center; display: flex; gap: .45rem; }
  .error { background: #fff0f0; color: #8a1717; padding: 1rem; }
  .sr-only { clip: rect(0,0,0,0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px; }
`;

export class MangoAVPlayerElement extends AVControllerElement {
  static observedAttributes = ['manifest-url', 'config'];

  #root: ShadowRoot;
  #manifestInput: JsonObject | string | undefined;
  #config: AVPlayerConfig = {};
  #resolvedSourceUrl: string | undefined;
  #sourceToken = 0;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
  }

  get manifest(): JsonObject | string | undefined {
    return this.#manifestInput;
  }

  set manifest(value: JsonObject | string | undefined) {
    this.#manifestInput = value;
    if (this.isConnected && value !== undefined) void this.load(value);
  }

  get config(): AVPlayerConfig {
    return this.#config;
  }

  set config(value: AVPlayerConfig) {
    this.#config = value;
    this.controller.configure(value);
    this.#render();
  }

  override connectedCallback(): void {
    this.#readConfigAttribute();
    void ensureMediaChrome(this.controller.config.preferredLanguages[0]);
    super.connectedCallback();
    const source = this.#manifestInput ?? this.getAttribute('manifest-url') ?? undefined;
    if (source !== undefined && !this.controller.manifest) void this.load(source);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.isConnected || oldValue === newValue) return;
    if (name === 'manifest-url' && newValue) {
      this.#manifestInput = newValue;
      void this.load(newValue);
    } else if (name === 'config') {
      this.#readConfigAttribute();
      this.#render();
    }
  }

  async load(input: JsonObject | string): Promise<AVManifest> {
    this.#manifestInput = input;
    return await this.controller.load(input);
  }

  play(): Promise<void> { return this.controller.play(); }
  pause(): void { this.controller.pause(); }
  seekTo(time: number): void { this.controller.seekTo(time); }
  selectCanvas(indexOrId: number | string, options?: { time?: number; autoplay?: boolean }): AVCanvas | undefined {
    return this.controller.selectCanvas(indexOrId, options);
  }

  protected controllerChanged(): void {
    this.#render();
  }

  protected handleControllerEvent<K extends keyof AVPlayerEventMap>(type: K, event: CustomEvent<AVPlayerEventMap[K]>): void {
    if (type === 'av-configchange') {
      this.#resolvedSourceUrl = undefined;
      void ensureMediaChrome(this.controller.config.preferredLanguages[0]).then(() => {
        this.#render();
        void this.#resolveSource();
      });
    } else if (type === 'av-ready' || type === 'av-canvaschange' || type === 'av-sourcechange' || type === 'av-error') {
      this.#resolvedSourceUrl = undefined;
      if (this.controller.source?.isHls) void ensureHlsElement();
      this.#render();
      void this.#resolveSource();
    }
    this.dispatchEvent(new CustomEvent(type, { detail: event.detail, bubbles: true, composed: true }));
  }

  #readConfigAttribute(): void {
    const value = this.getAttribute('config');
    if (!value) return;
    try {
      this.#config = JSON.parse(value) as AVPlayerConfig;
      this.controller.configure(this.#config);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
    }
  }

  #render(): void {
    const state = this.controller.state;
    const canvas = this.controller.canvas;
    const source = this.controller.source;
    const ui = resolveStrings(this.controller.config.strings);
    this.#root.innerHTML = `<style>${styles}</style>
      <div class="player">
        ${state.status === 'loading' ? `<p role="status">${escapeHtml(ui.loadingManifest)}</p>` : ''}
        ${state.status === 'error' ? `<div class="error" role="alert">${escapeHtml(state.error?.message ?? ui.unableToLoadMedia)}</div>` : ''}
        ${canvas && source ? this.#readyHtml(canvas, source) : state.status !== 'loading' && state.status !== 'error' ? `<div class="audio-art"><span>${escapeHtml(ui.noMediaLoaded)}</span></div>` : ''}
      </div>`;
    const media = this.#root.querySelector('video, audio, hls-video') as HTMLMediaElement | null;
    if (media) this.controller.attachMedia(media);
    this.#bind();
  }

  #readyHtml(canvas: AVCanvas, source: MediaSource): string {
    const controls = this.controller.config.controls;
    const manifest = this.controller.manifest;
    const kind = source.kind;
    const ui = resolveStrings(this.controller.config.strings);
    const language = this.controller.config.preferredLanguages.find((value) => value !== 'none');
    return `<media-controller ${kind === 'audio' ? 'audio' : ''} ${language ? `lang="${escapeHtml(language)}"` : ''}>
      ${kind === 'audio' ? `<div class="audio-art"><span>${escapeHtml(canvas.label)}</span></div>` : ''}
      ${this.#mediaHtml(canvas, source)}
      <slot name="overlay"></slot>
      <slot name="controls">
        <media-control-bar>
          <media-play-button></media-play-button>
          ${controls.seek ? `<media-seek-backward-button seekoffset="${controls.skipSeconds ?? 10}"></media-seek-backward-button><media-seek-forward-button seekoffset="${controls.skipSeconds ?? 10}"></media-seek-forward-button>` : ''}
          <media-time-display showduration></media-time-display>
          ${controls.seek ? '<media-time-range></media-time-range>' : ''}
          ${controls.volume ? '<media-mute-button></media-mute-button><media-volume-range></media-volume-range>' : ''}
          ${controls.captions && canvas.tracks.length > 0 ? '<media-captions-menu-button></media-captions-menu-button>' : ''}
          ${controls.playbackRate ? '<media-playback-rate-menu-button></media-playback-rate-menu-button>' : ''}
          ${controls.pictureInPicture && kind === 'video' ? '<media-pip-button></media-pip-button>' : ''}
          ${controls.fullscreen && kind === 'video' ? '<media-fullscreen-button></media-fullscreen-button>' : ''}
        </media-control-bar>
        ${controls.captions && canvas.tracks.length > 0 ? '<media-captions-menu hidden></media-captions-menu>' : ''}
        ${controls.playbackRate ? `<media-playback-rate-menu rates="${this.controller.config.playbackRates.join(' ')}" hidden></media-playback-rate-menu>` : ''}
      </slot>
    </media-controller>
    <div class="toolbar">
      <div class="group">
        <button type="button" data-action="previous" ${canvas.index === 0 ? 'disabled' : ''} aria-label="${escapeHtml(ui.previousSection)}">← ${escapeHtml(ui.previous)}</button>
        <button type="button" data-action="next" ${canvas.index === (manifest?.canvases.length ?? 1) - 1 && !this.controller.state.repeat ? 'disabled' : ''} aria-label="${escapeHtml(ui.nextSection)}">${escapeHtml(ui.next)} →</button>
      </div>
      <div class="group">
        ${controls.sourceSelector && canvas.sources.length > 1 ? `<label><span class="sr-only">${escapeHtml(ui.mediaSource)}</span><select data-action="source">${canvas.sources.map((item, index) => `<option value="${index}" ${index === this.controller.state.sourceIndex ? 'selected' : ''}>${escapeHtml(item.label ?? item.format ?? formatString(ui.sourceNumber, { number: index + 1 }))}</option>`).join('')}</select></label>` : ''}
        <label><input type="checkbox" data-action="auto-advance" ${this.controller.state.autoAdvance ? 'checked' : ''}> ${escapeHtml(ui.autoAdvance)}</label>
      </div>
    </div>`;
  }

  #mediaHtml(canvas: AVCanvas, source: MediaSource): string {
    const tag = source.isHls ? 'hls-video' : source.kind;
    const sourceUrl = this.#resolvedSourceUrl ?? (this.controller.config.resolveRequest ? '' : source.src);
    const attributes = [
      'slot="media"',
      sourceUrl ? `src="${escapeHtml(sourceUrl)}"` : '',
      `preload="${this.controller.config.preload}"`,
      this.controller.config.crossorigin ? `crossorigin="${this.controller.config.crossorigin}"` : '',
      source.kind === 'video' && canvas.poster ? `poster="${escapeHtml(canvas.poster)}"` : '',
      `aria-label="${escapeHtml(canvas.label)}"`,
      `data-canvasindex="${canvas.index}"`,
    ].filter(Boolean).join(' ');
    const tracks = canvas.tracks.map((track) => `<track src="${escapeHtml(track.src)}" kind="${track.kind}" label="${escapeHtml(track.label)}" ${track.language ? `srclang="${escapeHtml(track.language)}"` : ''} ${track.default ? 'default' : ''}>`).join('');
    return `<${tag} ${attributes}>${tracks}</${tag}>`;
  }

  #bind(): void {
    this.#root.querySelector<HTMLElement>('[data-action=previous]')?.addEventListener('click', () => this.controller.previous({ autoplay: this.controller.state.status === 'playing' }));
    this.#root.querySelector<HTMLElement>('[data-action=next]')?.addEventListener('click', () => this.controller.next({ autoplay: this.controller.state.status === 'playing' }));
    this.#root.querySelector<HTMLSelectElement>('[data-action=source]')?.addEventListener('change', (event) => this.controller.selectSource(Number((event.target as HTMLSelectElement).value)));
    this.#root.querySelector<HTMLInputElement>('[data-action=auto-advance]')?.addEventListener('change', (event) => this.controller.setAutoAdvance((event.target as HTMLInputElement).checked));
  }

  async #resolveSource(): Promise<void> {
    if (!this.controller.config.resolveRequest) return;
    const token = ++this.#sourceToken;
    try {
      const url = await this.controller.resolvedSourceUrl();
      if (token !== this.#sourceToken || !url) return;
      this.#resolvedSourceUrl = url;
      this.#root.querySelector('video, audio, hls-video')?.setAttribute('src', url);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
    }
  }
}

export const defineMangoAVPlayer = (tagName = 'mango-av-player'): typeof MangoAVPlayerElement => {
  if (typeof customElements === 'undefined') return MangoAVPlayerElement;
  if (!customElements.get(tagName)) customElements.define(tagName, MangoAVPlayerElement);
  return MangoAVPlayerElement;
};
