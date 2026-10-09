import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`shipped Christmas robin stays registered and click-through at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/logs?theme=christmas&theme-debug=1');
    await expect(page.locator('.robin')).toHaveCount(2);
    const bird = page.locator('[data-robin="0"]');
    await expect(bird).toBeVisible();
    await expect(bird.locator('[data-layered-robin]')).toHaveAttribute('data-flight-weight', '0');
    const rendered = await bird.evaluate(async el => {
      const rect = el.getBoundingClientRect(), svg = el.querySelector('svg')!;
      const floors = [...document.querySelectorAll('.geometry .floor')].map(f => Number(f.getAttribute('y1')));
      const urls = [...new Set([...svg.querySelectorAll('image')].map(part => part.getAttribute('href')!))];
      await Promise.all(urls.map(async src => { const img = new Image(); img.src = src; await img.decode(); }));
      return { width: rect.width, height: rect.height, floors, footY: rect.top + 35.735,
        viewBox: svg.getAttribute('viewBox'), catching: [...el.querySelectorAll('*')].filter(part => getComputedStyle(part).pointerEvents !== 'none').length };
    });
    expect(rendered.width).toBeCloseTo(44.8, 1); expect(rendered.height).toBeCloseTo(39.2, 1);
    expect(rendered.viewBox).toBe('0 0 128 112');
    expect(rendered.floors.some(y => Math.abs(y - rendered.footY) < .1)).toBe(true);
    expect(rendered.catching).toBe(0);
    await page.screenshot({ path: info.outputPath(`christmas-dashboard-${width}.png`) });
    await page.getByRole('link', { name: 'History', exact: true }).click();
    await expect(page).toHaveURL(/\/history/);
    await expect(page.locator('[data-christmas]')).toBeAttached();
    await expect(page.locator('[data-robin-atlas], .raised-wing')).toHaveCount(0);
    await page.goto('/?theme=none');
    await expect(page.locator('[data-christmas], .robin')).toHaveCount(0);
  });
}

test('a crowded mobile heading keeps snow without covering queue controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?theme=christmas');
  await expect(page.locator('[data-christmas]')).toBeAttached();
  await expect(page.locator('[data-snow]').first()).toBeAttached();
  await expect(page.locator('.robin')).toHaveCount(0);
});

test('live data updates preserve breathing and resting pecks in the shipped renderer', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { robinTime: 0 });
    performance.now = () => Reflect.get(window, 'robinTime');
    Math.random = () => .5;
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/logs?theme=christmas');
  await expect(page.locator('.robin')).toHaveCount(2);
  const rig = page.locator('[data-robin="0"] [data-layered-robin]');
  await expect(rig).toBeVisible();
  const advance = async (time: number) => {
    await page.evaluate(time => Reflect.set(window, 'robinTime', time), time);
    await rig.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const bodyTransform = () => rig.locator('[data-part="body"]').evaluate(el => el.closest('[data-slot]')!.getAttribute('transform'));
  await advance(1500);
  const before = await bodyTransform();
  await page.locator('main').evaluate(el => el.setAttribute('data-live-update', '1'));
  await expect.poll(bodyTransform).toBe(before);
  await advance(2500);
  const scale = (await bodyTransform())!.match(/scale\(([^ ]+)/)![1];
  expect(Number(scale)).toBeCloseTo(1.003, 4);
  // New log content changes measured obstacles but leaves the perch safe.
  await page.locator('.terminal').evaluate(el => { const p = document.createElement('p'); p.textContent = 'test log update'; el.append(p); });
  await advance(6000); await advance(6420);
  await expect(rig).toHaveAttribute('data-peck-weight', '1');
  await expect(rig).toHaveAttribute('data-head-angle', '82');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await advance(20000);
  await expect(rig).toHaveAttribute('data-peck-weight', '0');
  await expect(rig).toHaveAttribute('data-head-angle', '0');
});
