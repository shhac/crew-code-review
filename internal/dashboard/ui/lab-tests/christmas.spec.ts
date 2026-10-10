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
    await expect(page.locator(".robin").first()).toBeVisible();
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
    await expect(page.locator('.robin')).toHaveCount(2);
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
    const robinWidth = await page.locator('.robin').first().evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(robinWidth - 44.8)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Click through 0' }).first().click();
    await expect(page.getByRole('button', { name: 'Click through 1' }).first()).toBeVisible();
    await captureScene(page, info.outputPath(`christmas-${width}.png`));
    const before = await page.locator('.robin').first().boundingBox();
    await page.evaluate(() => window.scrollTo(0, 50));
    await expect.poll(async () => (await page.locator('.robin').first().boundingBox())?.y).toBeCloseTo((before?.y ?? 0) - 50, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.robin')).toHaveCount(2);
    await page.setViewportSize({ width: width + 40, height: 900 });
    await expect(page.locator('.robin')).toHaveCount(2);
    for (let i = 0; i < 3; i++) {
      // The select sits inside its label, so its accessible name also carries its value.
    await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption('none');
      await expect(page.locator('[data-christmas]')).toHaveCount(0);
      await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption('christmas');
      await expect(page.locator('.robin')).toHaveCount(2);
    }
    await page.getByLabel('empty', { exact: true }).check();
    await expect(page.locator('.robin')).toHaveCount(0);
    expect(api).toEqual([]);
  });
}

test('both live robins use idle, peck, hop and all eight wing profiles, and change floors', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/lab/scene.html?theme=christmas&clock=manual');
  await expect(page.locator('.robin')).toHaveCount(2);
  const clock = page.getByLabel('Scene elapsed (ms)', { exact: true });
  const first = page.locator('[data-robin="0"]');
  const second = page.locator('[data-robin="1"]');
  const rig = first.locator('[data-layered-robin]');
  const advance = async (time: number) => {
    await clock.fill(String(time));
    await first.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  await advance(3000);
  expect(await rig.getAttribute('data-head-angle')).not.toBe('0');
  expect(await rig.getAttribute('data-head-angle')).not.toBe(await second.locator('[data-layered-robin]').getAttribute('data-head-angle'));
  await advance(4350);
  await expect(rig).toHaveAttribute('data-closed', 'true');
  await advance(5900);
  const tail = await rig.locator('[data-part="tail"]').evaluate(el => el.closest('[data-slot]')!.getAttribute('transform'));
  expect(tail).not.toContain('rotate(0 46 65)');
  await advance(6000); await advance(6420);
  await expect(rig).toHaveAttribute('data-peck-weight', '1');
  await advance(11000);
  await expect(first).toHaveAttribute('data-action', 'hop');
  await advance(11135);
  await expect(rig.locator('[data-part="leg-near"]:not([visibility])')).toBeAttached();
  await advance(11300);
  const origin = await first.getAttribute('data-floor');
  await advance(22300);
  await expect(first).toHaveAttribute('data-action', 'flight');
  const wingProfiles = new Set<string>();
  const flightFrames: { x: number; y: number; facing: number; rotation: number }[] = [];
  for (let time = 22500; time < 23300; time += 25) {
    await advance(time);
    flightFrames.push(await first.evaluate(el => {
      if (!(el instanceof HTMLElement)) throw new Error('missing robin');
      return { x: parseFloat(el.style.left), y: parseFloat(el.style.top),
        facing: Number(el.dataset.facing), rotation: Number(el.dataset.rotation) };
    }));
    for (const id of await rig.locator('[data-part^="wing-"]:not([visibility])').evaluateAll(els => els.map(el => el.getAttribute('data-part')!))) wingProfiles.add(id);
  }
  for (const state of ['up', 'high-fall', 'forward', 'low-fall', 'down', 'low-rise', 'recovery', 'high-rise']) expect(wingProfiles.has('wing-' + state)).toBe(true);
  for (let i = 1; i < flightFrames.length - 1; i++) {
    const before = flightFrames[i - 1], frame = flightFrames[i], after = flightFrames[i + 1];
    expect(Math.abs(frame.rotation)).toBeLessThanOrEqual(20);
    if (before.facing === frame.facing && after.facing === frame.facing && Math.abs(after.x - before.x) > .01)
      expect(frame.facing).toBe(after.x > before.x ? 1 : -1);
  }
  expect(flightFrames.some(frame => Math.abs(frame.rotation) > 1)).toBe(true);
  await captureScene(page, info.outputPath('two-robins-flight.png'));
  // Large clock advances settle the current action rather than starting a new one.
  await advance(30000);
  await expect(first).toHaveAttribute('data-action', 'idle');
  expect(await first.getAttribute('data-floor')).not.toBe(origin);
  await expect(second).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const bird of [first, second]) await expect(bird.locator('[data-layered-robin]')).toHaveAttribute('data-flight-weight', '0');
});

test('a cursor chasing a rendered robin triggers flight after two hops', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/lab/scene.html?theme=none&clock=manual');
  await page.locator('main').evaluate(main => {
    const cards = [200, 450].map(top => {
      const card = document.createElement('section');
      card.className = 'surface';
      card.style.cssText = `position:fixed;left:200px;top:${top}px;width:600px;height:100px`;
      return card;
    });
    main.replaceChildren(...cards);
  });
  await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption('christmas');
  await expect(page.locator('.robin')).toHaveCount(2);
  const bird = page.locator('[data-robin="0"]');
  const clock = page.getByLabel('Scene elapsed (ms)', { exact: true });
  const advance = async (time: number) => {
    await clock.fill(String(time));
    await bird.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const chase = async () => {
    const position = await bird.evaluate(el => {
      if (!(el instanceof HTMLElement)) throw new Error('missing robin');
      return { x: parseFloat(el.style.left) + 22.4, y: parseFloat(el.style.top) + 35.735 };
    });
    await page.mouse.move(position.x - 10, position.y);
    await page.mouse.move(position.x - 9, position.y);
  };
  await advance(100);
  await chase();
  await expect(bird).toHaveAttribute('data-action', 'hop');
  await advance(400);
  await advance(2400);
  await chase();
  await expect(bird).toHaveAttribute('data-action', 'hop');
  await advance(2700);
  await advance(4700);
  await chase();
  await expect(bird).toHaveAttribute('data-action', 'flight');
});

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
  const bird = page.locator('[data-robin="0"]');
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
  test(`chart blockers never intersect a travelling robin at ${width}px`, async ({ page }) => {
    const api: string[] = [];
    await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lab/scene.html?theme=christmas&clock=manual');
    const bird = page.locator('[data-robin="0"]');
    await expect(bird).toHaveCount(1);
    await page.getByLabel('blocked routes', { exact: true }).check();
    await page.waitForTimeout(50);
    await page.getByLabel('random', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Advance 16s', exact: true }).click();
    // The new planner may safely go around a chart. Sample the rendered path,
    // rather than assuming one blocker makes every destination unreachable.
    for (let step = 0; step < 20; step++) {
      const clear = await bird.evaluate(async el => {
        const floorsModule = '/src/lib/theme/floors.ts';
        const { measureObstacles } = await import(floorsModule);
        const robinModule = '/src/lib/theme/christmas/robin.ts';
        const { safeRoute } = await import(robinModule);
        const snowModule = '/src/lib/theme/christmas/snow.ts';
        const { ROBIN } = await import(snowModule);
        const p = { x: Number.parseFloat((el as HTMLElement).style.left) + ROBIN.anchorX,
          y: Number.parseFloat((el as HTMLElement).style.top) + ROBIN.anchorY - .01 }; // Allow CSS coordinate rounding at a ledge.
        return safeRoute(p, p, 0, { floors: new Map(), obstacles: measureObstacles(), width: innerWidth, height: innerHeight },
          el.getAttribute('data-pose') === 'flight' ? 'flight' : 'perch');
      });
      expect(clear).toBe(true);
      await page.getByRole('button', { name: 'Advance 100ms', exact: true }).click();
    }
    expect(api).toEqual([]);
  });
  test(`supplied flight pose and interrupted layout at ${width}px`, async ({ page }, info) => {
    const api: string[] = [];
    await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lab/scene.html?theme=christmas&clock=manual');
    const bird = page.locator('[data-robin="0"]');
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

// Every seasonal shelf must obey the same real rail/identity footer contract.
// The scene registry says which sets have one, so a month's shelf is held to
// it as soon as its scene names it.
test('each theme shelf sits above identity and hides on cramped rails', async ({ page }) => {
  const api: string[] = [];
  await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
  await page.goto('/lab/scene.html');
  const shelved = await page.evaluate(async () => {
    const registry = '/src/lib/theme/scenes.ts';
    const { scenes } = await import(registry);
    return Object.keys(scenes).filter((name) => scenes[name].Shelf);
  });
  expect(shelved).toEqual(expect.arrayContaining(['halloween', 'bonfire', 'christmas', 'aurora']));
  for (const theme of shelved) {
    await test.step(`${theme} shelf`, async () => {
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
    });
  }
  expect(api).toEqual([]);
});
