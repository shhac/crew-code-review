import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';

// Mad March hares: a pot of daffodils on the shelf, and grass, daffodil
// shoots and brown hares on the page's ledges. How the hares' legs and heads
// move is covered by the rig's unit tests and the lab; their bouts, chases
// and leaps are timed and random, so the model's unit tests cover those.

const hares = (page: Page) => page.locator('[data-hare]');

test('the hares theme decorates the page, with at least two hares on the overview', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=hares');
  await expect(page.locator('[data-hares]')).toBeAttached();
  await expect(page.locator('.hares-shelf')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hares');
  await expect(page.locator('[data-hares] [data-plant]').first()).toBeAttached();
  await expect.poll(() => hares(page).count()).toBeGreaterThanOrEqual(2);
});

test('nothing hares takes pointer events, and it all sits below dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=hares');
  const hare = hares(page).first();
  await expect(hare).toBeVisible();
  const catching = await page.locator('[data-hares], [data-hares] *, .hares-shelf, .hares-shelf *').evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).pointerEvents !== 'none').map((el) => el.tagName + '.' + el.getAttribute('class')),
  );
  expect(catching).toEqual([]);
  const landsOnDecoration = await hare.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-hares], .hares-shelf');
  });
  expect(landsOnDecoration).toBe(false);
  expect(Number(await page.locator('[data-hares]').evaluate((el) => getComputedStyle(el).zIndex))).toBeLessThan(50);
  await expect(page.locator('[data-hares]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.hares-shelf')).toHaveAttribute('aria-hidden', 'true');
});

test('a hare freezes as the cursor comes near, then bolts', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => { Math.random = () => 0.3; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=hares');
  const hare = page.locator('[data-hare][data-id="2"]');
  await expect(hare).toBeVisible();
  const box = (await hare.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height - 12;
  await page.mouse.move(x + 160, y);
  await page.mouse.move(x + 40, y, { steps: 4 });
  await expect(hare).toHaveAttribute('data-hare', 'freeze');
  // The cursor stays: after a moment frozen, it is off.
  await expect(hare).not.toHaveAttribute('data-hare', 'freeze', { timeout: 5_000 });
  await expect.poll(async () => (await hare.count()) === 0 || ['bolt', 'run'].includes((await hare.getAttribute('data-hare')) ?? ''), { timeout: 3_000 }).toBe(true);
});

test('the hares never cover text, controls or charts, wherever they go', async ({ page }) => {
  // Each route is waited on and measured several times, so chases and
  // bolts in progress are caught too; measuring every text range is slow.
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const seen: number[] = [];
  for (const route of ['/', '/logs', '/metrics', '/history', '/leaderboard', '/config']) {
    await page.goto(`${route}?theme=hares`);
    await expect(page.locator('.rail nav a')).toHaveCount(7);
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(700);
      const drawn = page.locator('[data-hares] svg.rig');
      seen.push(await drawn.count());
      expect(await coveredContent(drawn), route).toEqual([]);
    }
  }
  expect(Math.max(...seen)).toBeGreaterThanOrEqual(2);
});

test('the hares stay off the content at 1024 wide too', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1024, height: 800 });
  for (const route of ['/', '/metrics']) {
    await page.goto(`${route}?theme=hares`);
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(700);
      expect(await coveredContent(page.locator('[data-hares] svg.rig')), route).toEqual([]);
    }
  }
});

test('reduced motion shows a still scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=hares');
  await expect.poll(() => hares(page).count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await page.waitForTimeout(500);
  const scene = async () => ({
    hares: await hares(page).evaluateAll((els) => els.map((el) => [el.getAttribute('data-hare'), el.getAttribute('data-pose'), el.getBoundingClientRect().toJSON()])),
    grass: await page.locator('[data-hares] [data-plant]').evaluateAll((els) => els.slice(0, 20).map((el) => el.getAttribute('transform'))),
  });
  const before = await scene();
  expect(new Set(before.hares.map(([mode]) => mode))).toEqual(new Set(['sit']));
  expect(before.grass.every((t) => t?.endsWith('rotate(0)'))).toBe(true);
  expect(await page.locator('.hares-shelf .tuft').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  const box = (await hares(page).first().boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 5, { steps: 3 });
  await page.waitForTimeout(2500);
  expect(await scene()).toEqual(before);
  await expect(page.locator('[data-hares] [data-lid]')).toHaveCount(0);
});

test('a phone keeps the page decorations and hides the shelf', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/metrics?theme=hares');
  await expect(page.locator('[data-hares]')).toBeAttached();
  await expect(page.locator('.hares-shelf')).toBeHidden();
  expect(await coveredContent(page.locator('[data-hares] svg.rig'))).toEqual([]);
});
