import { expect, it } from 'vitest';
import { createIdlePlayback, cosmeticStream } from './idle-playback';
import { advanceBird, createBird, reconcileBird, type Scene } from './robin';
import { idleClips } from './idle-inventory';

const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [], width: 800, height: 600 };
const bird = () => createBird(scene, 0, () => .5);

it('uses shipped manifest timing for one period, an ordinary wrap and a complete blink', () => {
  const player = createIdlePlayback(() => 0, idleClips()), resting = bird();
  for (const [now, frame] of [[0, 'I0'], [199, 'I0'], [200, 'I1'], [400, 'I2'], [600, 'I3'], [800, 'I2'], [1000, 'I1'], [1199, 'I1'], [1200, 'I0'], [1400, 'I1'], [4800, 'I0'], [4860, 'B1'], [4900, 'B2'], [4970, 'B1'], [5010, 'I0'], [5100, 'I0'], [5300, 'I1'], [9900, 'I0'], [9960, 'B1']] as const) {
    expect(player.frame(resting, now)).toBe(frame);
  }
});

it.each([[0, 4800], [1, 7200]])('starts blinks within 4–8 seconds, random=%s', (random, boundary) => {
  const player = createIdlePlayback(() => random), resting = bird();
  player.frame(resting, 0);
  expect(player.frame(resting, boundary + 60)).toBe('B1');
});

it('immediately preempts blinks for alert, movement, reduced motion and missing geometry', () => {
  const resting = bird();
  const moving = { ...resting, action: { from: { x: 124, y: 200 }, to: { x: 149, y: 200 }, target: resting.perch!, start: 4901, duration: 270, rise: 8, kind: 'hop' as const } };
  for (const changed of [{ ...resting, alert: true }, moving, { ...resting, perch: null }]) {
    const player = createIdlePlayback(() => 0);
    player.frame(resting, 0); expect(player.frame(resting, 4900)).toBe('B2');
    expect(player.frame(changed, 4901)).toBe('I0');
    expect(player.frame(resting, 5100)).toBe('I0');
    expect(player.frame(resting, 5300)).toBe('I1');
  }
  const player = createIdlePlayback(() => 0);
  player.frame(resting, 0); player.frame(resting, 4900);
  for (const now of [4901, 10000, 1e6]) expect(player.frame(resting, now, true)).toBe('I0');
  expect(player.frame(resting, 1e6 + 1)).toBe('I0');
});

it('never replays missed blinks or stale epochs after reset, clock rewind or reconciliation', () => {
  const resting = bird(), player = createIdlePlayback(() => 0);
  player.frame(resting, 0);
  expect(player.frame(resting, 100000)).toBe('I0');
  expect(player.frame(resting, 100200)).toBe('I1');
  player.reset();
  const reconciled = reconcileBird(resting, scene, 200000, () => .5);
  expect(player.frame(reconciled, 200000)).toBe('I0');
  expect(player.frame(reconciled, 200200)).toBe('I1');
  expect(player.frame(reconciled, 0)).toBe('I0');
});

it('cosmetic streams cannot change routes, movement RNG consumption or facing', () => {
  const run = (seed: number) => {
    let calls = 0;
    const movement = () => { calls++; return .5; };
    const player = createIdlePlayback(cosmeticStream(seed));
    let current = createBird(scene, 0, movement);
    const states = [];
    for (const now of [0, 200, 4800, 4900, 5100, 9000, 9100, 9270, 18000, 18270]) {
      current = advanceBird(current, scene, now, movement); player.frame(current, now); states.push(current);
    }
    return { calls, states };
  };
  expect(run(1)).toEqual(run(99999));
});
