import { expect, test, type Page } from '@playwright/test';

// Mad March hares: a pot of daffodils on the shelf, and grass, daffodil
// shoots and brown hares on the page's ledges. What every set keeps is
// seasonal.spec.ts's; this is the hares' own. How the hares' legs and heads
// move is covered by the rig's unit tests and the lab; their bouts, chases
// and leaps are timed and random, so the model's unit tests cover those.

const hares = (page: Page) => page.locator('[data-hare]');

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

test('reduced motion stands the grass and the daffodils still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=hares');
  await expect.poll(() => hares(page).count()).toBeGreaterThanOrEqual(2);
  const grass = await page.locator('[data-hares] [data-plant]').evaluateAll((els) => els.slice(0, 20).map((el) => el.getAttribute('transform')));
  expect(grass.length).toBeGreaterThan(0);
  expect(grass.every((t) => t?.endsWith('rotate(0)'))).toBe(true);
  expect(await page.locator('.hares-shelf .tuft').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.locator('[data-hares] [data-lid]')).toHaveCount(0);
});
