import { expect, test, type Page } from '@playwright/test';

// The northern lights: a winter shelf with the aurora in the rail's free
// space, and frost plus sleeping Arctic foxes on the page's ledges. The
// foxes' longer behaviours (changing ledge, the pounce, keeping apart) are
// timed and random, and how their legs and heads move is drawing, so those
// are covered by the model's and the rig's unit tests and the lab instead.

async function serveAurora(page: Page) {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.theme = 'aurora';
    await route.fulfill({ response, json: config });
  });
}

const accentOf = (page: Page) => page.locator('.brand em').evaluate((el) => getComputedStyle(el).color);

test('the daemon-resolved aurora theme decorates the page and takes its palette', async ({ page }) => {
  await serveAurora(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('[data-aurora]')).toBeAttached();
  await expect(page.locator('.aurora-shelf')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'aurora');
  expect(await accentOf(page)).toBe('rgb(114, 224, 207)');
  await expect(page.locator('[data-aurora] .rime').first()).toBeAttached();
  // The overview has room for at least two, apart.
  await expect.poll(() => page.locator('[data-fox]').count()).toBeGreaterThanOrEqual(2);
  expect(new Set(await page.locator('[data-fox]').evaluateAll((els) => els.map((el) => el.getAttribute('data-fox'))))).toEqual(new Set(['asleep']));
});

test('nothing aurora takes pointer events, and it all sits below dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=aurora');
  const fox = page.locator('[data-fox][data-id="0"]');
  await expect(fox).toBeVisible();
  const catching = await page.locator('[data-aurora], [data-aurora] *, .aurora-shelf, .aurora-shelf *').evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).pointerEvents !== 'none').map((el) => el.tagName + '.' + el.getAttribute('class')),
  );
  expect(catching).toEqual([]);
  const landsOnDecoration = await fox.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-aurora], .aurora-shelf');
  });
  expect(landsOnDecoration).toBe(false);
  expect(Number(await page.locator('[data-aurora]').evaluate((el) => getComputedStyle(el).zIndex))).toBeLessThan(50);
  await expect(page.locator('[data-aurora]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.aurora-shelf')).toHaveAttribute('aria-hidden', 'true');
});

test('the fox twitches an ear at a passing cursor, and wakes when it lingers', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => { Math.random = () => 0.3; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=aurora');
  const fox = page.locator('[data-fox][data-id="0"]');
  await expect(fox).toHaveAttribute('data-fox', 'asleep');
  const box = (await fox.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x + 200, y + 60);
  await page.mouse.move(x + 90, y, { steps: 3 });
  await expect(fox).toHaveAttribute('data-pose', 'alert');
  await expect(fox).toHaveAttribute('data-pose', 'curled');
  await page.mouse.move(x + 30, y, { steps: 2 });
  await expect(fox).not.toHaveAttribute('data-fox', 'asleep', { timeout: 5_000 });
});

test('the aurora stays inside the rail, between the nav and the shelf', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=aurora');
  const sky = page.locator('.aurora-shelf .sky');
  await expect(sky.locator('.curtain')).toHaveCount(3);
  const bounds = await sky.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const rail = document.querySelector('.rail')!.getBoundingClientRect();
    const nav = document.querySelector('.rail nav')!.getBoundingClientRect();
    const stage = el.parentElement!.querySelector('.stage')!.getBoundingClientRect();
    return { left: r.left - rail.left, right: rail.right - r.right, belowNav: r.top - nav.bottom, aboveStage: stage.top - r.bottom };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeGreaterThanOrEqual(0);
  expect(bounds.belowNav).toBeGreaterThan(0);
  expect(bounds.aboveStage).toBeGreaterThanOrEqual(0);
});

test('reduced motion shows a still aurora scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=aurora');
  const foxes = page.locator('[data-fox]');
  await expect.poll(() => foxes.count()).toBeGreaterThanOrEqual(2);
  const curtains = page.locator('.aurora-shelf .curtain');
  await expect(curtains).toHaveCount(3);
  // The nav gains a link once the config arrives, which moves the sky; a
  // still scene is redrawn for that, so it is compared once settled.
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await page.waitForTimeout(500);
  const scene = async () => ({
    foxes: await foxes.evaluateAll((els) => els.map((el) => [el.getAttribute('data-fox'), el.getAttribute('data-pose'), el.getBoundingClientRect().toJSON()])),
    sky: await curtains.evaluateAll((els) => els.map((el) => el.getAttribute('d'))),
  });
  const before = await scene();
  expect(new Set(before.foxes.map(([mode, pose]) => `${mode} ${pose}`))).toEqual(new Set(['asleep curled']));
  expect(await page.locator('.aurora-shelf .star').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.locator('[data-aurora] .glint')).toHaveCount(0);
  const box = (await foxes.first().boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 5, { steps: 3 });
  await page.waitForTimeout(2500);
  expect(await scene()).toEqual(before);
});

test('a phone keeps the page decorations and hides the shelf and its aurora', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/metrics?theme=aurora');
  await expect(page.locator('[data-aurora]')).toBeAttached();
  await expect(page.locator('.aurora-shelf')).toBeHidden();
  await expect(page.locator('.aurora-shelf .sky')).toHaveCount(0);
});
