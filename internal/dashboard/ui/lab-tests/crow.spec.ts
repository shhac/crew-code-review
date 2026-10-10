import { expect, test, type Page } from '@playwright/test';

// September's carrion crow in the critters lab: every part decodes, it
// walks on two stepping legs bobbing its head, pecks, flaps with its wings
// turning over, holds still under reduced motion, names a bird's joints,
// and its key poses lie over it.

const big = (page: Page) => page.locator('[data-stage] [data-critter]');
const legBones = (page: Page) => big(page).locator('[data-legs] image').evaluateAll((els) => els.map((el) => el.getAttribute('transform')));
const wings = (page: Page) => big(page).locator('image[href*="crow-wing-arm"], image[href*="crow-wing-hand"]').evaluateAll((els) =>
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

test('the crow walks on two stepping legs, every part decoded', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=crow&mode=walk');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(10);
  expect(sizes.every((n) => n > 0)).toBe(true);
  const first = await legBones(page);
  await expect.poll(() => legBones(page)).not.toEqual(first);
});

test('the crow flaps, its wings turning over between strokes', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=crow&mode=flap');
  await expect(big(page)).toBeVisible();
  expect((await decoded(page)).every((n) => n > 0)).toBe(true);
  // Both sides of both pieces of both wings are always drawn.
  await expect(big(page).locator('image[href*="crow-wing-arm"], image[href*="crow-wing-hand"]')).toHaveCount(8);
  const first = await wings(page);
  await expect.poll(() => wings(page)).not.toEqual(first);
});

test('the crow holds still under reduced motion, whatever it was doing', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=crow&mode=peck&still=1');
  await expect(big(page)).toBeVisible();
  const first = await legBones(page);
  await page.waitForTimeout(400);
  expect(await legBones(page)).toEqual(first);
  await expect(big(page).locator('[data-lid]')).toHaveCount(0);
});

test('the crow names a bird’s joints, and has its drawings to lay over it, each mode its own', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=crow&mode=stand&frame=0&guides=1');
  for (const joint of ['hip', 'knee', 'intertarsal joint (ankle)', 'toes (metatarsophalangeal joint)']) {
    await expect(page.locator('[data-stage]').getByText(joint, { exact: true }).first()).toBeAttached();
  }
  const drawing = page.locator('[data-stage] image[href*="crow-pose"], [data-stage] image[href*="crow-reference"]');
  await page.goto('/lab/critters.html#animal=crow&mode=walk&frame=10&ref=walk');
  await expect(drawing).toHaveAttribute('href', /crow-pose-walk/);
  for (const [mode, pose] of [['peck', 'peck'], ['alert', 'alert'], ['take-off', 'takeoff-2'], ['flap', 'flight-up-2'], ['flare', 'land-2'], ['stand', 'reference']]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(drawing).toHaveAttribute('href', new RegExp(pose === 'reference' ? 'crow-reference' : `crow-pose-${pose}`));
  }
});
