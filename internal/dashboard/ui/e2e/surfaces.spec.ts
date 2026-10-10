import { expect, test, type Page } from '@playwright/test';

// The shared surfaces the debug overlay draws (?theme-debug=1), read back off
// the real layout: each drawing must agree with the elements it was measured
// from. Halloween is used for the page surfaces and the aurora for the rail,
// but the overlay is the same under every set.

const rectOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => {
  const box = el.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
});

const drawn = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => ({
  left: Number(el.getAttribute('x')), top: Number(el.getAttribute('y')),
  right: Number(el.getAttribute('x')) + Number(el.getAttribute('width')),
  bottom: Number(el.getAttribute('y')) + Number(el.getAttribute('height')),
}));

test('the rail air runs from the sky down through the shelf, and only where the shelf shows', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?theme=aurora&theme-debug=1');
  await expect(page.locator('.theme-shelf')).toBeVisible();
  await expect(page.locator('[data-rail-air] rect')).toBeAttached();
  // The shelf's art settles after the first measurement; the overlay follows.
  await expect.poll(async () => {
    const shelf = await rectOf(page, '.theme-shelf');
    const sky = await drawn(page, '[data-sky] rect');
    const air = await drawn(page, '[data-rail-air] rect');
    return [air.top - sky.top, air.left - shelf.left, air.bottom - shelf.bottom].map(Math.round);
  }).toEqual([0, 0, 0]);
  const sky = await drawn(page, '[data-sky] rect');
  const air = await drawn(page, '[data-rail-air] rect');
  expect(air.bottom).toBeGreaterThan(sky.bottom);
  await page.screenshot({ path: info.outputPath('rail-air-1440.png') });

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator('.theme-shelf')).toBeHidden();
  await expect(page.locator('[data-rail-air]')).toHaveCount(0);
});
