import { AVControllerElement } from './controller-element';
import { componentTheme } from './component-styles';
import { rampManifest } from './ramp-manifest';
import type { RampHandle } from './ramp';
import type { AVCanvas, AVManifest, AVPlayerConfig, AVPlayerEventMap, JsonObject, MediaSource } from '../types';
import { escapeHtml, formatString, resolveStrings } from '../utils';

type RampModule = typeof import('./ramp');
let rampModule: Promise<RampModule> | undefined;
const loadRamp = (): Promise<RampModule> => {
  rampModule ??= import('./ramp');
  return rampModule;
};

const styles = `${componentTheme}
  :host { --mango-av-player-aspect-ratio: 16 / 9; }
  .player { container-type: inline-size; display: flex; flex-direction: column; gap: 12px; }
  .stage { background: #000; border-radius: var(--mango-av-radius); overflow: hidden; width: 100%; }
  .player[data-kind='audio'] .stage { background: var(--mango-av-surface); }
  /*
   * The stage slot holds content shown with the media, such as captions: in the
   * audio card above the controls, or over the foot of a video, clear of its
   * controls and letting clicks through to the player.
   */
  .player[data-kind='video'] .stage { position: relative; }
  .player[data-kind='video'] .stage-slot { bottom: 44px; left: 0; pointer-events: none; position: absolute; right: 0; z-index: 2; }
  .player[data-kind='video'] slot[name=stage]::slotted(*) {
    --mango-av-captions-background: rgb(0 0 0 / .72);
    --mango-av-captions-color: #fff;
    --mango-av-captions-padding: 0 16px;
  }
  .cover { align-items: center; display: flex; gap: 16px; padding: 16px; }
  .cover img { border-radius: 8px; height: 96px; object-fit: cover; width: 96px; }
  .cover h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 400; margin: 4px 0 0; }
  .eyebrow { color: var(--mango-av-muted); font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .status { color: var(--mango-av-muted); font-size: 14px; margin: 0; padding: 16px; }
  .error { color: var(--mango-av-danger); font-size: 14px; margin: 0; padding: 16px; }
  .toolbar { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }
  .group { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; font-size: 14px; }
  .toolbar button, .toolbar select {
    background: var(--mango-av-surface);
    border: 1px solid var(--mango-av-border);
    border-radius: 6px;
    color: inherit;
    height: 34px;
    padding: 0 10px;
  }
  .toolbar button:disabled { cursor: default; opacity: .5; }
  .sr-only { clip: rect(0,0,0,0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px; }

  /*
   * The player wears Video.js's default skin: ramp.ts takes off RAMP's
   * vjs-theme-ramp once the player is ready. Until then, and on any element
   * that keeps the class, don't let the theme's 490 x 270px minimum push the
   * player past a narrow column.
   */
  .ramp .vjs-theme-ramp { min-height: 0; min-width: 0; }
  /* Video.js keeps the bar hidden until playback starts; show it from the start, as before. */
  .ramp .video-js:not(.vjs-has-started) .vjs-control-bar { display: flex; }
  /* RAMP gives audio a 1:0 shape, so the player is the bar alone, in the flow rather than over a picture. */
  .ramp .video-js.vjs-audio-only-mode { height: auto; padding-top: 0; }
  .ramp .vjs-audio-only-mode .vjs-control-bar { position: relative; }
  /* The audio bar is too short to hold its menus, so they open over the card or the page; round its corners instead of clipping. */
  .player[data-kind='audio'] .stage { overflow: visible; }
  .player[data-kind='audio'] .ramp .vjs-control-bar { border-radius: 0 0 var(--mango-av-radius) var(--mango-av-radius); }
  /* RAMP narrows the bar inline, by 24px, to fit its theme's inset. The default skin runs it edge to edge. */
  .ramp .vjs-control-bar { width: 100% !important; }
  /*
   * RAMP's progress bar, and the slider in it, float above the controls even
   * without its theme. Seat them in the bar, growing like Video.js's own.
   */
  .ramp .vjs-control-bar > .vjs-custom-progress-bar { align-self: stretch; flex: auto; height: auto; margin: 0; position: relative; top: auto; width: auto !important; }
  .ramp .vjs-progress-holder.vjs-custom-progress-bar { flex: auto; height: .3em; margin: 0 10px; position: relative; top: auto; width: auto !important; }
  /*
   * Video.js sizes a fluid player with a rule it adds to the document head,
   * which doesn't reach into this shadow root. Give it the video's shape.
   */
  .player[data-kind='video'] .ramp .video-js.vjs-fluid { aspect-ratio: var(--mango-av-player-aspect-ratio); height: auto; padding-top: 0; }
  .player[data-hide~='volume'] .ramp :is(.vjs-volume-panel, .vjs-mute-control) { display: none; }
  .player[data-hide~='seek'] .ramp :is(.vjs-progress-control, .vjs-custom-progress-bar) { display: none; }
  .player[data-hide~='fullscreen'] .ramp .vjs-fullscreen-control { display: none; }
  /* Narrow: drop the controls least needed there, so the rest fit on one row. */
  @container (max-width: 480px) {
    .ramp :is(.vjs-picture-in-picture-control, .vjs-volume-panel) { display: none; }
  }
  @container (max-width: 360px) {
    .ramp :is(.vjs-skip-backward-10, .vjs-skip-backward-5, .vjs-skip-backward-30, .vjs-skip-forward-10, .vjs-skip-forward-5, .vjs-skip-forward-30, .vjs-playback-rate) { display: none; }
  }
`;

export class MangoAVPlayerElement extends AVControllerElement {
  static observedAttributes = ['manifest-url', 'config'];

  /**
   * Whether controller events are re-dispatched from this element. The complete
   * element turns this off for the player inside it, which forwards them itself.
   * @internal
   */
  forwardEvents = true;

  #root: ShadowRoot;
  #manifestInput: JsonObject | string | undefined;
  #config: AVPlayerConfig = {};
  #ramp: RampHandle | undefined;
  #rampCss = '';
  #media: HTMLMediaElement | undefined;
  #mountToken = 0;

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
  }

  override connectedCallback(): void {
    this.#readConfigAttribute();
    super.connectedCallback();
    const source = this.#manifestInput ?? this.getAttribute('manifest-url') ?? undefined;
    if (source !== undefined && !this.controller.manifest) void this.load(source);
  }

  override disconnectedCallback(): void {
    this.#unmount();
    super.disconnectedCallback();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.isConnected || oldValue === newValue) return;
    if (name === 'manifest-url' && newValue) {
      this.#manifestInput = newValue;
      void this.load(newValue);
    } else if (name === 'config') {
      this.#readConfigAttribute();
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
    if (type === 'av-ready' || type === 'av-canvaschange' || type === 'av-sourcechange' || type === 'av-configchange' || type === 'av-loadstart') {
      this.#render();
    } else if (type === 'av-error' && !this.#ramp) {
      // RAMP reports media errors over its own player; only a failed load is shown here.
      this.#render();
    } else if (type === 'av-statechange') {
      this.#syncToolbar();
    }
    if (this.forwardEvents) this.dispatchEvent(new CustomEvent(type, { detail: event.detail, bubbles: true, composed: true }));
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
    this.#unmount();
    const state = this.controller.state;
    const canvas = this.controller.canvas;
    const source = this.controller.source;
    const ui = resolveStrings(this.controller.config.strings);
    let body = '';
    if (state.status === 'loading') body = `<div class="stage"><p class="status" role="status">${escapeHtml(ui.loadingManifest)}</p></div>`;
    else if (state.status === 'error' && !source) body = `<div class="stage"><p class="error" role="alert">${escapeHtml(state.error?.message ?? ui.unableToLoadPlayer)}</p></div>`;
    else if (canvas && source) body = this.#readyHtml(canvas, source);
    else body = `<div class="stage"><p class="status">${escapeHtml(canvas ? ui.noPlayableMedia : ui.noMediaLoaded)}</p></div>`;
    // RAMP's stylesheet goes first, so the adjustments here win its ties.
    this.#root.innerHTML = `<style data-ramp>${this.#rampCss}</style><style>${styles}</style>
      <div class="player" data-kind="${source?.kind ?? 'video'}" data-hide="${this.#hiddenControls()}" style="${this.#aspectStyle(canvas, source)}">${body}</div>`;
    this.#bind();
    const host = this.#root.querySelector<HTMLElement>('.ramp');
    if (host && canvas && source) void this.#mount(host);
  }

  #readyHtml(canvas: AVCanvas, source: MediaSource): string {
    const controls = this.controller.config.controls;
    const manifest = this.controller.manifest;
    const ui = resolveStrings(this.controller.config.strings);
    const title = this.controller.config.audioArt.title || manifest?.label || canvas.label;
    const cover = canvas.poster ?? manifest?.thumbnail;
    const showSourceSelector = controls.sourceSelector && canvas.sources.length > 1;
    const showToolbar = controls.navigation || controls.autoAdvance || showSourceSelector;
    return `<div class="stage" aria-label="${escapeHtml(ui.mediaPlayer)}" role="region">
        ${source.kind === 'audio' ? `<div class="cover">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}
          <div><span class="eyebrow">${escapeHtml(ui.recording)}</span><h2>${escapeHtml(title)}</h2></div>
        </div>` : ''}
        <div class="stage-slot"><slot name="stage"></slot></div>
        <div class="ramp"></div>
      </div>
      <slot name="after-player"></slot>
      ${showToolbar ? `<div class="toolbar">
        ${controls.navigation ? `<div class="group">
          <button type="button" data-action="previous" aria-label="${escapeHtml(ui.previousSection)}">← ${escapeHtml(ui.previous)}</button>
          <button type="button" data-action="next" aria-label="${escapeHtml(ui.nextSection)}">${escapeHtml(ui.next)} →</button>
        </div>` : ''}
        ${showSourceSelector || controls.autoAdvance ? `<div class="group">
          ${showSourceSelector ? `<label><span class="sr-only">${escapeHtml(ui.mediaSource)}</span><select data-action="source">${canvas.sources.map((item, index) => `<option value="${index}" ${index === this.controller.state.sourceIndex ? 'selected' : ''}>${escapeHtml(item.label ?? item.format ?? formatString(ui.sourceNumber, { number: index + 1 }))}</option>`).join('')}</select></label>` : ''}
          ${controls.autoAdvance ? `<label><input type="checkbox" data-action="auto-advance"> ${escapeHtml(ui.autoAdvance)}</label>` : ''}
        </div>` : ''}
      </div>` : ''}`;
  }

  #hiddenControls(): string {
    const controls = this.controller.config.controls;
    return [
      controls.volume ? '' : 'volume',
      controls.seek ? '' : 'seek',
      controls.fullscreen ? '' : 'fullscreen',
    ].filter(Boolean).join(' ');
  }

  #aspectStyle(canvas: AVCanvas | undefined, source: MediaSource | undefined): string {
    const width = source?.width ?? canvas?.width;
    const height = source?.height ?? canvas?.height;
    return width && height ? `--mango-av-player-aspect-ratio: ${width} / ${height}` : '';
  }

  #bind(): void {
    this.#root.querySelector<HTMLElement>('[data-action=previous]')?.addEventListener('click', () => this.controller.previous({ autoplay: this.controller.state.status === 'playing' }));
    this.#root.querySelector<HTMLElement>('[data-action=next]')?.addEventListener('click', () => this.controller.next({ autoplay: this.controller.state.status === 'playing' }));
    this.#root.querySelector<HTMLSelectElement>('[data-action=source]')?.addEventListener('change', (event) => this.controller.selectSource(Number((event.target as HTMLSelectElement).value)));
    this.#root.querySelector<HTMLInputElement>('[data-action=auto-advance]')?.addEventListener('change', (event) => this.controller.setAutoAdvance((event.target as HTMLInputElement).checked));
    this.#syncToolbar();
  }

  #syncToolbar(): void {
    const canvas = this.controller.canvas;
    const count = this.controller.manifest?.canvases.length ?? 0;
    const state = this.controller.state;
    const previous = this.#root.querySelector<HTMLButtonElement>('[data-action=previous]');
    const next = this.#root.querySelector<HTMLButtonElement>('[data-action=next]');
    const autoAdvance = this.#root.querySelector<HTMLInputElement>('[data-action=auto-advance]');
    if (previous) previous.disabled = !canvas || canvas.index === 0;
    if (next) next.disabled = !canvas || (canvas.index >= count - 1 && !state.repeat);
    if (autoAdvance) autoAdvance.checked = state.autoAdvance;
  }

  async #mount(host: HTMLElement): Promise<void> {
    const token = ++this.#mountToken;
    const controller = this.controller;
    const manifest = controller.manifest;
    const canvas = controller.canvas;
    const source = controller.source;
    if (!manifest || !canvas || !source) return;
    try {
      const [src, ramp] = await Promise.all([controller.resolvedSourceUrl(), loadRamp()]);
      if (token !== this.#mountToken || !host.isConnected || !src) return;
      if (!this.#rampCss) {
        this.#rampCss = ramp.rampCss;
        const style = this.#root.querySelector('style[data-ramp]');
        if (style) style.textContent = ramp.rampCss;
      }
      const config = controller.config;
      const { controls } = config;
      const options: Parameters<RampModule['mountRamp']>[1] = {
        manifest: rampManifest(manifest, canvas, source, { src, captions: Boolean(controls.captions), download: Boolean(controls.download) }),
        language: config.preferredLanguages.find((value) => value !== 'none') ?? 'en',
        playbackRate: Boolean(controls.playbackRate),
        playbackRates: config.playbackRates,
        pictureInPicture: Boolean(controls.pictureInPicture) && source.kind === 'video',
        download: Boolean(controls.download),
        withCredentials: config.withCredentials,
        resume: { enable: Boolean(config.resume.enabled), ttlDays: config.resume.ttlDays ?? 30, maxItems: config.resume.maxItems ?? 200 },
        onMedia: (media) => {
          if (token !== this.#mountToken) return;
          this.#media = media;
          controller.attachMedia(media);
        },
      };
      if (controls.seek && controls.skipSeconds) options.skipSeconds = controls.skipSeconds;
      this.#ramp = ramp.mountRamp(host, options);
    } catch (cause) {
      if (token !== this.#mountToken) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
    }
  }

  #unmount(): void {
    this.#mountToken += 1;
    if (this.#media && this.controller.media === this.#media) this.controller.detachMedia();
    this.#media = undefined;
    this.#ramp?.destroy();
    this.#ramp = undefined;
  }
}

export const defineMangoAVPlayer = (tagName = 'mango-av-player'): typeof MangoAVPlayerElement => {
  if (typeof customElements === 'undefined') return MangoAVPlayerElement;
  if (!MangoAVPlayerElement.registeredTag && !customElements.get(tagName)) {
    customElements.define(tagName, MangoAVPlayerElement);
    MangoAVPlayerElement.registeredTag = tagName;
  }
  return MangoAVPlayerElement;
};
