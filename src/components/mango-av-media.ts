import { AVPlayerController } from '../controller';
import { loadTranscript } from '../transcript';
import { ensureMediaChrome } from './media-chrome';
import { playFromInteraction } from './playback';
import type {
  AVAnnotation,
  AVCanvas,
  AVManifest,
  AVPlayerConfig,
  AVPlayerEventMap,
  AVStrings,
  Chapter,
  JsonObject,
  MetadataEntry,
  TranscriptCue,
} from '../types';
import { escapeHtml, formatString, formatTime, resolveStrings } from '../utils';

const HTMLElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

let hlsElementRegistration: Promise<unknown> | undefined;
const ensureHlsElement = (): Promise<unknown> => {
  hlsElementRegistration ??= import('hls-video-element');
  return hlsElementRegistration;
};

const eventTypes: Array<keyof AVPlayerEventMap> = [
  'av-loadstart',
  'av-ready',
  'av-error',
  'av-canvaschange',
  'av-sourcechange',
  'av-play',
  'av-pause',
  'av-timeupdate',
  'av-seek',
  'av-ended',
  'av-annotationschange',
  'av-configchange',
  'av-statechange',
];

const styles = `
  :host {
    --mango-av-accent: #5b3fd6;
    --mango-av-accent-contrast: #fff;
    --mango-av-background: #fff;
    --mango-av-surface: #f5f5f8;
    --mango-av-text: #18181b;
    --mango-av-muted: #62626a;
    --mango-av-border: #d7d7de;
    --mango-av-radius: .65rem;
    --mango-av-font: ui-sans-serif, system-ui, sans-serif;
    --mango-av-panel-width: 24rem;
    --mango-av-player-aspect-ratio: 16 / 9;
    --media-primary-color: var(--mango-av-accent-contrast);
    --media-secondary-color: var(--mango-av-accent);
    color: var(--mango-av-text);
    display: block;
    font-family: var(--mango-av-font);
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, input, select { font: inherit; }
  button, select { cursor: pointer; }
  .shell { background: var(--mango-av-background); border: 1px solid var(--mango-av-border); border-radius: var(--mango-av-radius); overflow: clip; }
  .header { padding: 1rem 1.1rem; }
  .header h2 { font-size: 1.15rem; margin: 0; }
  .header p { color: var(--mango-av-muted); margin: .35rem 0 0; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, var(--mango-av-panel-width)); }
  .player-column { background: #08080a; min-width: 0; position: relative; }
  media-controller { display: block; width: 100%; }
  media-controller:not([audio]) { aspect-ratio: var(--mango-av-player-aspect-ratio); }
  video, hls-video { display: block; height: 100%; object-fit: contain; width: 100%; }
  audio { width: 100%; }
  media-control-bar { width: 100%; }
  .audio-art { align-items: center; aspect-ratio: 16 / 7; background: linear-gradient(135deg, var(--mango-av-accent), #111); color: white; display: flex; justify-content: center; padding: 2rem; text-align: center; }
  .audio-art img { height: 100%; inset: 0; object-fit: contain; position: absolute; width: 100%; }
  .audio-art span { font-size: clamp(1.1rem, 3vw, 2rem); font-weight: 700; }
  .player-toolbar { align-items: center; background: #151518; color: #fff; display: flex; flex-wrap: wrap; gap: .5rem; justify-content: space-between; padding: .55rem .7rem; }
  .player-toolbar button, .player-toolbar select { background: #29292e; border: 1px solid #44444a; border-radius: .35rem; color: white; padding: .4rem .55rem; }
  .player-toolbar .group { align-items: center; display: flex; gap: .45rem; }
  .search-markers { background: #242429; height: .45rem; position: relative; }
  .search-marker { background: #ffe24a; border: 0; border-radius: 50%; height: .7rem; padding: 0; position: absolute; top: 50%; transform: translate(-50%, -50%); width: .7rem; }
  .resume { align-items: center; background: #fff8d7; color: #312900; display: flex; gap: .5rem; justify-content: center; padding: .6rem; }
  .resume button { background: var(--mango-av-accent); border: 0; border-radius: .35rem; color: var(--mango-av-accent-contrast); padding: .35rem .65rem; }
  .panel { border-left: 1px solid var(--mango-av-border); display: flex; flex-direction: column; min-height: 22rem; min-width: 0; }
  .tabs { background: var(--mango-av-surface); display: flex; gap: .1rem; overflow-x: auto; padding: .35rem; }
  .tab { background: transparent; border: 0; border-bottom: 3px solid transparent; color: var(--mango-av-muted); padding: .55rem .6rem; white-space: nowrap; }
  .tab[aria-selected=true] { border-color: var(--mango-av-accent); color: var(--mango-av-text); font-weight: 650; }
  .panel-content { flex: 1; max-height: 34rem; overflow: auto; padding: .85rem; }
  .empty { color: var(--mango-av-muted); font-style: italic; }
  .chapter-list, .annotation-list, .cue-list, .file-list { list-style: none; margin: 0; padding: 0; }
  .chapter-list .chapter-list { border-left: 1px solid var(--mango-av-border); margin-left: .8rem; padding-left: .55rem; }
  .chapter button, .annotation button, .cue button { background: transparent; border: 0; border-radius: .35rem; color: inherit; display: grid; gap: .15rem; padding: .5rem; text-align: left; width: 100%; }
  .chapter button:hover, .annotation button:hover, .cue button:hover { background: var(--mango-av-surface); }
  .chapter button.active, .annotation button.active, .cue button.active { background: color-mix(in srgb, var(--mango-av-accent) 14%, transparent); box-shadow: inset 3px 0 var(--mango-av-accent); }
  .time { color: var(--mango-av-muted); font-size: .78rem; }
  .panel-tools { display: flex; flex-wrap: wrap; gap: .45rem; margin-bottom: .75rem; }
  .panel-tools input, .panel-tools select { border: 1px solid var(--mango-av-border); border-radius: .35rem; min-width: 0; padding: .45rem; }
  .panel-tools input { flex: 1; }
  .panel-tools a { align-content: center; color: var(--mango-av-accent); }
  .cue mark { background: #ffe770; }
  .speaker { font-weight: 700; }
  .tags { display: flex; flex-wrap: wrap; gap: .25rem; }
  .tag { background: var(--mango-av-surface); border-radius: 999px; font-size: .75rem; padding: .15rem .45rem; }
  dl { margin: 0; }
  dt { font-weight: 700; margin-top: .75rem; }
  dd { color: var(--mango-av-muted); margin: .2rem 0 0; }
  .file-list li { border-bottom: 1px solid var(--mango-av-border); padding: .55rem 0; }
  a { color: var(--mango-av-accent); }
  .error { background: #fff0f0; color: #8a1717; padding: 1rem; }
  .sr-only { clip: rect(0,0,0,0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px; }
  @media (max-width: 760px) {
    .layout { grid-template-columns: 1fr; }
    .panel { border-left: 0; border-top: 1px solid var(--mango-av-border); }
  }
`;

const metadataHtml = (entries: MetadataEntry[], ui: AVStrings): string => {
  if (entries.length === 0) return `<p class="empty">${escapeHtml(ui.noMetadata)}</p>`;
  return `<dl>${entries.map((entry) => `
    <dt>${escapeHtml(entry.label)}</dt>
    <dd>${entry.values.map((value) => escapeHtml(value.value)).join('<br>')}</dd>
  `).join('')}</dl>`;
};

const chapterHtml = (chapters: Chapter[], canvasId: string, ui: AVStrings, level = 1): string => {
  if (chapters.length === 0 && level === 1) return `<p class="empty">${escapeHtml(ui.noChapters)}</p>`;
  return `<ul class="chapter-list">${chapters.map((chapter) => {
    const active = chapter.canvasId === canvasId;
    const target = chapter.canvasId ? `data-canvas="${escapeHtml(chapter.canvasId)}"` : '';
    const time = chapter.time ? `data-time="${chapter.time.start}"` : '';
    return `<li class="chapter">
      <button type="button" class="${active ? 'active' : ''}" ${target} ${time} ${chapter.canvasId ? '' : 'disabled'}>
        <span>${escapeHtml(chapter.label)}</span>
        ${chapter.time ? `<span class="time">${formatTime(chapter.time.start)}</span>` : ''}
      </button>
      ${chapterHtml(chapter.children, canvasId, ui, level + 1)}
    </li>`;
  }).join('')}</ul>`;
};

const highlight = (text: string, query: string): string => {
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark>$1</mark>');
};

export class MangoAVMediaElement extends HTMLElementBase {
  static observedAttributes = ['manifest-url', 'config'];

  readonly player: AVPlayerController;
  #root: ShadowRoot;
  #inputManifest: JsonObject | string | undefined;
  #config: AVPlayerConfig = {};
  #activePanel: NonNullable<AVPlayerConfig['activePanel']> = 'chapters';
  #transcriptCues: TranscriptCue[] = [];
  #transcriptIndex = 0;
  #transcriptQuery = '';
  #resumeTime: number | undefined;
  #loadingToken = 0;
  #resolvedSourceUrl: string | undefined;
  #sourceToken = 0;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.player = new AVPlayerController();
    for (const type of eventTypes) {
      this.player.addEventListener(type, ((event: CustomEvent) => {
        if (type === 'av-ready') {
          if (this.player.source?.isHls) void ensureHlsElement();
          this.#resolvedSourceUrl = undefined;
          this.#resumeTime = this.player.getSavedPosition();
          this.#activePanel = this.player.config.activePanel;
          this.#render();
          void this.#resolveSource();
          void this.#loadActiveTranscript();
        } else if (type === 'av-canvaschange' || type === 'av-sourcechange') {
          if (this.player.source?.isHls) void ensureHlsElement();
          this.#resolvedSourceUrl = undefined;
          this.#transcriptCues = [];
          this.#transcriptIndex = 0;
          this.#render();
          void this.#resolveSource();
          void this.#loadActiveTranscript();
        } else if (type === 'av-configchange') {
          this.#activePanel = this.player.config.activePanel;
          void ensureMediaChrome(this.player.config.preferredLanguages[0]).then(() => this.#render());
        } else if (type === 'av-error') {
          this.#render();
        } else if (type === 'av-annotationschange') {
          if (this.#activePanel === 'annotations') this.#renderPanelOnly();
        } else if (type === 'av-timeupdate') {
          this.#syncTimedContent();
        }
        this.dispatchEvent(new CustomEvent(type, {
          detail: event.detail,
          bubbles: true,
          composed: true,
        }));
      }) as EventListener);
    }
  }

  get manifest(): JsonObject | string | undefined {
    return this.#inputManifest;
  }

  get controller(): AVPlayerController {
    return this.player;
  }

  set manifest(value: JsonObject | string | undefined) {
    this.#inputManifest = value;
    if (this.isConnected && value !== undefined) void this.load(value);
  }

  get config(): AVPlayerConfig {
    return this.#config;
  }

  set config(value: AVPlayerConfig) {
    this.#config = value;
    this.player.configure(value);
    this.#activePanel = value.activePanel ?? this.player.config.activePanel;
    if (this.isConnected) this.#render();
  }

  connectedCallback(): void {
    this.#readConfigAttribute();
    void ensureMediaChrome(this.player.config.preferredLanguages[0]);
    this.#render();
    const source = this.#inputManifest ?? this.getAttribute('manifest-url') ?? undefined;
    if (source !== undefined) void this.load(source);
  }

  disconnectedCallback(): void {
    this.player.destroy();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.isConnected || oldValue === newValue) return;
    if (name === 'manifest-url' && newValue) {
      this.#inputManifest = newValue;
      void this.load(newValue);
    }
    if (name === 'config') {
      this.#readConfigAttribute();
      this.#render();
    }
  }

  async load(input: JsonObject | string): Promise<AVManifest> {
    this.#inputManifest = input;
    return await this.player.load(input);
  }

  play(): Promise<void> {
    return this.player.play();
  }

  pause(): void {
    this.player.pause();
  }

  seekTo(time: number): void {
    this.player.seekTo(time);
  }

  selectCanvas(indexOrId: number | string, options?: { time?: number; autoplay?: boolean }): AVCanvas | undefined {
    return this.player.selectCanvas(indexOrId, options);
  }

  #readConfigAttribute(): void {
    const attribute = this.getAttribute('config');
    if (!attribute) return;
    try {
      this.#config = JSON.parse(attribute) as AVPlayerConfig;
      this.player.configure(this.#config);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
    }
  }

  #render(): void {
    const state = this.player.state;
    const manifest = state.manifest;
    const canvas = this.player.canvas;
    const source = this.player.source;
    const ui = resolveStrings(this.player.config.strings);
    this.#root.innerHTML = `<style>${styles}</style><div class="shell">
      <slot name="header">
        ${manifest ? `<header class="header"><h2>${escapeHtml(manifest.label)}</h2>${manifest.summary ? `<p>${escapeHtml(manifest.summary)}</p>` : ''}</header>` : ''}
      </slot>
      ${state.status === 'error' ? `<div class="error" role="alert">${escapeHtml(state.error?.message ?? ui.unableToLoadPlayer)}</div>` : ''}
      ${state.status === 'loading' ? `<p class="header" role="status">${escapeHtml(ui.loadingManifest)}</p>` : ''}
      ${manifest && canvas ? this.#renderReady(manifest, canvas, source?.kind ?? 'video') : ''}
    </div>`;
    this.#bindInteractions();
    const media = this.#root.querySelector('video, audio, hls-video') as HTMLMediaElement | null;
    if (media) this.player.attachMedia(media);
  }

  #renderReady(manifest: AVManifest, canvas: AVCanvas, kind: 'audio' | 'video'): string {
    const source = this.player.source;
    const panels = this.player.config.panels;
    const controls = this.player.config.controls;
    const ui = resolveStrings(this.player.config.strings);
    const panelTabs = [
      panels.chapters ? ['chapters', ui.chapters] : undefined,
      panels.transcript ? ['transcript', ui.transcript] : undefined,
      panels.annotations ? ['annotations', ui.annotations] : undefined,
      panels.metadata ? ['metadata', ui.metadata] : undefined,
      panels.supplementalFiles ? ['files', ui.files] : undefined,
    ].filter((value): value is [string, string] => Boolean(value));
    const showPanel = this.#activePanel !== 'none' && panelTabs.length > 0;
    return `
      ${this.#resumeTime !== undefined ? `<div class="resume">${escapeHtml(formatString(ui.resumePrompt, { time: formatTime(this.#resumeTime) }))} <button type="button" data-action="resume">${escapeHtml(ui.resume)}</button><button type="button" data-action="dismiss-resume">${escapeHtml(ui.startOver)}</button></div>` : ''}
      <div class="layout" ${showPanel ? '' : 'style="grid-template-columns: 1fr"'}>
        <section class="player-column" aria-label="${escapeHtml(ui.mediaPlayer)}">
          <slot name="before-player"></slot>
          <media-controller ${kind === 'audio' ? 'audio' : ''} ${this.#mediaChromeLanguage()}>
            ${kind === 'audio' ? `<div class="audio-art"><span>${escapeHtml(canvas.label)}</span></div>` : ''}
            ${source ? this.#mediaHtml(canvas, source.kind) : `<div class="audio-art"><span>${escapeHtml(ui.noPlayableMedia)}</span></div>`}
            <slot name="player-overlay"></slot>
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
              ${controls.playbackRate ? `<media-playback-rate-menu rates="${this.player.config.playbackRates.join(' ')}" hidden></media-playback-rate-menu>` : ''}
            </slot>
          </media-controller>
          ${this.#searchMarkersHtml()}
          <div class="player-toolbar">
            <div class="group">
              <button type="button" data-action="previous" ${canvas.index === 0 ? 'disabled' : ''} aria-label="${escapeHtml(ui.previousSection)}">← ${escapeHtml(ui.previous)}</button>
              <button type="button" data-action="next" ${canvas.index === manifest.canvases.length - 1 && !this.player.state.repeat ? 'disabled' : ''} aria-label="${escapeHtml(ui.nextSection)}">${escapeHtml(ui.next)} →</button>
            </div>
            <div class="group">
              ${controls.sourceSelector && canvas.sources.length > 1 ? `<label><span class="sr-only">${escapeHtml(ui.mediaSource)}</span><select data-action="source">${canvas.sources.map((item, index) => `<option value="${index}" ${index === this.player.state.sourceIndex ? 'selected' : ''}>${escapeHtml(item.label ?? item.format ?? formatString(ui.sourceNumber, { number: index + 1 }))}</option>`).join('')}</select></label>` : ''}
              ${controls.download && canvas.rendering.length > 0 ? `<label><span class="sr-only">${escapeHtml(ui.downloadMediaFile)}</span><select data-action="download"><option value="">${escapeHtml(ui.download)}…</option>${canvas.rendering.map((file) => `<option value="${escapeHtml(file.id)}" data-filename="${escapeHtml(file.filename ?? '')}">${escapeHtml(file.label)}</option>`).join('')}</select></label>` : ''}
              <label><input type="checkbox" data-action="auto-advance" ${this.player.state.autoAdvance ? 'checked' : ''}> ${escapeHtml(ui.autoAdvance)}</label>
            </div>
          </div>
          <slot name="after-player"></slot>
        </section>
        ${showPanel ? `<aside class="panel">
          <nav class="tabs" role="tablist" aria-label="${escapeHtml(ui.mediaInformation)}">${panelTabs.map(([id, tabLabel]) => `<button class="tab" type="button" role="tab" data-panel="${id}" aria-selected="${this.#activePanel === id}">${escapeHtml(tabLabel)}</button>`).join('')}</nav>
          <div class="panel-content" role="tabpanel">${this.#panelHtml(manifest, canvas)}</div>
        </aside>` : ''}
      </div>`;
  }

  #mediaHtml(canvas: AVCanvas, kind: 'audio' | 'video'): string {
    const source = this.player.source;
    if (!source) return '';
    const tag = source.isHls ? 'hls-video' : kind;
    const sourceUrl = this.#resolvedSourceUrl ?? (this.player.config.resolveRequest ? '' : source.src);
    const attributes = [
      'slot="media"',
      sourceUrl ? `src="${escapeHtml(sourceUrl)}"` : '',
      `preload="${this.player.config.preload}"`,
      this.player.config.crossorigin ? `crossorigin="${this.player.config.crossorigin}"` : '',
      kind === 'video' && canvas.poster ? `poster="${escapeHtml(canvas.poster)}"` : '',
      `aria-label="${escapeHtml(canvas.label)}"`,
      `data-canvasindex="${canvas.index}"`,
    ].filter(Boolean).join(' ');
    const tracks = canvas.tracks.map((track) => `<track src="${escapeHtml(track.src)}" kind="${track.kind}" label="${escapeHtml(track.label)}" ${track.language ? `srclang="${escapeHtml(track.language)}"` : ''} ${track.default ? 'default' : ''}>`).join('');
    return `<${tag} ${attributes}>${tracks}</${tag}>`;
  }

  #mediaChromeLanguage(): string {
    const language = this.player.config.preferredLanguages.find((value) => value !== 'none');
    return language ? `lang="${escapeHtml(language)}"` : '';
  }

  #panelHtml(manifest: AVManifest, canvas: AVCanvas): string {
    const ui = resolveStrings(this.player.config.strings);
    switch (this.#activePanel) {
      case 'chapters':
        return chapterHtml(manifest.chapters, canvas.id, ui);
      case 'transcript':
        return this.#transcriptHtml(canvas);
      case 'annotations':
        return this.#annotationsHtml(canvas.annotations);
      case 'metadata':
        return `<h3>${escapeHtml(canvas.label)}</h3>${metadataHtml([...manifest.metadata, ...canvas.metadata], ui)}${manifest.requiredStatement ? metadataHtml([manifest.requiredStatement], ui) : ''}${manifest.rights ? `<p><strong>${escapeHtml(ui.rights)}:</strong> <a href="${escapeHtml(manifest.rights)}" target="_blank" rel="noreferrer">${escapeHtml(manifest.rights)}</a></p>` : ''}`;
      case 'files': {
        const files = [...manifest.rendering, ...canvas.rendering];
        return files.length > 0 ? `<ul class="file-list">${files.map((file) => `<li><a href="${escapeHtml(file.id)}" download="${escapeHtml(file.filename ?? '')}">${escapeHtml(file.label)}</a>${file.format ? `<div class="time">${escapeHtml(file.format)}</div>` : ''}</li>`).join('')}</ul>` : `<p class="empty">${escapeHtml(ui.noSupplementalFiles)}</p>`;
      }
      default:
        return '';
    }
  }

  #transcriptHtml(canvas: AVCanvas): string {
    const ui = resolveStrings(this.player.config.strings);
    if (canvas.transcripts.length === 0) return `<p class="empty">${escapeHtml(ui.noTranscript)}</p>`;
    const resource = canvas.transcripts[this.#transcriptIndex];
    const query = this.#transcriptQuery.trim();
    const visible = query
      ? this.#transcriptCues.filter((cue) => cue.text.toLowerCase().includes(query.toLowerCase()))
      : this.#transcriptCues;
    return `<div class="panel-tools">
      ${canvas.transcripts.length > 1 ? `<select data-action="transcript" aria-label="${escapeHtml(ui.transcript)}">${canvas.transcripts.map((item, index) => `<option value="${index}" ${index === this.#transcriptIndex ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select>` : ''}
      ${this.player.config.transcript.search ? `<input type="search" data-action="transcript-search" value="${escapeHtml(this.#transcriptQuery)}" placeholder="${escapeHtml(ui.searchTranscript)}" aria-label="${escapeHtml(ui.searchTranscript)}">` : ''}
      ${this.player.config.transcript.download && resource?.src ? `<a href="${escapeHtml(resource.src)}" download>${escapeHtml(ui.download)}</a>` : ''}
    </div>
    ${this.#transcriptCues.length === 0 ? `<p class="empty">${escapeHtml(ui.loadingTranscript)}</p>` : `<ol class="cue-list">${visible.map((cue) => `<li class="cue" data-cue-id="${escapeHtml(cue.id)}" ${cue.start !== undefined ? `data-start="${cue.start}" data-end="${cue.end ?? cue.start}"` : ''}><button type="button" ${cue.start === undefined ? 'disabled' : ''}>${cue.start !== undefined ? `<span class="time">${formatTime(cue.start)}</span>` : ''}${cue.speaker ? `<span class="speaker">${escapeHtml(cue.speaker)}</span>` : ''}<span>${highlight(cue.text, query)}</span></button></li>`).join('')}</ol>`}`;
  }

  #annotationsHtml(annotations: AVAnnotation[]): string {
    const ui = resolveStrings(this.player.config.strings);
    if (annotations.length === 0) return `<p class="empty">${escapeHtml(ui.noAnnotations)}</p>`;
    return `<ol class="annotation-list">${annotations.map((annotation) => `<li class="annotation" data-start="${annotation.time?.start ?? ''}" data-end="${annotation.time?.end ?? annotation.time?.start ?? ''}"><button type="button" ${annotation.time ? '' : 'disabled'}>${annotation.time ? `<span class="time">${formatTime(annotation.time.start)}</span>` : ''}<span>${escapeHtml(annotation.text)}</span>${annotation.tags.length > 0 ? `<span class="tags">${annotation.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>` : ''}</button></li>`).join('')}</ol>`;
  }

  #searchMarkersHtml(): string {
    const ui = resolveStrings(this.player.config.strings);
    const query = this.#transcriptQuery.trim().toLowerCase();
    const duration = this.player.state.duration || this.player.canvas?.duration || 0;
    if (!query || !this.player.config.transcript.showSearchMarkers || duration <= 0) return '';
    const matches = this.#transcriptCues.filter((cue) => cue.start !== undefined && cue.text.toLowerCase().includes(query));
    if (matches.length === 0) return '';
    return `<div class="search-markers" aria-label="${escapeHtml(ui.transcriptSearchMatches)}">${matches.map((cue) => `<button type="button" class="search-marker" data-search-time="${cue.start}" style="left:${Math.min(100, Math.max(0, ((cue.start ?? 0) / duration) * 100))}%" aria-label="${escapeHtml(formatString(ui.searchMatchAt, { time: formatTime(cue.start ?? 0) }))}"></button>`).join('')}</div>`;
  }

  #bindInteractions(): void {
    this.#root.querySelectorAll<HTMLElement>('[data-panel]').forEach((button) => button.addEventListener('click', () => {
      this.#activePanel = button.dataset.panel as NonNullable<AVPlayerConfig['activePanel']>;
      this.#renderPanelOnly();
      if (this.#activePanel === 'transcript') void this.#loadActiveTranscript();
    }));
    this.#root.querySelector<HTMLElement>('[data-action=previous]')?.addEventListener('click', () => this.player.previous({ autoplay: this.player.state.status === 'playing' }));
    this.#root.querySelector<HTMLElement>('[data-action=next]')?.addEventListener('click', () => this.player.next({ autoplay: this.player.state.status === 'playing' }));
    this.#root.querySelector<HTMLSelectElement>('[data-action=source]')?.addEventListener('change', (event) => this.player.selectSource(Number((event.target as HTMLSelectElement).value)));
    this.#root.querySelector<HTMLSelectElement>('[data-action=download]')?.addEventListener('change', (event) => {
      const select = event.target as HTMLSelectElement;
      if (!select.value) return;
      const anchor = document.createElement('a');
      anchor.href = select.value;
      anchor.download = select.selectedOptions[0]?.dataset.filename ?? '';
      anchor.click();
      select.value = '';
    });
    this.#root.querySelector<HTMLInputElement>('[data-action=auto-advance]')?.addEventListener('change', (event) => this.player.setAutoAdvance((event.target as HTMLInputElement).checked));
    this.#root.querySelector<HTMLElement>('[data-action=resume]')?.addEventListener('click', () => {
      if (this.#resumeTime !== undefined) this.player.seekTo(this.#resumeTime);
      this.#resumeTime = undefined;
      this.#render();
    });
    this.#root.querySelector<HTMLElement>('[data-action=dismiss-resume]')?.addEventListener('click', () => {
      this.#resumeTime = undefined;
      this.#render();
    });
    this.#bindPanelInteractions();
  }

  #bindPanelInteractions(): void {
    this.#root.querySelectorAll<HTMLElement>('[data-canvas]').forEach((button) => button.addEventListener('click', () => {
      const canvasId = button.dataset.canvas;
      if (canvasId) this.player.selectCanvas(canvasId, { time: Number(button.dataset.time ?? 0), autoplay: true });
    }));
    this.#root.querySelector<HTMLSelectElement>('[data-action=transcript]')?.addEventListener('change', (event) => {
      this.#transcriptIndex = Number((event.target as HTMLSelectElement).value);
      this.#transcriptCues = [];
      this.#renderPanelOnly();
      void this.#loadActiveTranscript();
    });
    this.#root.querySelector<HTMLInputElement>('[data-action=transcript-search]')?.addEventListener('input', (event) => {
      this.#transcriptQuery = (event.target as HTMLInputElement).value;
      const selection = (event.target as HTMLInputElement).selectionStart;
      this.#renderPanelOnly();
      const input = this.#root.querySelector<HTMLInputElement>('[data-action=transcript-search]');
      input?.focus();
      if (selection !== null) input?.setSelectionRange(selection, selection);
    });
    this.#root.querySelectorAll<HTMLElement>('.cue[data-start] button, .annotation[data-start] button').forEach((button) => button.addEventListener('click', () => {
      const row = button.parentElement;
      const start = Number(row?.dataset.start);
      if (Number.isFinite(start)) {
        this.player.seekTo(start);
        playFromInteraction(this.player, this);
      }
    }));
    this.#root.querySelectorAll<HTMLElement>('[data-search-time]').forEach((button) => button.addEventListener('click', () => {
      const time = Number(button.dataset.searchTime);
      if (Number.isFinite(time)) this.player.seekTo(time);
    }));
  }

  #renderPanelOnly(): void {
    const manifest = this.player.manifest;
    const canvas = this.player.canvas;
    if (!manifest || !canvas) return;
    this.#root.querySelectorAll<HTMLElement>('[data-panel]').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.panel === this.#activePanel));
    });
    const content = this.#root.querySelector<HTMLElement>('.panel-content');
    if (content) content.innerHTML = this.#panelHtml(manifest, canvas);
    this.#root.querySelector('.search-markers')?.remove();
    const toolbar = this.#root.querySelector('.player-toolbar');
    const markers = this.#searchMarkersHtml();
    if (toolbar && markers) toolbar.insertAdjacentHTML('beforebegin', markers);
    this.#bindPanelInteractions();
  }

  async #loadActiveTranscript(): Promise<void> {
    const resource = this.player.canvas?.transcripts[this.#transcriptIndex];
    if (!resource) return;
    const token = ++this.#loadingToken;
    try {
      const transcriptOptions: Parameters<typeof loadTranscript>[1] = {};
      if (this.player.config.fetch) transcriptOptions.fetch = this.player.config.fetch;
      if (this.player.config.requestInit) transcriptOptions.requestInit = this.player.config.requestInit;
      if (this.player.config.transcript.showNotes !== undefined) transcriptOptions.showNotes = this.player.config.transcript.showNotes;
      if (this.player.config.transcript.showMetadata !== undefined) transcriptOptions.showMetadata = this.player.config.transcript.showMetadata;
      const cues = await loadTranscript(resource, transcriptOptions);
      if (token !== this.#loadingToken) return;
      this.#transcriptCues = cues;
      if (this.#activePanel === 'transcript') this.#renderPanelOnly();
    } catch (cause) {
      if (token !== this.#loadingToken) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
      this.#transcriptCues = [];
      if (this.#activePanel === 'transcript') this.#renderPanelOnly();
    }
  }

  async #resolveSource(): Promise<void> {
    if (!this.player.config.resolveRequest) return;
    const token = ++this.#sourceToken;
    try {
      const sourceUrl = await this.player.resolvedSourceUrl();
      if (token !== this.#sourceToken || !sourceUrl) return;
      this.#resolvedSourceUrl = sourceUrl;
      const media = this.#root.querySelector('video, audio, hls-video') as HTMLMediaElement | null;
      if (media) media.setAttribute('src', sourceUrl);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
    }
  }

  #syncTimedContent(): void {
    const time = this.player.state.currentTime;
    const rows = this.#root.querySelectorAll<HTMLElement>('[data-start][data-end]');
    let active: HTMLElement | undefined;
    rows.forEach((row) => {
      const start = Number(row.dataset.start);
      const end = Number(row.dataset.end);
      const isActive = Number.isFinite(start) && time >= start && (!Number.isFinite(end) || time < end);
      row.querySelector('button')?.classList.toggle('active', isActive);
      if (isActive) active = row;
    });
    if (active && this.player.config.transcript.autoScroll) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

export const defineMangoAVMedia = (tagName = 'mango-av-media'): typeof MangoAVMediaElement => {
  if (typeof customElements === 'undefined') return MangoAVMediaElement;
  if (!customElements.get(tagName)) customElements.define(tagName, MangoAVMediaElement);
  return MangoAVMediaElement;
};
