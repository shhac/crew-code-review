import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const pending = JSON.parse(readFileSync('src/lib/theme/christmas/robin-atlas/manifest.json', 'utf8'));
pending.rows.idle.available = false; pending.rows.idle.acceptance = 'pending';

for (const dpr of [1, 2]) {
  test.describe(`production idle DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const width of [1440, 480]) {
      test(`idle/blink, layout, preference and teardown at ${width}px`, async ({ page }, info) => {
        let apiCalls = 0;
        await page.route('**/api/**', route => { apiCalls++; return route.abort(); });
        // Keep this existing suite exercising the shipped rigged fallback,
        // including after the production atlas receives designer acceptance.
        await page.route('**/robin-atlas/manifest.json?*', route => route.fulfill({
          contentType: 'application/javascript', body: `export default ${JSON.stringify(JSON.stringify(pending))};`,
        }));
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/lab/scene.html?theme=christmas&clock=manual');
        const art = page.locator('.robin [data-robin-assets]');
        await expect(art).toHaveAttribute('data-robin-assets', 'ready');
        await expect(art).toHaveAttribute('data-robin-atlas', 'fallback');
        const frame = page.locator('.robin [data-atlas-frame]');
        const elapsed = page.getByLabel('Scene elapsed (ms)');
        const before = await page.locator('.robin').boundingBox();
        for (const [time, id] of [[200, 'I1'], [400, 'I2'], [1199, 'I1'], [1200, 'I0'], [4860, 'B1'], [4900, 'B2']] as const) {
          await elapsed.fill(String(time)); await expect(frame).toHaveAttribute('data-atlas-frame', id);
          expect(await page.locator('.robin').boundingBox()).toEqual(before);
        }
        await page.screenshot({ path: info.outputPath('idle-blink.png') });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
        await elapsed.fill('50000'); await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        // I0 is already visible while reduced; let the resumed loop establish
        // its epoch before advancing the manual clock.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
        await elapsed.fill('50200'); await expect(frame).toHaveAttribute('data-atlas-frame', 'I1');
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await elapsed.fill('100000');
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: false });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
        await elapsed.fill('100200'); await expect(frame).toHaveAttribute('data-atlas-frame', 'I1');
        await page.setViewportSize({ width: width + 40, height: 900 });
        await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
        const theme = page.locator('label', { hasText: /^theme/ }).locator('select');
        await theme.selectOption('none'); await expect(page.locator('.robin')).toHaveCount(0);
        await theme.selectOption('christmas'); await expect(frame).toHaveAttribute('data-atlas-frame', 'I0');
        expect(apiCalls).toBe(0);
      });
    }
  });
}

test('a missing atlas does not change route positions, timing, facing or legacy flight art', async ({ browser }) => {
  const run = async (fail: boolean) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/api/**', route => route.abort());
    if (fail) await page.route('**/*-idle-sheet.webp', route => route.abort());
    await page.goto('/lab/scene.html?theme=christmas&clock=manual');
    await expect(page.locator('.robin [data-robin-assets]')).toHaveAttribute('data-robin-assets', fail ? 'fallback' : 'ready');
    const states = [];
    for (const now of [0, 400, 4900, 9000, 9100, 9320, 20000, 20100, 21000]) {
      await page.getByLabel('Scene elapsed (ms)').fill(String(now));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      states.push(await page.locator('.robin').evaluate(el => {
        const box = el.getBoundingClientRect();
        return { x: box.x, y: box.y, pose: el.getAttribute('data-pose'), transform: getComputedStyle(el).transform };
      }));
    }
    await page.close(); return states;
  };
  expect(await run(true)).toEqual(await run(false));
});
