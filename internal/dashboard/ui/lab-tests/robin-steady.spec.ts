import { expect, test, type Page } from '@playwright/test';

// A robin playing mounts no drawing and swaps no picture: an image mounted
// or re-pointed mid-play paints nothing, or its old picture in its new
// place, until the file arrives, which flickers wherever it is not cached
// (the lab's dev server tells the browser to ask again every time).

const robin = (page: Page) => page.locator('[data-stage] [data-layered-robin]');
const frameShown = async (page: Page) => Number(await page.locator('output[data-frame]').getAttribute('data-frame'));

async function watch(page: Page) {
  await robin(page).evaluate((svg) => {
    const changes: string[] = [];
    Reflect.set(window, 'robinChanges', changes);
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList') changes.push(`${record.addedNodes.length} added, ${record.removedNodes.length} removed`);
        else if (record.target instanceof Element && record.attributeName) changes.push(`${record.attributeName} ${record.oldValue} to ${record.target.getAttribute(record.attributeName)}`);
      }
    }).observe(svg, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'data-part'], attributeOldValue: true });
  });
}
const changes = (page: Page) => page.evaluate(() => Reflect.get(window, 'robinChanges'));

for (const { mode, from, through } of [
  // A blink's first and last frames (259 and 266), where the eyelid comes and goes.
  { mode: 'alive', from: 250, through: 270 },
  // Every wing drawing hands over to the next, twice round.
  { mode: 'flight', from: 0, through: 80 },
]) {
  test(`the robin's drawings stay mounted and keep their pictures while it plays (${mode})`, async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort());
    await page.goto(`/lab/critters.html#animal=robin&mode=${mode}&frame=${from}`);
    await expect(robin(page).locator('image:not([visibility])').first()).toBeAttached();
    await watch(page);
    await page.getByRole('button', { name: 'play', exact: true }).click();
    await expect.poll(() => frameShown(page), { timeout: 10_000 }).toBeGreaterThan(through);
    await page.getByRole('button', { name: 'pause', exact: true }).click();
    expect(await changes(page)).toEqual([]);
  });
}
