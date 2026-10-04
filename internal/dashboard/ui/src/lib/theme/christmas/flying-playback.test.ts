import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { atlasFlyingAvailable, atlasIdleAvailable, validateAtlasIdleManifest } from './manifest';
import { flyingFrame, flyingLoopFrame } from './flying-playback';
import { advanceBird, createBird, type Scene } from './robin';

const raw = readFileSync(new URL('./robin-atlas/manifest.json', import.meta.url), 'utf8');
const fixture = () => {
  const manifest = JSON.parse(raw);
  manifest.rows.flying = { ...manifest.rows.flying, available: true, acceptance: 'accepted', joins: 'accepted' };
  return manifest;
};
const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [], width: 800, height: 600 };
const moving = (duration: number) => {
  const bird = createBird(scene, 0, () => .5);
  return { ...bird, action: { start: 1000, duration, kind: 'flight' as const, from: { x: 124, y: 200 }, to: { x: 400, y: 200 }, rise: 24, target: { ...bird.perch!, x: 300 } } };
};

it('retains accepted idle and gates the candidate on loop AND join acceptance', () => {
  const shipped = validateAtlasIdleManifest(JSON.parse(raw));
  expect(atlasIdleAvailable(shipped)).toBe(true);
  expect(atlasFlyingAvailable(shipped)).toBe(false);
  const manifest = validateAtlasIdleManifest(fixture());
  expect(atlasFlyingAvailable(manifest)).toBe(true);
  expect(manifest.clips.flap.durations.reduce((a, b) => a + b, 0)).toBe(200);
  expect(manifest.frames.W0).toMatchObject({ x: 0, y: 0, width: 142, height: 134 });
  expect(manifest.frames.W3).toMatchObject({ x: 426, y: 0 });
  const disabled = fixture(); disabled.rows.flying.available = false; disabled.rows.flying.joins = 'pending';
  expect(atlasFlyingAvailable(validateAtlasIdleManifest(disabled))).toBe(false);
  for (const change of [
    (m: ReturnType<typeof fixture>) => { m.rows.flying.joins = 'pending'; },
    (m: ReturnType<typeof fixture>) => { m.rows.flying.acceptance = 'pending'; },
    (m: ReturnType<typeof fixture>) => { m.rows.flying.count = 3; },
    (m: ReturnType<typeof fixture>) => { m.frames.W3.y = 224; },
    (m: ReturnType<typeof fixture>) => { m.clips.flap.durations[0] = 51; },
    (m: ReturnType<typeof fixture>) => { m.clips.flap.frames[3] = 'W0'; },
    (m: ReturnType<typeof fixture>) => { m.rows.landing.available = true; m.rows.landing.acceptance = 'accepted'; },
  ]) { const value = fixture(); change(value); expect(() => validateAtlasIdleManifest(value)).toThrow(); }
  const old = fixture();
  old.rows.flying = { row: 1, count: 0, available: false, acceptance: 'pending' };
  for (const id of ['W0', 'W1', 'W2', 'W3']) delete old.frames[id];
  delete old.clips.flap;
  expect(atlasIdleAvailable(validateAtlasIdleManifest(old))).toBe(true);
});

it.each([4, 5, 6, 8])('plays %i distinct cells in exactly 200ms without a closing duplicate', count => {
  for (let i = 0; i < count; i++) {
    expect(flyingLoopFrame(count, i * 200 / count + 1e-8)).toBe(`W${i}`);
    expect(flyingLoopFrame(count, (i + 1) * 200 / count - 1e-8)).toBe(`W${i}`);
  }
  expect(flyingLoopFrame(count, 200)).toBe('W0');
  expect(flyingLoopFrame(count, 400)).toBe('W0');
  expect(flyingLoopFrame(count, count * 140, count * 140)).toBe('W0');
});

it.each([450, 750, 451.123])('fits complete middle cycles into D=%s and preserves deadlines', duration => {
  const bird = moving(duration), original = structuredClone(bird);
  const start = 1000 + .2 * duration, end = 1000 + .8 * duration;
  const cycles = Math.max(1, Math.round(.6 * duration / 200)), cellDuration = .6 * duration / (4 * cycles);
  expect(flyingFrame(bird, start - 1e-8, 4)).toBeNull();
  for (let i = 0; i < 4 * cycles; i++) {
    expect(flyingFrame(bird, start + (i + .5) * cellDuration, 4)).toBe(`W${i % 4}`);
  }
  expect(flyingFrame(bird, end - 1e-8, 4)).toBe('W3');
  expect(flyingFrame(bird, end, 4)).toBeNull();
  expect(flyingFrame(bird, 1000 + duration, 4)).toBeNull();
  expect(flyingFrame(bird, start + .5 * cellDuration, 4)).toBe('W0'); // backwards clock, no stale epoch
  expect(bird).toEqual(original);
  expect(advanceBird(bird, scene, 1000 + duration - 1e-8, () => .5).action).toEqual(bird.action);
  expect(advanceBird(bird, scene, 1000 + duration, () => .5).action).toBeNull();
});

it('preempts for interruption, reduced motion, missing geometry, hop and a skipped deadline', () => {
  const bird = moving(450);
  expect(flyingFrame(bird, 1120, 4, true)).toBeNull();
  expect(flyingFrame({ ...bird, action: null }, 1120, 4)).toBeNull();
  expect(flyingFrame({ ...bird, perch: null }, 1120, 4)).toBeNull();
  expect(flyingFrame({ ...bird, action: { ...bird.action, kind: 'hop' } }, 1120, 4)).toBeNull();
  expect(flyingFrame(bird, 100000, 4)).toBeNull();
  expect(() => flyingFrame(bird, NaN, 4)).toThrow();
  expect(() => flyingLoopFrame(3, 0)).toThrow();
});
