import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';

// Bonfire Night: a bonfire shelf with fireworks in the rail's free space,
// and embers plus hedgehogs sharing a woodpile on the page's ledges. How
// their legs and heads move is covered by the rig's unit tests and the lab.

async function serveBonfire(page: Page) {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.theme = 'bonfire';
    await route.fulfill({ response, json: config });
  });
}

const accentOf = (page: Page) => page.locator('.brand em').evaluate((el) => getComputedStyle(el).color);

test('the daemon-resolved bonfire theme decorates the page and takes its palette', async ({ page }) => {
  await serveBonfire(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('[data-bonfire]')).toBeAttached();
  await expect(page.locator('.bonfire-shelf')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'bonfire');
  expect(await accentOf(page)).toBe('rgb(244, 194, 91)');
  await expect(page.locator('[data-woodpile]')).toBeVisible();
});

test('nothing bonfire takes pointer events, and clicks pass through the woodpile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bonfire');
  await expect(page.locator('[data-woodpile]')).toBeVisible();
  // Out of the pile, so its drawing is checked too.
  await expect(page.locator('[data-hedgehog]').first()).toBeAttached({ timeout: 15_000 });
  const catching = await page.locator('[data-bonfire], [data-bonfire] *, .bonfire-shelf, .bonfire-shelf *').evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).pointerEvents !== 'none').map((el) => el.tagName + '.' + el.getAttribute('class')),
  );
  expect(catching).toEqual([]);
  const landsOnDecoration = await page.locator('[data-woodpile]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-bonfire], .bonfire-shelf');
  });
  expect(landsOnDecoration).toBe(false);
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

test('the hedgehogs never cover text, controls or charts, wherever they wander', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const seen: number[] = [];
  for (const route of ['/logs', '/', '/metrics']) {
    await page.goto(`${route}?theme=bonfire`);
    // Still for long enough that any hedgehogs there come out.
    await page.waitForTimeout(5000);
    for (let i = 0; i < 6; i++) {
      const hogs = page.locator('[data-bonfire] svg.rig');
      seen.push(await hogs.count());
      expect(await coveredContent(hogs)).toEqual([]);
      await page.waitForTimeout(500);
    }
  }
  expect(Math.max(...seen)).toBeGreaterThanOrEqual(2);
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

test('reduced motion shows a still bonfire scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=bonfire');
  const hogs = page.locator('[data-hedgehog]');
  await expect.poll(() => hogs.count()).toBeGreaterThanOrEqual(2);
  const sat = async () => ({ modes: await hogs.evaluateAll((els) => els.map((el) => el.getAttribute('data-hedgehog'))), boxes: await hogs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON())) });
  const before = await sat();
  expect(new Set(before.modes)).toEqual(new Set(['sniff']));
  await expect(page.locator('.bonfire-shelf .sky line')).toHaveCount(20);
  expect(await page.locator('.bonfire-shelf .tongue').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.waitForTimeout(3000);
  expect(await sat()).toEqual(before);
  await expect(page.locator('[data-bonfire] [data-lid]')).toHaveCount(0);
});

test('a phone keeps the page decorations and hides the shelf and its fireworks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/metrics?theme=bonfire');
  await expect(page.locator('[data-bonfire]')).toBeAttached();
  await expect(page.locator('.bonfire-shelf')).toBeHidden();
  await expect(page.locator('.bonfire-shelf .sky')).toHaveCount(0);
});
