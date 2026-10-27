import { expect, test } from '@playwright/test';
import { big, decoded, legBones, seamOpening } from './critter';

// April's rabbit in the critters lab: its parts decode, its legs step as it
// hops and hold when paused, it sits still under reduced motion, each mode
// lays its own key pose over it, and its head stays on its neck.

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
});

test('every part of the rabbit decodes, and it hops on stepping legs', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=rabbit&mode=hop');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
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

// Its page pixels per drawing unit (rabbit-rig.ts's SCALE).
const SCALE = 1.4;
// Where the head lay over the body as the rabbit was drawn, each one's edge
// stays within a pixel and a fifth of the other in every mode (sat up
// alert, its head raised, the widest, closed to the eye): a nudge's head
// turned nose down about the throat swung the back of it 2.3px off the
// body, and the neck showed a notch; a groom's, 1.4px.
test('the rabbit\'s head stays on its neck in every mode', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/lab/critters.html#animal=rabbit&mode=nudge&frame=0');
  await expect(big(page)).toBeVisible();
  const modes = ['hop', 'bolt', 'sit', 'alert', 'groom', 'nudge', 'thump'];
  const at = modes.flatMap((mode) => Array.from({ length: 100 }, (_, i) => `animal=rabbit&mode=${mode}&frame=${i * 3}`));
  const found = await seamOpening(page, 'rabbit-head', 'rabbit-body', at);
  expect(found).toHaveLength(at.length);
  const widest = found.reduce((a, b) => (b.by > a.by ? b : a));
  expect(widest.by * SCALE, widest.at).toBeLessThan(1.2);
});
