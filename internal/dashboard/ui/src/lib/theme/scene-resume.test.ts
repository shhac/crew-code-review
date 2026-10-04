import { afterEach, expect, it, vi } from 'vitest';
import { setSceneReducedMotion } from '../../../lab-tests/scene-resume';

afterEach(() => vi.unstubAllGlobals());

it.each([false, true])('does not finish a preference change before its draw is processed (reduced: %s)', async reduced => {
  let changed = () => {};
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('window', {});
  vi.stubGlobal('matchMedia', () => ({ matches: !reduced, addEventListener: (_: string, callback: () => void) => { changed = callback; } }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  let finished = false;
  const resume = setSceneReducedMotion({
    // Execute Playwright's browser functions in the controlled test environment.
    evaluate: vi.fn(async (callback, argument) => callback(argument)),
    emulateMedia: vi.fn(async () => changed()),
  }, reduced).then(() => { finished = true; });
  // Flush promises, not animation frames: the old I0 assertion could pass here.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(finished).toBe(false);
  expect(frames).toHaveLength(1);
  frames.shift()!(0);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(finished).toBe(false);
  frames.shift()!(16);
  await resume;
  expect(finished).toBe(true);
});
