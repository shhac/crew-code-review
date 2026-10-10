import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';
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

// Every crow picture drawn over the rail (the nav, the sky, the shelf),
// which crows never fly over: they leave away from the scarecrow.
const overRail = (page: Page) => crows(page).evaluateAll((els, drawn) => {
  const rail = document.querySelector('.rail')?.getBoundingClientRect();
  if (!rail) return [];
  return els.flatMap((el) => Array.from(el.querySelectorAll(drawn)).map((i) => i.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.left < rail.right && rail.left < r.right && r.top < rail.bottom && rail.top < r.bottom)
    .map(() => `${el.getAttribute('data-id')} over the rail`));
}, SET.drawn);

// Looks at the crows every 80ms until done says stop or time runs out,
// returning every overlap seen and every mode.
async function watch(page: Page, ms: number, done: () => Promise<boolean>) {
  const seen = { covered: new Set<string>(), modes: new Set<string>() };
  for (const end = Date.now() + ms; Date.now() < end;) {
    for (const c of await coveredContent(page, [['[data-harvest] [data-crow]', SET.drawn]], 1)) seen.covered.add(c);
    for (const c of await overRail(page)) seen.covered.add(c);
    for (const m of await crows(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-crow') ?? ''))) seen.modes.add(m);
    if (await done()) break;
    await page.waitForTimeout(80);
  }
  return { covered: [...seen.covered], modes: [...seen.modes] };
}

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
  const seen = await watch(page, 15_000, async () => (await count(page)) === 0);
  expect(await count(page)).toBe(0);
  expect(seen.modes).toContain('depart');
  expect(seen.covered).toEqual([]);
});

test('scattered by the cue, the crows leave and come back one at a time, clear all the way', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=harvest&theme-cue=scatter');
  await expect.poll(() => crows(page).evaluateAll((els) => els.filter((el) => el.getAttribute('data-crow') === 'depart').length), { timeout: 20_000 }).toBeGreaterThan(0);
  const gone = await watch(page, 10_000, async () => (await count(page)) === 0);
  expect(await count(page)).toBe(0);
  // Back within the cue's few seconds, one coming in at a time.
  const back = await watch(page, 25_000, async () => (await crows(page).evaluateAll((els) => els.filter((el) => el.getAttribute('data-crow') === 'scan' || el.getAttribute('data-crow') === 'peck' || el.getAttribute('data-crow') === 'walk').length)) >= 1);
  expect(back.modes).toContain('arrive');
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
