import { describe, expect, it } from 'vitest';
import { normalizeManifest } from '../../src/iiif/normalize';
import { rampManifest } from '../../src/components/ramp-manifest';

const source = {
  id: 'https://example.org/manifest',
  type: 'Manifest',
  label: { en: ['Example'] },
  rendering: [{ id: 'https://example.org/full.pdf', type: 'Text', label: { en: ['Guide'] }, format: 'application/pdf' }],
  items: [{
    id: 'https://example.org/canvas/1',
    type: 'Canvas',
    duration: 30,
    width: 640,
    height: 360,
    placeholderCanvas: {
      id: 'https://example.org/canvas/1/placeholder',
      type: 'Canvas',
      items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', motivation: 'painting', body: { id: 'https://example.org/poster.jpg', type: 'Image' } }] }],
    },
    items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', motivation: 'painting', body: { id: 'https://example.org/one.mp4#t=2,12', type: 'Video', format: 'video/mp4' }, target: 'https://example.org/canvas/1' }] }],
    annotations: [{
      type: 'AnnotationPage',
      items: [{
        type: 'Annotation',
        motivation: 'supplementing',
        body: { id: 'https://example.org/captions.vtt', type: 'Text', format: 'text/vtt', label: { en: ['English'] }, language: 'en' },
        target: 'https://example.org/canvas/1',
      }],
    }],
  }, {
    id: 'https://example.org/canvas/2',
    type: 'Canvas',
    duration: 5,
    items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', motivation: 'painting', body: { id: 'https://example.org/two.mp4', type: 'Video' }, target: 'https://example.org/canvas/2' }] }],
  }],
};

describe('rampManifest', () => {
  it('rebuilds just the active Canvas and source as Presentation 3', async () => {
    const manifest = await normalizeManifest(source);
    const canvas = manifest.canvases[0]!;
    const result = rampManifest(manifest, canvas, canvas.sources[0]!, { src: 'https://example.org/resolved.mp4', captions: true, download: false });
    const items = result.items as Array<Record<string, any>>;

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('https://example.org/canvas/1');
    expect(items[0]?.duration).toBe(30);
    expect(items[0]?.items[0].items[0].body).toMatchObject({ id: 'https://example.org/resolved.mp4', type: 'Video', format: 'video/mp4' });
    expect(items[0]?.annotations[0].items[0].body).toMatchObject({ id: 'https://example.org/captions.vtt', format: 'text/vtt', language: 'en' });
    expect(items[0]?.placeholderCanvas.items[0].items[0].body.id).toBe('https://example.org/poster.jpg');
    expect(result.rendering).toBeUndefined();
  });

  it('leaves captions out when they are turned off, and adds downloads when on', async () => {
    const manifest = await normalizeManifest(source);
    const canvas = manifest.canvases[0]!;
    const result = rampManifest(manifest, canvas, canvas.sources[0]!, { src: 'x.mp4', captions: false, download: true });

    expect((result.items as Array<Record<string, unknown>>)[0]?.annotations).toBeUndefined();
    expect(result.rendering).toEqual([{ id: 'https://example.org/full.pdf', type: 'Text', label: { none: ['Guide'] }, format: 'application/pdf' }]);
  });
});
