import { AVControllerElement } from './controller-element';
import { componentTheme, panelStyles } from './component-styles';
import { playFromInteraction } from './playback';
import { markActiveRow, scrollRowToTop } from './timed-rows';
import { loadCues } from './transcript-cues';
import type { AVPlayerEventMap, AVStrings, TranscriptCue } from '../types';
import { escapeHtml, formatTime, resolveStrings } from '../utils';

const styles = `${componentTheme}${panelStyles}`;

const highlight = (text: string, query: string): string => {
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const safeQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark>$1</mark>');
};

const cuesHtml = (cues: TranscriptCue[], query: string, ui: AVStrings): string => {
  const visible = query ? cues.filter((cue) => cue.text.toLowerCase().includes(query.toLowerCase())) : cues;
  if (visible.length === 0) return `<li class="empty">${escapeHtml(ui.noTranscript)}</li>`;
  return visible.map((cue) => `<li data-cue-id="${escapeHtml(cue.id)}" ${cue.start !== undefined ? `data-start="${cue.start}" data-end="${cue.end ?? ''}"` : ''}>
    <button type="button" class="row" ${cue.start === undefined ? 'disabled' : ''}>
      <time>${cue.start !== undefined ? formatTime(cue.start) : ''}</time>
      <span class="text">${cue.speaker ? `<span class="speaker">${escapeHtml(cue.speaker)}</span>` : ''}<span>${highlight(cue.text, query)}</span></span>
    </button>
  </li>`).join('');
};

export class MangoAVTranscriptElement extends AVControllerElement {
  #root: ShadowRoot;
  #cues: TranscriptCue[] = [];
  #loading = false;
  #transcriptIndex = 0;
  #query = '';
  #loadToken = 0;
  #activeRow: HTMLElement | undefined;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
  }

  protected controllerChanged(): void {
    this.#reset();
  }

  protected handleControllerEvent<K extends keyof AVPlayerEventMap>(type: K, _event: CustomEvent<AVPlayerEventMap[K]>): void {
    if (type === 'av-ready' || type === 'av-canvaschange') this.#reset();
    else if (type === 'av-configchange') this.#render();
    else if (type === 'av-timeupdate' || type === 'av-seek' || type === 'av-statechange') this.#sync();
  }

  #reset(): void {
    this.#cues = [];
    this.#transcriptIndex = 0;
    this.#render();
    void this.#loadTranscript();
  }

  #render(): void {
    const canvas = this.controller.canvas;
    const transcripts = canvas?.transcripts ?? [];
    const resource = transcripts[this.#transcriptIndex];
    const ui = resolveStrings(this.controller.config.strings);
    const config = this.controller.config.transcript;
    this.#root.innerHTML = `<style>${styles}</style><section class="panel" aria-label="${escapeHtml(ui.transcript)}">
      <slot name="heading"><h2>${escapeHtml(ui.transcript)}</h2></slot>
      ${!canvas ? `<p class="empty">${escapeHtml(ui.noManifest)}</p>` : transcripts.length === 0 ? `<p class="empty">${escapeHtml(ui.noTranscript)}</p>` : `
        <div class="tools">
          ${transcripts.length > 1 ? `<label class="field">${escapeHtml(ui.transcript)}<select data-action="transcript">${transcripts.map((item, index) => `<option value="${index}" ${index === this.#transcriptIndex ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label>` : ''}
          ${config.search ? `<label class="field">${escapeHtml(ui.searchTranscript)}<input type="search" data-action="search" value="${escapeHtml(this.#query)}"></label>` : ''}
          ${config.download && resource?.src ? `<a href="${escapeHtml(resource.src)}" download>${escapeHtml(ui.download)}</a>` : ''}
        </div>
        <ol class="list"></ol>
      `}
    </section>`;
    this.#renderList();
    this.#bind();
  }

  #renderList(): void {
    const list = this.#root.querySelector<HTMLElement>('ol.list');
    if (!list) return;
    const ui = resolveStrings(this.controller.config.strings);
    list.innerHTML = this.#loading && this.#cues.length === 0
      ? `<li class="empty">${escapeHtml(ui.loadingTranscript)}</li>`
      : cuesHtml(this.#cues, this.#query.trim(), ui);
    list.querySelectorAll<HTMLElement>('[data-start] > button').forEach((button) => button.addEventListener('click', () => {
      const time = Number(button.parentElement?.dataset.start);
      if (!Number.isFinite(time)) return;
      this.dispatchEvent(new CustomEvent('av-transcriptcueselect', { detail: { time }, bubbles: true, composed: true }));
      this.controller.seekTo(time);
      playFromInteraction(this.controller, this);
    }));
    this.#activeRow = undefined;
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
      this.#query = (event.target as HTMLInputElement).value;
      this.#renderList();
      this.dispatchEvent(new CustomEvent('av-transcriptsearch', { detail: { query: this.#query }, bubbles: true, composed: true }));
    });
  }

  async #loadTranscript(): Promise<void> {
    const resource = this.controller.canvas?.transcripts[this.#transcriptIndex];
    if (!resource) return;
    const token = ++this.#loadToken;
    this.#loading = true;
    this.#renderList();
    try {
      const cues = await loadCues(this.controller, resource);
      if (token !== this.#loadToken) return;
      this.#cues = cues;
    } catch (cause) {
      if (token !== this.#loadToken) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.dispatchEvent(new CustomEvent('av-error', { detail: { error }, bubbles: true, composed: true }));
      this.#cues = [];
    }
    this.#loading = false;
    this.#renderList();
  }

  /* While playing, keep the passage being heard at the top of the list. Paused, leave it where the user scrolled. */
  #sync(): void {
    const active = markActiveRow(this.#root, this.controller.state.currentTime);
    if (active === this.#activeRow) return;
    this.#activeRow = active;
    if (active && this.controller.config.transcript.autoScroll && this.controller.state.status === 'playing') scrollRowToTop(active);
  }
}

export const defineMangoAVTranscript = (tagName = 'mango-av-transcript'): typeof MangoAVTranscriptElement => {
  if (typeof customElements === 'undefined') return MangoAVTranscriptElement;
  if (!MangoAVTranscriptElement.registeredTag && !customElements.get(tagName)) {
    customElements.define(tagName, MangoAVTranscriptElement);
    MangoAVTranscriptElement.registeredTag = tagName;
  }
  return MangoAVTranscriptElement;
};
