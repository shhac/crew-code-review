import { expect, test } from '@playwright/test';

test('Vite timing diagnostic selects exact wrap and route-deadline boundaries without API calls', async ({ page }) => {
  let apiCalls = 0;
  await page.route('**/api/**', route => { apiCalls++; return route.abort(); });
  await page.goto('/lab/robin-timing.html');
  const elapsed = page.getByLabel('Elapsed (ms)');
  await elapsed.fill('1199'); await expect(page.locator('[data-timing-frame]')).toHaveText('I1');
  await elapsed.fill('1200'); await expect(page.locator('[data-timing-frame]')).toHaveText('I0');
  await page.getByLabel('Clip', { exact: true }).selectOption('flight');
  await elapsed.fill('451');
  await expect(page.locator('[data-timing-frame]')).toHaveText('I0');
  await expect(page.locator('[data-timing-complete]')).toHaveText('complete');
  await page.getByRole('button', { name: 'Sample', exact: true }).click();
  await page.getByLabel('Alert', { exact: true }).check();
  await page.getByLabel('Clock (ms)').fill('100');
  await page.getByRole('button', { name: 'Sample', exact: true }).click();
  await page.getByLabel('Clock (ms)').fill('140');
  await page.getByRole('button', { name: 'Sample', exact: true }).click();
  await expect(page.locator('[data-controller-frame]')).toHaveText('A1');
  await page.getByLabel('Reduced motion').check();
  await page.getByRole('button', { name: 'Sample', exact: true }).click();
  await expect(page.locator('[data-controller-frame]')).toHaveText('I0');
  expect(apiCalls).toBe(0);
});
