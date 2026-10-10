import { expect, test, type Page } from '@playwright/test';
import { landsOnDecoration, SETS } from './seasonal';

// The Easter egg hunt: a basket and chicks on the shelf, painted eggs tucked
// into the ledges' ends with a found/total counter by the brand, and
// rabbits hopping on the ledges. What every set keeps is seasonal.spec.ts's;
// this is the hunt's own. The rabbits' longer behaviours (thumping and
// bolting, changing ledge, leaving eggs, keeping apart) are timed and
// random, and how their legs move is drawing, so those are covered by the
// models' and the rig's unit tests and the lab instead.

const EASTER = SETS.find((s) => s.theme === 'easter')!;
const overlay = EASTER.overlay;

async function hiddenEgg(page: Page) {
  const egg = page.locator(`${overlay} g[data-egg="hidden"]`).first();
  await expect(egg).toBeAttached();
  return egg;
}

test('the hunt starts with nothing found, and two or three rabbits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=easter');
  await hiddenEgg(page);
  await expect(page.locator(`${overlay} [data-tally]`)).toHaveAttribute('data-tally', /^0\/[1-9]/);
  await expect.poll(() => page.locator('[data-rabbit]').count()).toBeGreaterThanOrEqual(2);
  expect(await page.locator('[data-rabbit]').count()).toBeLessThanOrEqual(3);
});

test('clicks pass through the counter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=easter');
  const tally = page.locator(`${overlay} [data-tally]`);
  await expect(tally).toBeVisible();
  expect(await landsOnDecoration(tally, EASTER)).toBe(false);
});

test('passing the cursor over a hidden egg finds it, and the counter counts it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=easter');
  const egg = await hiddenEgg(page);
  const key = await egg.getAttribute('data-id');
  const box = (await egg.locator('image').boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + 2;
  await page.mouse.move(x - 80, y - 40);
  await page.mouse.move(x, y, { steps: 6 });
  await expect(page.locator(`${overlay} g[data-id="${key}"]`)).toHaveAttribute('data-egg', 'found');
  await expect(page.locator(`${overlay} [data-tally]`)).toHaveAttribute('data-tally', /^1\//);
  // A reload starts a new hunt: nothing is kept.
  await page.reload();
  await expect(page.locator(`${overlay} [data-tally]`)).toHaveAttribute('data-tally', /^0\//);
});

test('the counter sits in the rail head, clear of the brand and the nav', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?theme=easter');
    const tally = page.locator(`${overlay} [data-tally]`);
    await expect(tally).toBeVisible();
    await expect(page.locator('.rail nav a')).toHaveCount(7);
    const overlaps = await tally.evaluate((el) => {
      const t = el.getBoundingClientRect();
      const hit = (r: DOMRect) => t.left < r.right && r.left < t.right && t.top < r.bottom && r.top < t.bottom;
      const words = document.querySelector('.rail .brand span')!.getBoundingClientRect();
      const brand = document.querySelector('.rail .brand')!.getBoundingClientRect();
      const links = Array.from(document.querySelectorAll('.rail nav a, .rail button:not(.brand), main button, main input'), (a) => a.getBoundingClientRect());
      return { words: hit(words), inBrand: t.top >= brand.top && t.bottom <= brand.bottom && t.right <= brand.right + 0.5, links: links.filter(hit).length };
    });
    expect(overlaps).toEqual({ words: false, inBrand: true, links: 0 });
  }
});

test('under reduced motion the cursor finds no egg: the hunt holds still too', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=easter');
  await expect.poll(() => page.locator('[data-rabbit]').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  const hunt = async () => ({
    eggs: await page.locator(`${overlay} g[data-egg]`).evaluateAll((els) => els.map((el) => [el.getAttribute('data-egg'), el.innerHTML])),
    tally: await page.locator(`${overlay} [data-tally]`).getAttribute('data-tally'),
  });
  // The rabbits are out before the overview's queue, stats and usage have
  // all arrived, and each of those grows a card when it lands ("last review"
  // under Now is 18px), carrying the eggs down with their ledges: the eggs
  // are right to follow. Still is still once the page is, so wait for its
  // requests to finish (it next polls in 15s) and its drawing to rest.
  await page.waitForLoadState('networkidle');
  const rested = async () => {
    const first = await hunt();
    await page.waitForTimeout(400);
    return JSON.stringify(await hunt()) === JSON.stringify(first);
  };
  await expect.poll(rested, { intervals: [0] }).toBe(true);
  const before = await hunt();
  const box = (await page.locator(`${overlay} g[data-egg] image`).first().boundingBox())!;
  await page.mouse.move(box.x - 60, box.y, { steps: 2 });
  await page.mouse.move(box.x + box.width / 2, box.y + 2, { steps: 4 });
  await page.waitForTimeout(2500);
  expect(await hunt()).toEqual(before);
});
