import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

const regressionMp4 = Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAN0bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAMgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAp90cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAMgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAADIAAAEAAABAAAAAAIXbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAACgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABwm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAYJzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAMg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAHZIAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAFAAACAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAOGN0dHMAAAAAAAAABQAAAAEAAAQAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAUAAAABAAAAKHN0c3oAAAAAAAAAAAAAAAUAAALFAAAADAAAAAwAAAAMAAAADAAAABRzdGNvAAAAAAAAAAEAAAOkAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2MS43LjEwMAAAAAhmcmVlAAAC/W1kYXQAAAKuBgX//6rcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MjUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAPZYiEADP//vbsvgU2FMjBAAAACEGaJGxCv/7AAAAACEGeQniF/8GBAAAACAGeYXRCv8SAAAAACAGeY2pCv8SB', 'base64');

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

test('redirected cross-origin range media loads without implicit CORS mode', async ({ page }) => {
  const mediaServer = createServer((request, response) => {
    const start = Number(request.headers.range?.match(/^bytes=(\d+)-/)?.[1] ?? 0);
    const body = regressionMp4.subarray(start);
    response.writeHead(request.headers.range ? 206 : 200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': body.length,
      'Content-Range': `bytes ${start}-${regressionMp4.length - 1}/${regressionMp4.length}`,
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
