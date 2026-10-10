import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';

// On a phone the rail stacks above main, so the rail changing height (as it
// does while its nav and viewer chip arrive after load) moves every ledge
// with nothing in main changing. The ledges must follow within a frame or
// two, not when the once-a-second check catches up. The rail is grown by
// hand here, once the page has settled, so that nothing else moving in main
// can hide a lag.

const plants = '[data-hares] [data-plant]';

const frames = (page: Page, n: number) => page.evaluate((n) => new Promise<void>((done) => {
  const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : done());
  step(n);
}), n);

// Where each ledge's plants are drawn, from their groups' transforms.
const ledges = (page: Page) => page.locator('[data-hares] svg > g').evaluateAll((gs) => gs.map((g) => g.getAttribute('transform') ?? ''));
const ys = (transforms: string[]) => transforms.map((t) => Math.round(Number(/translate\([^ ]+ ([^)]+)\)/.exec(t)?.[1])));

for (const route of ['/metrics', '/history']) {
  test(`on a phone, ${route}'s plants follow the rail growing at once`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`${route}?theme=hares`);
    await expect(page.locator(plants).first()).toBeAttached();
    await page.waitForTimeout(2500);
    expect(await coveredContent(page, [[plants, 'path']])).toEqual([]);
    // Only the ledges in main's flow, which on a phone starts below the rail.
    const rail = (await page.locator('.rail').boundingBox())!;
    const inFlow = (all: number[]) => all.filter((y) => y > rail.y + rail.height);
    const before = inFlow(ys(await ledges(page)));
    expect(before.length).toBeGreaterThan(0);
    await page.locator('.rail').evaluate((el) => { el.style.paddingTop = '74px'; });
    await frames(page, 3);
    expect(inFlow(ys(await ledges(page)))).toEqual(before.map((y) => y + 60));
    expect(await coveredContent(page, [[plants, 'path']])).toEqual([]);
  });
}
