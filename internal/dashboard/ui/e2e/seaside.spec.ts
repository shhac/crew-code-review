import { expect, test, type Page } from '@playwright/test';
import { seedRandom } from './seasonal';

// The seaside: chips, a bucket and spade and a 99 on the shelf, drifts of
// sand with shells along the ledges, and herring gulls that strut them,
// eye the cursor and swoop at one left still. What every set keeps
// (palette, inert overlay, counts, content clear, a still scene) is
// seasonal.spec.ts's; this is the seaside's own: the swoop, which is timed,
// so it is cued (`?theme-cue=swoop`: as soon as the cursor stops) and its
// every frame is watched.

const gulls = (page: Page) => page.locator('[data-seaside] [data-gull]');
const modes = (page: Page) => gulls(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-gull')));

// Watches the gulls every frame until one has swooped and is calling (or
// the time is up), noting each mode seen and anything a gull's drawing
// covers: text, controls and charts, as e2e/content.ts counts them, with
// its 1px slack.
function watchSwoop(page: Page, ms: number) {
  return page.evaluate((ms) => new Promise<{ seen: string[]; covered: string[] }>((resolve) => {
    const main = document.querySelector('main')!;
    const content: { name: string; r: DOMRect }[] = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) content.push({ name: `text "${node.textContent.trim().slice(0, 20)}"`, r });
    }
    main.querySelectorAll('svg, canvas, button, input, textarea, select').forEach((el) => content.push({ name: el.tagName.toLowerCase(), r: el.getBoundingClientRect() }));
    const slack = 1;
    const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right - slack && b.left < a.right - slack && a.top < b.bottom - slack && b.top < a.bottom - slack && b.width > 0 && b.height > 0;
    const seen = new Set<string>(), covered = new Set<string>();
    const start = performance.now();
    let swooped = false;
    const frame = () => {
      for (const el of Array.from(document.querySelectorAll('[data-seaside] [data-gull]'))) {
        const mode = el.getAttribute('data-gull')!;
        seen.add(mode);
        if (mode === 'dive') swooped = true;
        const pictures = Array.from(el.querySelectorAll('image')).filter((i) => getComputedStyle(i).visibility !== 'hidden').map((i) => i.getBoundingClientRect());
        for (const c of content) if (pictures.some((p) => overlap(p, c.r))) covered.add(`${el.getAttribute('data-id')} (${mode}) over ${c.name}`);
      }
      const calling = swooped && Array.from(document.querySelectorAll('[data-seaside] [data-gull="call"]')).length > 0;
      if (calling || performance.now() - start > ms) resolve({ seen: [...seen], covered: [...covered] });
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }), ms);
}

test('the gulls stand about the ledges, sand drifted along them with shells', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=seaside');
  await expect.poll(() => gulls(page).count()).toBeGreaterThanOrEqual(2);
  expect(await modes(page)).not.toContain('dive');
  await expect(page.locator('[data-seaside] .sand').first()).toBeAttached();
  await expect(page.locator('[data-seaside] [data-shell]').first()).toBeAttached();
  await expect(page.locator('.seaside-shelf img')).toBeVisible();
});

test('a gull eyes a cursor left still near it', async ({ page }) => {
  test.setTimeout(60_000);
  await seedRandom(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=seaside');
  const gull = gulls(page).first();
  await expect(gull).toBeVisible();
  const box = (await gull.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + 120, box.y - 40, { steps: 3 });
  await expect.poll(() => modes(page), { timeout: 10_000 }).toContain('eye');
});

test('a cursor left still in clear air is swooped at by one gull, through clear air only, and it lands and calls', async ({ page }) => {
  test.setTimeout(90_000);
  await seedRandom(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=seaside&theme-cue=swoop');
  await expect.poll(() => gulls(page).count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await page.waitForTimeout(1000);
  // Over the empty stretch of the heading, between its subtitle and the
  // box to queue a pull request.
  await page.mouse.move(700, 80);
  await page.mouse.move(740, 60, { steps: 4 });
  const { seen, covered } = await watchSwoop(page, 15_000);
  expect(seen).toEqual(expect.arrayContaining(['run', 'climb', 'dive', 'pullup', 'flare', 'touchdown', 'call']));
  expect(covered).toEqual([]);
  // Only one went, and the others watched it.
  expect(seen).toContain('eye');
});

test('reduced motion stands every gull still, and no swoop comes', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=seaside&theme-cue=swoop');
  await expect(page.locator('.rail nav a')).toHaveCount(7);
  await expect.poll(() => gulls(page).count()).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(500);
  const where = () => gulls(page).evaluateAll((els) => els.map((el) => [el.getAttribute('data-gull'), el.getBoundingClientRect().toJSON()]));
  const before = await where();
  expect(new Set(before.map(([mode]) => mode))).toEqual(new Set(['stand']));
  await page.mouse.move(700, 80);
  await page.mouse.move(740, 60, { steps: 4 });
  await page.waitForTimeout(2500);
  expect(await where()).toEqual(before);
});

