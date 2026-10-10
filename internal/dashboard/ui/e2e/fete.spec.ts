import { expect, test, type Page } from '@playwright/test';
import { seedRandom } from './seasonal';

// The village fete: a cake stall on the rail's shelf, two wasps circling the
// cake in the rail's air, and bunting in the gaps between ledges. What every
// set keeps is seasonal.spec.ts's (including no wasps on a phone); this is
// June's own. The wasps' long random runs are the model's unit tests; here
// each timed behaviour is started on demand (?theme-cue=land) or by the
// cursor, and every frame of it is checked against the real layout.

const wasps = (page: Page) => page.locator('.fete-shelf [data-wasp]');
const bunting = (page: Page) => page.locator('[data-fete] [data-bunting]');

type Look = { id: string; mode: string; box: { left: number; right: number; top: number; bottom: number } };
type Rail = { nav: number; chip: number; right: number; airTop: number; shelfBottom: number; main: number; laneBottom: number };

// Every wasp's drawing at each of the next `frames` animation frames, and
// the rail it must keep to: under the nav (and 16px clear of it), above the
// identity chip, left of the page, inside the shelf's right edge; leaving
// past the window's left edge only along the top half of its air.
function watchWasps(page: Page, frames: number) {
  return page.evaluate(async (frames) => {
    const shelf = document.querySelector('.fete-shelf')!;
    const s = shelf.getBoundingClientRect();
    const nav = shelf.previousElementSibling!.getBoundingClientRect();
    const chip = shelf.nextElementSibling!.getBoundingClientRect();
    const airTop = Math.max(nav.bottom + 16, s.top - 240);
    const rail: Rail = {
      nav: nav.bottom, chip: chip.top, right: s.left + shelf.clientWidth, airTop, shelfBottom: s.bottom,
      main: document.querySelector('main')!.getBoundingClientRect().left, laneBottom: airTop + (s.bottom - airTop) / 2,
    };
    const looks: Look[][] = [];
    for (let i = 0; i < frames; i++) {
      await new Promise(requestAnimationFrame);
      looks.push(Array.from(document.querySelectorAll('.fete-shelf [data-wasp]')).map((el) => {
        const boxes = Array.from(el.querySelectorAll('image, [data-stroke]')).map((p) => p.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0);
        return {
          id: el.getAttribute('data-id') ?? '', mode: el.getAttribute('data-wasp') ?? '',
          box: { left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)), top: Math.min(...boxes.map((b) => b.top)), bottom: Math.max(...boxes.map((b) => b.bottom)) },
        };
      }));
    }
    return { rail, looks };
  }, frames);
}

// Where a look breaks the rail's rules, if anywhere. Half a pixel of slack
// for anti-aliasing at the edges.
function strays({ rail, looks }: { rail: Rail; looks: Look[][] }): string[] {
  const shrunk = 0.5;
  return looks.flatMap((frame, i) => frame.flatMap(({ id, mode, box }) => {
    const out: string[] = [];
    if (box.top < rail.airTop - shrunk) out.push('above its air, toward the nav');
    if (box.bottom > rail.shelfBottom + shrunk) out.push('below the shelf, toward the identity chip');
    if (box.right > rail.right + shrunk || box.right > rail.main) out.push('over the page');
    if (box.left < 0 && box.bottom > rail.laneBottom + shrunk) out.push('out of the window below its lane');
    return out.map((what) => `frame ${i}: wasp ${id} (${mode}) ${what}`);
  }));
}

test('bunting hangs under the hero and across the gutters, and a brushed swag swings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=fete');
  await expect(bunting(page).first()).toBeAttached();
  const ids = await bunting(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-bunting')!));
  // Festoons under a heading rule have ids like 5/12#0; gutter swags 12r-15l#0.
  expect(ids.some((id) => id.includes('/'))).toBe(true);
  expect(ids.some((id) => /r-\d+l#/.test(id))).toBe(true);
  await page.goto('/metrics?theme=fete');
  await expect.poll(() => bunting(page).evaluateAll((els) => els.filter((el) => /r-\d+l#/.test(el.getAttribute('data-bunting')!)).length)).toBeGreaterThan(1);

  // A swag across a gutter: its tape at rest, then brushed by a fast stroke.
  const swag = page.locator('[data-fete] [data-bunting*="r-"]').first();
  const tape = swag.locator('.tape');
  const rest = await tape.getAttribute('d');
  const box = (await swag.boundingBox())!;
  await page.mouse.move(box.x - 30, box.y + 2);
  await page.mouse.move(box.x + box.width + 30, box.y + box.height / 2, { steps: 3 });
  await expect.poll(() => tape.getAttribute('d'), { timeout: 2000 }).not.toBe(rest);
  // And it settles back.
  await expect.poll(() => tape.getAttribute('d'), { timeout: 8000 }).toBe(rest);
});

test('the wasps keep to the rail\'s air, frame by frame, and one lands on the cake when cued', async ({ page }) => {
  test.setTimeout(60_000);
  await seedRandom(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=fete&theme-cue=land');
  await expect(wasps(page)).toHaveCount(2);
  const seen: string[] = [];
  const modes = new Set<string>();
  // Inspecting, landing and feeding take a few seconds; every frame of them
  // is looked at.
  for (let i = 0; i < 12 && !modes.has('feed'); i++) {
    const watched = await watchWasps(page, 40);
    seen.push(...strays(watched));
    watched.looks.flat().forEach((l) => l.id === '0' && modes.add(l.mode));
  }
  expect(seen).toEqual([]);
  expect([...modes]).toEqual(expect.arrayContaining(['inspect', 'land', 'feed']));
});

test('a cursor darting at a wasp chases it off past the window\'s edge, keeping to the air as it goes', async ({ page }) => {
  test.setTimeout(60_000);
  await seedRandom(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=fete');
  await expect(wasps(page)).toHaveCount(2);
  await page.waitForTimeout(400);
  const wasp = page.locator('.fete-shelf [data-wasp][data-id="1"]');
  const box = (await wasp.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  // Watching starts with the dart and runs through the flight.
  const watching = watchWasps(page, 150);
  await page.mouse.move(x + 60, y);
  await page.mouse.move(x + 4, y, { steps: 3 });
  const watched = await watching;
  expect(strays(watched)).toEqual([]);
  const modes = new Set(watched.looks.flat().filter((l) => l.id === '1').map((l) => l.mode));
  expect(modes.has('flee') || modes.has('dodge')).toBe(true);
  if (modes.has('flee')) {
    // Gone out of the window, then back after a while.
    await expect(page.locator('.fete-shelf [data-wasp][data-id="1"]')).toHaveCount(0, { timeout: 5000 });
    await page.mouse.move(700, 600);
    await expect(page.locator('.fete-shelf [data-wasp][data-id="1"]')).toHaveCount(1, { timeout: 20_000 });
  }
});

test('in a short window the high orbit has no room, so wasp 1 rests on its jar while wasp 0 circles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto('/?theme=fete');
  await expect(wasps(page)).toHaveCount(2);
  await page.waitForTimeout(600);
  expect(await wasps(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-wasp')))).toEqual(['circle', 'rest']);
  expect(strays(await watchWasps(page, 60))).toEqual([]);
});

test('on a phone there is no shelf and no wasp, but the bunting still hangs where the page has gaps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/?theme=fete');
  await expect(page.locator('[data-fete]')).toBeAttached();
  await expect(page.locator('.fete-shelf')).toBeHidden();
  await page.waitForTimeout(800);
  await expect(wasps(page)).toHaveCount(0);
  await expect(bunting(page).first()).toBeAttached();
});
