import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('src/lib/theme/christmas/robin-atlas/manifest.json', 'utf8'));
async function useProductionRow(page: Page, available = true) {
  // Accepted tests use the shipped manifest unchanged. Only the unavailable
  // fixture overrides metadata to exercise the fallback path.
  const accepted = structuredClone(manifest);
  accepted.rows.idle.available = available; accepted.rows.idle.acceptance = available ? 'accepted' : 'pending';
  if (!available) await page.route('**/robin-atlas/manifest.json?*', route => route.fulfill({
    contentType: 'application/javascript', body: `export default ${JSON.stringify(JSON.stringify(accepted))};`,
  }));
  await page.route('**/api/**', route => route.abort());
}

test('eight production cells, both facings, reduced motion and lifecycle resets', async ({ page }, info) => {
  await useProductionRow(page);
  await page.goto('/lab/scene.html?theme=christmas&clock=manual');
  const art = page.locator('.robin [data-robin-atlas]');
  await expect(art).toHaveAttribute('data-robin-atlas', 'ready');
  const frame = page.locator('.robin [data-atlas-frame]'), clock = page.getByLabel('Scene elapsed (ms)');
  const before = await page.locator('.robin').boundingBox();
  for (const [time, id] of [[0, 'I0'], [1600, 'I1'], [2050, 'I2'], [2500, 'I3'], [3150, 'I4'], [3210, 'I5'], [3290, 'I6'], [3380, 'I7'], [4799, 'I7'], [4800, 'I0']] as const) {
    await clock.fill(String(time)); await expect(frame).toHaveAttribute('data-atlas-frame', id);
    expect(await page.locator('.robin').boundingBox()).toEqual(before);
    await expect(frame.locator('.atlas-sheet')).toHaveCSS('left', `${-Number(id.slice(1)) * 128}px`);
  }
  await page.screenshot({ path: info.outputPath('right.png') });
  await page.addStyleTag({ content: '.robin { transform: scaleX(-1) !important; }' });
  await expect(page.locator('.robin')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await page.screenshot({ path: info.outputPath('left.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await clock.fill('50000'); await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
  await clock.fill('51600'); await expect(frame).toHaveAttribute('data-atlas-frame', 'I1');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await clock.fill('100000');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
  await clock.fill('101600'); await expect(frame).toHaveAttribute('data-atlas-frame', 'I1');
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
  const theme = page.locator('label', { hasText: /^theme/ }).locator('select');
  await theme.selectOption('none'); await expect(page.locator('.robin')).toHaveCount(0);
  await theme.selectOption('christmas'); await expect(art).toHaveAttribute('data-robin-atlas', 'ready');
  await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
});

test('missing atlas uses rigged blink and missing rigged sheet uses canonical still', async ({ page }) => {
  await useProductionRow(page);
  await page.route('**/*-idle.webp', route => route.abort());
  await page.goto('/lab/scene.html?theme=christmas&clock=manual');
  await expect(page.locator('.robin [data-robin-atlas]')).toHaveAttribute('data-robin-atlas', 'fallback');
  await expect(page.locator('.robin [data-robin-assets]')).toHaveAttribute('data-robin-assets', 'ready');
  await page.getByLabel('Scene elapsed (ms)').fill('4900');
  await expect(page.locator('.robin [data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'B2');
  await page.route('**/*-idle-sheet.webp', route => route.abort());
  await page.reload();
  await expect(page.locator('.robin [data-robin-assets]')).toHaveAttribute('data-robin-assets', 'fallback');
  await expect(page.locator('.robin .fallback')).toBeVisible();
  await expect(page.locator('.robin [data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'I0');
});

test('unavailable row leaves the shipped rigged idle active', async ({ page }) => {
  await useProductionRow(page, false);
  await page.goto('/lab/scene.html?theme=christmas&clock=manual');
  await expect(page.locator('.robin [data-robin-atlas]')).toHaveAttribute('data-robin-atlas', 'fallback');
  await expect(page.locator('.robin [data-robin-assets]')).toHaveAttribute('data-robin-assets', 'ready');
  await page.getByLabel('Scene elapsed (ms)').fill('200');
  await expect(page.locator('.robin [data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'I1');
});

test('broken atlas neutral and rigged sheet still render the shipped perch', async ({ page }) => {
  await useProductionRow(page);
  await page.route('**/*-neutral.webp', route => route.abort());
  await page.route('**/*-idle-sheet.webp', route => route.abort());
  await page.goto('/lab/scene.html?theme=christmas&clock=manual');
  await expect(page.locator('.robin [data-robin-atlas]')).toHaveAttribute('data-robin-atlas', 'fallback');
  await expect(page.locator('.robin [data-robin-assets]')).toHaveAttribute('data-robin-assets', 'fallback');
  const still = page.locator('.robin .fallback');
  await expect(still).toHaveAttribute('src', /robin-perch\.webp/);
  await expect(still).toBeVisible();
  await expect.poll(() => still.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 128)).toBe(true);
});
