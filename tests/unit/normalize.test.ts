import { describe, expect, it, vi } from 'vitest';
import { normalizeManifest } from '../../src/iiif/normalize';

describe('normalizeManifest', () => {
  it('normalizes Presentation 3 AV resources, ranges, transcripts, and downloads', async () => {
    const manifest = await normalizeManifest({
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/manifest/3',
      type: 'Manifest',
      label: { en: ['Example video'] },
      behavior: ['auto-advance'],
      start: { type: 'SpecificResource', source: 'https://example.org/canvas/1', selector: { type: 'PointSelector', t: 4 } },
      rendering: [{ id: 'https://example.org/file.pdf', type: 'Text', format: 'application/pdf', label: { en: ['Programme'] } }],
      items: [{
        id: 'https://example.org/canvas/1',
        type: 'Canvas',
        label: { en: ['Part one'] },
        duration: 60,
        width: 1280,
        height: 720,
        items: [{
          id: 'https://example.org/page/painting',
          type: 'AnnotationPage',
          items: [{
            id: 'https://example.org/painting/1',
            type: 'Annotation',
            motivation: 'painting',
            body: {
              type: 'Choice',
              items: [
                { id: 'https://example.org/video.m3u8#t=1,40', type: 'Video', format: 'application/vnd.apple.mpegurl', label: { en: ['HLS'] } },
                { id: 'https://example.org/video.mp4', type: 'Video', format: 'video/mp4', label: { en: ['MP4'] } },
              ],
            },
            target: 'https://example.org/canvas/1#t=2,50',
          }],
        }],
        annotations: [{
          id: 'https://example.org/page/transcript',
          type: 'AnnotationPage',
          items: [{
            id: 'https://example.org/transcript/1',
            type: 'Annotation',
            motivation: 'supplementing',
            body: { type: 'TextualBody', value: 'Hello world', purpose: ['supplementing'] },
            target: 'https://example.org/canvas/1#t=5,8',
          }],
        }],
      }],
      structures: [{
        id: 'https://example.org/range/1',
        type: 'Range',
        label: { en: ['Introduction'] },
        items: ['https://example.org/canvas/1#t=2,12'],
      }],
    });

    expect(manifest.version).toBe(3);
    expect(manifest.start).toEqual({ canvasId: 'https://example.org/canvas/1', time: 4 });
    expect(manifest.canvases[0]?.sources).toHaveLength(2);
    expect(manifest.canvases[0]?.sources[0]).toMatchObject({
      src: 'https://example.org/video.m3u8',
      isHls: true,
      segment: { start: 1, end: 40 },
      canvasTarget: { start: 2, end: 50 },
    });
    expect(manifest.canvases[0]?.transcripts[0]?.cues?.[0]).toMatchObject({ text: 'Hello world', start: 5, end: 8 });
    expect(manifest.chapters[0]).toMatchObject({ label: 'Introduction', canvasId: 'https://example.org/canvas/1', time: { start: 2, end: 12 } });
    expect(manifest.rendering[0]?.label).toBe('Programme');
  });

  it('normalizes Presentation 2 sequences and external annotation lists', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      '@id': 'https://example.org/list/1',
      '@type': 'sc:AnnotationList',
      resources: [{
        '@id': 'https://example.org/transcript/annotation',
        '@type': 'oa:Annotation',
        motivation: 'supplementing',
        resource: { '@id': 'https://example.org/transcript.vtt', '@type': 'dctypes:Text', format: 'text/vtt', label: 'Captions' },
        on: 'https://example.org/canvas/2#t=0,10',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const manifest = await normalizeManifest({
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://example.org/manifest/2',
      '@type': 'sc:Manifest',
      label: 'Version two audio',
      sequences: [{
        '@type': 'sc:Sequence',
        startCanvas: 'https://example.org/canvas/2',
        canvases: [{
          '@id': 'https://example.org/canvas/2',
          '@type': 'sc:Canvas',
          label: 'Audio canvas',
          duration: 45,
          images: [{
            '@id': 'https://example.org/painting/audio',
            '@type': 'oa:Annotation',
            resource: { '@id': 'https://example.org/audio.mp3', '@type': 'dctypes:Sound', format: 'audio/mpeg' },
            on: 'https://example.org/canvas/2',
          }],
          otherContent: [{ '@id': 'https://example.org/list/1', '@type': 'sc:AnnotationList' }],
        }],
      }],
    }, { fetch: fetcher });

    expect(manifest.version).toBe(2);
    expect(manifest.start).toEqual({ canvasId: 'https://example.org/canvas/2' });
    expect(manifest.canvases[0]?.sources[0]).toMatchObject({ kind: 'audio', src: 'https://example.org/audio.mp3' });
    expect(manifest.canvases[0]?.tracks[0]).toMatchObject({ kind: 'captions', src: 'https://example.org/transcript.vtt' });
    expect(fetcher).toHaveBeenCalledWith('https://example.org/list/1', undefined);
  });

  it('rejects resources that are not manifests', async () => {
    await expect(normalizeManifest({ id: 'x', type: 'Collection', items: [] })).rejects.toThrow('Expected a IIIF Manifest');
  });

  it('uses translated strings for generated fallback labels', async () => {
    const manifest = await normalizeManifest({
      id: 'https://example.org/translated',
      type: 'Manifest',
      items: [{
        id: 'https://example.org/canvas/unlabelled',
        type: 'Canvas',
        items: [{
          type: 'AnnotationPage',
          items: [{
            type: 'Annotation',
            motivation: 'painting',
            body: { id: 'https://example.org/video.mp4', type: 'Video' },
            target: 'https://example.org/canvas/unlabelled',
          }],
        }],
      }],
      structures: [{
        id: 'https://example.org/range/unlabelled',
        type: 'Range',
        items: ['https://example.org/canvas/unlabelled'],
      }],
    }, {
      strings: {
        untitledManifest: 'Maniffest heb deitl',
        sectionNumber: 'Adran {number}',
        chapterNumber: 'Pennod {number}',
        autoSource: 'Awtomatig',
      },
    });

    expect(manifest.label).toBe('Maniffest heb deitl');
    expect(manifest.canvases[0]?.label).toBe('Adran 1');
    expect(manifest.canvases[0]?.sources[0]?.label).toBe('Awtomatig');
    expect(manifest.chapters[0]?.label).toBe('Pennod 1');
  });
});
