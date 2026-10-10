import { expect, test, type Page } from '@playwright/test';
import { coveredContent } from './content';

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

// Every wall stands on a drawn ledge's end, and its shaded runs (where a box
// 34px deep fits beside it) are never over content.
const wallErrors = (page: Page) => page.evaluate(() => {
  const floors = [...document.querySelectorAll('.geometry [data-floor-id]')].map((g) => {
    const line = g.querySelector('.floor')!;
    return { id: g.getAttribute('data-floor-id'), left: Number(line.getAttribute('x1')), right: Number(line.getAttribute('x2')), y: Number(line.getAttribute('y1')) };
  });
  return [...document.querySelectorAll('.geometry [data-wall-id]')].flatMap((g) => {
    const id = g.getAttribute('data-wall-id')!;
    const [floor, side] = id.split(':');
    const line = g.querySelector('.wall')!;
    const f = floors.find((c) => c.id === floor);
    const x = Number(line.getAttribute('x1'));
    const ok = f && x === (side === 'l' ? f.left : f.right) && Number(line.getAttribute('y1')) === f.y;
    return ok ? [] : [`${id} is not on its ledge`];
  });
});

for (const width of [1440, 1024]) {
  test(`walls stand on the card sides and shade only clear air at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of ['/', '/metrics', '/history']) {
      await page.goto(`${path}?theme=halloween&theme-debug=1`);
      await expect(page.locator('.geometry [data-wall-id]').first()).toBeAttached();
      if (path === '/metrics') await expect(page.locator('.metric-kpis > div')).toHaveCount(6);
      await expect.poll(() => wallErrors(page), { message: path }).toEqual([]);
      expect(await coveredContent(page.locator('.geometry [data-wall-id]'), '.wall-run'), path).toEqual([]);
      if (path === '/') {
        await expect(page.locator('.geometry .wall-run').first()).toBeAttached();
        await page.screenshot({ path: info.outputPath(`walls-${width}.png`) });
      }
    }
  });
}

// Every gap's ends are its ledges' ends, as drawn, and a side gap's column
// is clear of content.
const gapErrors = (page: Page) => page.evaluate(() => {
  const floors = new Map([...document.querySelectorAll('.geometry [data-floor-id]')].map((g) => {
    const line = g.querySelector('.floor')!;
    return [g.getAttribute('data-floor-id'), { left: Number(line.getAttribute('x1')), right: Number(line.getAttribute('x2')), y: Number(line.getAttribute('y1')) }];
  }));
  return [...document.querySelectorAll('.geometry [data-gap-kind=side]')].flatMap((g) => {
    const id = g.getAttribute('data-gap-id')!;
    const [, a, b] = /^(\d+)r-(\d+)l$/.exec(id) ?? [];
    const [from, to] = [...g.querySelectorAll('.gap-end')].map((c) => Number(c.getAttribute('cx')));
    return floors.get(a)?.right === from && floors.get(b)?.left === to ? [] : [`${id} is not between its ledges`];
  });
});

for (const width of [1440, 1024]) {
  test(`gaps sit between neighbouring ledges at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const seen: Record<string, string[]> = {};
    for (const path of ['/', '/metrics', '/config']) {
      await page.goto(`${path}?theme=halloween&theme-debug=1`);
      await expect(page.locator('.geometry [data-gap-id]').first()).toBeAttached();
      if (path === '/metrics') await expect(page.locator('.metric-kpis > div')).toHaveCount(6);
      if (path === '/config') await expect(page.locator('main .surface').first()).toBeVisible();
      await expect.poll(() => gapErrors(page), { message: path }).toEqual([]);
      expect(await coveredContent(page.locator('.geometry [data-gap-kind=side]'), 'rect.gap'), path).toEqual([]);
      seen[path] = await page.locator('.geometry [data-gap-id]').evaluateAll((gs) => gs.map((g) => `${g.getAttribute('data-gap-kind')}${g.hasAttribute('data-court') ? ' court' : ''}`));
      if (path !== '/') await page.screenshot({ path: info.outputPath(`gaps${path.replace('/', '-')}-${width}.png`) });
    }
    // The survey's gaps: a gutter on the overview, the KPI and chart gutters
    // (courts all) on metrics, and the config page's band cut by its tabs.
    expect(seen['/metrics'].filter((k) => k === 'side court')).toHaveLength(5);
    expect(seen['/'].filter((k) => k === 'side court')).toHaveLength(1);
    expect(seen['/config']).toEqual(['under']);
    await expect(page.locator('.geometry [data-gap-kind=under] .hatched').first()).toBeAttached();
  });
}

const exitsShown = (page: Page) => page.locator('.geometry [data-exit]').evaluateAll((gs) => gs.map((g) => g.getAttribute('data-exit')));

test('the air is main in view, with exits right, top and behind the rail where the page has them', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?theme=halloween&theme-debug=1');
  await expect(page.locator('.geometry [data-air] rect')).toBeAttached();
  const main = await rectOf(page, 'main');
  const air = await drawn(page, '.geometry [data-air] rect');
  expect(air).toEqual({ left: main.left + 6, top: 6, right: 1440 - 6, bottom: 900 - 6 });
  expect(await exitsShown(page)).toEqual(['right', 'top', 'rail']);
  expect(await page.locator('.geometry [data-exit=rail] line').getAttribute('x1')).toBe(String(main.left));
  await page.screenshot({ path: info.outputPath('exits-1440.png') });

  // On a phone the rail is stacked above main: no way out behind it, and
  // none out of the top until the rail has scrolled away.
  await page.setViewportSize({ width: 390, height: 900 });
  await expect.poll(() => exitsShown(page)).toEqual(['right']);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => exitsShown(page)).toEqual(['right', 'top']);
});
