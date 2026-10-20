import { expect, test, type Page } from '@playwright/test';
import { watchFrames, type Drawn, type Region } from './content';
import { CATCH_UP } from './seasonal';

// May's bluebell wood: a clump of bluebells on the shelf, moss and clumps of
// bluebells along the ledges, and bumblebees going from flower to flower.
// What every set keeps is seasonal.spec.ts's; this is the bluebells' own.
// Flights, holds and the airspace rules over long runs are timed and random,
// so the models' unit tests cover those; this checks the page as a browser
// lays it out.

const bees = (page: Page) => page.locator('[data-bluebells] [data-bee]');
const BEES: readonly Drawn[] = [['[data-bluebells] [data-bee]', 'image, [data-stroke]']];
const bee0 = '[data-bluebells] [data-bee][data-id="0"]';

// A flier keeps out of the cards' own boxes too, by more than a pixel (a
// bonk touches a side by a pixel).
const CARDS: Region = {
  name: 'a card', slack: 1,
  boxes: 'main .surface, main .queue-board, main .context section, main .terminal, main .metric-kpis > div, main .panel',
};

test('a moving cursor close to a bee sends it darting off, clear of the page all the while', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bluebells');
  const bee = page.locator('[data-bluebells] [data-bee][data-id="0"]');
  await expect(bee).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(CATCH_UP);
  const box = (await bee.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  // Every frame from the brush past it, through hovering about where it was,
  // moving, until it darts, and then its dart.
  const watching = watchFrames(page, BEES, { ms: 10_000, until: [`${bee0}:is([data-bee="dodge"], [data-bee="takeoff"])`], keepOut: [CARDS] });
  await page.mouse.move(x - 80, y + 10);
  await page.mouse.move(x - 10, y + 6, { steps: 6 });
  for (let i = 0; i < 20; i++) await page.mouse.move(x - 10 + (i % 2) * 6, y + 6, { steps: 2 });
  const darted = await watching;
  expect(darted.done).toBe(true);
  const dart = await watchFrames(page, BEES, { ms: 1500, keepOut: [CARDS] });
  expect([...darted.covered, ...dart.covered]).toEqual([]);
});

test('the bees keep out of the cards and bells dip under them, wide and on a phone', async ({ page }) => {
  test.setTimeout(90_000);
  for (const [width, routes] of [[1440, ['/', '/metrics', '/history']], [1024, ['/', '/logs']], [390, ['/', '/metrics']]] as const) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`${route}?theme=bluebells`);
      await expect(page.locator('.rail nav a')).toHaveCount(7);
      await expect.poll(() => bees(page).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
      await page.waitForTimeout(CATCH_UP);
      expect((await watchFrames(page, BEES, { ms: 1500, keepOut: [CARDS] })).covered, `${width} ${route}`).toEqual([]);
    }
  }
  // A perched bee's bell dips under it.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bluebells');
  await expect.poll(() => page.locator('[data-bluebells] [data-bee="perch"]').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-bluebells] .clump.dipped').first()).toBeAttached();
});

test('a cued bonk flies head first into a card\'s side and bounces off, never over content', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bluebells&theme-cue=bonk');
  await expect(bees(page).first()).toBeVisible({ timeout: 20_000 });
  const seen = await watchFrames(page, BEES, { ms: 40_000, until: [`${bee0}[data-bee="bounce"]`], keepOut: [CARDS] });
  expect(seen.done).toBe(true);
  expect(seen.covered).toEqual([]);
  // Dazed, it hovers and goes on, clear of everything.
  const after = await watchFrames(page, BEES, { ms: 3_000, until: [`${bee0}[data-bee="hover"]`], keepOut: [CARDS] });
  expect(after.covered).toEqual([]);
});

test('a bee visits the shelf through the rail\'s air, never over the nav or the identity chip', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bluebells&theme-cue=shelf');
  await expect(bees(page).first()).toBeVisible({ timeout: 20_000 });
  const shelf = (await page.locator('[data-bluebell-shelf]').boundingBox())!;
  const bee = page.locator(bee0);
  const onShelf = async () => {
    if ((await bee.getAttribute('data-bee')) !== 'perch') return false;
    const b = (await bee.boundingBox())!;
    return b.x + b.width / 2 > shelf.x && b.x + b.width / 2 < shelf.x + shelf.width;
  };
  // Every frame, a quarter of a second at a time, until it perches on the
  // shelf: in the rail a bee keeps below the nav and above the identity chip.
  const keepOut = [CARDS, { name: 'the nav', boxes: '.rail nav' }, { name: 'the identity chip', boxes: '.rail .viewer-chip' }];
  const visit = async (end: number, covered: readonly string[]): Promise<{ done: boolean; covered: readonly string[] }> => {
    const all = [...covered, ...(await watchFrames(page, BEES, { ms: 250, keepOut })).covered];
    if (await onShelf()) return { done: true, covered: all };
    return Date.now() < end ? visit(end, all) : { done: false, covered: all };
  };
  const visited = await visit(Date.now() + 45_000, []);
  expect(visited.done).toBe(true);
  expect(visited.covered).toEqual([]);
});
