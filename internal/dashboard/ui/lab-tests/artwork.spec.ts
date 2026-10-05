import { expect, test, type Page } from '@playwright/test';

async function decodeParts(page: Page) {
  return page.locator('[data-layered-robin] image').evaluateAll(async elements => {
    const urls = [...new Set(elements.map(el => el.getAttribute('href')!))];
    return Promise.all(urls.map(async src => {
      const image = new Image(); image.src = src; await image.decode();
      return { src, width: image.naturalWidth, height: image.naturalHeight };
    }));
  });
}
for (const width of [1440, 480]) {
  test(`layered artwork, registration and seasonal comparison at ${width}px`, async ({ page }, info) => {
    const api: string[] = [];
    await page.route('**/api/**', route => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lab/artwork.html');
    await expect(page.locator('[data-layered-robin]').first()).toBeVisible();
    const decoded = await decodeParts(page);
    expect(decoded.length).toBeGreaterThan(12);
    for (const image of decoded) {
      expect(image.src).toContain('/robin-parts/');
      expect(image.width).toBeGreaterThan(0); expect(image.height).toBeGreaterThan(0);
    }
    for (const pose of ['perch', 'alert', 'flight']) {
      for (const direction of [1, -1]) {
        for (const elapsed of pose === 'flight' ? [0, 150, 300] : [0]) {
          const bird = page.locator(`[data-art-pose="${pose}"][data-direction="${direction}"][data-elapsed="${elapsed}"][data-zoom="1"]`).first();
          const rendered = await bird.evaluate(el => {
            const facing = el.querySelector('.facing')!, svg = el.querySelector('svg')!;
            const rect = svg.getBoundingClientRect();
            return { width: rect.width, height: rect.height, viewBox: svg.getAttribute('viewBox'),
              mirror: getComputedStyle(facing).transform, foot: getComputedStyle(facing).transformOrigin,
              flight: svg.getAttribute('data-flight-weight'),
              parts: [...el.querySelectorAll('[data-part]')].map(part => part.getAttribute('data-part')) };
          });
          expect(rendered.width).toBeCloseTo(44.8, 1);
          expect(rendered.height).toBeCloseTo(39.2, 1);
          expect(rendered.viewBox).toBe('0 0 128 112');
          expect(rendered.foot).toBe('22.4px 35.735px');
          expect(rendered.mirror).toBe(`matrix(${direction}, 0, 0, 1, 0, 0)`);
          expect(rendered.parts).toContain('body'); expect(rendered.parts).toContain('tail');
          expect(rendered.flight).toBe(pose === 'flight' ? '1' : '0');
          if (pose === 'flight') {
            expect(rendered.parts).toContain('leg-near-tucked');
            expect(rendered.parts).toContain('wing-shoulder');
            expect(rendered.parts).not.toContain('wing');
          }
        }
      }
    }
    await page.screenshot({ path: info.outputPath(`artwork-${width}.png`), fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const theme of ['halloween', 'christmas']) {
      await page.goto(`/lab/scene.html?theme=${theme}&clock=manual`);
      await expect(page.locator('.theme-shelf')).toHaveCount(1);
      if (width > 760) await expect(page.locator('.theme-shelf')).toBeVisible();
      else await expect(page.locator('.theme-shelf')).toBeHidden();
      await page.locator('.controls').evaluate(el => { if (el instanceof HTMLElement) el.style.visibility = 'hidden'; });
      if (theme === 'christmas') {
        await expect(page.locator('[data-robin="0"] [data-layered-robin]')).toHaveAttribute('data-flight-weight', '0');
        await decodeParts(page);
      }
      await page.screenshot({ path: info.outputPath(`${theme}-comparison-${width}.png`) });
    }
    expect(api).toEqual([]);
  });
}
