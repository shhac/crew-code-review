import { expect, it } from 'vitest';
import { createRobinPlayback } from './robin-playback';
import { createBird, type Bird, type Scene } from './robin';
import { mixPartsPose, partsLayers, partsPose, partsTransforms } from './parts-pose';

const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [], width: 800, height: 600 };
const bird = () => createBird(scene, 0, () => .5);
const moving = (kind: 'hop' | 'flight', duration: number): Bird => ({ ...bird(), action: {
  kind, duration, start: 1000, rise: 24, from: { x: 130, y: 200 }, to: { x: 465, y: 200 },
  target: { floor: 1, x: 365, dir: 1 },
} });

it('starts a fresh neutral epoch after visibility, layout, clock reversal or reduced motion', () => {
  const player = createRobinPlayback(), b = bird();
  expect(player.pose(b, 50000).breathing).toBe(0);
  expect(player.pose(b, 51600).breathing).toBeGreaterThan(.9);
  for (const interruption of [() => player.reset(), () => player.pose(b, 80000, true), () => player.pose({ ...b, perch: null }, 80000)]) {
    interruption(); expect(player.pose(b, 100000).breathing).toBe(0);
    expect(player.pose(b, 101600).breathing).toBeGreaterThan(.9);
  }
  expect(player.pose(b, 10).breathing).toBe(0);
  expect(() => player.pose(b, NaN)).toThrow('Invalid animation clock');
});

it.each([450, 600, 750])('joins standing and flight without a body jump over a %sms route', duration => {
  const player = createRobinPlayback(), b = moving('flight', duration);
  player.pose(bird(), 0);
  expect(player.pose(b, 1000)).toEqual(partsPose(0, 'still'));
  expect(player.pose(b, 1000 + duration / 2).flightMix).toBe(1);
  const closing = player.pose(b, 1000 + duration - 1);
  expect(closing.flightMix).toBeLessThan(.001);
  expect(Math.abs(closing.lean)).toBeLessThan(.02);
  expect(player.pose(b, 1000 + duration)).toEqual(partsPose(0, 'still'));
  expect(player.pose(bird(), 1000 + duration)).toEqual(partsPose(0, 'still'));
  const fresh = createRobinPlayback(); fresh.pose(bird(), 0);
  for (let age = 0; age < duration; age += 5) {
    const pose = fresh.pose(b, 1000 + age), layers = partsLayers(pose);
    expect(layers.filter(layer => layer.id === 'body')).toHaveLength(1);
    expect(pose.flightMix).toBeGreaterThanOrEqual(0);
    expect(pose.flightMix).toBeLessThanOrEqual(1);
    if (pose.flightMix > 0 && pose.flightMix < 1) {
      const standingLeg = layers.find(layer => layer.id === 'leg-near')!;
      const tuckedLeg = layers.find(layer => layer.id === 'leg-near-tucked')!;
      expect(standingLeg.opacity! + tuckedLeg.opacity!).toBeCloseTo(1);
    }
  }
});

it('articulates a hop without adding a second lift to the scene trajectory', () => {
  const player = createRobinPlayback(), b = moving('hop', 270);
  player.pose(bird(), 0); player.pose(b, 1000);
  const apex = player.pose(b, 1135);
  expect(apex.lift).toBe(0);
  expect(apex.tuck).toBe(1);
  expect(apex.flightMix).toBe(0);
  expect(partsLayers(apex).some(layer => layer.id === 'wing-up')).toBe(false);
});

it('pecks while resting and smoothly interrupts a peck for an alert or flight', () => {
  const player = createRobinPlayback(), b = bird();
  player.pose(b, 0); player.pose(b, 6000);
  const peck = player.pose(b, 6420);
  expect(peck.peckMix).toBe(1); expect(peck.headAngle).toBe(82);
  const alert = { ...b, alert: true };
  expect(player.pose(alert, 6420).headAngle).toBe(82);
  expect(player.pose(alert, 6480).headAngle).toBeGreaterThan(-7);
  expect(player.pose(alert, 6540).headAngle).toBe(-7);
  const flying = { ...moving('flight', 600), action: { ...moving('flight', 600).action!, start: 6540 } };
  expect(player.pose(flying, 6540).headAngle).toBe(-7);
  expect(player.pose(flying, 6660).headAngle).toBe(-20);
  expect(player.pose(flying, 6600, true)).toEqual(partsPose(0, 'still'));
});

it('keeps the neck attachment continuous as a peck finishes blending in', () => {
  const from = partsPose(0, 'still'), to = partsPose(1120, 'peck');
  const before = partsTransforms(mixPartsPose(from, to, .99999)).neck;
  const after = partsTransforms(to).neck;
  const angle = (transform: string) => Number(transform.match(/rotate\(([^ ]+)/)![1]);
  expect(Math.abs(angle(before) - angle(after))).toBeLessThan(.002);
});
