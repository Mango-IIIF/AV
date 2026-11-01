import { AVPlayerController } from '../controller';
import { componentTheme, panelStyles } from './component-styles';
import { defineMangoAVPlayer, MangoAVPlayerElement } from './mango-av-player';
import { defineMangoAVChapters, MangoAVChaptersElement } from './mango-av-chapters';
import { defineMangoAVTranscript, MangoAVTranscriptElement } from './mango-av-transcript';
import { defineMangoAVAnnotations, MangoAVAnnotationsElement } from './mango-av-annotations';
import { defineMangoAVCaptions, MangoAVCaptionsElement } from './mango-av-captions';
import type { AVControllerElement } from './controller-element';
import { HTMLElementBase, controllerEventTypes } from './controller-element';
import type {
  AVCanvas,
  AVManifest,
  AVPlayerConfig,
  AVStrings,
  JsonObject,
  MetadataEntry,
} from '../types';
import { escapeHtml, formatTime, resolveStrings } from '../utils';

type Panel = NonNullable<AVPlayerConfig['activePanel']>;

/* The components are rendered under whatever tags they were defined with. */
const tags = () => ({
  player: MangoAVPlayerElement.registeredTag ?? 'mango-av-player',
  transcript: MangoAVTranscriptElement.registeredTag ?? 'mango-av-transcript',
  chapters: MangoAVChaptersElement.registeredTag ?? 'mango-av-chapters',
  annotations: MangoAVAnnotationsElement.registeredTag ?? 'mango-av-annotations',
  captions: MangoAVCaptionsElement.registeredTag ?? 'mango-av-captions',
});

/* The theme set on this element reaches the components inside it, over their own defaults. */
const inheritedTokens = ['accent', 'accent-contrast', 'accent-tint', 'background', 'surface', 'text', 'muted', 'border', 'danger', 'radius', 'font']
  .map((token) => `--mango-av-${token}: inherit;`)
  .join(' ');

/*
 * The player, its position, and the recording's transcript, chapters and
 * annotations underneath it in tabs. The panels keep their size order: the
 * player and tabs never shrink, and the active list scrolls on its own.
 */
const styles = `${componentTheme}${panelStyles}
  .shell {
    background: var(--mango-av-background);
    border: 1px solid var(--mango-av-border);
    border-radius: var(--mango-av-radius);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px;
  }
  .header h2 { font-size: 1.15rem; margin: 0; }
  .header p { color: var(--mango-av-muted); margin: .35rem 0 0; }
  .embedded { ${inheritedTokens} --mango-av-panel-background: transparent; --mango-av-panel-border: 0; --mango-av-panel-padding: 0; }
  .position { font-size: 14px; margin: 0; }
  .position span { color: var(--mango-av-muted); }
  .tabs { background: var(--mango-av-surface); border-radius: 8px; display: flex; gap: 4px; overflow-x: auto; padding: 4px; }
  .tab {
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: var(--mango-av-muted);
    flex: 1 0 auto;
    font-size: 14px;
    font-weight: 600;
    height: 34px;
    padding: 0 12px;
  }
  .tab[aria-selected=true] { background: var(--mango-av-background); color: var(--mango-av-text); }
  .details { min-height: 200px; }
  .details > [hidden] { display: none; }
  .canvas-label { font-size: 1rem; margin: 0 0 .5rem; }
  dl { font-size: 14px; margin: 0; }
  dt { font-weight: 700; margin-top: .75rem; }
  dd { color: var(--mango-av-muted); margin: .2rem 0 0; }
  .files { font-size: 14px; list-style: none; margin: 0; padding: 0; }
  .files li { border-bottom: 1px solid var(--mango-av-border); padding: .55rem 0; }
  .files small { color: var(--mango-av-muted); display: block; }
  a { color: var(--mango-av-accent); }
`;

const metadataHtml = (entries: MetadataEntry[]): string => `<dl>${entries.map((entry) => `
  <dt>${escapeHtml(entry.label)}</dt>
  <dd>${entry.values.map((value) => escapeHtml(value.value)).join('<br>')}</dd>
`).join('')}</dl>`;

const metadataPanelHtml = (manifest: AVManifest, canvas: AVCanvas, ui: AVStrings): string => {
  const entries = [...manifest.metadata, ...canvas.metadata];
  const statement = manifest.requiredStatement ? [manifest.requiredStatement] : [];
  if (entries.length === 0 && statement.length === 0 && !manifest.rights) return `<p class="empty">${escapeHtml(ui.noMetadata)}</p>`;
  return `<h3 class="canvas-label">${escapeHtml(canvas.label)}</h3>
    ${metadataHtml([...entries, ...statement])}
    ${manifest.rights ? `<p><strong>${escapeHtml(ui.rights)}:</strong> <a href="${escapeHtml(manifest.rights)}" target="_blank" rel="noreferrer">${escapeHtml(manifest.rights)}</a></p>` : ''}`;
};

const filesPanelHtml = (manifest: AVManifest, canvas: AVCanvas, ui: AVStrings): string => {
  const files = [...manifest.rendering, ...canvas.rendering];
  if (files.length === 0) return `<p class="empty">${escapeHtml(ui.noSupplementalFiles)}</p>`;
  return `<ul class="files">${files.map((file) => `<li>
    <a href="${escapeHtml(file.id)}" download="${escapeHtml(file.filename ?? '')}">${escapeHtml(file.label)}</a>
    ${file.format ? `<small>${escapeHtml(file.format)}</small>` : ''}
  </li>`).join('')}</ul>`;
};

export class MangoAVMediaElement extends HTMLElementBase {
  static observedAttributes = ['manifest-url', 'config'];

  readonly player: AVPlayerController;
  #root: ShadowRoot;
  #inputManifest: JsonObject | string | undefined;
  #config: AVPlayerConfig = {};
  #activePanel: Panel = 'transcript';

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.player = new AVPlayerController();
    for (const type of controllerEventTypes) {
      this.player.addEventListener(type, ((event: CustomEvent) => {
        if (type === 'av-ready' || type === 'av-configchange') {
          this.#activePanel = this.player.config.activePanel;
          this.#render();
        } else if (type === 'av-canvaschange') {
          this.#renderDetails();
        } else if (type === 'av-statechange') {
          this.#renderPosition();
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

  set manifest(value: JsonObject | string | undefined) {
    this.#inputManifest = value;
    if (this.isConnected && value !== undefined) void this.load(value);
  }

  get controller(): AVPlayerController {
    return this.player;
  }

  get config(): AVPlayerConfig {
    return this.#config;
  }

  set config(value: AVPlayerConfig) {
    this.#config = value;
    this.player.configure(value);
  }

  connectedCallback(): void {
    this.#readConfigAttribute();
    this.#render();
    const source = this.#inputManifest ?? this.getAttribute('manifest-url') ?? undefined;
    if (source !== undefined && !this.player.manifest) void this.load(source);
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
    if (name === 'config') this.#readConfigAttribute();
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

  #panels(ui: AVStrings): Array<[Panel, string]> {
    const panels = this.player.config.panels;
    return ([
      panels.transcript ? ['transcript', ui.transcript] : undefined,
      panels.chapters ? ['chapters', ui.chapters] : undefined,
      panels.annotations ? ['annotations', ui.annotations] : undefined,
      panels.metadata ? ['metadata', ui.metadata] : undefined,
      panels.supplementalFiles ? ['files', ui.files] : undefined,
    ] as const).filter((value): value is [Panel, string] => Boolean(value));
  }

  /* Rebuilt for a new Manifest or configuration; the components inside follow the controller from there. */
  #render(): void {
    const manifest = this.player.manifest;
    const ui = resolveStrings(this.player.config.strings);
    const panels = this.#panels(ui);
    if (!panels.some(([id]) => id === this.#activePanel) && this.#activePanel !== 'none') this.#activePanel = panels[0]?.[0] ?? 'none';
    const showPanels = this.#activePanel !== 'none' && panels.length > 0;
    const hiddenHeading = '<span slot="heading" hidden></span>';
    const tag = tags();
    const captions = this.player.config.audioArt.captions;
    this.#root.innerHTML = `<style>${styles}</style><div class="shell">
      <slot name="header">
        ${manifest ? `<header class="header"><h2>${escapeHtml(manifest.label)}</h2>${manifest.summary ? `<p>${escapeHtml(manifest.summary)}</p>` : ''}</header>` : ''}
      </slot>
      <slot name="before-player"></slot>
      <${tag.player} class="embedded" data-component>${captions ? `<${tag.captions} class="embedded" data-component slot="stage" audio-only ${captions === 'line' ? 'line' : ''}></${tag.captions}>` : ''}</${tag.player}>
      <slot name="after-player"></slot>
      ${manifest ? '<p class="position" aria-live="off"></p>' : ''}
      ${manifest && showPanels ? `
        <div class="tabs" role="tablist" aria-label="${escapeHtml(ui.mediaInformation)}">
          ${panels.map(([id, text]) => `<button class="tab" type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" data-panel="${id}" aria-selected="${this.#activePanel === id}">${escapeHtml(text)}</button>`).join('')}
        </div>
        <div class="details">
          ${panels.map(([id]) => {
            const attributes = `id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}" data-panel-body="${id}" ${this.#activePanel === id ? '' : 'hidden'}`;
            switch (id) {
              case 'transcript':
              case 'chapters':
              case 'annotations': return `<${tag[id]} class="embedded" data-component ${attributes}>${hiddenHeading}</${tag[id]}>`;
              default: return `<div ${attributes}></div>`;
            }
          }).join('')}
        </div>` : ''}
    </div>`;
    const player = this.#root.querySelector<MangoAVPlayerElement>(tag.player);
    if (player) player.forwardEvents = false;
    this.#root.querySelectorAll<AVControllerElement>('[data-component]').forEach((element) => { element.controller = this.player; });
    this.#root.querySelectorAll<HTMLElement>('[data-panel]').forEach((tab) => tab.addEventListener('click', () => this.#selectPanel(tab.dataset.panel as Panel)));
    this.#root.querySelector('.tabs')?.addEventListener('keydown', (event) => this.#moveTab(event as KeyboardEvent));
    this.#renderDetails();
    this.#renderPosition();
  }

  #selectPanel(panel: Panel): void {
    this.#activePanel = panel;
    this.#root.querySelectorAll<HTMLElement>('[data-panel]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.panel === panel)));
    this.#root.querySelectorAll<HTMLElement>('[data-panel-body]').forEach((body) => { body.hidden = body.dataset.panelBody !== panel; });
  }

  #moveTab(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const tabs = [...this.#root.querySelectorAll<HTMLElement>('[data-panel]')];
    const index = tabs.findIndex((tab) => tab.dataset.panel === this.#activePanel);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    if (!next) return;
    this.#selectPanel(next.dataset.panel as Panel);
    next.focus();
  }

  #renderDetails(): void {
    const manifest = this.player.manifest;
    const canvas = this.player.canvas;
    const ui = resolveStrings(this.player.config.strings);
    const metadata = this.#root.querySelector<HTMLElement>('[data-panel-body=metadata]');
    const files = this.#root.querySelector<HTMLElement>('[data-panel-body=files]');
    if (metadata) metadata.innerHTML = manifest && canvas ? metadataPanelHtml(manifest, canvas, ui) : '';
    if (files) files.innerHTML = manifest && canvas ? filesPanelHtml(manifest, canvas, ui) : '';
  }

  #renderPosition(): void {
    const position = this.#root.querySelector<HTMLElement>('.position');
    if (!position) return;
    const ui = resolveStrings(this.player.config.strings);
    const state = this.player.state;
    position.innerHTML = `${escapeHtml(ui.position)} <strong>${formatTime(state.currentTime)}</strong> <span>/ ${formatTime(state.duration)}</span>`;
  }
}

export const defineMangoAVMedia = (tagName = 'mango-av-media'): typeof MangoAVMediaElement => {
  defineMangoAVPlayer();
  defineMangoAVChapters();
  defineMangoAVTranscript();
  defineMangoAVAnnotations();
  defineMangoAVCaptions();
  if (typeof customElements === 'undefined') return MangoAVMediaElement;
  if (!customElements.get(tagName)) customElements.define(tagName, MangoAVMediaElement);
  return MangoAVMediaElement;
};
