import { afterEach, expect, it, vi } from 'vitest';
import { sceneLoop } from './lifecycle';
import { createAtlasIdlePlayback } from './christmas/idle-playback';
import { createBird, type Scene } from './christmas/robin';
afterEach(() => vi.unstubAllGlobals());
it('keeps one loop through invalidation, reduced motion, backgrounding and teardown', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0, preference: () => void = () => {}, visibility: () => void = () => {};
  const removeMedia = vi.fn(), removeVisibility = vi.fn();
  const media = { matches: false, addEventListener: (_: string, f: () => void) => { preference = f; }, removeEventListener: removeMedia };
  const doc = { hidden: false, addEventListener: (_: string, f: () => void) => { visibility = f; }, removeEventListener: removeVisibility };
  vi.stubGlobal('matchMedia', () => media);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { frames.set(++id, f); return id; });
  vi.stubGlobal('cancelAnimationFrame', (i: number) => frames.delete(i));
  const draw = vi.fn(), reset = vi.fn();
  const loop = sceneLoop(draw, reset);
  const run = (now: number) => { const [i, f] = [...frames][0]; frames.delete(i); f(now); };
  loop.invalidate(); loop.invalidate();
  expect(frames.size).toBe(1);
  run(1); expect(frames.size).toBe(1);
  media.matches = true; preference(); preference();
  expect(frames.size).toBe(1);
  run(2); expect(draw).toHaveBeenLastCalledWith(2, true); expect(frames.size).toBe(0);
  doc.hidden = true; visibility(); loop.invalidate(); expect(frames.size).toBe(0);
  doc.hidden = false; visibility(); run(10000); expect(frames.size).toBe(0);
  media.matches = false; preference(); run(10001); expect(frames.size).toBe(1);
  const stale = [...frames.values()][0];
  loop.stop(); stale(10002); loop.invalidate();
  expect(frames.size).toBe(0);
  expect(reset).toHaveBeenCalledTimes(5);
  expect(removeMedia).toHaveBeenCalledOnce(); expect(removeVisibility).toHaveBeenCalledOnce();
});

it.each([false, true])('starts the idle epoch on the resumed sample (advance first: %s)', advanceFirst => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0, preference = () => {}, now = 50000, rendered = 'I0';
  const media = { matches: true, addEventListener: (_: string, f: () => void) => { preference = f; }, removeEventListener: () => {} };
  vi.stubGlobal('matchMedia', () => media);
  vi.stubGlobal('document', { hidden: false, addEventListener: () => {}, removeEventListener: () => {} });
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { callbacks.set(++id, f); return id; });
  vi.stubGlobal('cancelAnimationFrame', (i: number) => callbacks.delete(i));
  const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [], width: 800, height: 600 };
  const bird = createBird(scene, 0, () => .5), player = createAtlasIdlePlayback();
  const samples: { now: number; reduced: boolean; frame: string }[] = [];
  const loop = sceneLoop((_time, reduced) => {
    rendered = player.frame(bird, now, reduced);
    samples.push({ now, reduced, frame: rendered });
  }, player.reset);
  const draw = () => {
    const [key, callback] = [...callbacks][0];
    callbacks.delete(key); callback(now);
  };
  draw();
  media.matches = false; preference(); preference();
  expect(callbacks.size).toBe(1);
  // I0 is still visible before any resumed sample establishes an epoch.
  expect(rendered).toBe('I0');
  expect(samples).toEqual([{ now: 50000, reduced: true, frame: 'I0' }]);
  if (advanceFirst) now = 51600;
  draw();
  const epoch = now;
  expect(samples.at(-1)).toEqual({ now: epoch, reduced: false, frame: 'I0' });
  now = 51600; draw();
  expect(rendered).toBe(advanceFirst ? 'I0' : 'I1');
  // Elapsed production time and the injected clock obey the same boundaries.
  now = epoch + 1600; draw(); expect(rendered).toBe('I1');
  now = epoch + 4800; draw(); expect(rendered).toBe('I0');
  const stale = [...callbacks.values()][0];
  loop.stop(); stale(now + 1);
  expect(callbacks.size).toBe(0);
});
