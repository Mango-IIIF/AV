import type { AVAudioVisualizerMode, TranscriptCue } from '../types';
import { escapeHtml } from '../utils';

export const audioArtTranscriptHtml = (label: string, title: string, cues: TranscriptCue[], enabled: boolean): string => {
  if (!enabled || cues.length === 0) return title ? `<span class="audio-art-title">${escapeHtml(title)}</span>` : '';
  return `<div class="audio-art-transcript" aria-live="polite" aria-label="${escapeHtml(label)}">
    ${cues.map((cue) => `<div class="audio-art-cue" data-audio-cue data-start="${cue.start ?? ''}" data-end="${cue.end ?? cue.start ?? ''}">${cue.speaker ? `<span class="audio-art-speaker">${escapeHtml(cue.speaker)}</span>` : ''}<span>${escapeHtml(cue.text)}</span></div>`).join('')}
  </div>`;
};

export const resolveAudioVisualizerMode = (
  value: boolean | AVAudioVisualizerMode | undefined,
): AVAudioVisualizerMode | undefined => value === true ? 'pulse' : value || undefined;

const VISUALIZER_COLOR_FALLBACK = '#5b3fd6';

/**
 * Registering the intensity keeps a malformed host value from invalidating the
 * artwork background, which would otherwise drop the base gradient along with
 * the pulse and leave the panel transparent. Registration must happen through
 * the API rather than an `@property` rule in the component's styles, because
 * property registrations are document-scoped and a rule inside a shadow tree is
 * ignored. Browsers without the API keep the `var()` defaults written alongside
 * each use, which cover every case but a malformed value.
 *
 * The colour is deliberately left unregistered: an initial value would be
 * substituted ahead of the `var()` fallback and stop the visualizer following
 * `--mango-av-accent` when the host has set no colour of its own.
 */
let visualizerPropertiesRegistered = false;

export const registerVisualizerProperties = (): void => {
  if (visualizerPropertiesRegistered) return;
  visualizerPropertiesRegistered = true;
  if (typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') return;
  try {
    CSS.registerProperty({
      name: '--mango-av-visualizer-intensity',
      syntax: '<number>',
      inherits: true,
      initialValue: '1',
    });
  } catch { /* Already registered by another instance or bundle on this page. */ }
};

/**
 * `--mango-av-visualizer-intensity` scales how strongly the visualizer renders
 * without touching the analysed audio level, so `1` reproduces the package
 * default exactly and `0` hides the visualizer while playback continues.
 */
export const resolveVisualizerIntensity = (value: string): number => {
  const intensity = Number.parseFloat(value);
  return Number.isFinite(intensity) && intensity >= 0 ? intensity : 1;
};

/**
 * Intensity scales the trace itself, not only its opacity, so the control reads
 * as strength rather than as a fade. The existing ceiling is applied last and so
 * still holds at any intensity, keeping the wave inside the artwork.
 */
export const waveformAmplitude = (
  height: number,
  level: number,
  intensity: number,
  reducedMotion: boolean,
): number => reducedMotion ? 0 : Math.min(height * .16, (5 + level * height * .12) * intensity);

/** Bars are capped at the height an unscaled full-energy bar would reach. */
export const spectrumBarHeight = (height: number, energy: number, intensity: number): number =>
  Math.max(1, Math.min(height * .32, energy * height * .32 * intensity));

/**
 * The visualizer colour and intensity are read per frame rather than cached, so
 * a theme change or a host stylesheet swap takes effect without reconnecting
 * the Web Audio graph.
 */
const readVisualizerStyle = (art: HTMLElement): { color: string; intensity: number } => {
  const styles = getComputedStyle(art);
  return {
    color: styles.getPropertyValue('--mango-av-visualizer-color').trim()
      || styles.getPropertyValue('--mango-av-accent').trim()
      || VISUALIZER_COLOR_FALLBACK,
    intensity: resolveVisualizerIntensity(styles.getPropertyValue('--mango-av-visualizer-intensity')),
  };
};

export const audioArtContentHtml = (
  label: string,
  title: string,
  cues: TranscriptCue[],
  transcriptEnabled: boolean,
  visualizerMode?: AVAudioVisualizerMode,
): string => `<div class="audio-art-text">${audioArtTranscriptHtml(label, title, cues, transcriptEnabled)}</div>${visualizerMode === 'waveform' || visualizerMode === 'spectrum' ? `<canvas class="audio-art-visualizer-canvas" aria-hidden="true"></canvas>` : ''}`;

export const syncAudioArtTranscript = (root: ParentNode, time: number, instant = false): void => {
  const cues = [...root.querySelectorAll<HTMLElement>('[data-audio-cue]')];
  if (cues.length === 0) return;
  const transcript = root.querySelector<HTMLElement>('.audio-art-transcript');
  if (instant && transcript) {
    transcript.classList.add('seeking');
    requestAnimationFrame(() => transcript.classList.remove('seeking'));
  }

  let activeIndex = cues.findIndex((cue) => {
    const start = Number(cue.dataset.start);
    const end = Number(cue.dataset.end);
    return Number.isFinite(start) && time >= start && (!Number.isFinite(end) || time < end);
  });
  if (activeIndex < 0) {
    for (let index = cues.length - 1; index >= 0; index -= 1) {
      const cue = cues[index];
      if (cue && Number.isFinite(Number(cue.dataset.start)) && time >= Number(cue.dataset.start)) {
        activeIndex = index;
        break;
      }
    }
  }
  if (activeIndex < 0) activeIndex = 0;

  cues.forEach((cue, index) => {
    const offset = index - activeIndex;
    cue.classList.toggle('active', offset === 0);
    cue.classList.toggle('adjacent', Math.abs(offset) === 1);
    cue.toggleAttribute('aria-hidden', offset !== 0);
    cue.style.opacity = offset === 0 ? '1' : Math.abs(offset) === 1 ? '.2' : '0';
    cue.style.transform = `translateY(calc(-50% + ${offset * 4.25}rem))`;
    cue.style.visibility = Math.abs(offset) <= 1 ? 'visible' : 'hidden';
  });
};

export class AudioArtVisualizer {
  #token = 0;
  #context: AudioContext | undefined;
  #source: MediaElementAudioSourceNode | undefined;
  #analyzer: AnalyserNode | undefined;
  #frame = 0;
  #level = 0;
  #media: HTMLMediaElement | undefined;
  #resume: (() => void) | undefined;

  connect(media: HTMLMediaElement, art: HTMLElement, mode: AVAudioVisualizerMode): void {
    this.disconnect();
    const token = ++this.#token;
    if (typeof AudioContext === 'undefined') return;

    try {
      if (token !== this.#token || !media.isConnected || !art.isConnected) return;
      const context = new AudioContext();
      this.#context = context;
      const source = context.createMediaElementSource(media);
      this.#source = source;
      const analyzer = context.createAnalyser();
      this.#analyzer = analyzer;
      analyzer.fftSize = 512;
      analyzer.smoothingTimeConstant = .95;
      source.connect(context.destination);
      source.connect(analyzer);
      this.#media = media;
      const samples = new Uint8Array(analyzer.fftSize);
      const frequencies = new Uint8Array(analyzer.frequencyBinCount);
      const canvas = art.querySelector<HTMLCanvasElement>('.audio-art-visualizer-canvas');
      const canvasContext = canvas?.getContext('2d');
      const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const resizeCanvas = () => {
        if (!canvas || !canvasContext) return;
        const scale = Math.min(2, devicePixelRatio || 1);
        const width = Math.max(1, Math.round(art.clientWidth * scale));
        const height = Math.max(1, Math.round(art.clientHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        canvasContext.setTransform(scale, 0, 0, scale, 0, 0);
      };
      const drawWaveform = (strength: number) => {
        if (!canvas || !canvasContext) return;
        resizeCanvas();
        const width = art.clientWidth;
        const height = art.clientHeight;
        canvasContext.clearRect(0, 0, width, height);
        if (strength === 0) return;
        const { color, intensity } = readVisualizerStyle(art);
        if (intensity === 0) return;
        canvasContext.globalAlpha = Math.min(1, Math.min(.7, .18 + strength / 100) * intensity);
        canvasContext.strokeStyle = color;
        canvasContext.lineWidth = 1.5;
        canvasContext.beginPath();
        const amplitude = waveformAmplitude(height, this.#level, intensity, reducedMotion);
        for (let index = 0; index < samples.length; index += 1) {
          const x = (index / (samples.length - 1)) * width;
          const sample = (samples[index]! - 128) / 128;
          const y = height * .72 + sample * amplitude;
          if (index === 0) canvasContext.moveTo(x, y);
          else canvasContext.lineTo(x, y);
        }
        canvasContext.stroke();
        canvasContext.globalAlpha = 1;
      };
      const drawSpectrum = (strength: number) => {
        if (!canvas || !canvasContext) return;
        resizeCanvas();
        const width = art.clientWidth;
        const height = art.clientHeight;
        canvasContext.clearRect(0, 0, width, height);
        if (strength === 0) return;
        const { color, intensity } = readVisualizerStyle(art);
        if (intensity === 0) return;
        analyzer.getByteFrequencyData(frequencies);
        const barCount = 24;
        const gap = 3;
        const barWidth = Math.max(1, (width - gap * (barCount - 1)) / barCount);
        canvasContext.fillStyle = color;
        canvasContext.globalAlpha = Math.min(1, (reducedMotion ? .2 : Math.min(.55, .15 + strength / 120)) * intensity);
        for (let index = 0; index < barCount; index += 1) {
          const frequencyIndex = Math.floor((index / barCount) ** 1.7 * frequencies.length * .7);
          const energy = reducedMotion ? .08 : (frequencies[frequencyIndex] ?? 0) / 255;
          const barHeight = spectrumBarHeight(height, energy, intensity);
          canvasContext.fillRect(index * (barWidth + gap), height - barHeight, barWidth, barHeight);
        }
        canvasContext.globalAlpha = 1;
      };
      const draw = () => {
        if (token !== this.#token) return;
        analyzer.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / samples.length);
        const target = media.paused || rms < .012 ? 0 : Math.min(1, (rms - .012) * 5);
        this.#level += (target - this.#level) * (target > this.#level ? .1 : .04);
        if (target === 0 && this.#level < .01) this.#level = 0;
        const strength = reducedMotion
          ? this.#level * 18
          : this.#level === 0 ? 0 : Math.min(52, 12 + this.#level * 40);
        art.style.setProperty('--mango-av-wave-rise', `${(8 - (reducedMotion ? 0 : this.#level * 6)).toFixed(2)}%`);
        art.style.setProperty('--mango-av-wave-strength', `${strength.toFixed(1)}%`);
        art.style.setProperty('--mango-av-wave-mid-strength', `${(strength * .45).toFixed(1)}%`);
        art.style.setProperty('--mango-av-wave-edge-strength', `${(strength * .18).toFixed(1)}%`);
        if (mode === 'waveform') drawWaveform(strength);
        else if (mode === 'spectrum') drawSpectrum(strength);
        this.#frame = requestAnimationFrame(draw);
      };
      draw();
      const resume = () => void context.resume();
      this.#resume = resume;
      media.addEventListener('play', resume, { once: true });
      if (!media.paused) resume();
    } catch {
      this.disconnect();
    }
  }

  disconnect(): void {
    this.#token += 1;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#level = 0;
    if (this.#media && this.#resume) this.#media.removeEventListener('play', this.#resume);
    try { this.#source?.disconnect(); } catch { /* Already disconnected. */ }
    try { this.#analyzer?.disconnect(); } catch { /* Already disconnected. */ }
    if (this.#context && this.#context.state !== 'closed') void this.#context.close();
    this.#analyzer = undefined;
    this.#source = undefined;
    this.#context = undefined;
    this.#media = undefined;
    this.#resume = undefined;
  }
}
