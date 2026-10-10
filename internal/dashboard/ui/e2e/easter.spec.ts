import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';

// The Easter egg hunt: a basket and chicks on the shelf, painted eggs tucked
// into the ledges' ends with a found/total counter by the brand, and
// rabbits hopping on the ledges. The rabbits' longer behaviours (thumping
// and bolting, changing ledge, leaving eggs, keeping apart) are timed and
// random, and how their legs move is drawing, so those are covered by the
// models' and the rig's unit tests and the lab instead.

const overlay = '[data-easter]';

async function hiddenEgg(page: Page) {
  const egg = page.locator(`${overlay} g[data-egg="hidden"]`).first();
  await expect(egg).toBeAttached();
  return egg;
}

async function serveEaster(page: Page) {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.theme = 'easter';
    await route.fulfill({ response, json: config });
  });
}

test('the daemon-resolved easter theme decorates the page and takes its palette', async ({ page }) => {
  await serveEaster(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator(overlay)).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'easter');
  expect(await page.locator('.brand em').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(196, 168, 242)');
});

test('the easter set mounts its shelf, its eggs, its counter and two or three rabbits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=easter');
  await expect(page.locator(overlay)).toBeAttached();
  await expect(page.locator('.easter-shelf')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'easter');
  await hiddenEgg(page);
  await expect(page.locator(`${overlay} [data-tally]`)).toHaveAttribute('data-tally', /^0\/[1-9]/);
  await expect.poll(() => page.locator('[data-rabbit]').count()).toBeGreaterThanOrEqual(2);
  expect(await page.locator('[data-rabbit]').count()).toBeLessThanOrEqual(3);
});

test('nothing easter takes pointer events, and it all sits below dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=easter');
  const rabbit = page.locator('[data-rabbit]').first();
  await expect(rabbit).toBeVisible();
  await hiddenEgg(page);
  await expect(page.locator(`${overlay} [data-tally]`)).toBeVisible();
  const catching = await page.locator(`${overlay}, ${overlay} *, .easter-shelf, .easter-shelf *`).evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).pointerEvents !== 'none').map((el) => el.tagName + '.' + el.getAttribute('class')),
  );
  expect(catching).toEqual([]);
  for (const target of [rabbit, page.locator(`${overlay} [data-tally]`)]) {
    const landsOnDecoration = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-easter], .easter-shelf');
    });
    expect(landsOnDecoration).toBe(false);
  }
  expect(Number(await page.locator(overlay).evaluate((el) => getComputedStyle(el).zIndex))).toBeLessThan(50);
  await expect(page.locator(overlay)).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.easter-shelf')).toHaveAttribute('aria-hidden', 'true');
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

test('neither the rabbits nor the eggs ever cover text, controls or charts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const seen: number[] = [];
  for (const route of ['/', '/history', '/metrics', '/leaderboard', '/config', '/prompt', '/logs']) {
    await page.goto(`${route}?theme=easter`);
    await expect(page.locator('.rail nav a')).toHaveCount(7);
    await page.waitForTimeout(400);
    const rabbits = page.locator(`${overlay} svg.rig`);
    seen.push(await rabbits.count());
    expect(await coveredContent(rabbits), route).toEqual([]);
    expect(await coveredContent(page.locator(`${overlay} g[data-egg]`)), route).toEqual([]);
  }
  expect(seen.slice(0, 3).every((n) => n >= 2)).toBe(true);
});

test('reduced motion shows a still easter scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=easter');
  const rabbits = page.locator('[data-rabbit]');
  await expect.poll(() => rabbits.count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await page.waitForTimeout(500);
  const scene = async () => ({
    rabbits: await rabbits.evaluateAll((els) => els.map((el) => [el.getAttribute('data-rabbit'), el.getAttribute('data-pose'), el.getBoundingClientRect().toJSON(), el.innerHTML])),
    eggs: await page.locator(`${overlay} g[data-egg]`).evaluateAll((els) => els.map((el) => [el.getAttribute('data-egg'), el.innerHTML])),
    tally: await page.locator(`${overlay} [data-tally]`).getAttribute('data-tally'),
  });
  const before = await scene();
  expect(new Set(before.rabbits.map(([mode, pose]) => `${mode} ${pose}`))).toEqual(new Set(['sit sit']));
  // The cursor over an egg finds nothing: the hunt holds still too.
  const box = (await page.locator(`${overlay} g[data-egg] image`).first().boundingBox())!;
  await page.mouse.move(box.x - 60, box.y, { steps: 2 });
  await page.mouse.move(box.x + box.width / 2, box.y + 2, { steps: 4 });
  await page.waitForTimeout(2500);
  expect(await scene()).toEqual(before);
});

test('a phone keeps the hunt and the rabbits, and hides the shelf', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/metrics?theme=easter');
  await expect(page.locator(overlay)).toBeAttached();
  await expect(page.locator('.easter-shelf')).toBeHidden();
  await expect(page.locator(`${overlay} [data-tally]`)).toBeVisible();
  await expect.poll(() => page.locator('[data-rabbit]').count()).toBeGreaterThanOrEqual(1);
  expect(await coveredContent(page.locator(`${overlay} svg.rig`))).toEqual([]);
});
