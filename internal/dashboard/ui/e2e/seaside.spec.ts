import { expect, test, type Page } from '@playwright/test';
import { watchFrames } from './content';
import { seedRandom } from './seasonal';

// The seaside: chips, a bucket and spade and a 99 on the shelf, drifts of
// sand with shells along the ledges, and herring gulls that strut them,
// eye the cursor and swoop at one left still. What every set keeps
// (palette, inert overlay, counts, content clear, a still scene) is
// seasonal.spec.ts's; this is the seaside's own: the swoop, which is timed,
// so it is cued (`?theme-cue=swoop`: as soon as the cursor stops) and its
// every frame is watched.

const gulls = (page: Page) => page.locator('[data-seaside] [data-gull]');
const modes = (page: Page) => gulls(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-gull')));

test('the gulls stand about the ledges, sand drifted along them with shells', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=seaside');
  await expect.poll(() => gulls(page).count()).toBeGreaterThanOrEqual(2);
  expect(await modes(page)).not.toContain('dive');
  await expect(page.locator('[data-seaside] .sand').first()).toBeAttached();
  await expect(page.locator('[data-seaside] [data-shell]').first()).toBeAttached();
  await expect(page.locator('.seaside-shelf img')).toBeVisible();
});

test('a gull eyes a cursor left still near it', async ({ page }) => {
  test.setTimeout(60_000);
  await seedRandom(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=seaside');
  const gull = gulls(page).first();
  await expect(gull).toBeVisible();
  const box = (await gull.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + 120, box.y - 40, { steps: 3 });
  await expect.poll(() => modes(page), { timeout: 10_000 }).toContain('eye');
});

test('a cursor left still in clear air is swooped at by one gull, through clear air only, and it lands and calls', async ({ page }) => {
  test.setTimeout(90_000);
  await seedRandom(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=seaside&theme-cue=swoop');
  await expect.poll(() => gulls(page).count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await page.waitForTimeout(1000);
  // Over the empty stretch of the heading, between its subtitle and the
  // box to queue a pull request.
  await page.mouse.move(700, 80);
  await page.mouse.move(740, 60, { steps: 4 });
  // Every frame until one has swooped and is calling.
  const { seen, covered } = await watchFrames(page, [['[data-seaside] [data-gull]', 'image']], {
    ms: 15_000, until: ['[data-seaside] [data-gull="dive"]', '[data-seaside] [data-gull="call"]'],
  });
  expect(seen).toEqual(expect.arrayContaining(['run', 'climb', 'dive', 'pullup', 'flare', 'touchdown', 'call'].map((m) => `gull ${m}`)));
  expect(covered).toEqual([]);
  // Only one went, and the others watched it.
  expect(seen).toContain('gull eye');
});

test('reduced motion stands every gull still, and no swoop comes', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=seaside&theme-cue=swoop');
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await expect.poll(() => gulls(page).count()).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(500);
  const where = () => gulls(page).evaluateAll((els) => els.map((el) => [el.getAttribute('data-gull'), el.getBoundingClientRect().toJSON()]));
  const before = await where();
  expect(new Set(before.map(([mode]) => mode))).toEqual(new Set(['stand']));
  await page.mouse.move(700, 80);
  await page.mouse.move(740, 60, { steps: 4 });
  await page.waitForTimeout(2500);
  expect(await where()).toEqual(before);
});

