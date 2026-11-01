import { expect, test, type Request } from '@playwright/test';

test('shipped dashboard keeps robin memory bounded across animation and navigation', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.assign(window, { robinTime: 0 });
    performance.now = () => Reflect.get(window, 'robinTime');
    Math.random = () => .5;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/logs?theme=christmas');
  await expect(page.locator('.robin')).toHaveCount(2);
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  // A page left while its fetch is still out stays reachable from that fetch's
  // continuation until the response lands, and no collection frees it before
  // then. Ten quick navigations queue ten fetches behind one store, so under
  // load a measurement taken at once counted hundreds of nodes that were
  // freed a second later, and grew batch by batch as the backlog did.
  const inFlight = new Set<Request>();
  page.on('request', request => inFlight.add(request));
  page.on('requestfinished', request => inFlight.delete(request));
  page.on('requestfailed', request => inFlight.delete(request));
  const memory = async () => {
    await expect.poll(() => inFlight.size, { timeout: 30000 }).toBe(0);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve)));
    await session.send('HeapProfiler.collectGarbage');
    const { metrics } = await session.send('Performance.getMetrics');
    return { heap: metrics.find(m => m.name === 'JSHeapUsedSize')!.value, ...await session.send('Memory.getDOMCounters') };
  };
  const soak = async (frames: number) => {
    await page.evaluate(async frames => {
      for (let frame = 0; frame < frames; frame++) {
        Reflect.set(window, 'robinTime', Reflect.get(window, 'robinTime') + 200);
        await new Promise(requestAnimationFrame);
      }
    }, frames);
  };
  await soak(600);
  const before = await memory();
  await soak(3600); // Twelve simulated minutes, including real dashboard polls.
  const afterAnimation = await memory();
  // Warm both route renderers, then compare two identical navigation batches.
  const navigate = async () => {
    for (let i = 0; i < 10; i++) {
      await page.getByRole('link', { name: 'History', exact: true }).click();
      await expect(page.locator('h1')).toHaveText('Review history');
      await page.getByRole('link', { name: 'Logs', exact: true }).click();
      await expect(page.locator('h1')).toHaveText('Server logs');
      await expect(page.locator('.robin')).toHaveCount(2);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
  };
  await navigate();
  const beforeNavigation = await memory();
  await navigate();
  const afterNavigation = await memory();
  await navigate();
  const afterMoreNavigation = await memory();
  const measurements = { before, afterAnimation, beforeNavigation, afterNavigation, afterMoreNavigation };
  console.log('shipped robin memory', JSON.stringify(measurements));
  await info.attach('dashboard-robin-memory.json', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
  for (const [start, end] of [[before, afterAnimation], [beforeNavigation, afterNavigation], [afterNavigation, afterMoreNavigation]]) {
    expect(end.heap - start.heap).toBeLessThan(2 * 1024 * 1024);
    expect(end.documents).toBe(start.documents);
    expect(end.nodes - start.nodes).toBeLessThan(100);
    expect(end.jsEventListeners - start.jsEventListeners).toBeLessThan(10);
  }
  await session.detach();
});
