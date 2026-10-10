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
