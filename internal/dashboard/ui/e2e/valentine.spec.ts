import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';
import { CATCH_UP } from './seasonal';

// Valentine's: a shelf of chocolates, a rose and a card, rose petals on the
// ledges, and cupids hovering in the page's open air that shoot at a still
// cursor. What every set keeps is seasonal.spec.ts's; this is Valentine's
// own. Flits, dodges and the airspace rules over long runs are timed and
// random, so the models' unit tests cover those; this checks the page as a
// browser lays it out.

const cupids = (page: Page) => page.locator('[data-valentine] svg.rig');

// Every box a cupid's drawing covers that falls inside a card's own box:
// unlike the walkers, a flier keeps out of the cards altogether.
const overCards = (page: Page) => cupids(page).evaluateAll((els) => {
  const cards = Array.from(document.querySelectorAll('main .surface, main .queue-board, main .context section, main .terminal, main .metric-kpis > div, main .panel')).map((c) => c.getBoundingClientRect());
  const meets = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom && b.width > 0 && b.height > 0;
  return els.flatMap((el) => Array.from(el.querySelectorAll('image, path')).map((p) => p.getBoundingClientRect()).filter((r) => cards.some((c) => meets(r, c))).map(() => el.getAttribute('data-id')));
});

// Holds the cursor still near the queue's top edge until a cupid shoots,
// checking the arrow and its hearts at every look. It rests past the end of
// the heading's subtitle: an arrow comes down from the air above, so the
// ledges under the subtitle are out of reach, and how far it runs depends on
// the font (Linux's DejaVu Sans sets it 47px wider than macOS does).
async function watchShot(page: Page) {
  const x = await page.locator('main .hero h1 + p').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().right + 60;
  });
  await page.mouse.move(x + 60, 280);
  await page.mouse.move(x, 230, { steps: 4 });
  const seen = { arrow: false, hearts: false, covered: [] as string[] };
  for (let i = 0; i < 60 && !(seen.arrow && seen.hearts); i++) {
    await page.waitForTimeout(80);
    const arrows = page.locator('[data-valentine] [data-arrow] path');
    const hearts = page.locator('[data-valentine] [data-heart]');
    if (await arrows.count()) seen.arrow = true;
    if (await hearts.count()) seen.hearts = true;
    seen.covered.push(...await coveredContent(page, [['[data-valentine] [data-arrow] path', 'path'], ['[data-valentine] [data-heart]', 'path']]));
  }
  return seen;
}

test('a cupid shoots at a still cursor, into a ledge, and neither arrow nor hearts cover anything', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=valentine');
  await expect.poll(() => cupids(page).count()).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(400);
  const seen = await watchShot(page);
  expect(seen.arrow).toBe(true);
  expect(seen.hearts).toBe(true);
  expect(seen.covered).toEqual([]);
  // The spent arrow stays stuck in its ledge a while.
  await expect(page.locator('[data-valentine] [data-arrow="stuck"]')).toHaveCount(1);
});

test('a cursor whipping past a cupid makes it dodge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=valentine');
  const cupid = page.locator('[data-cupid][data-id="0"]');
  await expect(cupid).toBeVisible();
  await page.waitForTimeout(400);
  const box = (await cupid.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x - 150, y + 4);
  await page.mouse.move(x + 150, y - 4, { steps: 6 });
  await expect(cupid).toHaveAttribute('data-cupid', 'dodge', { timeout: 1000 });
});

test('the cupids keep out of the cards, wide and on a phone', async ({ page }) => {
  for (const [width, routes] of [[1440, ['/', '/logs', '/metrics', '/history']], [390, ['/', '/metrics']]] as const) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`${route}?theme=valentine`);
      await expect(page.locator('.rail nav a')).toHaveCount(7);
      await page.waitForTimeout(CATCH_UP);
      expect(await overCards(page), `${width} ${route}`).toEqual([]);
    }
  }
});

test('reduced motion never shoots at a still cursor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=valentine');
  await expect.poll(() => cupids(page).count()).toBeGreaterThanOrEqual(2);
  await page.mouse.move(680, 280);
  await page.mouse.move(620, 230, { steps: 4 });
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-valentine] [data-arrow]')).toHaveCount(0);
});
