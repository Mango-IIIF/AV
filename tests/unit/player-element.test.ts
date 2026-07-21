import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { defineMangoAVPlayer } from '../../src/components/mango-av-player';
import { defineMangoAVMedia } from '../../src/components/mango-av-media';

const tagName = 'test-mango-av-player';
const mediaTagName = 'test-mango-av-media';
const videoManifest = {
  id: 'https://example.org/manifest',
  type: 'Manifest',
  items: [{
    id: 'https://example.org/canvas',
    type: 'Canvas',
    items: [{
      type: 'AnnotationPage',
      items: [{
        type: 'Annotation',
        motivation: 'painting',
        body: { id: 'https://media.example.org/movie.mp4', type: 'Video', format: 'video/mp4' },
        target: 'https://example.org/canvas',
      }],
    }],
  }],
};

const audioManifest = {
  id: 'https://example.org/audio-manifest',
  type: 'Manifest',
  items: [{
    id: 'https://example.org/audio-canvas',
    type: 'Canvas',
    duration: 10,
    items: [{
      type: 'AnnotationPage',
      items: [{
        type: 'Annotation',
        motivation: 'painting',
        body: { id: 'https://media.example.org/audio.mp3', type: 'Sound', format: 'audio/mpeg' },
        target: 'https://example.org/audio-canvas',
      }],
    }],
  }],
};

const twoCanvasAudioManifest = {
  ...audioManifest,
  id: 'https://example.org/two-audio-manifest',
  items: [
    audioManifest.items[0],
    {
      ...audioManifest.items[0],
      id: 'https://example.org/audio-canvas-2',
      items: [{
        type: 'AnnotationPage',
        items: [{
          type: 'Annotation',
          motivation: 'painting',
          body: { id: 'https://media.example.org/audio-2.mp3', type: 'Sound', format: 'audio/mpeg' },
          target: 'https://example.org/audio-canvas-2',
        }],
      }],
    },
  ],
};

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const installAudioContext = () => {
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const analyzer = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 256,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn(),
    getByteFrequencyData: vi.fn(),
  };
  const context = {
    state: 'suspended',
    destination: {},
    createMediaElementSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyzer),
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  const AudioContextMock = vi.fn();
  class FakeAudioContext {
    constructor() {
      AudioContextMock();
      return context;
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { AudioContextMock, context, source };
};

describe('MangoAVPlayerElement media CORS configuration', () => {
  beforeAll(() => {
    defineMangoAVPlayer(tagName);
    defineMangoAVMedia(mediaTagName);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('omits crossorigin by default and preserves explicit modes', async () => {
    const player = document.createElement(tagName) as ReturnType<typeof defineMangoAVPlayer>['prototype'];
    document.body.append(player);
    await player.load(videoManifest);

    expect(player.shadowRoot?.querySelector('video')?.hasAttribute('crossorigin')).toBe(false);

    player.config = { crossorigin: 'anonymous' };
    expect(player.shadowRoot?.querySelector('video')?.getAttribute('crossorigin')).toBe('anonymous');

    player.config = { crossorigin: 'use-credentials' };
    expect(player.shadowRoot?.querySelector('video')?.getAttribute('crossorigin')).toBe('use-credentials');
    player.remove();
  });

  it('does not create Web Audio when the visualizer is disabled', async () => {
    const { AudioContextMock } = installAudioContext();
    const player = document.createElement(tagName) as ReturnType<typeof defineMangoAVPlayer>['prototype'];
    document.body.append(player);
    await player.load(audioManifest);
    await settle();
    player.shadowRoot?.querySelector('audio')?.dispatchEvent(new Event('loadedmetadata'));

    expect(AudioContextMock).not.toHaveBeenCalled();
  });

  it('hides the audio artwork title by default and allows custom text', async () => {
    const player = document.createElement(tagName) as ReturnType<typeof defineMangoAVPlayer>['prototype'];
    document.body.append(player);
    await player.load(audioManifest);
    await settle();

    expect(player.shadowRoot?.querySelector('.audio-art-title')).toBeNull();
    expect(player.shadowRoot?.querySelector('audio')?.getAttribute('aria-label')).toBe('Section 1');

    player.config = { audioArt: { title: 'Listen & learn' } };

    expect(player.shadowRoot?.querySelector('.audio-art-title')?.textContent).toBe('Listen & learn');
  });

  it('applies implicit anonymous CORS before src and connects only after load succeeds', async () => {
    const { AudioContextMock, context } = installAudioContext();
    const player = document.createElement(tagName) as ReturnType<typeof defineMangoAVPlayer>['prototype'];
    player.config = { audioArt: { visualizer: true } };
    document.body.append(player);
    const mutations: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) if (record.attributeName) mutations.push(record.attributeName);
    });
    observer.observe(player.shadowRoot!, { attributes: true, subtree: true });

    await player.load(audioManifest);
    await settle();
    const audio = player.shadowRoot?.querySelector('audio');
    observer.takeRecords().forEach((record) => { if (record.attributeName) mutations.push(record.attributeName); });

    expect(audio?.crossOrigin).toBe('anonymous');
    expect(audio?.src).toBe('https://media.example.org/audio.mp3');
    expect(mutations.indexOf('crossorigin')).toBeLessThan(mutations.indexOf('src'));
    expect(AudioContextMock).not.toHaveBeenCalled();

    audio?.dispatchEvent(new Event('loadedmetadata'));
    expect(AudioContextMock).toHaveBeenCalledOnce();
    expect(context.createMediaElementSource).toHaveBeenCalledWith(audio);
    observer.disconnect();
  });

  it.each(['anonymous', 'use-credentials'] as const)('does not weaken an explicit %s failure', async (crossorigin) => {
    const player = document.createElement(tagName) as ReturnType<typeof defineMangoAVPlayer>['prototype'];
    player.config = { crossorigin, audioArt: { visualizer: true } };
    const fallback = vi.fn();
    player.addEventListener('av-visualizerfallback', fallback);
    document.body.append(player);
    await player.load(audioManifest);
    await settle();
    const audio = player.shadowRoot?.querySelector('audio');

    audio?.dispatchEvent(new Event('error'));

    expect(audio?.crossOrigin).toBe(crossorigin);
    expect(player.controller.state.status).toBe('error');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('retains an explicit empty policy and keeps cross-origin audio off Web Audio', async () => {
    const { AudioContextMock } = installAudioContext();
    const player = document.createElement(tagName) as ReturnType<typeof defineMangoAVPlayer>['prototype'];
    player.config = { crossorigin: '', audioArt: { visualizer: true } };
    document.body.append(player);
    await player.load(audioManifest);
    await settle();
    const audio = player.shadowRoot?.querySelector('audio');
    audio?.dispatchEvent(new Event('loadedmetadata'));

    expect(audio?.hasAttribute('crossorigin')).toBe(false);
    expect(AudioContextMock).not.toHaveBeenCalled();
  });

  it('falls back once by replacing a failed implicit-CORS audio element', async () => {
    const { AudioContextMock } = installAudioContext();
    const player = document.createElement(tagName) as ReturnType<typeof defineMangoAVPlayer>['prototype'];
    player.config = { audioArt: { visualizer: true } };
    const fallback = vi.fn();
    player.addEventListener('av-visualizerfallback', fallback);
    document.body.append(player);
    await player.load(audioManifest);
    await settle();
    const failed = player.shadowRoot?.querySelector('audio');

    failed?.dispatchEvent(new Event('error'));
    const replacement = player.shadowRoot?.querySelector('audio');

    expect(replacement).not.toBe(failed);
    expect(replacement?.hasAttribute('crossorigin')).toBe(false);
    expect(replacement?.src).toBe('https://media.example.org/audio.mp3');
    expect(player.controller.media).toBe(replacement);
    expect(player.controller.state.status).not.toBe('error');
    expect(AudioContextMock).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledOnce();
    expect((fallback.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      canvasId: 'https://example.org/audio-canvas',
      sourceUrl: 'https://media.example.org/audio.mp3',
      reason: 'cors',
    });

    failed?.dispatchEvent(new Event('error'));
    replacement?.dispatchEvent(new Event('error'));
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('closes the old graph and resets fallback state when the source changes', async () => {
    const { context } = installAudioContext();
    const player = document.createElement(tagName) as ReturnType<typeof defineMangoAVPlayer>['prototype'];
    player.config = { audioArt: { visualizer: true } };
    document.body.append(player);
    await player.load(twoCanvasAudioManifest);
    await settle();
    const first = player.shadowRoot?.querySelector('audio');
    first?.dispatchEvent(new Event('loadedmetadata'));

    player.selectCanvas(1);
    await settle();
    const second = player.shadowRoot?.querySelector('audio');

    expect(context.close).toHaveBeenCalledOnce();
    expect(second).not.toBe(first);
    expect(second?.src).toBe('https://media.example.org/audio-2.mp3');
    expect(second?.crossOrigin).toBe('anonymous');
  });

  it('uses the same safe fallback path in the complete media element', async () => {
    const media = document.createElement(mediaTagName) as ReturnType<typeof defineMangoAVMedia>['prototype'];
    media.config = { audioArt: { visualizer: true } };
    const fallback = vi.fn();
    media.addEventListener('av-visualizerfallback', fallback);
    document.body.append(media);
    await media.load(audioManifest);
    await settle();
    const failed = media.shadowRoot?.querySelector('audio');

    failed?.dispatchEvent(new Event('error'));
    const replacement = media.shadowRoot?.querySelector('audio');

    expect(replacement).not.toBe(failed);
    expect(replacement?.hasAttribute('crossorigin')).toBe(false);
    expect(media.controller.media).toBe(replacement);
    expect(fallback).toHaveBeenCalledOnce();
  });
});
