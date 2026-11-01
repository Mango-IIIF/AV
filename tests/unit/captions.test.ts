import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { defineMangoAVCaptions, type MangoAVCaptionsElement } from '../../src/components/mango-av-captions';
import { AVPlayerController } from '../../src/controller';

const line = (start: number, end: number, value: string) => ({
  id: `https://example.org/transcript/${start}`,
  type: 'Annotation',
  motivation: 'supplementing',
  body: { type: 'TextualBody', value, purpose: 'supplementing' },
  target: `https://example.org/canvas#t=${start},${end}`,
});

const manifest = (type: 'Sound' | 'Video') => ({
  id: 'https://example.org/manifest',
  type: 'Manifest',
  items: [{
    id: 'https://example.org/canvas',
    type: 'Canvas',
    duration: 20,
    items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', motivation: 'painting', body: { id: 'https://example.org/media', type }, target: 'https://example.org/canvas' }] }],
    annotations: [{ type: 'AnnotationPage', items: [line(0, 4, 'First.'), line(4, 8, 'Second.'), line(10, 14, 'Third.')] }],
  }],
});

const lines = (captions: MangoAVCaptionsElement) =>
  Object.fromEntries([...captions.shadowRoot!.querySelectorAll<HTMLElement>('.line')].map((element) => [element.dataset.line, element.textContent?.trim()]));

const mount = async (type: 'Sound' | 'Video' = 'Sound', attributes: string[] = []) => {
  const controller = new AVPlayerController();
  const captions = document.createElement('mango-av-captions') as MangoAVCaptionsElement;
  for (const name of attributes) captions.setAttribute(name, '');
  document.body.append(captions);
  captions.controller = controller;
  await controller.load(manifest(type));
  await new Promise((resolve) => setTimeout(resolve));
  return { controller, captions };
};

describe('MangoAVCaptionsElement', () => {
  beforeAll(() => { defineMangoAVCaptions(); });
  afterEach(() => document.body.replaceChildren());

  it('shows the line being spoken with the lines either side, following time', async () => {
    const { controller, captions } = await mount();
    expect(lines(captions)).toEqual({ previous: '', current: 'First.', next: 'Second.' });

    controller.seekTo(5);
    expect(lines(captions)).toEqual({ previous: 'First.', current: 'Second.', next: 'Third.' });
  });

  it('leaves the current line empty between lines, keeping its neighbours', async () => {
    const { controller, captions } = await mount();
    controller.seekTo(9);
    expect(lines(captions)).toEqual({ previous: 'Second.', current: '', next: 'Third.' });
  });

  it('shows only the line being spoken with the line attribute', async () => {
    const { controller, captions } = await mount('Sound', ['line']);
    controller.seekTo(11);
    expect(lines(captions)).toEqual({ current: 'Third.' });
  });

  it('steps aside for video when audio-only', async () => {
    const { captions } = await mount('Video', ['audio-only']);
    expect(captions.hidden).toBe(true);
    captions.removeAttribute('audio-only');
    expect(captions.hidden).toBe(false);
  });
});
