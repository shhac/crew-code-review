import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('robin animation and repeated mounts keep retained memory and DOM bounded', async ({ page, browser }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/lab/scene.html?theme=christmas&clock=manual');
  const session = await page.context().newCDPSession(page);
  const browserSession = await browser.newBrowserCDPSession();
  await session.send('Performance.enable');
  const memory = async () => {
    await session.send('HeapProfiler.collectGarbage');
    const { metrics } = await session.send('Performance.getMetrics');
    const dom = await session.send('Memory.getDOMCounters');
    const { processInfo } = await browserSession.send('SystemInfo.getProcessInfo');
    const pids = processInfo.map(p => p.id).join(',');
    const rss = execFileSync('ps', ['-p', pids, '-o', 'rss='], { encoding: 'utf8' }).trim().split(/\s+/).reduce((sum, value) => sum + Number(value), 0) * 1024;
    return { heap: metrics.find(m => m.name === 'JSHeapUsedSize')!.value,
      tasks: metrics.find(m => m.name === 'TaskDuration')!.value, ...dom, rss };
  };
  const theme = page.locator('label', { hasText: /^theme/ }).locator('select');
  const soak = async (frames: number) => {
    await page.evaluate(async frames => {
      const input = document.querySelector<HTMLInputElement>('input[type="number"][min="0"]');
      if (!input) throw new Error('missing lab clock');
      let time = Number(input.value);
      for (let frame = 0; frame < frames; frame++) {
        time += 200;
        input.value = String(time);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(requestAnimationFrame);
      }
    }, frames);
  };
  await soak(600); // Warm all wing profiles, image decoding and component branches.
  const activeBefore = await memory();
  await soak(1800); // Eight simulated minutes in one sustained animation session.
  const activeAfter = await memory();
  console.log('robin active memory', JSON.stringify({ activeBefore, activeAfter }));
  await info.attach('robin-active-memory.json', { body: JSON.stringify({ activeBefore, activeAfter }, null, 2), contentType: 'application/json' });
  expect(activeAfter.heap - activeBefore.heap).toBeLessThan(2 * 1024 * 1024);
  expect(activeAfter.nodes - activeBefore.nodes).toBeLessThan(100);
  expect(activeAfter.jsEventListeners - activeBefore.jsEventListeners).toBeLessThan(20);
  expect(activeAfter.rss - activeBefore.rss).toBeLessThan(64 * 1024 * 1024);
  // Warm both theme renderers before measuring repeated mounts.
  for (let i = 0; i < 5; i++) {
    await theme.selectOption('none');
    await theme.selectOption('christmas');
  }
  await theme.selectOption('none');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const unmountedBefore = await memory();
  for (let i = 0; i < 30; i++) {
    await theme.selectOption('none');
    await theme.selectOption('christmas');
  }
  await theme.selectOption('none');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const unmountedAfter = await memory();
  console.log('robin unmounted memory', JSON.stringify({ unmountedBefore, unmountedAfter }));
  await info.attach('robin-unmounted-memory.json', { body: JSON.stringify({ unmountedBefore, unmountedAfter }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
  expect(unmountedAfter.documents).toBe(unmountedBefore.documents);
  expect(unmountedAfter.nodes - unmountedBefore.nodes).toBeLessThan(10);
  expect(unmountedAfter.jsEventListeners - unmountedBefore.jsEventListeners).toBeLessThan(10);
  expect(unmountedAfter.heap - unmountedBefore.heap).toBeLessThan(2 * 1024 * 1024);
  expect(unmountedAfter.rss - unmountedBefore.rss).toBeLessThan(64 * 1024 * 1024);
  await session.detach(); await browserSession.detach();
});
