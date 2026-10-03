import { expect, test } from '@playwright/test';

for (const width of [1440, 480]) {
  test(`raster cells, layers and seasonal comparison at ${width}px`, async ({ page }, info) => {
    const api: string[] = [];
    await page.route('**/api/**', route => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lab/artwork.html');
    const decoded = await page.locator('img').evaluateAll(async images => Promise.all(images.map(async image => {
      if (!(image instanceof HTMLImageElement)) throw new Error('expected image');
      await image.decode();
      return { src: image.src, w: image.naturalWidth, h: image.naturalHeight };
    })));
    for (const image of decoded) {
      expect(image.src).toContain('.webp');
      if (/robin-/.test(image.src)) expect([image.w, image.h]).toEqual([128, 112]);
      if (/holly/.test(image.src)) expect([image.w, image.h]).toEqual([96, 64]);
      if (/\/tree\./.test(image.src)) expect([image.w, image.h]).toEqual([176, 166]);
      if (/\/presents\./.test(image.src)) expect([image.w, image.h]).toEqual([248, 132]);
    }
    for (const pose of ['perch', 'alert', 'flight']) {
      for (const direction of [1, -1]) {
        for (const angle of pose === 'flight' ? [-5, 0, 5] : [0]) {
          const bird = page.locator(`[data-art-pose="${pose}"][data-direction="${direction}"][data-angle="${angle}"][data-zoom="1"]`).first();
          const rendered = await bird.evaluate(el => {
            const stage = el.querySelector('.art-cell');
            const facing = el.querySelector('.facing');
            const body = el.querySelector('.bird-body');
            const wing = el.querySelector('.raised-wing');
            if (!stage || !body || !facing) throw new Error('missing native stage/body/mirror');
            const rect = el.getBoundingClientRect();
            return {
              width: rect.width, height: rect.height,
              scale: getComputedStyle(stage).transform,
              stageOrigin: getComputedStyle(stage).transformOrigin,
              mirror: getComputedStyle(facing).transform,
              foot: getComputedStyle(facing).transformOrigin,
              bodyTransform: getComputedStyle(body).transform,
              source: body.getAttribute('src'),
              images: el.querySelectorAll('img').length,
              wing: wing ? { origin: getComputedStyle(wing).transformOrigin,
                matrix: getComputedStyle(wing).transform, source: wing.getAttribute('src') } : null,
            };
          });
          expect(rendered.width).toBeCloseTo(44.8, 1);
          expect(rendered.height).toBeCloseTo(39.2, 1);
          expect(rendered.scale).toBe('matrix(0.35, 0, 0, 0.35, 0, 0)');
          expect(rendered.stageOrigin).toBe('0px 0px');
          expect(rendered.foot).toBe('22.4px 35px');
          expect(rendered.mirror).toBe(`matrix(${direction}, 0, 0, 1, 0, 0)`);
          expect(rendered.bodyTransform).toBe('none');
          expect(rendered.source).toContain(`robin-${pose}.webp`);
          expect(rendered.images).toBe(pose === 'flight' ? 2 : 1);
          if (pose === 'flight') {
            expect(rendered.wing?.origin).toBe('64px 57px');
            expect(rendered.wing?.source).toContain('robin-flight-wing.webp');
            const matrix = rendered.wing?.matrix.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number);
            expect(matrix).toBeDefined();
            expect(Math.atan2(matrix![1], matrix![0]) * 180 / Math.PI).toBeCloseTo(angle, 3);
          }
        }
      }
    }
    const holly = await page.locator('.holly').first().boundingBox();
    expect(holly?.width).toBe(48);
    expect(holly?.height).toBe(32);
    await page.screenshot({ path: info.outputPath(`artwork-${width}.png`), fullPage: true });
    // Match scene windows and capture real responsive shelves separately from
    // the isolated art fixture. The existing Christmas suite tests interaction.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const theme of ['halloween', 'christmas']) {
      await page.goto(`/lab/scene.html?theme=${theme}&clock=manual`);
      await expect(page.locator('.theme-shelf')).toHaveCount(1);
      if (width > 760) await expect(page.locator('.theme-shelf')).toBeVisible();
      else await expect(page.locator('.theme-shelf')).toBeHidden();
      await page.locator('.controls').evaluate(el => { if (el instanceof HTMLElement) el.style.visibility = 'hidden'; });
      if (theme === 'christmas') {
        const body = page.locator('.robin .bird-body');
        await expect(body).toHaveAttribute('src', /robin-perch\.webp/);
        await body.evaluate(async el => { if (el instanceof HTMLImageElement) await el.decode(); });
      }
      await page.screenshot({ path: info.outputPath(`${theme}-comparison-${width}.png`) });
    }
    expect(api).toEqual([]);
  });
}
