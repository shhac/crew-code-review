import { expect, test, type Page } from '@playwright/test';
import { watchFrames } from './content';
import { SETS } from './seasonal';

// The harvest: a scarecrow on the rail's shelf, straw and grain on the
// ledges, and carrion crows feeding there that a flap of the scarecrow's
// arms scatters off the page. What every set keeps is seasonal.spec.ts's;
// this is September's own. The scatter is timed and random, so it is
// started on demand (a stroke past the scarecrow, or `?theme-cue=scatter`)
// and checked frame by frame; the airspace rules over long runs are the
// models' unit tests.

const SET = SETS.find((s) => s.theme === 'harvest')!;
const crows = (page: Page) => page.locator('[data-harvest] [data-crow]');
const count = (page: Page) => crows(page).count();
const arm = (page: Page) => page.locator('.harvest-shelf .arm.left').evaluate((el) => (el instanceof HTMLElement ? Math.abs(parseFloat(el.style.rotate || '0')) : NaN));

// Every frame for `ms` or until `until` is met: what the crows cover, the
// rail included (the nav, the sky, the shelf), which crows never fly over:
// they leave away from the scarecrow.
const watch = (page: Page, ms: number, until: string) => watchFrames(page, [['[data-harvest] [data-crow]', SET.drawn]], {
  ms, until: [until], keepOut: [{ name: 'the rail', boxes: '.rail' }],
});
const NONE_LEFT = '[data-harvest]:not(:has([data-crow]))';

// A short stroke past the scarecrow, 10px off its right side.
async function stir(page: Page) {
  const box = (await page.locator('[data-scarecrow]').boundingBox())!;
  await page.mouse.move(box.x + box.width + 80, box.y + 10);
  await page.mouse.move(box.x + box.width + 10, box.y + 24, { steps: 5 });
}

test('a stroke past the scarecrow flaps its arms and sends every crow off the page, clear of the content and the rail', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=harvest');
  await expect.poll(() => count(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(600);
  await stir(page);
  await expect.poll(() => arm(page)).toBeGreaterThan(10);
  const seen = await watch(page, 15_000, NONE_LEFT);
  expect(seen.done).toBe(true);
  expect(seen.seen).toContain('crow depart');
  expect(seen.covered).toEqual([]);
});

test('scattered by the cue, the crows leave and come back one at a time, clear all the way', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=harvest&theme-cue=scatter');
  await expect.poll(() => crows(page).evaluateAll((els) => els.filter((el) => el.getAttribute('data-crow') === 'depart').length), { timeout: 20_000 }).toBeGreaterThan(0);
  const gone = await watch(page, 10_000, NONE_LEFT);
  expect(gone.done).toBe(true);
  // Back within the cue's few seconds, one coming in at a time.
  const back = await watch(page, 25_000, '[data-harvest] :is([data-crow="scan"], [data-crow="peck"], [data-crow="walk"])');
  expect(back.done).toBe(true);
  expect(back.seen).toContain('crow arrive');
  expect(await crows(page).evaluateAll((els) => els.filter((el) => el.getAttribute('data-crow') === 'arrive').length)).toBeLessThanOrEqual(1);
  expect([...gone.covered, ...back.covered]).toEqual([]);
});

test('on a phone there is no scarecrow, and the crows feed on, a cursor near the corner scaring none', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/?theme=harvest');
  await expect(page.locator('.harvest-shelf')).toBeHidden();
  await expect.poll(() => count(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(SET.min[390]);
  await page.mouse.move(20, 880);
  await page.mouse.move(120, 800, { steps: 6 });
  await page.waitForTimeout(1200);
  const modes = await crows(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-crow')));
  expect(modes.filter((m) => m === 'takeoff' || m === 'depart')).toEqual([]);
});

test('under reduced motion the scarecrow rests with its arms straight out, and stirring it scares nobody', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=harvest');
  await expect.poll(() => count(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(400);
  const before = await crows(page).evaluateAll((els) => els.map((el) => el.outerHTML));
  await stir(page);
  await page.waitForTimeout(1500);
  expect(await arm(page)).toBe(0);
  expect(await crows(page).evaluateAll((els) => els.map((el) => el.outerHTML))).toEqual(before);
});
