import { normalizeManifest } from './iiif/normalize';
import type {
  AVCanvas,
  AVAnnotation,
  AVAnnotationDraft,
  AVManifest,
  AVPlayerConfig,
  AVPlayerEventMap,
  AVPlayerState,
  JsonObject,
  MediaSource,
} from './types';
import { defaultConfig } from './types';
import { mergeConfig, withoutFragment } from './utils';

type ResolvedConfig = AVPlayerConfig & typeof defaultConfig;

interface SavedPosition {
  time: number;
  savedAt: number;
}

const positionPrefix = '@mango-iiif/av:position:';

export class AVPlayerController extends EventTarget {
  #config: ResolvedConfig;
  #state: AVPlayerState = {
    status: 'idle',
    canvasIndex: 0,
    sourceIndex: 0,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    autoAdvance: false,
    repeat: false,
  };
  #media: HTMLMediaElement | undefined;
  #lastTime = 0;
  #timelineScale = 1;
  #pendingTime: number | undefined;
  #boundListeners = new Map<string, EventListener>();
  #crossoriginExplicit: boolean;

  constructor(config: AVPlayerConfig = {}) {
    super();
    this.#crossoriginExplicit = Object.hasOwn(config, 'crossorigin');
    this.#config = mergeConfig(defaultConfig, config) as ResolvedConfig;
    this.#state.autoAdvance = this.#config.autoAdvance;
    this.#state.repeat = this.#config.repeat;
  }

  get config(): Readonly<ResolvedConfig> {
    return this.#config;
  }

  get state(): Readonly<AVPlayerState> {
    return this.#state;
  }

  get manifest(): AVManifest | undefined {
    return this.#state.manifest;
  }

  get canvas(): AVCanvas | undefined {
    return this.#state.manifest?.canvases[this.#state.canvasIndex];
  }

  get source(): MediaSource | undefined {
    return this.canvas?.sources[this.#state.sourceIndex];
  }

  get media(): HTMLMediaElement | undefined {
    return this.#media;
  }

  /** Whether the host explicitly selected the media element CORS policy. */
  get crossoriginExplicit(): boolean {
    return this.#crossoriginExplicit;
  }

  on<K extends keyof AVPlayerEventMap>(
    type: K,
    listener: (event: CustomEvent<AVPlayerEventMap[K]>) => void,
  ): () => void {
    const eventListener = listener as EventListener;
    this.addEventListener(type, eventListener);
    return () => this.removeEventListener(type, eventListener);
  }

  configure(config: AVPlayerConfig): void {
    if (Object.hasOwn(config, 'crossorigin')) this.#crossoriginExplicit = true;
    this.#config = mergeConfig(
      this.#config as unknown as Record<string, unknown>,
      config as unknown as Record<string, unknown>,
    ) as unknown as ResolvedConfig;
    if (config.autoAdvance !== undefined) this.#state.autoAdvance = config.autoAdvance;
    if (config.repeat !== undefined) this.#state.repeat = config.repeat;
    this.#emit('av-configchange', { config: this.#config });
    this.#emitState();
  }

  async load(input: JsonObject | string): Promise<AVManifest> {
    this.#state.status = 'loading';
    delete this.#state.error;
    this.#emit('av-loadstart', { source: input });
    this.#emitState();
    try {
      const normalizeOptions: Parameters<typeof normalizeManifest>[1] = {
        preferredLanguages: this.#config.preferredLanguages,
        strings: this.#config.strings,
      };
      if (this.#config.fetch) normalizeOptions.fetch = this.#config.fetch;
      if (this.#config.requestInit) normalizeOptions.requestInit = this.#config.requestInit;
      const manifest = await normalizeManifest(input, normalizeOptions);
      this.#state.manifest = manifest;
      const requestedCanvas = this.#config.startCanvasId ?? manifest.start?.canvasId;
      const canvasIndex = requestedCanvas
        ? Math.max(0, manifest.canvases.findIndex((canvas) => canvas.id === withoutFragment(requestedCanvas)))
        : 0;
      this.#state.canvasIndex = canvasIndex;
      this.#state.sourceIndex = 0;
      this.#timelineScale = 1;
      this.#state.currentTime = 0;
      this.#state.duration = this.canvas?.duration ?? 0;
      this.#state.autoAdvance = this.#config.autoAdvance || manifest.behavior.includes('auto-advance');
      this.#state.repeat = this.#config.repeat || manifest.behavior.includes('repeat');
      this.#state.status = 'ready';
      const initialTime = this.#config.startTime ?? manifest.start?.time ?? this.source?.canvasTarget?.start;
      if (initialTime !== undefined) this.#pendingTime = initialTime;
      this.#emit('av-ready', { manifest });
      const canvas = this.canvas;
      if (canvas) this.#emit('av-canvaschange', { canvas, canvasIndex });
      this.#emitState();
      return manifest;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.#state.status = 'error';
      this.#state.error = error;
      this.#emit('av-error', { error });
      this.#emitState();
      throw error;
    }
  }

  attachMedia(media: HTMLMediaElement): void {
    if (this.#media === media) return;
    this.detachMedia();
    this.#media = media;
    const listeners: Record<string, EventListener> = {
      loadedmetadata: () => {
        const segment = this.source?.segment;
        const target = this.source?.canvasTarget;
        if (this.source?.timeMode === 'scale' && target?.end !== undefined && Number.isFinite(media.duration)) {
          const sourceDuration = segment?.end !== undefined ? segment.end - segment.start : media.duration;
          const targetDuration = target.end - target.start;
          if (sourceDuration > 0 && targetDuration > 0) {
            this.#timelineScale = sourceDuration / targetDuration;
            media.playbackRate = this.#timelineScale;
          }
        }
        const pending = this.#pendingTime ?? target?.start;
        if (pending !== undefined) {
          media.currentTime = this.#toMediaTime(pending);
          this.#pendingTime = undefined;
        }
        this.#state.duration = this.canvas?.duration ?? target?.end ?? (Number.isFinite(media.duration) ? this.#toCanvasTime(media.duration) : 0);
        this.#emitState();
      },
      play: () => {
        this.#state.status = 'playing';
        this.#emit('av-play', { canvasId: this.canvas?.id ?? '', time: this.#toCanvasTime(media.currentTime) });
        this.#emitState();
      },
      pause: () => {
        if (!media.ended) this.#state.status = 'paused';
        this.#savePosition();
        this.#emit('av-pause', { canvasId: this.canvas?.id ?? '', time: this.#toCanvasTime(media.currentTime) });
        this.#emitState();
      },
      timeupdate: () => {
        const time = this.#toCanvasTime(media.currentTime);
        const duration = this.canvas?.duration ?? this.source?.canvasTarget?.end ?? (Number.isFinite(media.duration) ? this.#toCanvasTime(media.duration) : 0);
        this.#state.currentTime = time;
        this.#state.duration = duration;
        this.#emit('av-timeupdate', { canvasId: this.canvas?.id ?? '', time, duration });
        const end = this.source?.canvasTarget?.end ?? (this.source?.segment?.end !== undefined ? this.#toCanvasTime(this.source.segment.end) : undefined);
        if (end !== undefined && time >= end) {
          if (this.source?.timeMode === 'loop') {
            media.currentTime = this.source.segment?.start ?? 0;
          } else {
            media.pause();
            void this.#advanceAfterEnd();
          }
        }
        this.#lastTime = time;
        this.#emitState();
      },
      seeking: () => {
        const time = this.#toCanvasTime(media.currentTime);
        this.#state.currentTime = time;
        this.#emit('av-seek', { canvasId: this.canvas?.id ?? '', from: this.#lastTime, to: time });
        this.#emitState();
      },
      volumechange: () => {
        this.#state.volume = media.volume;
        this.#state.muted = media.muted;
        this.#emitState();
      },
      ratechange: () => {
        this.#state.playbackRate = media.playbackRate;
        this.#emitState();
      },
      ended: () => {
        this.#state.status = 'ended';
        this.#emit('av-ended', { canvasId: this.canvas?.id ?? '' });
        this.#clearPosition();
        this.#emitState();
        void this.#advanceAfterEnd();
      },
      error: () => {
        const error = new Error(media.error?.message ?? 'The media resource could not be played.');
        this.#state.status = 'error';
        this.#state.error = error;
        this.#emit('av-error', { error });
        this.#emitState();
      },
    };
    for (const [type, listener] of Object.entries(listeners)) {
      media.addEventListener(type, listener);
      this.#boundListeners.set(type, listener);
    }
  }

  detachMedia(): void {
    if (!this.#media) return;
    for (const [type, listener] of this.#boundListeners) this.#media.removeEventListener(type, listener);
    this.#boundListeners.clear();
    this.#media = undefined;
  }

  async play(): Promise<void> {
    await this.#media?.play();
  }

  pause(): void {
    this.#media?.pause();
  }

  stop(): void {
    this.pause();
    this.seekTo(this.source?.canvasTarget?.start ?? 0);
  }

  seekTo(time: number): void {
    const source = this.source;
    const minimum = source?.canvasTarget?.start ?? 0;
    const maximum = source?.canvasTarget?.end ?? this.#state.duration;
    const target = maximum > 0 ? Math.min(Math.max(time, minimum), maximum) : Math.max(time, minimum);
    if (this.#media && this.#media.readyState > 0) this.#media.currentTime = this.#toMediaTime(target);
    else this.#pendingTime = target;
    this.#state.currentTime = target;
    this.#emitState();
  }

  seekBy(delta: number): void {
    this.seekTo(this.#state.currentTime + delta);
  }

  selectCanvas(indexOrId: number | string, options: { time?: number; autoplay?: boolean } = {}): AVCanvas | undefined {
    const canvases = this.#state.manifest?.canvases ?? [];
    const index = typeof indexOrId === 'number'
      ? indexOrId
      : canvases.findIndex((canvas) => canvas.id === withoutFragment(indexOrId));
    if (index < 0 || index >= canvases.length) return undefined;
    const wasPlaying = options.autoplay ?? this.#state.status === 'playing';
    const canvas = canvases[index];
    const time = options.time ?? canvas?.sources[0]?.canvasTarget?.start ?? 0;
    if (index === this.#state.canvasIndex) {
      this.seekTo(time);
      if (wasPlaying) queueMicrotask(() => void this.play());
      return canvas;
    }
    this.#state.canvasIndex = index;
    this.#state.sourceIndex = 0;
    this.#timelineScale = 1;
    this.#state.currentTime = time;
    this.#state.duration = canvas?.duration ?? 0;
    this.#pendingTime = this.#state.currentTime;
    if (canvas) this.#emit('av-canvaschange', { canvas, canvasIndex: index });
    this.#emitState();
    if (wasPlaying) queueMicrotask(() => void this.play());
    return canvas;
  }

  next(options: { autoplay?: boolean } = {}): AVCanvas | undefined {
    const count = this.#state.manifest?.canvases.length ?? 0;
    if (this.#state.canvasIndex + 1 < count) return this.selectCanvas(this.#state.canvasIndex + 1, options);
    if (this.#state.repeat && count > 0) return this.selectCanvas(0, options);
    return undefined;
  }

  previous(options: { autoplay?: boolean } = {}): AVCanvas | undefined {
    if (this.#state.canvasIndex > 0) return this.selectCanvas(this.#state.canvasIndex - 1, options);
    return undefined;
  }

  selectSource(index: number): MediaSource | undefined {
    const sources = this.canvas?.sources ?? [];
    const source = sources[index];
    if (!source) return undefined;
    const wasPlaying = this.#state.status === 'playing';
    const currentTime = this.#state.currentTime;
    this.#state.sourceIndex = index;
    this.#timelineScale = 1;
    this.#pendingTime = currentTime;
    this.#emit('av-sourcechange', { source, sourceIndex: index });
    this.#emitState();
    if (wasPlaying) queueMicrotask(() => void this.play());
    return source;
  }

  async createAnnotation(draft: AVAnnotationDraft): Promise<AVAnnotation> {
    const canvas = this.canvas;
    if (!canvas) throw new Error('A Canvas must be active before creating an annotation.');
    const created = this.#config.annotationAdapter?.create
      ? await this.#config.annotationAdapter.create(canvas, draft)
      : this.#annotationFromDraft(canvas, draft);
    canvas.annotations.push(created);
    this.#emit('av-annotationschange', { canvasId: canvas.id, annotations: [...canvas.annotations] });
    this.#emitState();
    return created;
  }

  async updateAnnotation(id: string, update: Partial<AVAnnotationDraft>): Promise<AVAnnotation> {
    const canvas = this.canvas;
    if (!canvas) throw new Error('A Canvas must be active before updating an annotation.');
    const index = canvas.annotations.findIndex((annotation) => annotation.id === id);
    const current = canvas.annotations[index];
    if (!current) throw new Error(`Annotation ${id} was not found on the active Canvas.`);
    const candidate: AVAnnotation = {
      ...current,
      ...update,
      motivation: update.motivation ?? current.motivation,
      purpose: update.purpose ?? current.purpose,
      tags: update.tags ?? current.tags,
    };
    const saved = this.#config.annotationAdapter?.update
      ? await this.#config.annotationAdapter.update(canvas, candidate)
      : candidate;
    canvas.annotations[index] = saved;
    this.#emit('av-annotationschange', { canvasId: canvas.id, annotations: [...canvas.annotations] });
    this.#emitState();
    return saved;
  }

  async removeAnnotation(id: string): Promise<void> {
    const canvas = this.canvas;
    if (!canvas) throw new Error('A Canvas must be active before removing an annotation.');
    const index = canvas.annotations.findIndex((annotation) => annotation.id === id);
    const current = canvas.annotations[index];
    if (!current) throw new Error(`Annotation ${id} was not found on the active Canvas.`);
    if (this.#config.annotationAdapter?.remove) await this.#config.annotationAdapter.remove(canvas, current);
    canvas.annotations.splice(index, 1);
    this.#emit('av-annotationschange', { canvasId: canvas.id, annotations: [...canvas.annotations] });
    this.#emitState();
  }

  setAutoAdvance(enabled: boolean): void {
    this.#state.autoAdvance = enabled;
    this.#emitState();
  }

  setRepeat(enabled: boolean): void {
    this.#state.repeat = enabled;
    this.#emitState();
  }

  getSavedPosition(): number | undefined {
    if (!this.#config.resume.enabled || !this.canvas || typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(`${positionPrefix}${this.#state.manifest?.id}:${this.canvas.id}`);
    if (!raw) return undefined;
    try {
      const saved = JSON.parse(raw) as SavedPosition;
      const ttl = (this.#config.resume.ttlDays ?? 30) * 86_400_000;
      if (Date.now() - saved.savedAt > ttl) {
        this.#clearPosition();
        return undefined;
      }
      return saved.time;
    } catch {
      return undefined;
    }
  }

  destroy(): void {
    this.#savePosition();
    this.detachMedia();
  }

  async resolvedSourceUrl(): Promise<string | undefined> {
    const source = this.source;
    if (!source) return undefined;
    if (!this.#config.resolveRequest) return source.src;
    const context: { manifest?: AVManifest; canvas?: AVCanvas } = {};
    if (this.manifest) context.manifest = this.manifest;
    if (this.canvas) context.canvas = this.canvas;
    return await this.#config.resolveRequest(source.src, context);
  }

  async #advanceAfterEnd(): Promise<void> {
    if (!this.#state.autoAdvance) return;
    const next = this.next({ autoplay: true });
    if (!next) this.#state.status = 'ended';
  }

  #savePosition(): void {
    if (!this.#config.resume.enabled || !this.canvas || typeof localStorage === 'undefined') return;
    const time = this.#state.currentTime;
    if (time <= 0 || (this.#state.duration > 0 && time >= this.#state.duration - 2)) return;
    const key = `${positionPrefix}${this.#state.manifest?.id}:${this.canvas.id}`;
    localStorage.setItem(key, JSON.stringify({ time, savedAt: Date.now() } satisfies SavedPosition));
    const keys = Object.keys(localStorage).filter((item) => item.startsWith(positionPrefix));
    const maxItems = this.#config.resume.maxItems ?? 200;
    if (keys.length > maxItems) {
      const oldest = keys
        .map((item) => ({ item, value: JSON.parse(localStorage.getItem(item) ?? '{}') as Partial<SavedPosition> }))
        .sort((a, b) => (a.value.savedAt ?? 0) - (b.value.savedAt ?? 0))[0];
      if (oldest) localStorage.removeItem(oldest.item);
    }
  }

  #clearPosition(): void {
    if (!this.canvas || typeof localStorage === 'undefined') return;
    localStorage.removeItem(`${positionPrefix}${this.#state.manifest?.id}:${this.canvas.id}`);
  }

  #emit<K extends keyof AVPlayerEventMap>(type: K, detail: AVPlayerEventMap[K]): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: false, composed: false }));
  }

  #emitState(): void {
    this.#emit('av-statechange', { ...this.#state });
  }

  #annotationFromDraft(canvas: AVCanvas, draft: AVAnnotationDraft): AVAnnotation {
    const annotation: AVAnnotation = {
      id: `${canvas.id}/annotation/${crypto.randomUUID?.() ?? Date.now()}`,
      canvasId: canvas.id,
      motivation: draft.motivation ?? ['commenting'],
      purpose: draft.purpose ?? ['commenting'],
      text: draft.text,
      tags: draft.tags ?? [],
    };
    if (draft.label) annotation.label = draft.label;
    if (draft.time) annotation.time = draft.time;
    return annotation;
  }

  #toCanvasTime(mediaTime: number): number {
    const sourceStart = this.source?.segment?.start ?? 0;
    const targetStart = this.source?.canvasTarget?.start ?? 0;
    const scale = this.source?.timeMode === 'scale' ? this.#timelineScale : 1;
    return targetStart + ((mediaTime - sourceStart) / scale);
  }

  #toMediaTime(canvasTime: number): number {
    const sourceStart = this.source?.segment?.start ?? 0;
    const targetStart = this.source?.canvasTarget?.start ?? 0;
    const scale = this.source?.timeMode === 'scale' ? this.#timelineScale : 1;
    return sourceStart + ((canvasTime - targetStart) * scale);
  }
}
