import { expect, it } from 'vitest';
import { createPlayback } from './playback';
import { advanceBird, createBird, reconcileBird, type Bird, type Scene } from './robin';

const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [], width: 800, height: 600 };
const resting = (): Bird => createBird(scene, 0, () => .5);

it.each([[0, 4800], [.5, 6000], [1, 7200]])('keeps neutral variation boundaries in 4–8s for randomness %s', (random, boundary) => {
  const player = createPlayback(() => random), bird = resting();
  const start = 123.25;
  expect(player.frame(bird, start)).toBe('I0');
  expect(player.frame(bird, start + boundary - 1)).toBe('I1');
  expect(player.frame(bird, start + boundary)).toBe('I0');
  expect(player.frame(bird, start + boundary + 60)).toBe('B1');
  expect(boundary).toBeGreaterThanOrEqual(4000);
  expect(boundary).toBeLessThanOrEqual(8000);
  expect(boundary % 1200).toBe(0);
});

it('alternates blink and tilt at neutral boundaries after uninterrupted rest', () => {
  const player = createPlayback(() => 0), bird = resting();
  expect(player.frame(bird, 0)).toBe('I0');
  expect(player.frame(bird, 4000)).toBe('I2');
  expect(player.frame(bird, 4800)).toBe('I0');
  expect(player.frame(bird, 4860)).toBe('B1');
  expect(player.frame(bird, 4900)).toBe('B2');
  expect(player.frame(bird, 5100)).toBe('I0');
  expect(player.frame(bird, 9900)).toBe('I0');
  expect(player.frame(bird, 10000)).toBe('T1');
  expect(player.frame(bird, 10120)).toBe('T2');
  expect(player.frame(bird, 10520)).toBe('I0');
});

it('holds alert without restarting on repeated interactions or facing reversal', () => {
  const player = createPlayback(() => 0), bird = resting();
  player.frame(bird, 0);
  const alert = { ...bird, alert: true };
  expect(player.frame(alert, 100)).toBe('I0');
  expect(player.frame({ ...alert }, 140)).toBe('A1');
  expect(player.frame({ ...alert, perch: { ...alert.perch!, dir: -1 } }, 200)).toBe('A2');
  expect(player.frame(alert, 380)).toBe('A3');
  expect(player.frame(alert, 10000)).toBe('A3');
  expect(player.frame(bird, 10001)).toBe('A3');
  expect(player.frame(bird, 10061)).toBe('A2');
  expect(player.frame(alert, 10062)).toBe('I0');
  expect(player.frame(alert, 10342)).toBe('A3');
  expect(player.frame(bird, 10343)).toBe('A3');
  expect(player.frame(bird, 10583)).toBe('I0');
});

it('movement preempts cosmetics and alert immediately, completing at route deadline', () => {
  for (const kind of ['hop', 'flight'] as const) {
    const player = createPlayback(() => 0), bird = resting();
    player.frame({ ...bird, alert: true }, 0);
    const moving = { ...bird, action: { from: { x: 124, y: 200 }, to: { x: 149, y: 200 }, target: bird.perch!, start: 100, duration: 451, rise: 8, kind } };
    expect(player.frame(moving, 100)).toBe('I0');
    expect(player.frame(moving, 151)).toBe(kind === 'hop' ? 'H1' : 'F2');
    expect(player.frame(moving, 551)).toBe('I0');
    expect(player.frame(moving, 1e6)).toBe('I0');
    // A stale action sample cannot resurrect a completed one-shot.
    expect(player.frame(moving, 1e6 + 1)).toBe('I0');
    expect(player.frame(bird, 1e6 + 2)).toBe('I0');
    expect(player.frame(bird, 1e6 + 202)).toBe('I1');
  }
  const player = createPlayback(() => 0), bird = resting();
  player.frame(bird, 0); expect(player.frame(bird, 4900)).toBe('B2');
  expect(player.frame({ ...bird, alert: true }, 4901)).toBe('I0');
});

it('clears epochs for reconciliation, hidden geometry, preference changes and teardown', () => {
  const player = createPlayback(() => 0), bird = resting();
  for (const interrupt of ['reset', 'geometry', 'reduced'] as const) {
    player.reset(); player.frame(bird, 0); player.frame({ ...bird, alert: true }, 100);
    if (interrupt === 'reset') player.reset();
    if (interrupt === 'geometry') expect(player.frame({ ...bird, perch: null }, 500)).toBe('I0');
    if (interrupt === 'reduced') {
      for (const time of [500, 550, 10000]) expect(player.frame({ ...bird, alert: true }, time, true)).toBe('I0');
    }
    expect(player.frame(bird, 11000)).toBe('I0');
    expect(player.frame(bird, 11200)).toBe('I1');
  }
  expect(player.frame(bird, 0)).toBe('I0'); // clock rewind starts a fresh epoch
  expect(() => player.frame(bird, NaN)).toThrow();
});

it('skips missed variations rather than replaying them after a large clock jump', () => {
  const player = createPlayback(() => 0), bird = resting();
  player.frame(bird, 0);
  expect(player.frame(bird, 1e6)).toBe('I0');
  expect(player.frame(bird, 1e6 + 200)).toBe('I1');
});

it('never changes movement results or movement RNG consumption under different cosmetic streams', () => {
  const run = (cosmetic: number) => {
    let calls = 0;
    const random = () => { calls++; return .5; };
    const player = createPlayback(() => cosmetic);
    let bird = createBird(scene, 0, random);
    const states = [];
    for (const time of [0, 200, 4800, 4900, 5100, 9000, 9100, 9270, 18000, 18270]) {
      bird = advanceBird(bird, scene, time, random);
      player.frame(bird, time); states.push(bird);
    }
    bird = reconcileBird(bird, scene, 19000, random); player.reset();
    states.push(bird);
    return { calls, states };
  };
  expect(run(0)).toEqual(run(1));
});
