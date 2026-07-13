import { expect, test } from '@playwright/test';

test('configuration builder switches media presets and updates generated config', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AV configuration builder' })).toBeVisible();
  await expect(page.locator('mango-av-media')).toBeVisible();
  await expect(page.locator('mango-av-media media-play-button')).toBeVisible();
  await page.locator('#preset').selectOption('audio');
  await expect.poll(() => page.locator('mango-av-media').evaluate((element: any) => element.manifest?.id)).toBe('https://example.org/manifest/audio-demo');
  await page.getByLabel('Chapters').uncheck();
  await expect(page.locator('#generated-code')).toContainText('"chapters": false');
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
