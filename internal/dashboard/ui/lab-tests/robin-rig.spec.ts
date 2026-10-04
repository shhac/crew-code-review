import { expect, test } from '@playwright/test';

test('committed rig uses the production renderer, wraps discretely and exposes reference overlays', async ({ page }) => {
  let apiCalls = 0;
  await page.route('**/api/**', route => { apiCalls++; return route.abort(); });
  await page.goto('/lab/robin-rig.html');
  await expect(page.locator('[data-robin-assets]')).toHaveAttribute('data-robin-assets', 'ready');
  await expect(page.locator('.frame-window img')).toHaveAttribute('src', /^blob:/);
  const frame = page.locator('[data-atlas-frame]');
  const elapsed = page.getByLabel('Elapsed (ms)', { exact: true });
  await elapsed.fill('400');
  await expect(page.locator('[data-rig-frame]')).toHaveText('I2');
  await expect(frame).toHaveAttribute('data-atlas-frame', 'I2');
  await expect(page.locator('.frame-window img')).toHaveCSS('left', '-261px');
  await expect(page.locator('.frame-window img')).toHaveCSS('top', '-1px');
  await elapsed.fill('1199'); await expect(page.locator('[data-rig-frame]')).toHaveText('I1');
  await expect(frame).toHaveAttribute('data-atlas-frame', 'I1');
  await elapsed.fill('1200'); await expect(page.locator('[data-rig-frame]')).toHaveText('I0');
  await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
  await page.getByLabel('Reference overlay').check();
  await expect(page.getByAltText('Reference overlay')).toBeVisible();
  await page.getByLabel('Mirror', { exact: true }).check();
  await expect(page.locator('.preview')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await page.getByRole('combobox', { name: 'Clip', exact: true }).selectOption('blink');
  await elapsed.fill('100'); await expect(page.locator('[data-rig-frame]')).toHaveText('B2');
  await expect(frame).toHaveAttribute('data-atlas-frame', 'B2');
  await page.getByLabel('Reduced motion', { exact: true }).check();
  await expect(page.locator('[data-rig-frame]')).toHaveText('I0');
  await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
  expect(apiCalls).toBe(0);
});

test('missing or corrupted rig sheets display the independent reference', async ({ page }) => {
  await page.route('**/*-idle-sheet.webp', route => route.fulfill({ contentType: 'image/webp', body: 'corrupt' }));
  await page.goto('/lab/robin-rig.html');
  await expect(page.locator('[data-robin-assets]')).toHaveAttribute('data-robin-assets', 'fallback');
  await expect(page.locator('.art-cell .fallback')).toHaveAttribute('src', /robin-perch\.webp/);
  await expect(page.locator('.frame-window')).toHaveCount(0);
});
