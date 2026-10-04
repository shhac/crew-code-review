import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Test-only availability override. Exercise ChristmasLayer with retained art
// without treating an automated regression as production visual acceptance.
const accepted = JSON.parse(readFileSync('src/lib/theme/christmas/robin-atlas/manifest.json', 'utf8'));
accepted.rows.flying = { ...accepted.rows.flying, available: true, acceptance: 'accepted', joins: 'accepted' };

for (const reset of ['deadline', 'layout', 'visibility', 'reduced', 'teardown', 'interruption'] as const) {
  test(`real scene flying clears on ${reset}`, async ({ page }) => {
    let apiCalls = 0;
    await page.route('**/api/**', route => { apiCalls++; return route.abort(); });
    await page.route('**/robin-atlas/manifest.json?*', route => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(JSON.stringify(accepted))};`,
    }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lab/scene.html?theme=christmas&clock=manual');
    const robin = page.locator('.robin');
    const cell = robin.locator('[data-atlas-frame]');
    await expect(robin.locator('[data-robin-atlas]')).toHaveAttribute('data-robin-atlas', 'ready');
    // At the leftmost perch random=0 rejects a left hop and chooses a real
    // 450ms flight at flightAt=16000. No manually constructed Bird/action.
    await page.getByLabel('random', { exact: true }).fill('0');
    const elapsed = page.getByLabel('Scene elapsed (ms)');
    await elapsed.fill('16000');
    await expect(robin).toHaveAttribute('data-pose', 'flight');
    await expect(robin.locator('.raised-wing')).toHaveCount(1);
    for (const [time, frame] of [[16090, 'W0'], [16160, 'W1'], [16230, 'W2'], [16300, 'W3']] as const) {
      await elapsed.fill(String(time));
      await expect(cell).toHaveAttribute('data-atlas-frame', frame);
      await expect(robin.locator('.raised-wing')).toHaveCount(0);
    }
    const flying = robin.locator('[data-atlas-frame^="W"]');
    if (reset === 'deadline') {
      await elapsed.fill('16360');
      await expect(flying).toHaveCount(0);
      await expect(robin.locator('.raised-wing')).toHaveCount(1);
      await elapsed.fill('16449');
      await expect(robin).toHaveAttribute('data-pose', 'flight');
    } else if (reset === 'layout') {
      await page.setViewportSize({ width: 1480, height: 900 });
    } else if (reset === 'visibility') {
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await elapsed.fill('16450');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    } else if (reset === 'reduced') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(cell).toHaveAttribute('data-atlas-frame', 'I0');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    } else if (reset === 'interruption') {
      await page.getByLabel('empty', { exact: true }).check();
      await expect(robin).toHaveCount(0);
      await page.getByLabel('empty', { exact: true }).uncheck();
    } else {
      const theme = page.locator('label', { hasText: /^theme/ }).locator('select');
      await theme.selectOption('none');
      await expect(robin).toHaveCount(0);
      await theme.selectOption('christmas');
    }
    await expect(flying).toHaveCount(0);
    await elapsed.fill('16450');
    await expect(robin).toHaveAttribute('data-pose', 'perch');
    await expect(cell).toHaveAttribute('data-atlas-frame', 'I0');
    await elapsed.fill('16500');
    await expect(flying).toHaveCount(0);
    await expect(robin).toHaveAttribute('data-pose', 'perch');
    expect(apiCalls).toBe(0);
  });
}

test('real scene atlas availability does not change the flight route or deadline', async ({ browser }) => {
  const run = async (fail: boolean) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/api/**', route => route.abort());
    await page.route('**/robin-atlas/manifest.json?*', route => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(JSON.stringify(accepted))};`,
    }));
    if (fail) await page.route('**/*-idle.webp', route => route.abort());
    await page.goto('/lab/scene.html?theme=christmas&clock=manual');
    const robin = page.locator('.robin');
    await expect(robin.locator('[data-robin-atlas]')).toHaveAttribute('data-robin-atlas', fail ? 'fallback' : 'ready');
    await page.getByLabel('random', { exact: true }).fill('0');
    const states = [];
    for (const time of [16000, 16090, 16160, 16230, 16300, 16360, 16449, 16450]) {
      await page.getByLabel('Scene elapsed (ms)').fill(String(time));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if (time === 16160) {
        if (fail) {
          await expect(robin.locator('.raised-wing')).toHaveCount(1);
          await expect(robin.locator('[data-atlas-frame^="W"]')).toHaveCount(0);
        } else {
          await expect(robin.locator('[data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'W1');
          await expect(robin.locator('.raised-wing')).toHaveCount(0);
        }
      }
      states.push(await robin.evaluate(el => ({
        pose: el.getAttribute('data-pose'), left: el.style.left, top: el.style.top, transform: el.style.transform,
      })));
    }
    await expect(robin).toHaveAttribute('data-pose', 'perch');
    await page.close();
    return states;
  };
  expect(await run(true)).toEqual(await run(false));
});

test('candidate middle cycles use cells with no legacy wing, exact preview and both facings', async ({ page }) => {
  await page.route('**/api/**', route => route.abort());
  await page.goto('/lab/robin-timing.html');
  const view = page.locator('[data-flying-view="light-1-0.35"]');
  await expect(view.locator('[data-robin-atlas]')).toHaveAttribute('data-robin-atlas', 'ready');
  const clock = page.getByLabel('Flying elapsed (ms)');
  await clock.fill('89.999'); await expect(view.locator('.raised-wing')).toHaveCount(1);
  await clock.fill('90'); await expect(view.locator('[data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'W0');
  await expect(view.locator('.raised-wing')).toHaveCount(0);
  await clock.fill('359.999'); await expect(view.locator('[data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'W3');
  await clock.fill('360'); await expect(view.locator('.raised-wing')).toHaveCount(1);
  await clock.fill('450'); await expect(view.locator('[data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'I0');
  await page.getByLabel('Flying duration (ms)').fill('750');
  for (const [time, id] of [[150, 'W0'], [374.999, 'W3'], [375, 'W0'], [599.999, 'W3']] as const) {
    await clock.fill(String(time)); await expect(view.locator('[data-atlas-frame]')).toHaveAttribute('data-atlas-frame', id);
  }
  await clock.fill('600'); await expect(view.locator('.raised-wing')).toHaveCount(1);
  await clock.fill('750'); await expect(view.locator('[data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'I0');
  await page.getByLabel('Flying mode').selectOption('exact');
  for (const [time, id] of [[0, 'W0'], [50, 'W1'], [100, 'W2'], [150, 'W3'], [200, 'W0']] as const) {
    await clock.fill(String(time));
    await expect(page.locator('[data-flying-phase]')).toHaveText(id);
    for (const facing of [1, -1]) {
      const cell = page.locator(`[data-flying-view="dark-${facing}-1"]`);
      await expect(cell.locator('[data-atlas-frame]')).toHaveAttribute('data-atlas-frame', id);
      await expect(cell.locator('.atlas-sheet')).toHaveCSS('top', '0px');
      await expect(cell.locator('.frame-window')).toHaveCSS('width', '142px');
      await expect(cell.locator('.frame-window')).toHaveCSS('height', '134px');
      await expect(cell.locator('.frame-window')).toHaveCSS('left', '-16.9px');
      await expect(cell.locator('.frame-window')).toHaveCSS('top', '-35.3px');
      await expect(cell.locator('.raised-wing')).toHaveCount(0);
    }
  }
  await page.getByLabel('Flying reduced motion').check();
  await expect(view.locator('[data-atlas-frame]')).toHaveAttribute('data-atlas-frame', 'I0');
  await page.getByLabel('Flying reduced motion').uncheck();
  await page.getByLabel('Inspect candidate flying').uncheck();
  await expect(view.locator('.raised-wing')).toHaveCount(1);
});

test('failed candidate atlas keeps complete legacy flight', async ({ page }) => {
  await page.route('**/*-idle.webp', route => route.abort());
  await page.goto('/lab/robin-timing.html');
  await page.getByLabel('Flying elapsed (ms)').fill('150');
  const view = page.locator('[data-flying-view="light-1-0.35"]');
  await expect(view.locator('[data-robin-atlas]')).toHaveAttribute('data-robin-atlas', 'fallback');
  await expect(view.locator('.raised-wing')).toHaveCount(1);
  await expect(view.locator('.bird-body')).toHaveAttribute('src', /robin-flight.webp/);
});
