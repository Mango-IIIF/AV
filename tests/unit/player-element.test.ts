import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const { mountRamp, handles } = vi.hoisted(() => {
  const handles: Array<{ destroy: ReturnType<typeof vi.fn> }> = [];
  const mountRamp = vi.fn((_host: HTMLElement, _options: Record<string, unknown>) => {
    const handle = { destroy: vi.fn() };
    handles.push(handle);
    return handle;
  });
  return { mountRamp, handles };
});

vi.mock('../../src/components/ramp', () => ({ rampCss: '.ramp-test {}', mountRamp }));

import { defineMangoAVPlayer } from '../../src/components/mango-av-player';
import { defineMangoAVMedia } from '../../src/components/mango-av-media';
import { AVPlayerController } from '../../src/controller';
import type { RampMountOptions } from '../../src/components/ramp';

const tagName = 'test-mango-av-player';
const mediaTagName = 'test-mango-av-media';

const canvasWith = (id: string, body: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'Canvas',
  duration: 10,
  ...extra,
  items: [{
    type: 'AnnotationPage',
    items: [{ type: 'Annotation', motivation: 'painting', body, target: id }],
  }],
});

const videoManifest = {
  id: 'https://example.org/manifest',
  type: 'Manifest',
  label: { en: ['Video'] },
  items: [canvasWith('https://example.org/canvas', { id: 'https://media.example.org/movie.mp4', type: 'Video', format: 'video/mp4' }, { width: 4, height: 3 })],
};

const audioManifest = {
  id: 'https://example.org/audio-manifest',
  type: 'Manifest',
  label: { en: ['Oral history'] },
  thumbnail: [{ id: 'https://example.org/cover.jpg', type: 'Image' }],
  items: [
    canvasWith('https://example.org/audio-canvas', { id: 'https://media.example.org/audio.mp3', type: 'Sound', format: 'audio/mpeg' }),
    canvasWith('https://example.org/audio-canvas-2', { id: 'https://media.example.org/audio-2.mp3', type: 'Sound', format: 'audio/mpeg' }),
  ],
};

type PlayerElement = ReturnType<typeof defineMangoAVPlayer>['prototype'];
type MediaElement = ReturnType<typeof defineMangoAVMedia>['prototype'];

const lastMount = () => {
  const call = mountRamp.mock.calls.at(-1);
  if (!call) throw new Error('RAMP was not mounted');
  return { host: call[0], options: call[1] as unknown as RampMountOptions };
};

const mounted = async (count = 1) => {
  await vi.waitFor(() => expect(mountRamp).toHaveBeenCalledTimes(count));
  return lastMount();
};

describe('MangoAVPlayerElement with RAMP', () => {
  beforeAll(() => {
    defineMangoAVPlayer(tagName);
    defineMangoAVMedia(mediaTagName);
  });

  afterEach(() => {
    document.body.replaceChildren();
    mountRamp.mockClear();
    handles.length = 0;
  });

  it('mounts RAMP with the active Canvas and the resolved source', async () => {
    const player = document.createElement(tagName) as PlayerElement;
    player.config = { resolveRequest: (url) => `${url}?token=1` };
    document.body.append(player);
    await player.load(videoManifest);
    const { host, options } = await mounted();

    expect(player.shadowRoot?.contains(host)).toBe(true);
    const canvas = (options.manifest.items as Array<Record<string, unknown>>)[0];
    const body = (((canvas?.items as Array<Record<string, unknown>>)[0]?.items as Array<Record<string, unknown>>)[0]?.body) as Record<string, unknown>;
    expect(body.id).toBe('https://media.example.org/movie.mp4?token=1');
    expect(options.language).toBe('en');
    expect(options.playbackRate).toBe(true);
    expect(options.pictureInPicture).toBe(true);
    expect(options.skipSeconds).toBe(10);
    expect(player.shadowRoot?.querySelector('style[data-ramp]')?.textContent).toBe('.ramp-test {}');
    expect(player.shadowRoot?.querySelector<HTMLElement>('.player')?.style.getPropertyValue('--mango-av-player-aspect-ratio')).toBe('4 / 3');
  });

  it('attaches the controller to the media element RAMP plays through', async () => {
    const controller = new AVPlayerController();
    await controller.load(videoManifest);
    const player = document.createElement(tagName) as PlayerElement;
    document.body.append(player);
    player.controller = controller;
    const { options } = await mounted();

    const media = document.createElement('video');
    options.onMedia(media);

    expect(controller.media).toBe(media);
  });

  it('maps control settings onto RAMP and the control bar', async () => {
    const player = document.createElement(tagName) as PlayerElement;
    player.config = { controls: { playbackRate: false, volume: false, fullscreen: false, seek: false }, withCredentials: true };
    document.body.append(player);
    await player.load(videoManifest);
    const { options } = await mounted();

    expect(options.playbackRate).toBe(false);
    expect(options.withCredentials).toBe(true);
    expect(options.skipSeconds).toBeUndefined();
    expect(player.shadowRoot?.querySelector('.player')?.getAttribute('data-hide')).toBe('volume seek fullscreen');
  });

  it('shows an audio card with the Manifest label and thumbnail, or a custom title', async () => {
    const player = document.createElement(tagName) as PlayerElement;
    document.body.append(player);
    await player.load(audioManifest);
    const { options } = await mounted();

    expect(options.pictureInPicture).toBe(false);
    expect(player.shadowRoot?.querySelector('.cover h2')?.textContent).toBe('Oral history');
    expect(player.shadowRoot?.querySelector('.cover img')?.getAttribute('src')).toBe('https://example.org/cover.jpg');

    player.config = { audioArt: { title: 'Listen & learn' } };
    expect(player.shadowRoot?.querySelector('.cover h2')?.textContent).toBe('Listen & learn');
  });

  it('remounts RAMP for another Canvas and lets go of the old media', async () => {
    const player = document.createElement(tagName) as PlayerElement;
    document.body.append(player);
    await player.load(audioManifest);
    const first = await mounted();
    const media = document.createElement('audio');
    first.options.onMedia(media);

    player.selectCanvas(1);
    const second = await mounted(2);

    expect(handles[0]?.destroy).toHaveBeenCalledOnce();
    expect(player.controller.media).toBeUndefined();
    expect(((second.options.manifest.items as Array<Record<string, unknown>>)[0])?.id).toBe('https://example.org/audio-canvas-2');
  });

  it('keeps RAMP and playback through a change of strings or panels', async () => {
    const media = document.createElement(mediaTagName) as MediaElement;
    media.config = { controls: { navigation: true } };
    document.body.append(media);
    await media.load(audioManifest);
    await mounted();
    const root = media.shadowRoot!;
    const player = root.querySelector<PlayerElement>('[data-component]');
    const ramp = player?.shadowRoot?.querySelector('.ramp');

    media.config = {
      strings: { recording: 'Enregistrement', next: 'Suivant', transcript: 'Transcription' },
      panels: { chapters: false },
    };

    expect(mountRamp).toHaveBeenCalledOnce();
    expect(handles[0]?.destroy).not.toHaveBeenCalled();
    expect(root.querySelector('[data-component]')).toBe(player);
    expect(player?.shadowRoot?.querySelector('.ramp')).toBe(ramp);
    expect(player?.shadowRoot?.querySelector('.eyebrow')?.textContent).toBe('Enregistrement');
    expect(player?.shadowRoot?.querySelector('[data-action=next]')?.textContent).toContain('Suivant');
    const tabs = [...root.querySelectorAll<HTMLElement>('[role=tab]')].map((tab) => tab.textContent);
    expect(tabs).toEqual(['Transcription', 'Annotations', 'Metadata', 'Files']);
  });

  it('remounts RAMP when a setting it is mounted with changes', async () => {
    const player = document.createElement(tagName) as PlayerElement;
    document.body.append(player);
    await player.load(videoManifest);
    await mounted();

    player.config = { controls: { playbackRate: false } };
    const { options } = await mounted(2);

    expect(handles[0]?.destroy).toHaveBeenCalledOnce();
    expect(options.playbackRate).toBe(false);
  });

  it('gives the player a stage slot for content shown with the media', async () => {
    const player = document.createElement(tagName) as PlayerElement;
    document.body.append(player);
    await player.load(audioManifest);

    // Inside the stage, after the audio card and before the controls.
    expect(player.shadowRoot?.querySelector('.stage > [data-part=cover] > .cover')).toBeTruthy();
    expect(player.shadowRoot?.querySelector('.stage > [data-part=cover] + .stage-slot > slot[name=stage]')).toBeTruthy();
    expect(player.shadowRoot?.querySelector('.stage > .stage-slot + .ramp')).toBeTruthy();
  });

  it('puts audio captions in the complete element\'s player when configured', async () => {
    const media = document.createElement(mediaTagName) as MediaElement;
    media.config = { audioArt: { captions: 'line' } };
    document.body.append(media);
    await media.load(audioManifest);

    const captions = media.shadowRoot?.querySelector<HTMLElement & { controller: AVPlayerController }>('[slot=stage]');
    expect(captions?.parentElement?.matches('[data-component]')).toBe(true);
    expect(captions?.hasAttribute('audio-only')).toBe(true);
    expect(captions?.hasAttribute('line')).toBe(true);
    expect(captions?.controller).toBe(media.controller);

    media.config = { audioArt: { captions: false } };
    expect(media.shadowRoot?.querySelector('[slot=stage]')).toBeNull();
  });

  it('builds the complete element from the player and panels on one controller', async () => {
    const media = document.createElement(mediaTagName) as MediaElement;
    const ready = vi.fn();
    media.addEventListener('av-ready', ready);
    document.body.append(media);
    await media.load(audioManifest);
    await mounted();

    const root = media.shadowRoot!;
    const inner = root.querySelectorAll<HTMLElement & { controller: AVPlayerController }>('[data-component]');
    expect(inner).toHaveLength(4);
    inner.forEach((element) => expect(element.controller).toBe(media.controller));
    expect(ready).toHaveBeenCalledOnce();

    const tabs = [...root.querySelectorAll<HTMLElement>('[role=tab]')].map((tab) => tab.textContent);
    expect(tabs).toEqual(['Transcript', 'Chapters', 'Annotations', 'Metadata', 'Files']);
    expect(root.querySelector<HTMLElement>('[data-panel-body=transcript]')?.hidden).toBe(false);
    root.querySelector<HTMLElement>('[data-panel=chapters]')?.click();
    expect(root.querySelector<HTMLElement>('[data-panel-body=transcript]')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-panel-body=chapters]')?.hidden).toBe(false);
    expect(root.querySelector('.position')?.textContent).toContain('Position');
  });
});
