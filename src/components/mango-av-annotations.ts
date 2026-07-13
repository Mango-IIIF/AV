import { AVControllerElement } from './controller-element';
import { componentTheme } from './component-styles';
import { playFromInteraction } from './playback';
import type { AVAnnotation, AVPlayerEventMap, AVStrings } from '../types';
import { escapeHtml, formatTime, resolveStrings } from '../utils';

const styles = `${componentTheme}
  .annotations { background: var(--mango-av-background); border: 1px solid var(--mango-av-border); border-radius: var(--mango-av-radius); padding: .75rem; }
  h2 { font-size: 1rem; margin: 0 0 .5rem; }
  ol { list-style: none; margin: 0; padding: 0; }
  button { background: transparent; border: 0; border-radius: .35rem; color: inherit; display: grid; gap: .2rem; padding: .5rem; text-align: left; width: 100%; }
  button:hover { background: var(--mango-av-surface); }
  button.active { background: color-mix(in srgb, var(--mango-av-accent) 14%, transparent); box-shadow: inset 3px 0 var(--mango-av-accent); }
  .tags { display: flex; flex-wrap: wrap; gap: .25rem; }
  .tag { background: var(--mango-av-surface); border-radius: 999px; font-size: .75rem; padding: .15rem .45rem; }
`;

const annotationsHtml = (annotations: AVAnnotation[], ui: AVStrings): string => {
  if (annotations.length === 0) return `<p class="empty">${escapeHtml(ui.noAnnotations)}</p>`;
  return `<ol>${annotations.map((annotation) => `<li data-start="${annotation.time?.start ?? ''}" data-end="${annotation.time?.end ?? annotation.time?.start ?? ''}">
    <button type="button" ${annotation.time ? '' : 'disabled'}>
      ${annotation.time ? `<span class="time">${formatTime(annotation.time.start)}</span>` : ''}
      <span>${escapeHtml(annotation.text)}</span>
      ${annotation.tags.length > 0 ? `<span class="tags">${annotation.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>` : ''}
    </button>
  </li>`).join('')}</ol>`;
};

export class MangoAVAnnotationsElement extends AVControllerElement {
  #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
  }

  protected controllerChanged(): void { this.#render(); }

  protected handleControllerEvent<K extends keyof AVPlayerEventMap>(type: K, _event: CustomEvent<AVPlayerEventMap[K]>): void {
    if (type === 'av-ready' || type === 'av-canvaschange' || type === 'av-annotationschange' || type === 'av-configchange') this.#render();
    else if (type === 'av-timeupdate' || type === 'av-seek' || type === 'av-statechange') this.#sync();
  }

  #render(): void {
    const canvas = this.controller.canvas;
    const ui = resolveStrings(this.controller.config.strings);
    this.#root.innerHTML = `<style>${styles}</style><section class="annotations" aria-label="${escapeHtml(ui.annotations)}">
      <slot name="heading"><h2>${escapeHtml(ui.annotations)}</h2></slot>
      ${canvas ? annotationsHtml(canvas.annotations, ui) : `<p class="empty">${escapeHtml(ui.noManifest)}</p>`}
    </section>`;
    this.#root.querySelectorAll<HTMLElement>('[data-start] button').forEach((button) => button.addEventListener('click', () => {
      const start = Number(button.parentElement?.dataset.start);
      if (!Number.isFinite(start)) return;
      this.dispatchEvent(new CustomEvent('av-annotationselect', { detail: { time: start }, bubbles: true, composed: true }));
      this.controller.seekTo(start);
      playFromInteraction(this.controller, this);
    }));
    this.#sync();
  }

  #sync(): void {
    const time = this.controller.state.currentTime;
    this.#root.querySelectorAll<HTMLElement>('[data-start][data-end]').forEach((row) => {
      const start = Number(row.dataset.start);
      const end = Number(row.dataset.end);
      row.querySelector('button')?.classList.toggle('active', Number.isFinite(start) && time >= start && (!Number.isFinite(end) || time < end));
    });
  }
}

export const defineMangoAVAnnotations = (tagName = 'mango-av-annotations'): typeof MangoAVAnnotationsElement => {
  if (typeof customElements === 'undefined') return MangoAVAnnotationsElement;
  if (!customElements.get(tagName)) customElements.define(tagName, MangoAVAnnotationsElement);
  return MangoAVAnnotationsElement;
};
