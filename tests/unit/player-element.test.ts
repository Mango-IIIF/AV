import { beforeAll, describe, expect, it } from 'vitest';
import { defineMangoAVPlayer } from '../../src/components/mango-av-player';

const tagName = 'test-mango-av-player';
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

describe('MangoAVPlayerElement media CORS configuration', () => {
  beforeAll(() => {
    defineMangoAVPlayer(tagName);
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
});
