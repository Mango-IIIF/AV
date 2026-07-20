import { describe, expect, it } from 'vitest';
import { mediaKind } from '../../src/utils';

describe('mediaKind', () => {
  it.each([
    {
      type: 'Image',
      format: 'image/png',
      src: 'https://example.org/video/poster.png',
      expected: undefined,
    },
    {
      type: 'Video',
      format: 'video/mp4',
      src: 'https://example.org/resource-without-extension',
      expected: 'video',
    },
    {
      type: 'Audio',
      format: 'audio/mpeg; codecs=mp3',
      src: 'https://example.org/resource-without-extension',
      expected: 'audio',
    },
    {
      type: undefined,
      format: undefined,
      src: 'https://example.org/media/movie.mp4?download=1',
      expected: 'video',
    },
    {
      type: undefined,
      format: undefined,
      src: 'https://example.org/video/poster.png',
      expected: undefined,
    },
    {
      type: 'dctypes:Sound',
      format: undefined,
      src: 'https://example.org/resource',
      expected: 'audio',
    },
    {
      type: 'dctypes:MovingImage',
      format: undefined,
      src: 'https://example.org/resource',
      expected: 'video',
    },
    {
      type: undefined,
      format: 'application/vnd.apple.mpegurl',
      src: 'https://example.org/resource',
      expected: 'video',
    },
  ])('classifies $src as $expected', ({ type, format, src, expected }) => {
    expect(mediaKind(type, format, src)).toBe(expected);
  });
});
