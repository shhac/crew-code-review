import { expect, test, type Page } from '@playwright/test';

// Summer tennis: a shelf of strawberries, fruit cup and a racquet, chalk
// court lines on the ledges, pigeons on the first row of cards, a Harris's
// hawk now and then sweeping low along their row as they fly off, and a ball
// rallying between two cards side by side. What every set keeps is
// seasonal.spec.ts's; this is July's own. The sweep and the rally are timed
// and random, so they are started by the test-only cue (`?theme-cue=`) and
// watched frame by frame for anything drawn over the page's content.

const pigeons = (page: Page) => page.locator('[data-wimbledon] [data-pigeon]');
const hawk = (page: Page) => page.locator('[data-wimbledon] [data-hawk]');
const ball = (page: Page) => page.locator('[data-wimbledon] [data-ball]');

// Every animation frame for `ms`, what of the birds and the ball is drawn
// over the page's content (rendered text, controls, charts, and the rail's
// links, brand and identity chip), and what was seen at all: a frame-by-frame
// check, since a sweep or a shot is over in a second or two.
function watchFrames(page: Page, ms: number) {
  return page.evaluate((ms) => new Promise<{ covered: string[]; seen: string[] }>((done) => {
    const main = document.querySelector('main')!;
    const contentNow = () => {
      const boxes: { name: string; r: DOMRect }[] = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        for (const r of Array.from(range.getClientRects())) boxes.push({ name: `text "${node.textContent.trim().slice(0, 20)}"`, r });
      }
      main.querySelectorAll('svg, canvas, button, input, textarea, select').forEach((el) => boxes.push({ name: el.tagName.toLowerCase(), r: el.getBoundingClientRect() }));
      // The overlay sits above the rail, so a bird drawn across it covers
      // its links, brand and identity chip.
      document.querySelectorAll('.rail nav a, .rail .brand, .rail .viewer-chip').forEach((el) => boxes.push({ name: `rail ${el.matches('a') ? `link "${el.textContent?.trim()}"` : el.className.split(' ')[0]}`, r: el.getBoundingClientRect() }));
      return boxes;
    };
    const content = contentNow();
    type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
    const overlap = (a: Box, b: Box) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && b.width > 0 && b.height > 0 && a.width > 0 && a.height > 0;
    // What of a picture shows: its box cut to any CSS `clip-path: inset()`
    // on it or around it (the fliers are clipped at the rail's edge, so a
    // bird past it is behind the rail), which a box alone ignores.
    const lineage = (el: Element | null): Element[] => (el ? [el, ...lineage(el.parentElement)] : []);
    const shown = (picture: Element): Box => {
      const r = picture.getBoundingClientRect();
      const cut = lineage(picture).reduce((c, at) => {
        const inset = getComputedStyle(at).clipPath.match(/^inset\(([^)]*)\)$/)?.[1].split(/\s+/).map(parseFloat);
        if (!inset) return c;
        const [top, right = top, bottom = top, left = right] = inset;
        const b = at.getBoundingClientRect();
        return { left: Math.max(c.left, b.left + left), right: Math.min(c.right, b.right - right), top: Math.max(c.top, b.top + top), bottom: Math.min(c.bottom, b.bottom - bottom) };
      }, { left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      return { ...cut, width: Math.max(0, cut.right - cut.left), height: Math.max(0, cut.bottom - cut.top) };
    };
    const covered = new Set<string>();
    const seen = new Set<string>();
    const start = performance.now();
    const look = () => {
      const drawn = [
        ...Array.from(document.querySelectorAll('[data-wimbledon] [data-pigeon] image:not([visibility="hidden"])')).map((el) => ['pigeon', el] as const),
        ...Array.from(document.querySelectorAll('[data-wimbledon] [data-hawk] image:not([visibility="hidden"])')).map((el) => ['hawk', el] as const),
        ...Array.from(document.querySelectorAll('[data-wimbledon] [data-ball] circle')).map((el) => ['ball', el] as const),
      ];
      for (const [what, el] of drawn) {
        seen.add(what);
        const r = shown(el);
        for (const c of content) if (overlap(r, c.r)) covered.add(`${what} over ${c.name}`);
      }
      if (performance.now() - start < ms) requestAnimationFrame(look);
      else done({ covered: [...covered], seen: [...seen] });
    };
    requestAnimationFrame(look);
  }), ms);
}

test.describe('summer tennis', () => {
  test('chalks court lines along the ledges and puts pigeons on the first row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?theme=wimbledon');
    await expect(page.locator('.wimbledon-shelf')).toBeVisible();
    await expect.poll(() => page.locator('[data-wimbledon] [data-lines]').count()).toBeGreaterThan(1);
    await expect.poll(() => pigeons(page).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    // The court lines are thin chalk on the ledges, never over a heading's text.
    const lines = await page.locator('[data-wimbledon] [data-lines] path').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(Math.max(...lines)).toBeLessThanOrEqual(5);
  });

  test('cued, the hawk sweeps the row and the pigeons fly off ahead of it, nothing drawn over content', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?theme=wimbledon&theme-cue=sweep');
    await expect.poll(() => pigeons(page).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    const watched = await watchFrames(page, 6000);
    expect(watched.seen).toContain('hawk');
    expect(watched.covered).toEqual([]);
    // They have gone: none of them stands where it was.
    await expect.poll(() => pigeons(page).evaluateAll((els) => els.filter((el) => el.getAttribute('data-pigeon') !== 'away').length)).toBeLessThan(3);
  });

  test('cued, a ball rallies between two cards, never over content', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?theme=wimbledon&theme-cue=rally');
    await expect(ball(page)).toBeAttached({ timeout: 20_000 });
    const watched = await watchFrames(page, 5000);
    expect(watched.seen).toContain('ball');
    expect(watched.covered).toEqual([]);
  });

  test('a cursor swept across the ball\'s path volleys it back', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?theme=wimbledon&theme-cue=rally');
    await expect(ball(page)).toBeAttached({ timeout: 20_000 });
    const where = async () => {
      const b = await ball(page).boundingBox();
      return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    // Which way it is going, and a sweep of the cursor down across its path
    // just ahead of it.
    const a = await where();
    await page.waitForTimeout(60);
    const b = await where();
    expect(a && b).toBeTruthy();
    const way = Math.sign(b!.x - a!.x) || 1;
    const x = b!.x + way * 25;
    await page.mouse.move(x, b!.y - 40);
    await page.mouse.move(x, b!.y + 30, { steps: 6 });
    // Struck back: it now goes the other way.
    await expect.poll(async () => {
      const p = await where();
      await page.waitForTimeout(40);
      const q = await where();
      return p && q ? Math.sign(q.x - p.x) : way;
    }, { timeout: 3000 }).toBe(-way);
  });

  test('on a phone there is no rail to sweep in from, so no hawk, even cued', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/?theme=wimbledon&theme-cue=sweep');
    await page.waitForTimeout(3000);
    await expect(hawk(page)).toHaveCount(0);
  });

  test('under reduced motion the pigeons stand still, with no hawk and no ball, cue or not', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const cue of ['sweep', 'rally']) {
      await page.goto(`/?theme=wimbledon&theme-cue=${cue}`);
      await expect.poll(() => pigeons(page).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
      await page.waitForTimeout(1500);
      await expect(hawk(page)).toHaveCount(0);
      await expect(ball(page)).toHaveCount(0);
      const modes = await pigeons(page).evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-pigeon')))]);
      expect(modes).toEqual(['stand']);
    }
  });
});
