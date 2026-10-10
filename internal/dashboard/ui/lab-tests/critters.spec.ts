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

const frameShown = (page: Page) => page.locator('output[data-frame]').getAttribute('data-frame');

test('a frame named in the address draws the same thing every time, paused there', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=fox&mode=trot&frame=214');
  await expect(big(page)).toBeVisible();
  expect(await frameShown(page)).toBe('214');
  const first = await legBones(page);
  await page.waitForTimeout(300);
  expect(await legBones(page)).toEqual(first);
  await page.reload();
  await expect(big(page)).toBeVisible();
  expect(await legBones(page)).toEqual(first);
});

test('stepping a frame moves the pose on and the address with it', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=fox&mode=trot&frame=214');
  await expect(big(page)).toBeVisible();
  const at214 = await legBones(page);
  await page.getByRole('button', { name: 'forward a frame' }).click();
  expect(await frameShown(page)).toBe('215');
  expect(await legBones(page)).not.toEqual(at214);
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('frame=215');
  await page.keyboard.press('ArrowLeft');
  expect(await frameShown(page)).toBe('214');
  expect(await legBones(page)).toEqual(at214);
});

test('the frame counts on while it plays, past any loop', async ({ page }) => {
  const first = Number(await frameShown(page));
  await expect.poll(async () => Number(await frameShown(page))).toBeGreaterThan(first + 30);
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

test('the hedgehog has its drawings to lay over it, each mode its own', async ({ page }) => {
  const drawing = page.locator('[data-stage] image[href*="hedgehog-pose"], [data-stage] image[href*="hedgehog-reference"]');
  await page.goto('/lab/critters.html#animal=hedgehog&mode=sniff&frame=10&ref=sniff');
  await expect(drawing).toHaveAttribute('href', /hedgehog-pose-sniff/);
  expect(await drawing.evaluate(async (el) => {
    const image = new Image();
    image.src = el.getAttribute('href')!;
    await image.decode();
    return image.naturalWidth;
  })).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'walk', exact: true }).click();
  await expect(drawing).toHaveAttribute('href', /hedgehog-pose-walk-contact/);
  await page.getByLabel('drawing').selectOption('standing');
  await expect(drawing).toHaveAttribute('href', /hedgehog-reference/);
  await page.getByRole('button', { name: 'fox', exact: true }).click();
  await expect(drawing).toHaveCount(0);
});

test('the cupid hovers above the floor, beating its wings, every part decoded', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=cupid&mode=hover');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(8);
  expect(sizes.every((n) => n > 0)).toBe(true);
  // Airborne: its feet clear the stage's floor.
  const feet = await big(page).evaluate((el) => el.getBoundingClientRect().bottom);
  const floor = await page.locator('[data-stage] .floor').evaluate((el) => el.getBoundingClientRect().top);
  expect(feet).toBeLessThan(floor);
  const wings = () => big(page).locator('g[transform]').evaluateAll((els) => els.map((el) => el.getAttribute('transform')));
  const first = await wings();
  await expect.poll(wings).not.toEqual(first);
});

test('the cupid draws its bow in code, the arrow nocked only while it draws', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=cupid&mode=aim&frame=0');
  await expect(big(page).locator('[data-stroke="string"]')).toHaveCount(1);
  await expect(big(page).locator('[data-stroke="arrow head"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'hover', exact: true }).click();
  await expect(big(page).locator('[data-stroke="arrow head"]')).toHaveCount(0);
  await page.getByLabel('reduced motion').check();
  const still = await big(page).innerHTML();
  await page.waitForTimeout(300);
  expect(await big(page).innerHTML()).toBe(still);
});

test('the bee proves the insect rig: legs and antennae in code, a steady wing blur, every part decoded', async ({ page }) => {
  const legs = () => big(page).locator('[data-stroke="near legs"], [data-stroke="far legs"]').evaluateAll((els) => els.map((el) => el.getAttribute('d')));
  await page.goto('/lab/critters.html#animal=bee&mode=crawl');
  await expect(big(page)).toBeVisible();
  const sizes = await decoded(page);
  expect(sizes.length).toBeGreaterThanOrEqual(5);
  expect(sizes.every((n) => n > 0)).toBe(true);
  // Six legs, each its bones and claws, outlined then coloured.
  expect(await legs()).toHaveLength(48);
  await expect(big(page).locator('[data-stroke="near antenna"]')).toHaveCount(2);
  const first = await legs();
  await expect.poll(legs).not.toEqual(first);
  await expect(big(page).locator('[data-stroke="wing blur"]')).toHaveCount(0);
  // Hovering, the wings are a fan and two faint wings, held still from
  // frame to frame while the body bobs.
  await page.goto('/lab/critters.html#animal=bee&mode=hover&frame=0');
  await expect(big(page).locator('[data-stroke="wing blur"]')).toHaveCount(1);
  const fan = () => big(page).locator('[data-stroke="wing blur"]').getAttribute('d');
  const at0 = await fan();
  await page.getByRole('button', { name: 'forward a frame' }).click();
  expect(await fan()).toBe(at0);
  await page.getByLabel('reduced motion').check();
  await expect(big(page).locator('[data-stroke="wing blur"]')).toHaveCount(0);
  await expect(big(page).locator('[data-lid]')).toHaveCount(0);
  await page.getByRole('button', { name: 'play' }).click();
  const still = await big(page).innerHTML();
  await page.waitForTimeout(300);
  expect(await big(page).innerHTML()).toBe(still);
});
