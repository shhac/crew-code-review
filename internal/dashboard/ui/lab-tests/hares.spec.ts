import { expect, test } from '@playwright/test';
import { big, decoded, legBones } from './critter';

// The hare in the critters lab: every part decodes, it bounds on stepping
// legs, sits on its long hind feet, holds still under reduced motion, and
// each mode has its key pose to lay over it.

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
});

test('the hare bounds on stepping legs, every part decoded', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=hare&mode=bound');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(10);
  expect(sizes.every((n) => n > 0)).toBe(true);
  const first = await legBones(page);
  await expect.poll(() => legBones(page)).not.toEqual(first);
});

test('the hare holds still under reduced motion, whatever it was doing', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=hare&mode=box&still=1');
  await expect(big(page)).toBeVisible();
  const first = await legBones(page);
  await page.waitForTimeout(400);
  expect(await legBones(page)).toEqual(first);
  await expect(big(page).locator('[data-lid]')).toHaveCount(0);
});

test('the hare has its drawings to lay over it, each mode its own', async ({ page }) => {
  const drawing = page.locator('[data-stage] image[href*="hare-pose"], [data-stage] image[href*="hare-reference"]');
  await page.goto('/lab/critters.html#animal=hare&mode=sit&frame=10&ref=sit');
  await expect(drawing).toHaveAttribute('href', /hare-pose-sit/);
  const [size] = await decoded(page, drawing);
  expect(size).toBeGreaterThan(0);
  for (const [mode, pose] of [['bound', 'bound-reach'], ['box', 'box'], ['alert', 'freeze'], ['graze', 'graze'], ['lope', 'lope']]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(drawing).toHaveAttribute('href', new RegExp(`hare-pose-${pose}`));
  }
  await page.getByLabel('drawing').selectOption('standing');
  await expect(drawing).toHaveAttribute('href', /hare-reference/);
});
