import { expect, test } from '@playwright/test';
import { landsOnDecoration, SETS } from './seasonal';

// Bonfire Night: a bonfire shelf with fireworks in the rail's free space,
// and embers plus hedgehogs sharing a woodpile on the page's ledges. What
// every set keeps is seasonal.spec.ts's; this is the bonfire's own. How
// the hedgehogs' legs and heads move is covered by the rig's unit tests
// and the lab.

const BONFIRE = SETS.find((s) => s.theme === 'bonfire')!;

test('clicks pass through the woodpile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bonfire');
  const pile = page.locator('[data-woodpile]');
  await expect(pile).toBeVisible();
  expect(await landsOnDecoration(pile, BONFIRE)).toBe(false);
});

test('the hedgehogs come out one by one once the page is still, and one curls up at a nearby cursor', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => { Math.random = () => 0.3; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/logs?theme=bonfire');
  await expect.poll(() => page.locator('[data-hedgehog]').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  const hog = page.locator('[data-hedgehog][data-id="0"]');
  await expect(hog).toHaveAttribute('data-hedgehog', /walk|sniff/, { timeout: 15_000 });
  const box = (await hog.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + 40, box.y - 30);
  await page.mouse.move(box.x + box.width / 2 + 10, box.y - 10, { steps: 4 });
  await expect(hog).toHaveAttribute('data-hedgehog', 'curled');
});

test('fireworks burst inside the rail, between the nav and the shelf', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bonfire');
  const sky = page.locator('.bonfire-shelf .sky');
  await expect(sky).toBeAttached();
  await expect(sky.locator('line').first()).toBeAttached({ timeout: 20_000 });
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

test('reduced motion stills the fire and the fireworks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bonfire');
  await expect(page.locator('.bonfire-shelf .sky line')).toHaveCount(20);
  expect(await page.locator('.bonfire-shelf .tongue').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect.poll(() => page.locator('[data-hedgehog]').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-bonfire] [data-lid]')).toHaveCount(0);
});

test('a phone draws no fireworks at all', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/metrics?theme=bonfire');
  await expect(page.locator('[data-bonfire]')).toBeAttached();
  await expect(page.locator('.bonfire-shelf .sky')).toHaveCount(0);
});
