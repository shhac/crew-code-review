import { expect, test, type Page } from '@playwright/test';

// Hide only the fixed lab controls during captures. Visibility preserves layout
// and scene state, and restoring in finally keeps the remaining controls usable.
async function captureScene(page: Page, path: string) {
  const controls = page.locator(".controls");
  const previous = await controls.evaluate((el) => {
    if (!(el instanceof HTMLElement)) throw new Error("missing lab controls");
    const value = el.style.visibility;
    el.style.visibility = "hidden";
    return value;
  });
  try {
    await expect(controls).toBeHidden();
    await expect(page.locator(".robin")).toBeVisible();
    await page.screenshot({ path });
  } finally {
    await controls.evaluate((el, value) => {
      if (el instanceof HTMLElement) el.style.visibility = value;
    }, previous);
  }
  await expect(controls).toBeVisible();
}

test('standalone rendered text blocks routes independently of its tag', async ({ page }) => {
  const api: string[] = [];
  await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
  await page.goto('/lab/scene.html?theme=christmas');
  const results = await page.evaluate(async () => {
    const floorsModule = '/src/lib/theme/floors.ts';
    const robinModule = '/src/lib/theme/christmas/robin.ts';
    const { measureObstacles } = await import(floorsModule);
    const { safeRoute } = await import(robinModule);
    const main = document.querySelector('main');
    if (!main) throw new Error('missing synthetic main');
    return ['div', 'strong', 'small', 'dt', 'dd', 'summary', 'custom-text'].map((tag) => {
      const el = document.createElement(tag);
      el.textContent = 'text';
      el.style.cssText = 'position:fixed;left:180px;top:160px;margin:0;padding:0;font:12px/16px monospace';
      main.replaceChildren(el);
      const scene = { floors: new Map(), obstacles: measureObstacles(), width: innerWidth, height: innerHeight };
      const from = { x: 100, y: 200 }, to = { x: 300, y: 200 };
      return { tag, start: safeRoute(from, from, 0, scene), end: safeRoute(to, to, 0, scene), route: safeRoute(from, to, 8, scene) };
    });
  });
  for (const result of results) {
    expect(result.start, result.tag).toBe(true);
    expect(result.end, result.tag).toBe(true);
    expect(result.route, result.tag).toBe(false);
  }
  expect(api).toEqual([]);
});

for (const width of [1440, 480]) {
  test(`still Christmas at ${width}px`, async ({ page }, info) => {
    const api: string[] = [];
    await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/lab/scene.html?theme=christmas');
    await expect(page.locator('[data-christmas]')).toHaveCount(1);
    await expect(page.locator('.robin')).toHaveCount(1);
    await expect(page.locator('.christmas-shelf img')).toHaveCount(2);
    if (width > 760) await expect(page.locator('.christmas-shelf')).toBeVisible();
    else await expect(page.locator('.christmas-shelf')).toBeHidden();
    const bounds = await page.locator('[data-snow]').evaluateAll((els) => els.map((el) => {
      if (!(el instanceof SVGGraphicsElement)) throw new Error("snow must be SVG geometry");
      const box = el.getBBox();
      return { y: box.y, bottom: box.y + box.height };
    }));
    for (const box of bounds) {
      expect(box.y).toBeGreaterThanOrEqual(-9);
      expect(box.bottom).toBeCloseTo(0);
    }
    // Drawn at 0.35 of its 128px art cell (44.8px); browsers may snap it to a whole pixel.
    const robinWidth = await page.locator('.robin').evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(robinWidth - 44.8)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Click through 0' }).first().click();
    await expect(page.getByRole('button', { name: 'Click through 1' }).first()).toBeVisible();
    await captureScene(page, info.outputPath(`christmas-${width}.png`));
    const before = await page.locator('.robin').boundingBox();
    await page.evaluate(() => window.scrollTo(0, 50));
    await expect.poll(async () => (await page.locator('.robin').boundingBox())?.y).toBeCloseTo((before?.y ?? 0) - 50, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.robin')).toHaveCount(1);
    await page.setViewportSize({ width: width + 40, height: 900 });
    await expect(page.locator('.robin')).toHaveCount(1);
    for (let i = 0; i < 3; i++) {
      // The select sits inside its label, so its accessible name also carries its value.
    await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption('none');
      await expect(page.locator('[data-christmas]')).toHaveCount(0);
      await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption('christmas');
      await expect(page.locator('.robin')).toHaveCount(1);
    }
    await page.getByLabel('empty', { exact: true }).check();
    await expect(page.locator('.robin')).toHaveCount(0);
    expect(api).toEqual([]);
  });
}

for (const width of [1440, 480]) {
test(`Christmas fast strokes, recovery, rejection and teardown at ${width}px`, async ({ page }, info) => {
  const api: string[] = [];
  await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/lab/scene.html?theme=christmas&clock=manual');
  const snow = page.locator('[data-snow]').first();
  await expect(snow).toHaveAttribute('d', /^M/);
  const original = await snow.getAttribute('d');
  const bounds = await snow.evaluate((el) => el.parentElement!.getBoundingClientRect().toJSON());
  const y = bounds.y;
  // Two events span the entire cap, including samples far from either end.
  const move = async (x: number, extra = {}) => page.evaluate(({ x, y, extra }) => {
    dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', ...extra }));
  }, { x, y, extra });
  await move(bounds.x - 40); await move(bounds.x + bounds.width + 40);
  await expect.poll(() => snow.getAttribute('d')).not.toBe(original);
  const cleared = await snow.getAttribute('d');
  await captureScene(page, info.outputPath(`christmas-wiped-${width}.png`));
  await page.getByRole('button', { name: 'Advance 1s', exact: true }).click();
  await expect(page.locator('[data-scene-time]')).toHaveText('1000');
  await expect(snow).toHaveAttribute('d', cleared!);
  await page.getByRole('button', { name: 'Advance 1s', exact: true }).click();
  await expect.poll(() => snow.getAttribute('d')).not.toBe(cleared);
  await captureScene(page, info.outputPath(`christmas-recovery-${width}.png`));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(snow).toHaveAttribute('d', original!);
  await move(bounds.x - 40); await move(bounds.x + bounds.width + 40);
  await expect(snow).toHaveAttribute('d', original!);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(snow).toHaveAttribute('d', original!);
  for (const extra of [{ pointerType: 'touch' }, { buttons: 1 }, { pointerType: 'pen', pressure: .5 }]) {
    await move(bounds.x - 40, extra); await move(bounds.x + bounds.width + 40, extra);
    await expect(snow).toHaveAttribute('d', original!);
  }
  await move(bounds.x - 40);
  await page.evaluate(() => dispatchEvent(new Event('resize')));
  await page.waitForTimeout(50);
  await move(bounds.x + bounds.width + 40);
  await expect(snow).toHaveAttribute('d', original!);
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointerout', { relatedTarget: null })));
  await move(bounds.x - 40);
  await expect(snow).toHaveAttribute('d', original!);
  await page.evaluate(() => window.scrollTo(0, 20));
  await page.waitForTimeout(50);
  await move(bounds.x + bounds.width + 40);
  await expect(snow).toHaveAttribute('d', original!);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(50);
  await move(bounds.x - 40, { pointerType: 'pen', pressure: 0 });
  await move(bounds.x + bounds.width + 40, { pointerType: 'pen', pressure: 0 });
  await expect.poll(() => snow.getAttribute('d')).not.toBe(original);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(snow).toHaveAttribute('d', original!);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(50);
  const bird = page.locator('.robin');
  const box = (await bird.boundingBox())!;
  await page.mouse.move(box.x + 80, box.y + 35);
  await page.mouse.move(box.x + 79, box.y + 35);
  await expect(bird).toHaveAttribute('data-pose', 'alert');
  await captureScene(page, info.outputPath(`christmas-alert-${width}.png`));
  await page.getByLabel('blocked routes', { exact: true }).check();
  await expect(bird).toHaveAttribute('data-pose', 'perch');
  await page.getByRole('button', { name: 'Click through 0' }).first().click();
  await expect(page.getByRole('button', { name: 'Click through 1' }).first()).toBeVisible();
  await page.getByLabel('empty', { exact: true }).check();
  await expect(bird).toHaveCount(0); await expect(page.locator('[data-snow]')).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption('none');
    await expect(page.locator('[data-christmas]')).toHaveCount(0);
    await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption('christmas');
    await expect(page.locator('[data-christmas]')).toHaveCount(1);
  }
  expect(api).toEqual([]);
});
}

for (const width of [1440, 480]) {
  test(`blocked swept routes stay perched at ${width}px`, async ({ page }) => {
    const api: string[] = [];
    await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lab/scene.html?theme=christmas&clock=manual');
    const bird = page.locator('.robin');
    await expect(bird).toHaveCount(1);
    await page.getByLabel('blocked routes', { exact: true }).check();
    await page.waitForTimeout(50);
    const before = await bird.boundingBox();
    await page.getByLabel('random', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Advance 16s', exact: true }).click();
    await expect(bird).toHaveAttribute('data-pose', 'perch');
    expect(await bird.boundingBox()).toEqual(before);
    expect(api).toEqual([]);
  });
  test(`supplied flight pose and interrupted layout at ${width}px`, async ({ page }, info) => {
    const api: string[] = [];
    await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lab/scene.html?theme=christmas&clock=manual');
    const bird = page.locator('.robin');
    await expect(bird).toHaveAttribute('data-pose', 'perch');
    await page.getByLabel('random', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Advance 16s', exact: true }).click();
    await expect(bird).toHaveAttribute('data-pose', 'flight');
    await page.getByRole('button', { name: 'Advance 100ms', exact: true }).click();
    await captureScene(page, info.outputPath(`christmas-flight-${width}.png`));
    await page.setViewportSize({ width: width + 10, height: 900 });
    await expect(bird).toHaveAttribute('data-pose', 'perch');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const still = await bird.getAttribute('style');
    await page.getByRole('button', { name: 'Advance 16s', exact: true }).click();
    await expect(bird).toHaveAttribute('style', still!);
    await page.getByLabel('empty', { exact: true }).check();
    await expect(bird).toHaveCount(0);
    await page.getByLabel('empty', { exact: true }).uncheck();
    await expect(bird).toHaveAttribute('data-pose', 'perch');
    expect(api).toEqual([]);
  });
}

// Both seasonal shelves must obey the same real rail/identity footer contract.
for (const theme of ['christmas', 'halloween']) {
  test(`${theme} shelf sits above identity and hides on cramped rails`, async ({ page }) => {
    const api: string[] = [];
    await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/lab/scene.html?theme=${theme}`);
    const shelf = page.locator('.shell .rail > .theme-shelf');
    const identity = page.locator('.rail > .viewer-chip');
    await expect(shelf).toBeVisible();
    await expect(identity).toBeVisible();
    expect(await shelf.evaluate((el) => el.nextElementSibling?.classList.contains('viewer-chip'))).toBe(true);
    const position = await shelf.evaluate((el) => {
      const chip = el.nextElementSibling;
      const nav = el.previousElementSibling;
      if (!chip || !nav) throw new Error('missing rail footer siblings');
      const bounds = el.getBoundingClientRect();
      return {
        aboveIdentity: chip.getBoundingClientRect().top - bounds.bottom,
        spaceBelowNav: bounds.top - nav.getBoundingClientRect().bottom,
        gap: Number.parseFloat(getComputedStyle(el.parentElement!).rowGap),
        identityMargin: getComputedStyle(chip).marginTop,
      };
    });
    expect(position.aboveIdentity).toBeCloseTo(position.gap, 0);
    expect(position.spaceBelowNav).toBeGreaterThan(position.gap + 40);
    expect(position.identityMargin).toBe('0px');
    for (const viewport of [
      { width: 1440, height: 640 },
      { width: 760, height: 900 },
      { width: 480, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(shelf).toBeHidden();
      await expect(identity).toBeVisible();
    }
    await page.setViewportSize({ width: 761, height: 900 });
    await expect(shelf).toBeVisible();
    await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption('none');
    await expect(shelf).toHaveCount(0);
    await expect(identity).toBeVisible();
    expect(api).toEqual([]);
  });
}
