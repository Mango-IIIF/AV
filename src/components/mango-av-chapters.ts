import { AVControllerElement } from './controller-element';
import { componentTheme } from './component-styles';
import type { AVPlayerEventMap, AVStrings, Chapter } from '../types';
import { escapeHtml, formatTime, resolveStrings } from '../utils';

const styles = `${componentTheme}
  .chapters { background: var(--mango-av-background); border: 1px solid var(--mango-av-border); border-radius: var(--mango-av-radius); padding: .75rem; }
  h2 { font-size: 1rem; margin: 0 0 .5rem; }
  ul { list-style: none; margin: 0; padding: 0; }
  ul ul { border-left: 1px solid var(--mango-av-border); margin-left: .8rem; padding-left: .55rem; }
  li { margin-block: .3rem; }
  button { background: transparent; border: 0; border-radius: 0; color: inherit; display: grid; gap: .15rem; padding: .5rem; text-align: left; width: 100%; }
  button:hover { background: var(--mango-av-surface); }
  button.active { background: color-mix(in srgb, var(--mango-av-accent) 14%, transparent); box-shadow: inset 3px 0 var(--mango-av-accent); }
`;

const renderChapters = (chapters: Chapter[], canvasId: string, ui: AVStrings, level = 1): string => {
  if (chapters.length === 0 && level === 1) return `<p class="empty">${escapeHtml(ui.noChapters)}</p>`;
  return `<ul>${chapters.map((chapter) => `<li>
    <button type="button" class="${chapter.canvasId === canvasId ? 'active' : ''}" ${chapter.canvasId ? `data-canvas="${escapeHtml(chapter.canvasId)}"` : 'disabled'} ${chapter.time ? `data-time="${chapter.time.start}"` : ''}>
      <span>${escapeHtml(chapter.label)}</span>
      ${chapter.time ? `<span class="time">${formatTime(chapter.time.start)}</span>` : ''}
    </button>
    ${renderChapters(chapter.children, canvasId, ui, level + 1)}
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
  }

  #render(): void {
    const manifest = this.controller.manifest;
    const canvas = this.controller.canvas;
    const ui = resolveStrings(this.controller.config.strings);
    this.#root.innerHTML = `<style>${styles}</style><section class="chapters" aria-label="${escapeHtml(ui.chapters)}">
      <slot name="heading"><h2>${escapeHtml(ui.chapters)}</h2></slot>
      ${manifest && canvas ? renderChapters(manifest.chapters, canvas.id, ui) : `<p class="empty">${escapeHtml(ui.noManifest)}</p>`}
    </section>`;
    this.#root.querySelectorAll<HTMLElement>('[data-canvas]').forEach((button) => button.addEventListener('click', () => {
      const canvasId = button.dataset.canvas;
      if (!canvasId) return;
      const time = Number(button.dataset.time ?? 0);
      this.dispatchEvent(new CustomEvent('av-chapterselect', {
        detail: { canvasId, time },
        bubbles: true,
        composed: true,
      }));
      this.controller.selectCanvas(canvasId, { time, autoplay: this.controller.state.status === 'playing' });
    }));
  }
}

export const defineMangoAVChapters = (tagName = 'mango-av-chapters'): typeof MangoAVChaptersElement => {
  if (typeof customElements === 'undefined') return MangoAVChaptersElement;
  if (!customElements.get(tagName)) customElements.define(tagName, MangoAVChaptersElement);
  return MangoAVChaptersElement;
};
