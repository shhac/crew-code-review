import { expect, test } from '@playwright/test';
import {
  CATCH_UP, ROOMY, ROUTES, SETS, WIDTHS, accentOf, animals, catching, coveredByAnimals, coveredByParts, knownAt, landsOnDecoration, modesOf,
  sceneOf, seedRandom, serveTheme, settled, watchCovered, type Known, type SeasonalSet, type Width,
} from './seasonal';

// The overlay contract, run for every seasonal set with animals (see
// seasonal.ts). Each set's own spec covers only its own behaviour.

const LOOK = { animals: coveredByAnimals, parts: coveredByParts } satisfies Record<Known['what'], unknown>;
const covers = (set: SeasonalSet): Known['what'][] => (set.parts.length ? ['animals', 'parts'] : ['animals']);

for (const set of SETS) {
  test.describe(set.theme, () => {
    test('the daemon-resolved set decorates the page and takes its palette', async ({ page }) => {
      await serveTheme(page, set.theme);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await expect(page.locator(set.overlay)).toBeAttached();
      await expect(page.locator(set.shelf)).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', set.theme);
      expect(await accentOf(page)).toBe(set.accent);
      await expect(page.locator(`${set.overlay} ${set.decoration}`).first()).toBeAttached();
    });

    test('nothing takes pointer events, it all sits below dialogs, and it is hidden from assistive tech', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?theme=${set.theme}`);
      const animal = animals(page, set).first();
      // Out and drawn, so its drawing is checked too.
      await expect(animal).toBeVisible({ timeout: 20_000 });
      expect(await catching(page, set)).toEqual([]);
      expect(await landsOnDecoration(animal, set)).toBe(false);
      // The modal sits at 50.
      expect(Number(await page.locator(set.overlay).evaluate((el) => getComputedStyle(el).zIndex))).toBeLessThan(50);
      await expect(page.locator(set.overlay)).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator(set.shelf)).toHaveAttribute('aria-hidden', 'true');
    });

    for (const width of WIDTHS) {
      test(`at ${width}px the roomy pages get at least ${set.min[width]} animals, and the shelf shows only beside a rail`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: 900 });
        for (const route of ROOMY) {
          await page.goto(`${route}?theme=${set.theme}`);
          await expect(page.locator(set.overlay)).toBeAttached();
          await expect(page.locator(set.shelf)).toBeVisible({ visible: width !== 390 });
          await expect.poll(() => animals(page, set).count(), { message: route, timeout: 20_000 }).toBeGreaterThanOrEqual(set.min[width]);
        }
      });

      for (const what of covers(set)) {
        const known = knownAt(set.theme, width, what);
        test(`at ${width}px its ${what} cover no text, controls or charts on any page`, async ({ page }) => {
          // Each route is looked at several times; measuring every text
          // range is slow.
          test.setTimeout(240_000);
          await seedRandom(page);
          await page.setViewportSize({ width, height: 900 });
          for (const route of ROUTES.filter((r) => !known.some((k) => k.route === r))) {
            await page.goto(`${route}?theme=${set.theme}`);
            await settled(page, set);
            await page.waitForTimeout(CATCH_UP);
            expect(await watchCovered(page, () => LOOK[what](page, set)), route).toEqual([]);
          }
        });
        for (const k of known) {
          test(`at ${width}px on ${k.route} its ${what} cover content (known bug: ${k.bug})`, async ({ page }) => {
            test.fail();
            test.setTimeout(60_000);
            await seedRandom(page);
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`${k.route}?theme=${set.theme}`);
            await settled(page, set);
            await page.waitForTimeout(CATCH_UP);
            // Watched for longer, so a bug that shows only in some moments
            // (a sniff) is seen every run.
            expect(await watchCovered(page, () => LOOK[what](page, set), 12)).toEqual([]);
          });
        }
      }
    }

    test('reduced motion shows a still scene that a cursor cannot wake', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?theme=${set.theme}`);
      await expect.poll(() => animals(page, set).count()).toBeGreaterThanOrEqual(set.min[1440]);
      await settled(page, set);
      const before = await sceneOf(page, set);
      expect(await modesOf(page, set)).toEqual([set.still]);
      const box = (await animals(page, set).first().boundingBox())!;
      await page.mouse.move(box.x - 60, box.y, { steps: 2 });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
      await page.waitForTimeout(2500);
      expect(await sceneOf(page, set)).toEqual(before);
    });

    test('reduced motion switched on mid-visit stills the scene', async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?theme=${set.theme}`);
      await expect.poll(() => animals(page, set).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(set.min[1440]);
      await settled(page, set);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect.poll(() => modesOf(page, set)).toEqual([set.still]);
      await page.waitForTimeout(500);
      const before = await sceneOf(page, set);
      await page.waitForTimeout(2500);
      expect(await sceneOf(page, set)).toEqual(before);
    });

    test('client-side navigation and a resize mid-run leave the content clear', async ({ page }) => {
      test.setTimeout(120_000);
      await seedRandom(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?theme=${set.theme}`);
      await expect.poll(() => animals(page, set).count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(set.min[1440]);
      // Each step, and the width and page it leaves the visit on.
      const steps: { name: string; go: () => Promise<unknown>; width: Width; route: string }[] = [
        { name: 'to history', go: () => page.getByRole('link', { name: 'History', exact: true }).click(), width: 1440, route: '/history' },
        { name: 'to 1024px', go: () => page.setViewportSize({ width: 1024, height: 800 }), width: 1024, route: '/history' },
        { name: 'to metrics', go: () => page.getByRole('link', { name: 'Metrics', exact: true }).click(), width: 1024, route: '/metrics' },
        { name: 'to a phone', go: () => page.setViewportSize({ width: 390, height: 900 }), width: 390, route: '/metrics' },
        { name: 'back to the queue', go: () => page.getByRole('link', { name: 'Queue', exact: true }).click(), width: 390, route: '/' },
      ];
      for (const step of steps) {
        await step.go();
        await page.waitForTimeout(Math.max(set.settle, CATCH_UP));
        const looks = covers(set).filter((what) => !knownAt(set.theme, step.width, what).some((k) => k.route === step.route));
        const look = async () => (await Promise.all(looks.map((what) => LOOK[what](page, set)))).flat();
        expect(await watchCovered(page, look), step.name).toEqual([]);
      }
    });
  });
}
