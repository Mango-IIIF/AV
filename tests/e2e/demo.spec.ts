import { expect, test } from '@playwright/test';

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
