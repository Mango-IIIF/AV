import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

const regressionMp4 = Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAN0bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAMgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAp90cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAMgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAADIAAAEAAABAAAAAAIXbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAACgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABwm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAYJzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAMg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAHZIAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAFAAACAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAOGN0dHMAAAAAAAAABQAAAAEAAAQAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAUAAAABAAAAKHN0c3oAAAAAAAAAAAAAAAUAAALFAAAADAAAAAwAAAAMAAAADAAAABRzdGNvAAAAAAAAAAEAAAOkAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2MS43LjEwMAAAAAhmcmVlAAAC/W1kYXQAAAKuBgX//6rcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MjUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAPZYiEADP//vbsvgU2FMjBAAAACEGaJGxCv/7AAAAACEGeQniF/8GBAAAACAGeYXRCv8SAAAAACAGeY2pCv8SB', 'base64');

const sineWaveMp3 = Buffer.from('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', 'base64');

const playbackManifest = (src: string) => ({
  id: 'https://example.org/playback-regression',
  type: 'Manifest',
  items: [{
    id: 'https://example.org/playback-regression/canvas',
    type: 'Canvas',
    items: [{
      type: 'AnnotationPage',
      items: [{
        type: 'Annotation',
        motivation: 'painting',
        body: { id: src, type: 'Video', format: 'video/mp4' },
        target: 'https://example.org/playback-regression/canvas',
      }],
    }],
  }],
});

const audioPlaybackManifest = (src: string) => ({
  id: 'https://example.org/audio-playback-regression',
  type: 'Manifest',
  items: [{
    id: 'https://example.org/audio-playback-regression/canvas',
    type: 'Canvas',
    duration: 1.5,
    items: [{
      type: 'AnnotationPage',
      items: [{
        type: 'Annotation',
        motivation: 'painting',
        body: { id: src, type: 'Sound', format: 'audio/mpeg' },
        target: 'https://example.org/audio-playback-regression/canvas',
      }],
    }],
  }],
});

test('configuration builder switches media presets and updates generated config', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AV configuration builder' })).toBeVisible();
  await expect(page.locator('mango-av-media')).toBeVisible();
  await expect(page.locator('mango-av-media media-play-button')).toBeVisible();
  await expect.poll(() => page.locator('mango-av-media').evaluate((element) => {
    const column = element.shadowRoot?.querySelector('.player-column')?.getBoundingClientRect();
    const controller = element.shadowRoot?.querySelector('media-controller')?.getBoundingClientRect();
    return column && controller ? Math.abs(column.bottom - controller.bottom) : Number.POSITIVE_INFINITY;
  })).toBeLessThan(1);
  await page.locator('#preset').selectOption('audio');
  await expect.poll(() => page.locator('mango-av-media').evaluate((element: any) => element.manifest?.id)).toBe('https://example.org/manifest/audio-demo');
  const viewer = page.locator('mango-av-media');
  await expect(viewer.getByRole('button', { name: 'Next section' })).toHaveCount(0);
  await expect(viewer.getByLabel('Auto-advance', { exact: true })).toHaveCount(0);
  await page.getByLabel('Previous and next controls').check();
  await page.getByLabel('Auto-advance control').check();
  await expect(viewer.getByRole('button', { name: 'Next section' })).toBeVisible();
  await expect(viewer.getByLabel('Auto-advance', { exact: true })).toBeVisible();
  await page.getByLabel('Chapters').uncheck();
  await expect(page.locator('#generated-code')).toContainText('"chapters": false');
});

test('redirected cross-origin range media loads without implicit CORS mode', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot fulfill an intercepted request with a redirect response.');
  const mediaServer = createServer((request, response) => {
    const start = Number(request.headers.range?.match(/^bytes=(\d+)-/)?.[1] ?? 0);
    const body = regressionMp4.subarray(start);
    response.writeHead(request.headers.range ? 206 : 200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': body.length,
      ...(request.headers.range ? { 'Content-Range': `bytes ${start}-${regressionMp4.length - 1}/${regressionMp4.length}` } : {}),
      'Content-Type': 'video/mp4',
      ...(request.url === '/cors.mp4' ? { 'Access-Control-Allow-Origin': '*' } : {}),
    });
    response.end(body);
  });
  await new Promise<void>((resolve) => mediaServer.listen(0, '127.0.0.1', resolve));

  try {
    const address = mediaServer.address();
    if (!address || typeof address === 'string') throw new Error('Unable to start media test server');
    const redirectUrl = 'http://127.0.0.1:4173/playback-redirect.mp4';
    await page.route(redirectUrl, (route) => route.fulfill({
      status: 302,
      headers: { location: `http://127.0.0.1:${address.port}/no-cors.mp4` },
    }));
    await page.goto('/');

    const defaultResult = await page.evaluate(async (manifest) => {
      const player = document.createElement('mango-av-player') as any;
      document.body.append(player);
      await player.load(manifest);
      const video = player.shadowRoot.querySelector('video') as HTMLVideoElement;
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
          video.addEventListener('error', () => reject(video.error), { once: true });
        });
      }
      return { crossorigin: video.getAttribute('crossorigin'), error: video.error?.code ?? null };
    }, playbackManifest(redirectUrl));

    expect(defaultResult).toEqual({ crossorigin: null, error: null });

    const corsResult = await page.evaluate(async ({ manifest }) => {
      const player = document.createElement('mango-av-player') as any;
      player.config = { crossorigin: 'anonymous' };
      document.body.append(player);
      await player.load(manifest);
      const video = player.shadowRoot.querySelector('video') as HTMLVideoElement;
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
          video.addEventListener('error', () => reject(video.error), { once: true });
        });
      }
      return { crossorigin: video.getAttribute('crossorigin'), error: video.error?.code ?? null };
    }, { manifest: playbackManifest(`http://127.0.0.1:${address.port}/cors.mp4`) });

    expect(corsResult).toEqual({ crossorigin: 'anonymous', error: null });
  } finally {
    await new Promise<void>((resolve, reject) => mediaServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('cross-origin audio visualizes with CORS and falls back to ordinary playback without it', async ({ page, browserName }) => {
  const mediaServer = createServer((request, response) => {
    const start = Number(request.headers.range?.match(/^bytes=(\d+)-/)?.[1] ?? 0);
    const body = sineWaveMp3.subarray(start);
    response.writeHead(request.headers.range ? 206 : 200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': body.length,
      ...(request.headers.range ? { 'Content-Range': `bytes ${start}-${sineWaveMp3.length - 1}/${sineWaveMp3.length}` } : {}),
      'Content-Type': 'audio/mpeg',
      ...(request.url === '/cors.mp3' ? { 'Access-Control-Allow-Origin': '*' } : {}),
    });
    response.end(body);
  });
  await new Promise<void>((resolve) => mediaServer.listen(0, '127.0.0.1', resolve));

  try {
    const address = mediaServer.address();
    if (!address || typeof address === 'string') throw new Error('Unable to start audio test server');
    await page.goto('/');

    await page.evaluate(async (manifest) => {
      const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
      AudioContext.prototype.createAnalyser = function (...args) {
        const analyser = originalCreateAnalyser.apply(this, args);
        (globalThis as any).__mangoTestAnalyser = analyser;
        return analyser;
      };
      const player = document.createElement('mango-av-player') as any;
      player.id = 'cors-audio-player';
      player.config = { preload: 'auto', audioArt: { visualizer: true } };
      document.body.append(player);
      await player.load(manifest);
      player.controller.media.loop = true;
    }, audioPlaybackManifest(`http://127.0.0.1:${address.port}/cors.mp3`));

    const corsPlayer = page.locator('#cors-audio-player');
    await corsPlayer.locator('media-play-button').click();
    await expect.poll(() => corsPlayer.evaluate((element: any) => element.controller.media?.readyState ?? 0)).toBeGreaterThanOrEqual(1);
    await expect.poll(() => corsPlayer.evaluate((element: any) => element.controller.media?.currentTime ?? 0)).toBeGreaterThan(.1);
    if (browserName === 'webkit') {
      // Playwright's frozen macOS 14 WebKit build does not render audio samples
      // in headless mode, but it must still create the analyser graph.
      await expect.poll(() => page.evaluate(() => Boolean((globalThis as any).__mangoTestAnalyser))).toBe(true);
    } else {
      await expect.poll(() => page.evaluate(() => {
        const analyser = (globalThis as any).__mangoTestAnalyser as AnalyserNode | undefined;
        if (!analyser) return 0;
        const samples = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(samples);
        return Math.max(...samples) - Math.min(...samples);
      })).toBeGreaterThan(0);
    }

    await page.evaluate(async (manifest) => {
      const player = document.createElement('mango-av-player') as any;
      player.id = 'fallback-audio-player';
      player.config = { preload: 'auto', audioArt: { visualizer: true } };
      player.addEventListener('av-visualizerfallback', (event: CustomEvent) => {
        (globalThis as any).__mangoFallbackDetail = event.detail;
      }, { once: true });
      document.body.append(player);
      await player.load(manifest);
    }, audioPlaybackManifest(`http://127.0.0.1:${address.port}/no-cors.mp3`));

    const fallbackPlayer = page.locator('#fallback-audio-player');
    await fallbackPlayer.locator('media-play-button').click();
    await expect.poll(() => page.evaluate(() => (globalThis as any).__mangoFallbackDetail)).toEqual({
      canvasId: 'https://example.org/audio-playback-regression/canvas',
      sourceUrl: `http://127.0.0.1:${address.port}/no-cors.mp3`,
      reason: 'cors',
    });
    await expect.poll(() => fallbackPlayer.evaluate((element: any) => element.controller.media?.readyState ?? 0)).toBeGreaterThanOrEqual(1);
    await expect(fallbackPlayer.locator('audio')).not.toHaveAttribute('crossorigin');
    await expect.poll(() => fallbackPlayer.evaluate((element: any) => element.controller.media?.currentTime ?? 0)).toBeGreaterThan(.1);
  } finally {
    await new Promise<void>((resolve, reject) => mediaServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('audio artwork can show a moving transcript independently from the volume visualizer', async ({ page }) => {
  await page.goto('/');
  await page.locator('#preset').selectOption('audio');
  await page.getByLabel('Transcript in audio artwork').check();

  const art = page.locator('mango-av-media .audio-art');
  await expect(art.locator('.audio-art-title')).toHaveCount(0);
  await expect(art.locator('.audio-art-cue.active')).toContainText('Welcome to the Mango');
  await expect(art.locator('.audio-art-cue.adjacent')).toContainText('The transcript, chapters');

  await page.locator('mango-av-media').evaluate((element: any) => {
    element.controller.media.currentTime = 7;
    element.controller.media.dispatchEvent(new Event('seeking'));
  });
  await expect(art.locator('.audio-art-cue.active')).toContainText('The transcript, chapters');
  await expect(art.locator('.audio-art-cue.adjacent')).toContainText('Welcome to the Mango');

  await page.locator('mango-av-media').evaluate((element: any) => {
    element.controller.media.currentTime = 1;
    element.controller.media.dispatchEvent(new Event('seeking'));
  });
  await expect(art.locator('.audio-art-cue.active')).toContainText('Welcome to the Mango');
  await expect(art.locator('.audio-art-cue.adjacent')).toContainText('The transcript, chapters');
  await expect(art.locator('.audio-art-cue.adjacent')).toHaveCSS('visibility', 'visible');

  await page.getByLabel('Audio visualizer').selectOption('pulse');
  await expect(art).toHaveClass(/visualizer/);
  await expect.poll(() => art.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).getPropertyValue('--mango-av-wave-strength')),
  )).toBe(0);
  await page.getByLabel('Audio visualizer').selectOption('waveform');
  await expect(art).toHaveClass(/visualizer--waveform/);
  await expect(art.locator('canvas')).toHaveCount(1);
  await page.getByLabel('Audio visualizer').selectOption('spectrum');
  await expect(art).toHaveClass(/visualizer--spectrum/);
  await expect(art.locator('canvas')).toHaveCount(1);
  await expect(page.locator('#generated-code')).toContainText('"visualizer": "spectrum"');
});

test('configuration builder loads a custom manifest URL', async ({ page }) => {
  const manifestUrl = 'https://example.org/custom-manifest.json';
  await page.route(manifestUrl, async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: manifestUrl,
      type: 'Manifest',
      label: { en: ['Custom manifest'] },
      items: [{
        id: 'https://example.org/custom-canvas',
        type: 'Canvas',
        duration: 10,
        items: [{
          id: 'https://example.org/custom-page',
          type: 'AnnotationPage',
          items: [{
            id: 'https://example.org/custom-painting',
            type: 'Annotation',
            motivation: 'painting',
            body: { id: 'https://example.org/audio.mp3', type: 'Sound', format: 'audio/mpeg' },
            target: 'https://example.org/custom-canvas',
          }],
        }],
      }],
    }),
  }));

  await page.goto('/');
  await page.getByLabel('Manifest URL').fill(manifestUrl);
  await page.getByRole('button', { name: 'Load' }).click();

  await expect.poll(() => page.locator('mango-av-media').evaluate((element: any) => element.controller.manifest?.id)).toBe(manifestUrl);
  await expect(page.locator('#preset')).toHaveValue('custom');
  await expect(page.getByRole('status')).toHaveText('Custom manifest loaded');
  await expect(page.locator('#generated-code')).toContainText(`player.manifest = "${manifestUrl}"`);
});

test('HLS preset lazily upgrades the HLS media element', async ({ page }) => {
  await page.goto('/');
  await page.locator('#preset').selectOption('hls');
  await expect.poll(() => page.locator('mango-av-media').evaluate((element) => {
    const media = element.shadowRoot?.querySelector('hls-video');
    const constructor = customElements.get('hls-video');
    return Boolean(media && constructor && media instanceof constructor);
  })).toBe(true);
});

test('style recipes change the public CSS custom properties', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Archive dark' }).click();
  const accent = await page.locator('mango-av-media').evaluate((element) => element.style.getPropertyValue('--mango-av-accent'));
  expect(accent).toBe('#f59e0b');
});

test('string overrides translate the complete component and generated configuration', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Previous and next controls').check();
  await page.locator('#language').selectOption('cy');
  await expect(page.getByRole('tab', { name: 'Penodau' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adran nesaf' })).toContainText('Nesaf');
  await expect(page.locator('#generated-code')).toContainText('Trawsgrifiad');

  await page.locator('#language').selectOption('fr');
  await expect(page.getByRole('tab', { name: 'Chapitres' })).toBeVisible();
  await expect(page.locator('mango-av-media media-play-button')).toHaveAttribute('aria-label', 'lire');
});

test('API documentation is linked from the builder', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'API documentation' }).click();
  await expect(page).toHaveURL(/\/api\.html$/);
  await expect(page.getByRole('heading', { name: 'Complete or composable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AVPlayerController' })).toBeVisible();
});

test('independent components synchronize through one controller', async ({ page }) => {
  await page.goto('/composable.html');
  await expect(page.locator('mango-av-player media-play-button')).toBeVisible();
  await expect(page.locator('mango-av-chapters')).toBeVisible();
  await expect(page.locator('mango-av-transcript')).toBeVisible();
  await expect(page.locator('mango-av-annotations')).toBeVisible();

  await page.locator('mango-av-chapters button', { hasText: 'Feature details' }).click();
  await expect.poll(() => page.locator('mango-av-player').evaluate((element: any) => element.controller.state.currentTime)).toBe(8);
  await expect(page.locator('#component-events')).toContainText('av-canvaschange');

  const annotation = page.locator('mango-av-annotations button', { hasText: 'example time-synchronised annotation' });
  await annotation.click();
  await expect.poll(() => page.locator('mango-av-player').evaluate((element: any) => element.controller.state.currentTime)).toBe(9);
  await expect(annotation).toHaveClass(/active/);

  const cue = page.locator('mango-av-transcript button', { hasText: 'Welcome to the Mango' });
  await cue.click();
  await expect.poll(() => page.locator('mango-av-player').evaluate((element: any) => element.controller.state.currentTime)).toBe(0);
  await expect(cue).toHaveClass(/active/);
  await expect.poll(() => page.locator('mango-av-player').evaluate((element: any) => element.controller.state.status)).toBe('playing');

  await page.locator('mango-av-player').evaluate((element: any) => {
    element.controller.pause();
    element.controller.configure({
      strings: { chapters: 'Penodau', transcript: 'Trawsgrifiad', annotations: 'Anodiadau' },
    });
  });
  await expect(page.getByRole('heading', { name: 'Penodau' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trawsgrifiad' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anodiadau' })).toBeVisible();
});
