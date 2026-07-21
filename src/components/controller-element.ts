import { AVPlayerController } from '../controller';
import type { AVPlayerEventMap } from '../types';

export const HTMLElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export const controllerEventTypes: Array<keyof AVPlayerEventMap> = [
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
  'av-visualizerfallback',
];

export abstract class AVControllerElement extends HTMLElementBase {
  #controller = new AVPlayerController();
  #connected = false;
  #listeners = new Map<keyof AVPlayerEventMap, EventListener>();

  get controller(): AVPlayerController {
    return this.#controller;
  }

  set controller(value: AVPlayerController) {
    if (value === this.#controller) return;
    this.#detachController();
    this.#controller = value;
    if (this.#connected) this.#attachController();
    this.controllerChanged();
  }

  connectedCallback(): void {
    this.#connected = true;
    this.#attachController();
    this.controllerChanged();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    this.#detachController();
  }

  protected get controllerEvents(): Array<keyof AVPlayerEventMap> {
    return controllerEventTypes;
  }

  protected abstract controllerChanged(): void;

  protected abstract handleControllerEvent<K extends keyof AVPlayerEventMap>(
    type: K,
    event: CustomEvent<AVPlayerEventMap[K]>,
  ): void;

  #attachController(): void {
    if (this.#listeners.size > 0) return;
    for (const type of this.controllerEvents) {
      const listener = ((event: CustomEvent) => {
        this.handleControllerEvent(type, event as CustomEvent<AVPlayerEventMap[typeof type]>);
      }) as EventListener;
      this.#controller.addEventListener(type, listener);
      this.#listeners.set(type, listener);
    }
  }

  #detachController(): void {
    for (const [type, listener] of this.#listeners) {
      this.#controller.removeEventListener(type, listener);
    }
    this.#listeners.clear();
  }
}
