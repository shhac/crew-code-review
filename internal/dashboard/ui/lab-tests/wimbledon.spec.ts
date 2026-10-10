import { expect, test, type Page } from '@playwright/test';

// Summer tennis's birds in the critters lab: every part decodes, the pigeon
// walks on two stepping legs and flaps with its wings turning over, the
// hawk glides and flaps, both hold still under reduced motion, and their
// key poses lie over them.

const big = (page: Page) => page.locator('[data-stage] [data-critter]');
const legBones = (page: Page) => big(page).locator('[data-legs] image').evaluateAll((els) => els.map((el) => el.getAttribute('transform')));
const wings = (page: Page, bird: string) => big(page).locator(`image[href*="${bird}-arm"], image[href*="${bird}-hand"]`).evaluateAll((els) =>
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

test('the pigeon walks on two stepping legs, every part decoded', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=pigeon&mode=walk');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(10);
  expect(sizes.every((n) => n > 0)).toBe(true);
  const first = await legBones(page);
  await expect.poll(() => legBones(page)).not.toEqual(first);
});

test('the pigeon flies, its wings turning over between strokes', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=pigeon&mode=fly');
  await expect(big(page)).toBeVisible();
  // Both sides of both pieces of both wings are always drawn.
  await expect(big(page).locator('image[href*="pigeon-arm"], image[href*="pigeon-hand"]')).toHaveCount(8);
  const first = await wings(page, 'pigeon');
  await expect.poll(() => wings(page, 'pigeon')).not.toEqual(first);
});

test('the hawk glides and flaps, every part decoded', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=hawk&mode=flap');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(10);
  expect(sizes.every((n) => n > 0)).toBe(true);
  const first = await wings(page, 'hawk');
  await expect.poll(() => wings(page, 'hawk')).not.toEqual(first);
});

test('both hold still under reduced motion', async ({ page }) => {
  for (const hash of ['animal=pigeon&mode=walk&still=1', 'animal=hawk&mode=flap&still=1']) {
    await page.goto(`/lab/critters.html#${hash}`);
    await expect(big(page)).toBeVisible();
    const first = await big(page).innerHTML();
    await page.waitForTimeout(400);
    expect(await big(page).innerHTML(), hash).toEqual(first);
    await expect(big(page).locator('[data-lid]')).toHaveCount(0);
  }
});

test('each has its drawings to lay over it, each mode its own', async ({ page }) => {
  const drawing = page.locator('[data-stage] image[href*="-pose-"], [data-stage] image[href*="pigeon-reference"]');
  await page.goto('/lab/critters.html#animal=pigeon&mode=walk&frame=10&ref=walk%2C%20thrust');
  await expect(drawing).toHaveAttribute('href', /pigeon-pose-walk-thrust/);
  for (const [mode, pose] of [['peck', 'pigeon-pose-peck'], ['alert', 'pigeon-pose-alert'], ['take-off', 'pigeon-pose-takeoff'], ['fly', 'pigeon-pose-flight-down'], ['land', 'pigeon-pose-land'], ['stand', 'pigeon-reference']]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(drawing).toHaveAttribute('href', new RegExp(pose));
  }
  await page.goto('/lab/critters.html#animal=hawk&mode=glide&frame=10&ref=glide');
  await expect(drawing).toHaveAttribute('href', /hawk-pose-glide/);
  await page.getByRole('button', { name: 'flap', exact: true }).click();
  await expect(drawing).toHaveAttribute('href', /hawk-pose-flap-down/);
});
