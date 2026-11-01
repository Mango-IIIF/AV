import { expect, test, type Page } from '@playwright/test';

/*
 * The builder writes its generated configuration once its controls are wired
 * up. RAMP mounts just after, and WebKit can drop input while it does.
 */
const openBuilder = async (page: Page) => {
  await page.goto('/');
  await expect(page.locator('#generated-code')).toContainText('player.config');
  await expect.poll(() => page.locator('mango-av-media').evaluate((element: any) => Boolean(element.controller.media))).toBe(true);
};

test('configuration builder switches media presets and updates generated config', async ({ page }) => {
  await openBuilder(page);
  await expect(page.getByRole('heading', { name: 'AV configuration builder' })).toBeVisible();
  await expect(page.locator('mango-av-media')).toBeVisible();
  await expect(page.locator('mango-av-media .vjs-play-control')).toBeVisible();
  await expect(page.locator('mango-av-media .vjs-skip-backward-10')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Transcript' })).toHaveAttribute('aria-selected', 'true');
  await page.locator('#preset').selectOption('audio');
  await expect.poll(() => page.locator('mango-av-media').evaluate((element: any) => element.manifest?.id)).toBe('https://example.org/manifest/audio-demo');
  const viewer = page.locator('mango-av-media');
  await expect(viewer.getByRole('button', { name: 'Next section' })).toHaveCount(0);
  await expect(viewer.getByLabel('Auto-advance', { exact: true })).toHaveCount(0);
  await page.getByLabel('Previous and next controls').check();
  await page.getByLabel('Auto-advance control').check();
  await expect(viewer.getByRole('button', { name: 'Next section' })).toBeVisible();
  await expect(viewer.getByRole('region', { name: 'Media player' }).getByRole('heading', { name: 'Audio player theme' })).toBeVisible();
  await expect(viewer.getByLabel('Auto-advance', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Chapters' }).uncheck();
  await expect(page.locator('#generated-code')).toContainText('"chapters": false');
});

test('configuration builder loads a custom manifest URL', async ({ page }) => {
  const manifestUrl = 'https://example.org/custom-manifest.json';
  const mediaUrl = 'https://example.org/audio.mp3';
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
            body: { id: mediaUrl, type: 'Sound', format: 'audio/mpeg' },
            target: 'https://example.org/custom-canvas',
          }],
        }],
      }],
    }),
  }));
  await page.route(mediaUrl, async (route) => route.fulfill({
    contentType: 'audio/mpeg',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: Buffer.alloc(0),
  }));

  await openBuilder(page);
  await page.getByLabel('Manifest URL').fill(manifestUrl);
  await page.getByRole('button', { name: 'Load' }).click();

  await expect.poll(() => page.locator('mango-av-media').evaluate((element: any) => element.controller.manifest?.id)).toBe(manifestUrl);
  await expect(page.locator('#preset')).toHaveValue('custom');
  await expect(page.getByRole('status')).toHaveText('Custom manifest loaded');
  await expect(page.locator('#generated-code')).toContainText(`player.manifest = "${manifestUrl}"`);
});

test('HLS preset plays through RAMP', async ({ page }) => {
  await openBuilder(page);
  await page.locator('#preset').selectOption('hls');
  await expect.poll(() => page.locator('mango-av-media').evaluate((element: any) => element.controller.source?.isHls)).toBe(true);
  await expect.poll(() => page.locator('mango-av-media').evaluate((element: any) => Boolean(element.controller.media?.classList.contains('vjs-tech')))).toBe(true);
});

test('RAMP playback and the panels follow each other', async ({ page }) => {
  await openBuilder(page);
  const viewer = page.locator('mango-av-media');
  await expect.poll(() => viewer.evaluate((element: any) => Boolean(element.controller.media))).toBe(true);
  await page.getByRole('tab', { name: 'Chapters' }).click();
  await viewer.locator('mango-av-chapters button', { hasText: 'Feature details' }).click();
  await expect.poll(() => viewer.evaluate((element: any) => element.controller.media.currentTime)).toBeGreaterThanOrEqual(8);
  await expect(viewer.locator('mango-av-chapters button.active')).toContainText('Feature details');
  await expect(viewer.locator('.position')).toContainText('0:08');
});

test('style recipes change the public CSS custom properties', async ({ page }) => {
  await openBuilder(page);
  await page.getByRole('button', { name: 'Archive dark' }).click();
  const accent = await page.locator('mango-av-media').evaluate((element) => element.style.getPropertyValue('--mango-av-accent'));
  expect(accent).toBe('#f59e0b');
});

test('string overrides translate the complete component and generated configuration', async ({ page }) => {
  await openBuilder(page);
  await page.getByLabel('Previous and next controls').check();
  await page.locator('#language').selectOption('cy');
  await expect(page.getByRole('tab', { name: 'Penodau' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adran nesaf' })).toContainText('Nesaf');
  await expect(page.locator('#generated-code')).toContainText('Trawsgrifiad');

  await page.locator('#language').selectOption('fr');
  await expect(page.getByRole('tab', { name: 'Chapitres' })).toBeVisible();
});

test('API documentation is linked from the builder', async ({ page }) => {
  await openBuilder(page);
  await page.getByRole('link', { name: 'API documentation' }).click();
  await expect(page).toHaveURL(/\/api\.html$/);
  await expect(page.getByRole('heading', { name: 'Complete or composable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AVPlayerController' })).toBeVisible();
});

test('independent components synchronize through one controller', async ({ page }) => {
  await page.goto('/composable.html');
  await expect(page.locator('mango-av-player .vjs-play-control')).toBeVisible();
  await expect(page.locator('mango-av-chapters')).toBeVisible();
  await expect(page.locator('mango-av-transcript')).toBeVisible();
  await expect(page.locator('mango-av-annotations')).toBeVisible();

  const player = page.locator('mango-av-player');
  await expect.poll(() => player.evaluate((element: any) => Boolean(element.controller.media))).toBe(true);
  await player.evaluate((element: any) => {
    const activeMedia = element.controller.media as HTMLMediaElement | undefined;
    activeMedia?.pause();
    const media = document.createElement('video');
    Object.defineProperties(media, {
      readyState: { configurable: true, value: HTMLMediaElement.HAVE_METADATA },
      duration: { configurable: true, value: 30 },
    });
    media.play = async () => { media.dispatchEvent(new Event('play')); };
    media.pause = () => { media.dispatchEvent(new Event('pause')); };
    element.controller.attachMedia(media);
  });

  await page.locator('mango-av-chapters button', { hasText: 'Feature details' }).click();
  await expect.poll(() => player.evaluate((element: any) => element.controller.state.currentTime)).toBe(8);
  await expect(page.locator('#component-events')).toContainText('av-canvaschange');

  const annotation = page.locator('mango-av-annotations button', { hasText: 'example time-synchronised annotation' });
  await annotation.click();
  await expect.poll(() => player.evaluate((element: any) => element.controller.state.currentTime)).toBe(9);
  await expect(annotation).toHaveClass(/active/);

  const cue = page.locator('mango-av-transcript button', { hasText: 'Welcome to the Mango' });
  await cue.click();
  await expect.poll(() => player.evaluate((element: any) => element.controller.state.currentTime)).toBe(0);
  await expect(cue).toHaveClass(/active/);
  await expect.poll(() => player.evaluate((element: any) => element.controller.state.status)).toBe('playing');

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

test('audio captions follow playback, built in and in a layout of the page\'s own', async ({ page }) => {
  await page.goto('/captions.html');
  // As with the builder, wait for RAMP to mount in both players before clicking.
  for (const player of ['#built-in', '#own-player']) {
    await expect.poll(() => page.locator(player).evaluate((element: any) => Boolean(element.controller.media))).toBe(true);
  }
  const builtIn = page.locator('#built-in mango-av-captions');
  const current = (captions: typeof builtIn) => captions.locator('[data-line=current]');

  await expect(current(builtIn)).toContainText('Where did it start?');
  await expect(builtIn.locator('[data-line=next]')).toContainText('In a small studio');

  await page.locator('#captions-mode').selectOption('line');
  await expect(page.locator('#built-in mango-av-captions [data-line=next]')).toHaveCount(0);
  await page.locator('#captions-mode').selectOption('off');
  await expect(page.locator('#built-in mango-av-captions')).toHaveCount(0);

  const own = page.locator('#own-captions');
  await page.locator('#own-transcript button', { hasText: 'Every hiss' }).click();
  await expect(current(own)).toContainText('Every hiss and footstep');
  await expect(current(own)).toContainText('Narrator');
  await expect(own.locator('[data-line=previous]')).toContainText('what the archive kept');
});
