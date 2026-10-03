import { expect, test } from '@playwright/test';

test('Christmas shelf geometry, lights and real pointer pass-through', async ({ page }) => {
  const api: string[] = [];
  await page.route('**/api/**', route => { api.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/lab/scene.html?theme=christmas&clock=manual');
  const shelf = page.locator('.christmas-shelf');
  const stage = shelf.locator('.shelf-stage');
  const box = (await stage.boundingBox())!;
  expect([box.width, box.height]).toEqual([192, 83]);
  expect((await shelf.boundingBox())!.height).toBe(105);
  for (const [name, x, y, width, height] of [['tree', 0, 0, 88, 83], ['presents', 68, 17, 124, 66]] as const) {
    const image = shelf.locator(`.${name}`);
    await image.evaluate(async el => { if (!(el instanceof HTMLImageElement)) throw new Error('expected sprite'); await el.decode(); });
    const rect = (await image.boundingBox())!;
    expect([rect.x - box.x, rect.y - box.y, rect.width, rect.height]).toEqual([x, y, width, height]);
    expect(rect.y + rect.height).toBe(box.y + box.height);
  }
  await expect(shelf.locator('button, a, input, [tabindex]')).toHaveCount(0);
  const lights = shelf.locator('.fairy-light');
  await expect(lights).toHaveCount(7);
  const timings = await lights.evaluateAll(els => els.map(el => {
    const style = getComputedStyle(el);
    const frames = el.getAnimations()[0].effect!.getKeyframes();
    return { timing: [style.animationDuration, style.animationDelay].join('/'), pointer: style.pointerEvents,
      frames: frames.map(frame => Object.keys(frame).filter(key => !['offset', 'computedOffset', 'easing', 'composite'].includes(key))) };
  }));
  expect(new Set(timings.map(t => t.timing)).size).toBe(7);
  for (const timing of timings) {
    expect(timing.pointer).toBe('none');
    expect(timing.frames).toEqual([['opacity'], ['opacity']]);
  }
  // An underlying synthetic target, behind the actual production shelf.
  await stage.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const button = document.createElement('button');
    button.id = 'shelf-click-target';
    button.textContent = '0';
    button.style.cssText = `position:fixed;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;z-index:-1;pointer-events:auto`;
    button.onclick = () => { button.textContent = String(Number(button.textContent) + 1); };
    el.parentElement!.append(button);
    el.parentElement!.style.isolation = 'isolate';
  });
  const points = await lights.evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }));
  points.push([box.x + 120, box.y + 60]);
  for (const [x, y] of points) await page.mouse.click(x, y);
  await expect(page.locator('#shelf-click-target')).toHaveText('8');
  await page.locator('#shelf-click-target').evaluate(el => el.remove());
  for (const reducedMotion of ['reduce', 'no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    const styles = await lights.evaluateAll(els => els.map(el => ({ animation: getComputedStyle(el).animationName, opacity: getComputedStyle(el).opacity })));
    for (const style of styles) {
      if (reducedMotion === 'reduce') expect(style).toEqual({ animation: 'none', opacity: '0.5' });
      else expect(style.animation).not.toBe('none');
    }
  }
  expect(api).toEqual([]);
});

test('identity stays at the pre-change holly and theme-none positions at every boundary', async ({ page }, info) => {
  const api: string[] = [];
  await page.route('**/api/**', route => { api.push(route.request().url()); return route.abort(); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{width:1440,height:900}, {width:480,height:900}, {width:760,height:900}, {width:761,height:900}, {width:1440,height:640}, {width:1440,height:641}]) {
    await page.setViewportSize(viewport);
    await page.goto('/lab/scene.html?theme=christmas&clock=manual&shelf=holly');
    const legacy = page.locator('.rail > .christmas-shelf');
    await expect(legacy.locator('img')).toHaveCount(1);
    await expect(legacy.locator('img')).toHaveAttribute('src', /holly\.webp/);
    await expect(legacy.locator('img')).toHaveAttribute('width', '48');
    await expect(legacy.locator('img')).toHaveAttribute('height', '32');
    await legacy.locator('img').evaluate(async el => {
      if (!(el instanceof HTMLImageElement)) throw new Error('expected pre-change holly');
      await el.decode();
    });
    const baseline = await page.locator('.rail > .viewer-chip').boundingBox();
    expect(baseline).not.toBeNull();
    await page.goto('/lab/scene.html?theme=christmas&clock=manual');
    const rectangles = [];
    for (const theme of ['christmas', 'halloween', 'none']) {
      await page.locator('label', { hasText: /^theme/ }).locator('select').selectOption(theme);
      const decoration = page.locator('.rail > .theme-shelf');
      if (theme !== 'none') {
        if (viewport.width > 760 && viewport.height > 640) await expect(decoration).toBeVisible();
        else await expect(decoration).toBeHidden();
        expect(await decoration.evaluate(el => el.nextElementSibling!.classList.contains('viewer-chip'))).toBe(true);
      }
      rectangles.push(await page.locator('.rail > .viewer-chip').boundingBox());
    }
    const context = `${viewport.width}×${viewport.height}`;
    await info.attach(`identity-${viewport.width}x${viewport.height}.json`, {
      body: JSON.stringify({ viewport, holly: baseline, christmas: rectangles[0], halloween: rectangles[1], none: rectangles[2] }, null, 2),
      contentType: 'application/json',
    });
    expect(rectangles[0], `Christmas vs original holly at ${context}`).toEqual(baseline);
    expect(rectangles[0], `Christmas vs Halloween at ${context}`).toEqual(rectangles[1]);
    expect(rectangles[0], `Christmas vs theme-none at ${context}`).toEqual(rectangles[2]);
  }
  expect(api).toEqual([]);
});
