import { expect, test, type Page } from '@playwright/test';

// The bird kit's test gull in the critters lab: every part decodes, it
// struts on two stepping legs, flaps with its wings turning over, holds
// still under reduced motion, and its key poses lie over it.

const big = (page: Page) => page.locator('[data-stage] [data-critter]');
const legBones = (page: Page) => big(page).locator('[data-legs] image').evaluateAll((els) => els.map((el) => el.getAttribute('transform')));
// Each wing picture's group transform and whether it is seen.
const wings = (page: Page) => big(page).locator('image[href*="gull-arm"], image[href*="gull-hand"]').evaluateAll((els) =>
  els.map((el) => `${el.closest('g')?.parentElement?.parentElement?.getAttribute('transform')} ${el.getAttribute('visibility') ?? 'visible'}`));
const decoded = (page: Page) => big(page).locator('image').evaluateAll((els) => Promise.all(els.map(async (el) => {
  const image = new Image();
  image.src = el.getAttribute('href')!;
  await image.decode();
  return image.naturalWidth * image.naturalHeight;
})));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
});

test('the gull struts on two stepping legs, every part decoded', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=gull&mode=strut');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(10);
  expect(sizes.every((n) => n > 0)).toBe(true);
  const first = await legBones(page);
  await expect.poll(() => legBones(page)).not.toEqual(first);
});

test('the gull flaps, its wings turning over between strokes, every part decoded', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=gull&mode=flap');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
  expect(sizes.every((n) => n > 0)).toBe(true);
  // Both sides of both pieces of both wings are always drawn.
  await expect(big(page).locator('image[href*="gull-arm"], image[href*="gull-hand"]')).toHaveCount(8);
  const first = await wings(page);
  await expect.poll(() => wings(page)).not.toEqual(first);
});

test('the gull holds still under reduced motion, whatever it was doing', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=gull&mode=flap&still=1');
  await expect(big(page)).toBeVisible();
  const first = await legBones(page);
  await page.waitForTimeout(400);
  expect(await legBones(page)).toEqual(first);
  await expect(big(page).locator('[data-lid]')).toHaveCount(0);
});

test('the gull has its drawings to lay over it, each mode its own', async ({ page }) => {
  const drawing = page.locator('[data-stage] image[href*="gull-pose"], [data-stage] image[href*="gull-reference"]');
  await page.goto('/lab/critters.html#animal=gull&mode=strut&frame=10&ref=walk%20contact');
  await expect(drawing).toHaveAttribute('href', /gull-pose-walk-contact/);
  for (const [mode, pose] of [['take-off', 'takeoff'], ['flap', 'flap-up'], ['stoop', 'swoop'], ['flare', 'flare-2'], ['stand', 'reference']]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(drawing).toHaveAttribute('href', new RegExp(pose === 'reference' ? 'gull-reference' : `gull-pose-${pose}`));
  }
});
