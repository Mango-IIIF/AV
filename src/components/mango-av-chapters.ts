import { AVControllerElement } from './controller-element';
import { componentTheme, panelStyles } from './component-styles';
import type { AVPlayerEventMap, AVStrings, Chapter } from '../types';
import { escapeHtml, formatTime, resolveStrings } from '../utils';

const styles = `${componentTheme}${panelStyles}`;

const renderChapters = (chapters: Chapter[], ui: AVStrings, level = 1): string => {
  if (chapters.length === 0) return level === 1 ? `<p class="empty">${escapeHtml(ui.noChapters)}</p>` : '';
  return `<ul class="list">${chapters.map((chapter) => `<li ${chapter.canvasId ? `data-canvas="${escapeHtml(chapter.canvasId)}"` : ''} ${chapter.time ? `data-time="${chapter.time.start}" data-end="${chapter.time.end ?? ''}"` : ''}>
    <button type="button" class="row" ${chapter.canvasId ? '' : 'disabled'}>
      <time>${chapter.time ? formatTime(chapter.time.start) : ''}</time>
      <span>${escapeHtml(chapter.label)}</span>
    </button>
    ${renderChapters(chapter.children, ui, level + 1)}
  </li>`).join('')}</ul>`;
};

export class MangoAVChaptersElement extends AVControllerElement {
  #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
  }

  protected controllerChanged(): void { this.#render(); }

  protected handleControllerEvent<K extends keyof AVPlayerEventMap>(type: K, _event: CustomEvent<AVPlayerEventMap[K]>): void {
    if (type === 'av-ready' || type === 'av-canvaschange' || type === 'av-configchange') this.#render();
    else if (type === 'av-timeupdate' || type === 'av-seek') this.#sync();
  }

  #render(): void {
    const manifest = this.controller.manifest;
    const ui = resolveStrings(this.controller.config.strings);
    this.#root.innerHTML = `<style>${styles}</style><section class="panel" aria-label="${escapeHtml(ui.chapters)}">
      <slot name="heading"><h2>${escapeHtml(ui.chapters)}</h2></slot>
      ${manifest ? renderChapters(manifest.chapters, ui) : `<p class="empty">${escapeHtml(ui.noManifest)}</p>`}
    </section>`;
    this.#root.querySelectorAll<HTMLElement>('[data-canvas] > button').forEach((button) => button.addEventListener('click', () => {
      const canvasId = button.parentElement?.dataset.canvas;
      if (!canvasId) return;
      const time = Number(button.parentElement?.dataset.time ?? 0);
      this.dispatchEvent(new CustomEvent('av-chapterselect', {
        detail: { canvasId, time },
        bubbles: true,
        composed: true,
      }));
      this.controller.selectCanvas(canvasId, { time, autoplay: this.controller.state.status === 'playing' });
    }));
    this.#sync();
  }

  /* A chapter is current while its Canvas plays and the time is within it; one without a time covers its Canvas. */
  #sync(): void {
    const canvasId = this.controller.canvas?.id;
    const time = this.controller.state.currentTime;
    this.#root.querySelectorAll<HTMLElement>('[data-canvas]').forEach((row) => {
      const start = Number(row.dataset.time);
      const end = row.dataset.end ? Number(row.dataset.end) : Number.NaN;
      const inTime = row.dataset.time === undefined || (time >= start && (!Number.isFinite(end) || time < end));
      const active = row.dataset.canvas === canvasId && inTime;
      const button = row.querySelector(':scope > button');
      button?.classList.toggle('active', active);
      if (active) button?.setAttribute('aria-current', 'true');
      else button?.removeAttribute('aria-current');
    });
  }
}

export const defineMangoAVChapters = (tagName = 'mango-av-chapters'): typeof MangoAVChaptersElement => {
  if (typeof customElements === 'undefined') return MangoAVChaptersElement;
  if (!MangoAVChaptersElement.registeredTag && !customElements.get(tagName)) {
    customElements.define(tagName, MangoAVChaptersElement);
    MangoAVChaptersElement.registeredTag = tagName;
  }
  return MangoAVChaptersElement;
};
