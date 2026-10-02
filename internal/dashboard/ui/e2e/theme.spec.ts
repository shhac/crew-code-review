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
