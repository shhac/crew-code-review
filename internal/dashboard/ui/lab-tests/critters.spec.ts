import { expect, test, type Page } from '@playwright/test';

// Every seasonal animal in its workbench: each draws, the parts-drawn ones'
// parts decode, their legs step while walking and hold when paused,
// stillness holds under reduced motion, and the layer controls hide and
// separate parts.

const big = (page: Page) => page.locator('[data-stage] [data-critter]');
const legBones = (page: Page) => big(page).locator('[data-legs] image').evaluateAll((els) => els.map((el) => el.getAttribute('transform')));
const decoded = (page: Page) => big(page).locator('image').evaluateAll((els) => Promise.all(els.map(async (el) => {
  const image = new Image();
  image.src = el.getAttribute('href')!;
  await image.decode();
  return image.naturalWidth * image.naturalHeight;
})));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/lab/critters.html');
  await expect(big(page)).toBeVisible();
});

test('every part of the hedgehog decodes', async ({ page }) => {
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(3);
  expect(sizes.every((n) => n > 0)).toBe(true);
});

test('the legs step while it walks, and hold when it stops', async ({ page }) => {
  const first = await legBones(page);
  await expect.poll(() => legBones(page)).not.toEqual(first);
  await page.getByRole('button', { name: 'pause' }).click();
  const paused = await legBones(page);
  await page.waitForTimeout(300);
  expect(await legBones(page)).toEqual(paused);
});

test('reduced motion stands it still on all four feet', async ({ page }) => {
  await page.getByLabel('reduced motion').check();
  const first = await legBones(page);
  await page.waitForTimeout(300);
  expect(await legBones(page)).toEqual(first);
  await expect(big(page).locator('[data-lid]')).toHaveCount(0);
});

test('the fox trots on stepping legs, every part decoded', async ({ page }) => {
  await page.getByRole('button', { name: 'fox', exact: true }).click();
  await page.getByRole('button', { name: 'trot', exact: true }).click();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(5);
  expect(sizes.every((n) => n > 0)).toBe(true);
  const first = await legBones(page);
  await expect.poll(() => legBones(page)).not.toEqual(first);
  await page.getByRole('button', { name: 'asleep', exact: true }).click();
  await expect(big(page).locator('[data-legs]')).toHaveCount(0);
});

test('a layer can be hidden, and the parts shown apart', async ({ page }) => {
  await page.getByRole('button', { name: 'fox', exact: true }).click();
  const images = () => big(page).locator('image').count();
  const all = await images();
  await page.getByLabel('tail').uncheck();
  await expect.poll(images).toBe(all - 1);
  await page.getByLabel('separate pieces').check();
  // One piece shown alone for each layer listed.
  await expect(page.locator('.pieces figure')).toHaveCount(await page.locator('.parts .controls label').count());
});

test('the spider and the robin are here too', async ({ page }) => {
  await page.getByRole('button', { name: 'spider', exact: true }).click();
  await expect(big(page).locator('svg.walker')).toBeVisible();
  await page.getByRole('button', { name: 'robin', exact: true }).click();
  await expect(big(page).locator('[data-layered-robin]')).toBeVisible();
});

test('the layer list holds still while parts come and go, the eyelid listed from the start', async ({ page }) => {
  const labels = () => page.locator('.parts .controls label').allTextContents();
  const first = await labels();
  expect(first.map((l) => l.trim())).toContain('eyelid');
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(400);
    expect(await labels()).toEqual(first);
  }
});

test('the spider and the robin list their layers, and hide them', async ({ page }) => {
  await page.getByRole('button', { name: 'spider', exact: true }).click();
  await page.getByLabel('body', { exact: true }).uncheck();
  await expect(big(page).locator('svg.walker > image[href*="spider-body"]')).toHaveCount(0);
  await expect(big(page).locator('svg.walker > image')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'robin', exact: true }).click();
  await page.getByLabel('tail', { exact: true }).uncheck();
  await expect(big(page).locator('[data-part="tail"]')).toHaveCount(0);
});
