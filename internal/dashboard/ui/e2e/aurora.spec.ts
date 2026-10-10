import { expect, test } from '@playwright/test';

// The northern lights: a winter shelf with the aurora in the rail's free
// space, and frost plus sleeping Arctic foxes on the page's ledges. What
// every set keeps (palette, inert overlay, counts, content clear, a still
// scene) is seasonal.spec.ts's; this is the aurora's own. The foxes' longer
// behaviours (changing ledge, the pounce, keeping apart) are timed and
// random, and how their legs and heads move is drawing, so those are
// covered by the model's and the rig's unit tests and the lab instead.

test('the foxes start the night asleep, curled up', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=aurora');
  await expect.poll(() => page.locator('[data-fox]').count()).toBeGreaterThanOrEqual(2);
  expect(new Set(await page.locator('[data-fox]').evaluateAll((els) => els.map((el) => el.getAttribute('data-fox'))))).toEqual(new Set(['asleep']));
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

test('reduced motion stills the sky and the frost', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=aurora');
  const curtains = page.locator('.aurora-shelf .curtain');
  await expect(curtains).toHaveCount(3);
  // The nav gains a link once the config arrives, which moves the sky; a
  // still scene is redrawn for that, so it is compared once settled.
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await page.waitForTimeout(500);
  const sky = () => curtains.evaluateAll((els) => els.map((el) => el.getAttribute('d')));
  const before = await sky();
  expect(await page.locator('.aurora-shelf .star').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.locator('[data-aurora] .glint')).toHaveCount(0);
  await page.waitForTimeout(2500);
  expect(await sky()).toEqual(before);
});

test('a phone draws no sky at all', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/metrics?theme=aurora');
  await expect(page.locator('[data-aurora]')).toBeAttached();
  await expect(page.locator('.aurora-shelf .sky')).toHaveCount(0);
});
