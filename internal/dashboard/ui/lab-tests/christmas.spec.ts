import { expect, test } from '@playwright/test';

for (const width of [1440, 480]) {
  test(`still Christmas at ${width}px`, async ({ page }, info) => {
    const api: string[] = [];
    await page.route('**/api/**', (route) => { api.push(route.request().url()); return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lab/scene.html?theme=christmas');
    await expect(page.locator('[data-christmas]')).toHaveCount(1);
    await expect(page.locator('.robin')).toHaveCount(1);
    await expect(page.locator('.christmas-shelf img')).toHaveCount(1);
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
    expect(await page.locator('.robin').evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(44.8, 1);
    await page.getByRole('button', { name: 'Click through 0' }).first().click();
    await expect(page.getByRole('button', { name: 'Click through 1' }).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath(`christmas-${width}.png`) });
    const before = await page.locator('.robin').boundingBox();
    await page.evaluate(() => window.scrollTo(0, 50));
    await expect.poll(async () => (await page.locator('.robin').boundingBox())?.y).toBeCloseTo((before?.y ?? 0) - 50, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.robin')).toHaveCount(1);
    await page.setViewportSize({ width: width + 40, height: 900 });
    await expect(page.locator('.robin')).toHaveCount(1);
    for (let i = 0; i < 3; i++) {
      await page.getByLabel('theme', { exact: true }).selectOption('none');
      await expect(page.locator('[data-christmas]')).toHaveCount(0);
      await page.getByLabel('theme', { exact: true }).selectOption('christmas');
      await expect(page.locator('.robin')).toHaveCount(1);
    }
    await page.getByLabel('empty', { exact: true }).check();
    await expect(page.locator('.robin')).toHaveCount(0);
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
    await page.getByLabel('theme', { exact: true }).selectOption('none');
    await expect(shelf).toHaveCount(0);
    await expect(identity).toBeVisible();
    expect(api).toEqual([]);
  });
}
