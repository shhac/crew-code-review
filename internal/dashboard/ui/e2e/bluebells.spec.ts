import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';
import { CATCH_UP } from './seasonal';

// May's bluebell wood: a clump of bluebells on the shelf, moss and clumps of
// bluebells along the ledges, and bumblebees going from flower to flower.
// What every set keeps is seasonal.spec.ts's; this is the bluebells' own.
// Flights, holds and the airspace rules over long runs are timed and random,
// so the models' unit tests cover those; this checks the page as a browser
// lays it out.

const bees = (page: Page) => page.locator('[data-bluebells] [data-bee]');
const drawn = 'image, [data-stroke]';

// Every box a bee's drawing covers that falls inside a card's own box by
// more than a pixel: a flier keeps out of the cards (a bonk touches a side
// by a pixel).
const overCards = (page: Page) => bees(page).evaluateAll((els, parts) => {
  const cards = Array.from(document.querySelectorAll('main .surface, main .queue-board, main .context section, main .terminal, main .metric-kpis > div, main .panel')).map((c) => c.getBoundingClientRect());
  const meets = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && b.width > 0 && b.height > 0;
  return els.flatMap((el) => Array.from(el.querySelectorAll(parts)).map((p) => p.getBoundingClientRect()).filter((r) => cards.some((c) => meets(r, c))).map(() => `${el.getAttribute('data-id')} ${el.getAttribute('data-bee')}`));
}, drawn);

test('a moving cursor close to a bee sends it darting off, clear of the page all the while', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bluebells');
  const bee = page.locator('[data-bluebells] [data-bee][data-id="0"]');
  await expect(bee).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(CATCH_UP);
  const box = (await bee.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  // Brushing past it, then hovering about where it was, moving.
  await page.mouse.move(x - 80, y + 10);
  await page.mouse.move(x - 10, y + 6, { steps: 6 });
  const seen = { modes: new Set<string>(), covered: [] as string[] };
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(x - 10 + (i % 2) * 6, y + 6, { steps: 2 });
    seen.modes.add((await bee.getAttribute('data-bee')) ?? '');
    seen.covered.push(...await coveredContent(page, [['[data-bluebells] [data-bee]', drawn]], 1), ...await overCards(page));
  }
  expect([...seen.modes].some((m) => m === 'dodge' || m === 'takeoff')).toBe(true);
  expect(seen.covered).toEqual([]);
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
      for (let i = 0; i < 4; i++) {
        if (i) await page.waitForTimeout(500);
        expect(await overCards(page), `${width} ${route}`).toEqual([]);
      }
    }
  }
  // A perched bee's bell dips under it.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bluebells');
  await expect.poll(() => page.locator('[data-bluebells] [data-bee="perch"]').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-bluebells] .clump.dipped').first()).toBeAttached();
});

// Watches the bees frame by frame (as fast as the page can be asked) until
// `done` says so, gathering everything they cover on the way.
async function watchFrames(page: Page, done: () => Promise<boolean>, ms: number) {
  const covered: string[] = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    covered.push(...await coveredContent(page, [['[data-bluebells] [data-bee]', drawn]], 1), ...await overCards(page));
    if (await done()) return { done: true, covered };
  }
  return { done: false, covered };
}

test('a cued bonk flies head first into a card\'s side and bounces off, never over content', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bluebells&theme-cue=bonk');
  await expect(bees(page).first()).toBeVisible({ timeout: 20_000 });
  const bee = page.locator('[data-bluebells] [data-bee][data-id="0"]');
  const seen = await watchFrames(page, async () => (await bee.getAttribute('data-bee')) === 'bounce', 40_000);
  expect(seen.done).toBe(true);
  expect(seen.covered).toEqual([]);
  // Dazed, it hovers and goes on, clear of everything.
  const after = await watchFrames(page, async () => (await bee.getAttribute('data-bee')) === 'hover', 3_000);
  expect(after.covered).toEqual([]);
});

test('a bee visits the shelf through the rail\'s air, never over the nav or the identity chip', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bluebells&theme-cue=shelf');
  await expect(bees(page).first()).toBeVisible({ timeout: 20_000 });
  const shelf = (await page.locator('[data-bluebell-shelf]').boundingBox())!;
  const nav = (await page.locator('.rail nav').boundingBox())!;
  const chip = (await page.locator('.rail .viewer-chip').boundingBox())!;
  const bee = page.locator('[data-bluebells] [data-bee][data-id="0"]');
  const onShelf = async () => {
    if ((await bee.getAttribute('data-bee')) !== 'perch') return false;
    const b = (await bee.boundingBox())!;
    return b.x + b.width / 2 > shelf.x && b.x + b.width / 2 < shelf.x + shelf.width;
  };
  // Any bee in the rail reaching up past the nav's bottom or down past the
  // identity chip's top.
  const outOfRail = () => bees(page).evaluateAll((els, [navBottom, chipTop, railRight, parts]) => els.flatMap((el) => {
    const out = Array.from(el.querySelectorAll(parts)).map((p) => p.getBoundingClientRect())
      .some((r) => r.width > 0 && r.left < railRight && (r.top < navBottom || r.bottom > chipTop));
    return out ? [el.getAttribute('data-id') ?? ''] : [];
  }), [nav.y + nav.height, chip.y, shelf.x + shelf.width + 40, drawn] as const);
  const strays: string[] = [];
  const visit = await watchFrames(page, async () => { strays.push(...await outOfRail()); return onShelf(); }, 45_000);
  expect(visit.done).toBe(true);
  expect(visit.covered).toEqual([]);
  expect(strays).toEqual([]);
});
