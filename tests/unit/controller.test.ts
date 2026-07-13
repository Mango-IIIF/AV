import { describe, expect, it, vi } from 'vitest';
import { AVPlayerController } from '../../src/controller';

const manifest = {
  id: 'https://example.org/manifest',
  type: 'Manifest',
  label: { en: ['Controller test'] },
  items: [
    {
      id: 'https://example.org/canvas/1', type: 'Canvas', duration: 10,
      items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', motivation: 'painting', body: { id: 'https://example.org/one.mp4', type: 'Video', format: 'video/mp4' }, target: 'https://example.org/canvas/1' }] }],
    },
    {
      id: 'https://example.org/canvas/2', type: 'Canvas', duration: 20,
      items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', motivation: 'painting', body: { id: 'https://example.org/two.mp4', type: 'Video', format: 'video/mp4' }, target: 'https://example.org/canvas/2' }] }],
    },
  ],
};

describe('AVPlayerController', () => {
  it('loads, navigates, and emits typed state events', async () => {
    const controller = new AVPlayerController();
    const listener = vi.fn();
    controller.addEventListener('av-canvaschange', listener);
    await controller.load(manifest);
    expect(controller.canvas?.id).toBe('https://example.org/canvas/1');
    controller.next();
    expect(controller.canvas?.id).toBe('https://example.org/canvas/2');
    expect(listener).toHaveBeenCalledTimes(2);
    controller.previous();
    expect(controller.state.canvasIndex).toBe(0);
  });

  it('provides a typed subscription with an unsubscribe function', async () => {
    const controller = new AVPlayerController();
    const listener = vi.fn();
    const unsubscribe = controller.on('av-canvaschange', listener);
    await controller.load(manifest);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    controller.next();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('merges partial string overrides and emits a configuration event', () => {
    const controller = new AVPlayerController({ strings: { chapters: 'Penodau' } });
    const listener = vi.fn();
    controller.addEventListener('av-configchange', listener);

    expect(controller.config.strings.chapters).toBe('Penodau');
    expect(controller.config.strings.transcript).toBe('Transcript');

    controller.configure({ strings: { transcript: 'Trawsgrifiad' } });
    expect(controller.config.strings.chapters).toBe('Penodau');
    expect(controller.config.strings.transcript).toBe('Trawsgrifiad');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('resolves protected source URLs through the configured request hook', async () => {
    const controller = new AVPlayerController({ resolveRequest: (url) => `${url}?token=secret` });
    await controller.load(manifest);
    expect(await controller.resolvedSourceUrl()).toBe('https://example.org/one.mp4?token=secret');
  });

  it('maps media fragments onto the Canvas timeline', async () => {
    const controller = new AVPlayerController();
    await controller.load({
      id: 'https://example.org/timeline',
      type: 'Manifest',
      items: [{
        id: 'https://example.org/canvas/timeline', type: 'Canvas', duration: 30,
        items: [{ type: 'AnnotationPage', items: [{
          type: 'Annotation', motivation: 'painting',
          body: { id: 'https://example.org/clip.mp4#t=2,12', type: 'Video', format: 'video/mp4' },
          target: 'https://example.org/canvas/timeline#t=10,20',
        }] }],
      }],
    });
    const media = document.createElement('video');
    Object.defineProperty(media, 'readyState', { configurable: true, value: 1 });
    Object.defineProperty(media, 'duration', { configurable: true, value: 12 });
    controller.attachMedia(media);
    media.dispatchEvent(new Event('loadedmetadata'));
    expect(media.currentTime).toBe(2);
    controller.seekTo(15);
    expect(media.currentTime).toBe(7);
    media.dispatchEvent(new Event('timeupdate'));
    expect(controller.state.currentTime).toBe(15);
  });
});
