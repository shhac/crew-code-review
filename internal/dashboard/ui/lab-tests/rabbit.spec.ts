import { expect, test, type Page } from '@playwright/test';

// April's rabbit in the critters lab: its parts decode, its legs step as it
// hops and hold when paused, it sits still under reduced motion, and each
// mode lays its own key pose over it.

const big = (page: Page) => page.locator('[data-stage] [data-critter]');
const legBones = (page: Page) => big(page).locator('[data-legs] image').evaluateAll((els) => els.map((el) => el.getAttribute('transform')));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
});

test('every part of the rabbit decodes, and it hops on stepping legs', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=rabbit&mode=hop');
  await expect(big(page)).toBeVisible();
  const sizes = await big(page).locator('image').evaluateAll((els) => Promise.all(els.map(async (el) => {
    const image = new Image();
    image.src = el.getAttribute('href')!;
    await image.decode();
    return image.naturalWidth * image.naturalHeight;
  })));
  expect(sizes.length).toBeGreaterThanOrEqual(12);
  expect(sizes.every((n) => n > 0)).toBe(true);
  const first = await legBones(page);
  await expect.poll(() => legBones(page)).not.toEqual(first);
  await page.getByRole('button', { name: 'pause' }).click();
  const paused = await legBones(page);
  await page.waitForTimeout(300);
  expect(await legBones(page)).toEqual(paused);
});

test('reduced motion sits the rabbit still, its eye open', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=rabbit&mode=groom');
  await expect(big(page)).toBeVisible();
  await page.getByLabel('reduced motion').check();
  const first = await legBones(page);
  await page.waitForTimeout(400);
  expect(await legBones(page)).toEqual(first);
  await expect(big(page).locator('[data-lid]')).toHaveCount(0);
});

test('each of the rabbit\'s modes lays its own key pose over it', async ({ page }) => {
  const drawing = page.locator('[data-stage] image[href*="rabbit-pose"], [data-stage] image[href*="rabbit-reference"]');
  await page.goto('/lab/critters.html#animal=rabbit&mode=sit&frame=10&ref=sit');
  await expect(drawing).toHaveAttribute('href', /rabbit-pose-sit/);
  for (const [mode, pose] of [['hop', 'gather'], ['alert', 'alert'], ['groom', 'groom'], ['nudge', 'nudge'], ['thump', 'thump']]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(drawing).toHaveAttribute('href', new RegExp(`rabbit-pose-${pose}`));
  }
  await page.getByLabel('drawing').selectOption('standing');
  await expect(drawing).toHaveAttribute('href', /rabbit-reference/);
});
