import { expect, test, type Page } from '@playwright/test';
import { big } from './critter';

// The critters lab's skeleton view: three states, the drawing alone, the
// skeleton over it faded, and the skeleton alone, each kept in the address;
// codes on the stage, a name shown on pointing and a joint or bone pinned
// by a click, in the address too, with the legend under the stage in step;
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
  await expect(skeleton(page).locator('text[data-code="L0B2"]')).toHaveCount(1);
  await expect(skeleton(page).locator('text[data-code="L1J2"]')).toHaveCount(1);
  await expect(big(page)).toBeVisible();
  expect(Number(await art(page).evaluate((el) => getComputedStyle(el).opacity))).toBeCloseTo(0.22);
  await expect.poll(() => hash(page)).toContain('skeleton=faded');

  await page.getByText('skeleton only', { exact: true }).click();
  await expect(big(page)).toBeHidden();
  await expect(skeleton(page).locator('text[data-code="L0B0"]')).toHaveCount(1);
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
  await expect(skeleton(page).locator('text[data-code="L1B1"]')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel('skeleton only')).toBeChecked();
  await expect(skeleton(page).locator('text[data-code="L0J1"]')).toHaveCount(1);
});

test('an old link to a joint or bone whose code has moved pins it under its code now', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=hedgehog&mode=sniff&frame=0&skeleton=faded&joint=L0J1');
  await expect(page.locator('[data-legend] [data-row="L0J3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => hash(page)).toContain('joint=L0J3');
  await page.goto('/lab/critters.html#animal=hedgehog&mode=sniff&frame=0&skeleton=faded&bone=L2B1');
  await expect(page.locator('[data-legend] [data-row="L2B3"]')).toHaveAttribute('aria-pressed', 'true');
});

test("the spider's skeleton is read off its drawn legs, and follows them as it walks", async ({ page }) => {
  await page.goto('/lab/critters.html#animal=spider&mode=walk&frame=0&skeleton=faded');
  await expect(skeleton(page).locator('text[data-code$="B0"]')).toHaveCount(8);
  await expect(page.locator('[data-legend] [data-row="L7B0"]')).toContainText('femur');
  const claws = () => skeleton(page).locator('line.bone').evaluateAll((els) => els.map((el) => `${el.getAttribute('x2')} ${el.getAttribute('y2')}`));
  const first = await claws();
  await page.getByRole('button', { name: 'forward a frame' }).click();
  await page.getByRole('button', { name: 'forward a frame' }).click();
  await expect.poll(claws).not.toEqual(first);
});

test('the robin, whole pictures each turning about its pivot, shows those as its joints, its spine through them head to tail', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=robin&mode=alive&frame=0&skeleton=only');
  await expect(page.locator('[data-legend] [data-row="SJ0"]')).toContainText('head joint');
  await expect(page.locator('[data-legend] [data-row="SJ2"]')).toContainText('tail root');
  await expect(skeleton(page).locator('text[data-code="SB0"]')).toHaveCount(1);
});

test('every code stands outside the animal, tied to its point by a leader', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=rabbit&mode=hop&frame=0&skeleton=faded&zoom=16');
  const outside = await skeleton(page).evaluate((svg) => {
    const box = (sel: string) => [...svg.querySelectorAll(sel)].map((el) => el.getBoundingClientRect());
    const joints = box('circle.joint');
    const left = Math.min(...joints.map((r) => r.left)), right = Math.max(...joints.map((r) => r.right));
    return box('text.code').every((r) => r.right <= left || r.left >= right);
  });
  expect(outside).toBe(true);
  await expect(skeleton(page).locator('line.leader')).toHaveCount(await skeleton(page).locator('text.code').count());
});

test('pointing at a code names it; a click pins it, in the address and the legend, and a click on the stage lets it go', async ({ page }) => {
  await page.goto('/lab/critters.html#animal=rabbit&mode=sit&frame=0&skeleton=faded&zoom=16');
  const name = skeleton(page).locator('text[data-name]');
  await expect(name).toHaveCount(0);
  await skeleton(page).locator('text[data-code="L0B2"]').hover();
  await expect(name).toHaveText('L0B2 metacarpus');
  await expect(page.locator('[data-legend] [data-row="L0B2"]')).toHaveClass(/lit/);
  await expect(page.locator('[data-legend] [data-row="L0J3"]')).toHaveClass(/lit/);
  await expect(skeleton(page).locator('line.bone.dim').first()).toBeAttached();

  await skeleton(page).locator('text[data-code="L0B2"]').click();
  await expect.poll(() => hash(page)).toContain('bone=L0B2');
  await expect(page.locator('[data-legend] [data-row="L0B2"]')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(5, 5);
  await expect(name).toHaveText('L0B2 metacarpus');

  await page.reload();
  await expect(name).toHaveText('L0B2 metacarpus');
  await page.locator('[data-legend] [data-row="L2J1"]').click();
  await expect.poll(() => hash(page)).toContain('joint=L2J1');
  await page.mouse.move(5, 5);
  await expect(name).toHaveText('L2J1 stifle (knee)');

  await page.locator('[data-stage]').click({ position: { x: 20, y: 20 } });
  await expect(name).toHaveCount(0);
  await expect.poll(() => hash(page)).not.toContain('joint=');
});
