import { expect, test, type Page } from '@playwright/test';

// The animals drawn from parts, in their workbench: every part decodes, the
// legs step while walking and hold when paused, and stillness holds under
// reduced motion.

const big = (page: Page) => page.locator('[data-stage] [data-critter]');
const legPaths = (page: Page) => big(page).locator('[data-legs] path').evaluateAll((els) => els.map((el) => el.getAttribute('d')));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/lab/critters.html');
  await expect(big(page)).toBeVisible();
});

const decoded = (page: Page) => big(page).locator('image').evaluateAll((els) => Promise.all(els.map(async (el) => {
  const image = new Image();
  image.src = el.getAttribute('href')!;
  await image.decode();
  return image.naturalWidth * image.naturalHeight;
})));

test('every part of the hedgehog decodes', async ({ page }) => {
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(2);
  expect(sizes.every((n) => n > 0)).toBe(true);
});

test('the legs step while it walks, and hold when it stops', async ({ page }) => {
  const first = await legPaths(page);
  await expect.poll(() => legPaths(page)).not.toEqual(first);
  await page.getByRole('button', { name: 'pause' }).click();
  const paused = await legPaths(page);
  await page.waitForTimeout(300);
  expect(await legPaths(page)).toEqual(paused);
});

test('reduced motion stands it still on all four feet', async ({ page }) => {
  await page.getByLabel('reduced motion').check();
  const first = await legPaths(page);
  await page.waitForTimeout(300);
  expect(await legPaths(page)).toEqual(first);
  await expect(big(page).locator('[data-lid]')).toHaveCount(0);
});

test('the fox trots on stepping legs, every part decoded', async ({ page }) => {
  await page.getByRole('button', { name: 'fox', exact: true }).click();
  await page.getByRole('button', { name: 'trot', exact: true }).click();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(3);
  expect(sizes.every((n) => n > 0)).toBe(true);
  const first = await legPaths(page);
  await expect.poll(() => legPaths(page)).not.toEqual(first);
  await page.getByRole('button', { name: 'asleep', exact: true }).click();
  await expect(big(page).locator('[data-legs] path')).toHaveCount(0);
});
