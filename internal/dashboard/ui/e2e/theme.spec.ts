import { expect, test, type Page } from '@playwright/test';

// The seasonal decorations are drawn OVER the page, so the one property that
// matters is that they never get between a person and what they clicked.

// The fixture pins dashboard.theme to none; these pretend the daemon resolved
// a set, as it would by the calendar or by config.
async function serveTheme(page: Page, active: string) {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.theme = active;
    await route.fulfill({ response, json: config });
  });
}

// What a click at the centre of each decoration would actually land on.
async function hitsUnder(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { decoration: el.className, landsOnDecoration: !!hit?.closest('.theme-layer, .theme-shelf') };
    }),
  );
}

const accentOf = (page: Page) => page.locator('.brand em').evaluate((el) => getComputedStyle(el).color);

test('the daemon-resolved theme decorates the page and takes its palette', async ({ page }) => {
  await serveTheme(page, 'halloween');
  await page.goto('/');
  await expect(page.locator('.theme-layer')).toBeAttached();
  await expect(page.locator('.theme-shelf')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'halloween');
  expect(await accentOf(page)).toBe('rgb(255, 143, 46)');
});

test('no theme means no decorations and the usual palette', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.theme-layer, .theme-shelf')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(await accentOf(page)).toBe('rgb(132, 203, 45)');
});

test('the query string previews a set, and can switch one off', async ({ page }) => {
  await page.goto('/?theme=halloween');
  await expect(page.locator('.theme-layer')).toBeAttached();

  await serveTheme(page, 'halloween');
  await page.goto('/?theme=none');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.theme-layer, .theme-shelf')).toHaveCount(0);
});

test('clicks pass through every decoration to the page beneath', async ({ page }) => {
  await serveTheme(page, 'halloween');
  await page.goto('/');
  await expect(page.locator('.theme-shelf')).toBeVisible();
  const hits = await hitsUnder(page, '.theme-layer .web, .theme-layer .resident .sprite, .theme-shelf img');
  expect(hits.length).toBeGreaterThanOrEqual(4);
  expect(hits.filter((h) => h.landsOnDecoration)).toEqual([]);
});

// Centre-point probes only sample the decorations; this checks every element
// the layer draws, threads included, whatever rule styled it.
test('nothing in the decoration layer takes pointer events', async ({ page }) => {
  await serveTheme(page, 'halloween');
  await page.goto('/');
  await expect(page.locator('.crawler').first()).toBeAttached({ timeout: 20_000 });
  const catching = await page.locator('.theme-layer, .theme-layer *, .theme-shelf, .theme-shelf *').evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).pointerEvents !== 'none').map((el) => el.tagName + '.' + el.getAttribute('class')),
  );
  expect(catching).toEqual([]);
});

test('navigation still works with the decorations on', async ({ page }) => {
  await serveTheme(page, 'halloween');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.theme-layer')).toBeAttached();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.locator('.theme-layer')).toBeAttached();
});

test('a roaming spider does not block a click', async ({ page }) => {
  await serveTheme(page, 'halloween');
  await page.goto('/');
  const spider = page.locator('.crawler .sprite').first();
  await expect(spider).toBeAttached({ timeout: 20_000 });
  const hits = await hitsUnder(page, '.crawler .sprite');
  expect(hits.filter((h) => h.landsOnDecoration)).toEqual([]);
});

test('climbing leaves a moving silk tail below the spider, then fades the used thread', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  // A repeatable stroll: arrive, walk a little, seek the line just left behind.
  await page.addInitScript(() => { Math.random = () => 0.2; });
  await page.setViewportSize({ width: 1440, height: 900 });
  // Logs has one welcoming ledge (the heading rule), so the climb fits in
  // this test's wait regardless of the queue/sidebar's data-dependent height.
  await page.goto('/logs?theme=halloween');
  const climber = page.locator('.crawler[data-dragline]').first();
  await expect(climber).toBeAttached({ timeout: 20_000 });
  const id = await climber.getAttribute('data-dragline');
  const tail = page.locator(`.strands g[data-strand="line-${id}"]`);
  await expect(tail).toBeAttached();
  const path = tail.locator('path.strand');
  const before = await path.getAttribute('d');
  await expect.poll(() => path.getAttribute('d')).not.toBe(before);
  const height = await climber.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
  await expect.poll(() => climber.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)).toBeLessThan(height - 60);
  await page.screenshot({ path: testInfo.outputPath('dragline-climb.png') });
  await expect(page.locator(`.crawler[data-dragline="${id}"]`)).toHaveCount(0, { timeout: 20_000 });
  // The spider is off the line, but the used silk remains and fades gently.
  await expect(tail).toBeAttached();
  await expect.poll(() => tail.evaluate((el) => Number((el as SVGElement).style.opacity))).toBeLessThan(0.8);
  await expect(tail).toHaveCount(0, { timeout: 10_000 });
});

test('reduced motion keeps the decorations but stops the roaming', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await serveTheme(page, 'halloween');
  await page.goto('/');
  await expect(page.locator('.theme-layer .resident')).toBeAttached();
  await page.waitForTimeout(6000);
  await expect(page.locator('.crawler')).toHaveCount(0);
});

test('turning reduced motion on mid-visit sends the roaming spiders home and keeps the candles', async ({ page }) => {
  await serveTheme(page, 'halloween');
  await page.goto('/');
  await expect(page.locator('.crawler').first()).toBeAttached({ timeout: 20_000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.crawler')).toHaveCount(0);
  await expect(page.locator('.strands path')).toHaveCount(0);
  await expect(page.locator('.theme-layer .resident')).toBeAttached();
  // And they come back when it is turned off again.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.crawler').first()).toBeAttached({ timeout: 20_000 });
});

// Use the real layout and the production measurement, including cards whose
// top is blocked by a heading. Those still have walls in the overlay.
async function geometryErrors(page: Page) {
  return page.evaluate(() => {
    const lines = [...document.querySelectorAll<SVGLineElement>('.geometry .floor')].map((el) => ({
      left: Number(el.getAttribute('x1')), right: Number(el.getAttribute('x2')), y: Number(el.getAttribute('y1')),
    }));
    const cards = [...document.querySelectorAll('main .surface, main .queue-board, main .context section, main .terminal, main .metric-kpis > div, main .panel')];
    const errors = cards.flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 120 || !r.height) return [];
      return lines.some((f) => Math.abs(f.y - r.top) < 8 && f.left <= r.left + 2 && f.right >= r.right - 2) ? [] : [`missing card: ${el.className}`];
    });
    const heading = document.querySelector('main .hero, main .page-head')?.getBoundingClientRect();
    if (heading && !lines.some((f) => Math.abs(f.y - heading.bottom) < 1)) errors.push('missing heading rule');
    if (heading && lines.some((f) => Math.abs(f.y - heading.top) < 1)) errors.push('phantom heading top');
    return errors;
  });
}

for (const width of [1440, 390]) {
  test(`Halloween geometry follows all dashboard pages at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of ['/', '/history', '/metrics', '/leaderboard', '/config', '/prompt', '/logs', '/review/acme/widgets/103']) {
      await page.goto(`${path}?theme=halloween&theme-debug=1`);
      await expect(page.locator('.geometry .floor').first()).toBeAttached();
      if (path === '/metrics') await expect(page.locator('.metric-kpis > div')).toHaveCount(6);
      if (path === '/config' || path === '/prompt') await expect(page.locator('main .surface').first()).toBeVisible();
      await expect.poll(() => geometryErrors(page), { message: path }).toEqual([]);
      if (path === '/metrics') {
        const grid = await page.locator('.metric-kpis').boundingBox();
        expect(grid).not.toBeNull();
        const floors = await page.locator('.geometry .floor').evaluateAll((els) => els.map((el) => ({
          left: Number(el.getAttribute('x1')), right: Number(el.getAttribute('x2')), y: Number(el.getAttribute('y1')),
        })));
        expect(floors.some((f) => Math.abs(f.y - grid!.y) < 1 && f.right - f.left > grid!.width - 1)).toBe(width === 390);
        await page.screenshot({ path: testInfo.outputPath(`metrics-geometry-${width}.png`), fullPage: true });
        await page.locator('main').evaluate(() => window.scrollTo(0, 300));
        await expect.poll(() => geometryErrors(page)).toEqual([]);
      }
      if (path === '/leaderboard') await expect(page.locator('.geometry .wall')).toHaveCount(0);
    }
  });
}
