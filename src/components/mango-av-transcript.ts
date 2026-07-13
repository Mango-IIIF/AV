import { AVControllerElement } from './controller-element';
import { componentTheme } from './component-styles';
import { loadTranscript } from '../transcript';
import { playFromInteraction } from './playback';
import type { AVPlayerEventMap, TranscriptCue } from '../types';
import { escapeHtml, formatTime, resolveStrings } from '../utils';

const styles = `${componentTheme}
  .transcript { background: var(--mango-av-background); border: 1px solid var(--mango-av-border); border-radius: var(--mango-av-radius); padding: .75rem; }
  h2 { font-size: 1rem; margin: 0 0 .5rem; }
  .tools { display: flex; flex-wrap: wrap; gap: .45rem; margin-bottom: .75rem; }
  .tools input, .tools select { border: 1px solid var(--mango-av-border); border-radius: .35rem; min-width: 0; padding: .45rem; }
  .tools input { flex: 1; }
  .tools a { align-content: center; color: var(--mango-av-accent); }
  ol { list-style: none; margin: 0; max-height: var(--mango-av-transcript-height, 34rem); overflow: auto; padding: 0; }
  button { background: transparent; border: 0; border-radius: .35rem; color: inherit; display: grid; gap: .2rem; padding: .5rem; text-align: left; width: 100%; }
  button:hover { background: var(--mango-av-surface); }
  button.active { background: color-mix(in srgb, var(--mango-av-accent) 14%, transparent); box-shadow: inset 3px 0 var(--mango-av-accent); }
  mark { background: #ffe770; }
  .speaker { font-weight: 700; }
`;

const highlight = (text: string, query: string): string => {
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark>$1</mark>');
};

export class MangoAVTranscriptElement extends AVControllerElement {
  #root: ShadowRoot;
  #cues: TranscriptCue[] = [];
  #transcriptIndex = 0;
  #query = '';
  #loadToken = 0;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
  }

  protected controllerChanged(): void {
    this.#cues = [];
    this.#transcriptIndex = 0;
    this.#render();
    void this.#loadTranscript();
  }

  protected handleControllerEvent<K extends keyof AVPlayerEventMap>(type: K, _event: CustomEvent<AVPlayerEventMap[K]>): void {
    if (type === 'av-ready' || type === 'av-canvaschange') {
      this.#cues = [];
      this.#transcriptIndex = 0;
      this.#render();
      void this.#loadTranscript();
    } else if (type === 'av-configchange') {
      this.#render();
    } else if (type === 'av-timeupdate' || type === 'av-seek' || type === 'av-statechange') {
      this.#sync();
    }
  }

  #render(): void {
    const canvas = this.controller.canvas;
    const transcripts = canvas?.transcripts ?? [];
    const resource = transcripts[this.#transcriptIndex];
    const query = this.#query.trim();
    const ui = resolveStrings(this.controller.config.strings);
    const cues = query ? this.#cues.filter((cue) => cue.text.toLowerCase().includes(query.toLowerCase())) : this.#cues;
    this.#root.innerHTML = `<style>${styles}</style><section class="transcript" aria-label="${escapeHtml(ui.transcript)}">
      <slot name="heading"><h2>${escapeHtml(ui.transcript)}</h2></slot>
      ${!canvas ? `<p class="empty">${escapeHtml(ui.noManifest)}</p>` : transcripts.length === 0 ? `<p class="empty">${escapeHtml(ui.noTranscript)}</p>` : `
        <div class="tools">
          ${transcripts.length > 1 ? `<select data-action="transcript" aria-label="${escapeHtml(ui.transcript)}">${transcripts.map((item, index) => `<option value="${index}" ${index === this.#transcriptIndex ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select>` : ''}
          ${this.controller.config.transcript.search ? `<input type="search" data-action="search" value="${escapeHtml(this.#query)}" placeholder="${escapeHtml(ui.searchTranscript)}" aria-label="${escapeHtml(ui.searchTranscript)}">` : ''}
          ${this.controller.config.transcript.download && resource?.src ? `<a href="${escapeHtml(resource.src)}" download>${escapeHtml(ui.download)}</a>` : ''}
        </div>
        ${this.#cues.length === 0 ? `<p class="empty">${escapeHtml(ui.loadingTranscript)}</p>` : `<ol>${cues.map((cue) => `<li data-cue-id="${escapeHtml(cue.id)}" ${cue.start !== undefined ? `data-start="${cue.start}" data-end="${cue.end ?? cue.start}"` : ''}>
          <button type="button" ${cue.start === undefined ? 'disabled' : ''}>
            ${cue.start !== undefined ? `<span class="time">${formatTime(cue.start)}</span>` : ''}
            ${cue.speaker ? `<span class="speaker">${escapeHtml(cue.speaker)}</span>` : ''}
            <span>${highlight(cue.text, query)}</span>
          </button>
        </li>`).join('')}</ol>`}
      `}
    </section>`;
    this.#bind();
    this.#sync();
  }

  #bind(): void {
    this.#root.querySelector<HTMLSelectElement>('[data-action=transcript]')?.addEventListener('change', (event) => {
      this.#transcriptIndex = Number((event.target as HTMLSelectElement).value);
      this.#cues = [];
      this.#render();
      void this.#loadTranscript();
    });
    this.#root.querySelector<HTMLInputElement>('[data-action=search]')?.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement;
      const selection = input.selectionStart;
      this.#query = input.value;
      this.#render();
      const next = this.#root.querySelector<HTMLInputElement>('[data-action=search]');
      next?.focus();
      if (selection !== null) next?.setSelectionRange(selection, selection);
      this.dispatchEvent(new CustomEvent('av-transcriptsearch', { detail: { query: this.#query }, bubbles: true, composed: true }));
    });
    this.#root.querySelectorAll<HTMLElement>('[data-start] button').forEach((button) => button.addEventListener('click', () => {
      const time = Number(button.parentElement?.dataset.start);
      if (!Number.isFinite(time)) return;
      this.dispatchEvent(new CustomEvent('av-transcriptcueselect', { detail: { time }, bubbles: true, composed: true }));
      this.controller.seekTo(time);
      playFromInteraction(this.controller, this);
    }));
  }

  async #loadTranscript(): Promise<void> {
    const resource = this.controller.canvas?.transcripts[this.#transcriptIndex];
    if (!resource) return;
    const token = ++this.#loadToken;
    const options: Parameters<typeof loadTranscript>[1] = {};
    if (this.controller.config.fetch) options.fetch = this.controller.config.fetch;
    if (this.controller.config.requestInit) options.requestInit = this.controller.config.requestInit;
    if (this.controller.config.transcript.showNotes !== undefined) options.showNotes = this.controller.config.transcript.showNotes;
    if (this.controller.config.transcript.showMetadata !== undefined) options.showMetadata = this.controller.config.transcript.showMetadata;
    try {
      const cues = await loadTranscript(resource, options);
      if (token !== this.#loadToken) return;
      this.#cues = cues;
      this.#render();
    } catch (cause) {
      if (token !== this.#loadToken) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
      this.#cues = [];
      this.#render();
    }
  }

  #sync(): void {
    const time = this.controller.state.currentTime;
    let active: HTMLElement | undefined;
    this.#root.querySelectorAll<HTMLElement>('[data-start][data-end]').forEach((row) => {
      const start = Number(row.dataset.start);
      const end = Number(row.dataset.end);
      const isActive = Number.isFinite(start) && time >= start && (!Number.isFinite(end) || time < end);
      row.querySelector('button')?.classList.toggle('active', isActive);
      if (isActive) active = row;
    });
    if (active && this.controller.config.transcript.autoScroll) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

export const defineMangoAVTranscript = (tagName = 'mango-av-transcript'): typeof MangoAVTranscriptElement => {
  if (typeof customElements === 'undefined') return MangoAVTranscriptElement;
  if (!customElements.get(tagName)) customElements.define(tagName, MangoAVTranscriptElement);
  return MangoAVTranscriptElement;
};
