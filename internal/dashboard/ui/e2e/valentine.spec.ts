import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';

// Valentine's: a shelf of chocolates, a rose and a card, rose petals on the
// ledges, and cupids hovering in the page's open air that shoot at a still
// cursor. Flits, dodges and the airspace rules over long runs are timed and
// random, so the models' unit tests cover those; this checks the page as a
// browser lays it out.

const CUPID_PARTS = 'image, path';
const cupids = (page: Page) => page.locator('[data-valentine] svg.rig');

// Every box a cupid's drawing covers that falls inside a card's own box:
// unlike the walkers, a flier keeps out of the cards altogether.
const overCards = (page: Page) => cupids(page).evaluateAll((els) => {
  const cards = Array.from(document.querySelectorAll('main .surface, main .queue-board, main .context section, main .terminal, main .metric-kpis > div, main .panel')).map((c) => c.getBoundingClientRect());
  const meets = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom && b.width > 0 && b.height > 0;
  return els.flatMap((el) => Array.from(el.querySelectorAll('image, path')).map((p) => p.getBoundingClientRect()).filter((r) => cards.some((c) => meets(r, c))).map(() => el.getAttribute('data-id')));
});

// Holds the cursor still near the queue's top edge until a cupid shoots,
// checking the arrow and its hearts at every look.
async function watchShot(page: Page) {
  await page.mouse.move(680, 280);
  await page.mouse.move(620, 230, { steps: 4 });
  const seen = { arrow: false, hearts: false, covered: [] as string[] };
  for (let i = 0; i < 60 && !(seen.arrow && seen.hearts); i++) {
    await page.waitForTimeout(80);
    const arrows = page.locator('[data-valentine] [data-arrow] path');
    const hearts = page.locator('[data-valentine] [data-heart]');
    if (await arrows.count()) seen.arrow = true;
    if (await hearts.count()) seen.hearts = true;
    seen.covered.push(...await coveredContent(arrows, 'path'), ...await coveredContent(hearts, 'path'));
  }
  return seen;
}

test('the valentine set decorates the page: its shelf, petals and at least two cupids', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=valentine');
  await expect(page.locator('[data-valentine]')).toBeAttached();
  await expect(page.locator('.valentine-shelf')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'valentine');
  await expect(page.locator('[data-valentine] .petal').first()).toBeAttached();
  await expect.poll(() => cupids(page).count()).toBeGreaterThanOrEqual(2);
});

test('nothing valentine takes pointer events, and it all sits below dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=valentine');
  const cupid = page.locator('[data-cupid][data-id="0"]');
  await expect(cupid).toBeVisible();
  const catching = await page.locator('[data-valentine], [data-valentine] *, .valentine-shelf, .valentine-shelf *').evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).pointerEvents !== 'none').map((el) => el.tagName + '.' + el.getAttribute('class')),
  );
  expect(catching).toEqual([]);
  const landsOnDecoration = await cupid.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-valentine], .valentine-shelf');
  });
  expect(landsOnDecoration).toBe(false);
  expect(Number(await page.locator('[data-valentine]').evaluate((el) => getComputedStyle(el).zIndex))).toBeLessThan(50);
  await expect(page.locator('[data-valentine]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.valentine-shelf')).toHaveAttribute('aria-hidden', 'true');
});

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

test('the cupids never cover text, controls, charts or cards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const seen: number[] = [];
  for (const route of ['/', '/logs', '/metrics', '/history']) {
    await page.goto(`${route}?theme=valentine`);
    await expect(page.locator('.rail nav a')).toHaveCount(7);
    await page.waitForTimeout(400);
    seen.push(await cupids(page).count());
    expect(await coveredContent(cupids(page), CUPID_PARTS)).toEqual([]);
    expect(await overCards(page)).toEqual([]);
  }
  expect(seen.every((n) => n >= 2)).toBe(true);
});

test('reduced motion shows still cupids that never shoot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=valentine');
  await expect.poll(() => cupids(page).count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await page.waitForTimeout(500);
  const scene = () => cupids(page).evaluateAll((els) => els.map((el) => [el.getAttribute('data-cupid'), el.getAttribute('data-pose'), el.getBoundingClientRect().toJSON(), el.innerHTML]));
  const before = await scene();
  expect(new Set(before.map(([mode, pose]) => `${mode} ${pose}`))).toEqual(new Set(['hover hover']));
  await page.mouse.move(640, 260, { steps: 3 });
  await page.waitForTimeout(2500);
  expect(await scene()).toEqual(before);
  await expect(page.locator('[data-valentine] [data-arrow]')).toHaveCount(0);
});

test('a phone keeps the page decorations, hides the shelf, and its cupids stay clear', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  for (const route of ['/', '/metrics']) {
    await page.goto(`${route}?theme=valentine`);
    await expect(page.locator('[data-valentine]')).toBeAttached();
    await expect(page.locator('.valentine-shelf')).toBeHidden();
    await page.waitForTimeout(400);
    expect(await coveredContent(cupids(page), CUPID_PARTS)).toEqual([]);
    expect(await overCards(page)).toEqual([]);
  }
});
