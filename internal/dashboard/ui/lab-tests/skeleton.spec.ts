import { expect, test, type Page } from '@playwright/test';
import { big } from './critter';

// The critters lab's skeleton view: three states, the drawing alone, the
// skeleton over it faded, and the skeleton alone, each kept in the address;
// and the skeleton drawn for an animal with its own view as well as for one
// drawn by a rig.

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
});

const art = (page: Page) => page.locator('[data-stage] [data-art]');
const skeleton = (page: Page) => page.locator('[data-stage] [data-skeleton]');
const hash = (page: Page) => page.evaluate(() => location.hash);

test('the skeleton view goes from the drawing alone, to over it faded, to alone, and back, in the address', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=rabbit&mode=sit&frame=0');
  await expect(big(page)).toBeVisible();
  await expect(page.getByLabel('art', { exact: true })).toBeChecked();
  await expect(skeleton(page)).toHaveCount(0);

  await page.getByText('skeleton over art', { exact: true }).click();
  await expect(skeleton(page).locator('text[data-bone="metacarpus"]')).toHaveCount(2);
  await expect(skeleton(page).locator('text[data-joint="wrist (carpus)"]')).toHaveCount(2);
  await expect(big(page)).toBeVisible();
  expect(Number(await art(page).evaluate((el) => getComputedStyle(el).opacity))).toBeCloseTo(0.22);
  await expect.poll(() => hash(page)).toContain('skeleton=faded');

  await page.getByText('skeleton only', { exact: true }).click();
  await expect(big(page)).toBeHidden();
  await expect(skeleton(page).locator('text[data-bone="humerus"]')).toHaveCount(2);
  await expect.poll(() => hash(page)).toContain('skeleton=only');

  await page.getByText('art', { exact: true }).click();
  await expect(big(page)).toBeVisible();
  await expect(skeleton(page)).toHaveCount(0);
  await expect.poll(() => hash(page)).not.toContain('skeleton');
});

test('a link to the skeleton alone opens on it', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=hare&mode=sit&frame=0&skeleton=only');
  await expect(page.getByLabel('skeleton only')).toBeChecked();
  await expect(big(page)).toBeHidden();
  await expect(skeleton(page).locator('text[data-bone="radius and ulna"]')).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel('skeleton only')).toBeChecked();
  await expect(skeleton(page).locator('text[data-joint="elbow"]')).toHaveCount(2);
});

test("the spider's skeleton is read off its drawn legs, and follows them as it walks", async ({ page }) => {
  await page.goto('/lab/critters.html#animal=spider&mode=walk&frame=0&skeleton=faded');
  const femurs = skeleton(page).locator('text[data-bone="femur (with coxa and trochanter)"]');
  await expect(femurs).toHaveCount(8);
  const claws = () => skeleton(page).locator('line.bone').evaluateAll((els) => els.map((el) => `${el.getAttribute('x2')} ${el.getAttribute('y2')}`));
  const first = await claws();
  await page.getByRole('button', { name: 'forward a frame' }).click();
  await page.getByRole('button', { name: 'forward a frame' }).click();
  await expect.poll(claws).not.toEqual(first);
});

test('the robin, whole pictures each turning about its pivot, shows those as its joints', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=robin&mode=alive&frame=0&skeleton=only');
  await expect(skeleton(page).locator('text[data-joint="neck (head turns here)"]')).toHaveCount(1);
  await expect(skeleton(page).locator('text[data-bone]')).toHaveCount(0);
});
