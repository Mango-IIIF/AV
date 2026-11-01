import { AVControllerElement } from './controller-element';
import { componentTheme, panelStyles } from './component-styles';
import { playFromInteraction } from './playback';
import { markActiveRow } from './timed-rows';
import type { AVAnnotation, AVPlayerEventMap, AVStrings } from '../types';
import { escapeHtml, formatTime, resolveStrings } from '../utils';

const styles = `${componentTheme}${panelStyles}`;

const annotationsHtml = (annotations: AVAnnotation[], ui: AVStrings): string => {
  if (annotations.length === 0) return `<p class="empty">${escapeHtml(ui.noAnnotations)}</p>`;
  return `<ol class="list">${annotations.map((annotation) => `<li data-start="${annotation.time?.start ?? ''}" data-end="${annotation.time?.end ?? ''}">
    <button type="button" class="row" ${annotation.time ? '' : 'disabled'}>
      <time>${annotation.time ? formatTime(annotation.time.start) : '—'}</time>
      <span class="text">
        <span>${escapeHtml(annotation.text || annotation.label || '')}</span>
        ${annotation.tags.length > 0 ? `<span class="tags">${annotation.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>` : ''}
      </span>
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
    else if (type === 'av-timeupdate' || type === 'av-seek' || type === 'av-statechange') markActiveRow(this.#root, this.controller.state.currentTime);
  }

  #render(): void {
    const canvas = this.controller.canvas;
    const ui = resolveStrings(this.controller.config.strings);
    this.#root.innerHTML = `<style>${styles}</style><section class="panel" aria-label="${escapeHtml(ui.annotations)}">
      <slot name="heading"><h2>${escapeHtml(ui.annotations)}</h2></slot>
      ${canvas ? annotationsHtml(canvas.annotations, ui) : `<p class="empty">${escapeHtml(ui.noManifest)}</p>`}
    </section>`;
    this.#root.querySelectorAll<HTMLElement>('[data-start] > button').forEach((button) => button.addEventListener('click', () => {
      const start = Number(button.parentElement?.dataset.start);
      if (button.parentElement?.dataset.start === '' || !Number.isFinite(start)) return;
      this.dispatchEvent(new CustomEvent('av-annotationselect', { detail: { time: start }, bubbles: true, composed: true }));
      this.controller.seekTo(start);
      playFromInteraction(this.controller, this);
    }));
    markActiveRow(this.#root, this.controller.state.currentTime);
  }
}

export const defineMangoAVAnnotations = (tagName = 'mango-av-annotations'): typeof MangoAVAnnotationsElement => {
  if (typeof customElements === 'undefined') return MangoAVAnnotationsElement;
  if (!MangoAVAnnotationsElement.registeredTag && !customElements.get(tagName)) {
    customElements.define(tagName, MangoAVAnnotationsElement);
    MangoAVAnnotationsElement.registeredTag = tagName;
  }
  return MangoAVAnnotationsElement;
};
