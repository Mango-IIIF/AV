import type { AVAudioVisualizerMode, TranscriptCue } from '../types';
import { escapeHtml } from '../utils';

export const audioArtTranscriptHtml = (label: string, cues: TranscriptCue[], enabled: boolean): string => {
  if (!enabled || cues.length === 0) return `<span class="audio-art-title">${escapeHtml(label)}</span>`;
  return `<div class="audio-art-transcript" aria-live="polite" aria-label="${escapeHtml(label)}">
    ${cues.map((cue) => `<div class="audio-art-cue" data-audio-cue data-start="${cue.start ?? ''}" data-end="${cue.end ?? cue.start ?? ''}">${cue.speaker ? `<span class="audio-art-speaker">${escapeHtml(cue.speaker)}</span>` : ''}<span>${escapeHtml(cue.text)}</span></div>`).join('')}
  </div>`;
};

export const resolveAudioVisualizerMode = (
  value: boolean | AVAudioVisualizerMode | undefined,
): AVAudioVisualizerMode | undefined => value === true ? 'pulse' : value || undefined;

export const audioArtContentHtml = (
  label: string,
  cues: TranscriptCue[],
  transcriptEnabled: boolean,
  visualizerMode?: AVAudioVisualizerMode,
): string => `<div class="audio-art-text">${audioArtTranscriptHtml(label, cues, transcriptEnabled)}</div>${visualizerMode === 'waveform' || visualizerMode === 'spectrum' ? `<canvas class="audio-art-visualizer-canvas" aria-hidden="true"></canvas>` : ''}`;

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

  connect(media: HTMLMediaElement, art: HTMLElement, mode: AVAudioVisualizerMode): void {
    this.disconnect();
    const token = ++this.#token;
    if (typeof AudioContext === 'undefined') return;

    try {
      if (token !== this.#token || !media.isConnected || !art.isConnected) return;
      const context = new AudioContext();
      const source = context.createMediaElementSource(media);
      const analyzer = context.createAnalyser();
      analyzer.fftSize = 512;
      analyzer.smoothingTimeConstant = .95;
      source.connect(context.destination);
      source.connect(analyzer);
      this.#context = context;
      this.#source = source;
      this.#analyzer = analyzer;
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
        const accent = getComputedStyle(art).getPropertyValue('--mango-av-accent').trim() || '#5b3fd6';
        canvasContext.globalAlpha = Math.min(.7, .18 + strength / 100);
        canvasContext.strokeStyle = accent;
        canvasContext.lineWidth = 1.5;
        canvasContext.beginPath();
        const amplitude = reducedMotion ? 0 : Math.min(height * .16, 5 + this.#level * height * .12);
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
        analyzer.getByteFrequencyData(frequencies);
        const accent = getComputedStyle(art).getPropertyValue('--mango-av-accent').trim() || '#5b3fd6';
        const barCount = 24;
        const gap = 3;
        const barWidth = Math.max(1, (width - gap * (barCount - 1)) / barCount);
        canvasContext.fillStyle = accent;
        canvasContext.globalAlpha = reducedMotion ? .2 : Math.min(.55, .15 + strength / 120);
        for (let index = 0; index < barCount; index += 1) {
          const frequencyIndex = Math.floor((index / barCount) ** 1.7 * frequencies.length * .7);
          const energy = reducedMotion ? .08 : (frequencies[frequencyIndex] ?? 0) / 255;
          const barHeight = Math.max(1, energy * height * .32);
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
    try { this.#source?.disconnect(); } catch { /* Already disconnected. */ }
    if (this.#context && this.#context.state !== 'closed') void this.#context.close();
    this.#analyzer = undefined;
    this.#source = undefined;
    this.#context = undefined;
  }
}
