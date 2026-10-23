import { describe, expect, it, vi } from 'vitest';
import { momentsOf } from '../../../../lab/critters/critter';
import { CRITTERS } from '../../../../lab/critters/registry';
import type { Point } from '../../pointer';
import * as bird from '../bird';
import * as gait from '../gait';
import { applied, translate } from './affine';
import { ownedFrames, ownedPoints, solveLimb, standing } from './limbs';
import type { LimbSpec, Skeleton } from './types';

// Every call the animals make to today's solvers, with what they answered,
// so each constraint can be held to the same answer for the same question.
vi.mock('../gait', async (original) => {
  const real = await original<typeof import('../gait')>();
  return { ...real, legsTo: vi.fn(real.legsTo) };
});
vi.mock('../bird', async (original) => {
  const real = await original<typeof import('../bird')>();
  return { ...real, birdLegsTo: vi.fn(real.birdLegsTo), airLegsTo: vi.fn(real.airLegsTo), plantedLegs: vi.fn(real.plantedLegs) };
});

const OWNED = { root: 'J0', middle: 'J1', lower: 'J2', end: 'J3' } as const;
// A rig's leg as a limb of the skeleton: what the skeleton owns taken out.
function limbOf<L extends gait.QuadLeg>({ hip, far, fore, ...leg }: L): Omit<L, 'hip' | 'far' | 'fore'> & { side: 'near' | 'far'; pair: number } {
  return { ...leg, side: far ? 'far' : 'near', pair: fore ? 0 : 1 };
}
const quad = (spec: gait.QuadLeg, ground = 0): LimbSpec => {
  const { side, pair, ...leg } = limbOf(spec);
  return { id: 'leg', pair, side, joints: OWNED, ground, solve: 'quad', leg };
};
const birdLimb = (spec: bird.BirdLeg, ground = 0): LimbSpec => {
  const { side, pair, ...leg } = limbOf(spec);
  return { id: 'leg', pair, side, joints: OWNED, ground, solve: 'bird', leg };
};
const nowhere = (): Point => {
  throw new Error('no handle here');
};

const mocks = () => ({ legs: vi.mocked(gait.legsTo).mock, birds: vi.mocked(bird.birdLegsTo).mock, air: vi.mocked(bird.airLegsTo).mock, planted: vi.mocked(bird.plantedLegs).mock });
const callsSoFar = () => Object.values(mocks()).reduce((n, m) => n + m.calls.length, 0);

describe('a limb\'s constraint', () => {
  it('poses every leg of every animal as legsTo, birdLegsTo, airLegsTo and plantedLegs do, over the moments the lab shows', () => {
    // Every moment the lab shows each animal in, moving and held still.
    const asked = CRITTERS.flatMap((critter) => {
      if (critter.kind !== 'rig') return [];
      const before = callsSoFar();
      momentsOf(critter).forEach((at) => [false, true].forEach((still) => critter.pose(at, { gaze: 0, still })));
      return [{ name: critter.name, calls: callsSoFar() - before }];
    });
    const { legs, birds, air, planted } = mocks();
    const checked = { legs: 0, birds: 0, air: 0, planted: 0 };
    legs.calls.forEach(([specs, hips, feet, steps = []], n) => specs.forEach((s, i) => {
      expect(solveLimb(quad(s), hips[i], { kind: 'plant', at: feet[i], step: steps[i] }, nowhere)).toEqual(legs.results[n].value[i]);
      checked.legs += 1;
    }));
    birds.calls.forEach(([specs, hips, feet, steps = [], ground], n) => specs.forEach((s, i) => {
      expect(solveLimb(birdLimb(s), hips[i], { kind: 'plant', at: feet[i], step: steps[i], ground }, nowhere)).toEqual(birds.results[n].value[i]);
      checked.birds += 1;
    }));
    air.calls.forEach(([specs, hips, reach, legsAt], n) => specs.forEach((s, i) => {
      expect(solveLimb(birdLimb(s), hips[i], { kind: 'air', reach, legs: legsAt }, nowhere)).toEqual(air.results[n].value[i]);
      checked.air += 1;
    }));
    // Standing, a bird's feet are where its constraint stands them at rest.
    planted.calls.forEach(([specs, hips, feet], n) => specs.forEach((s, i) => {
      expect(standing(birdLimb(s, feet), hips[i])).toEqual(planted.results[n].value[i]);
      checked.planted += 1;
    }));
    for (const name of ['hedgehog', 'fox', 'rabbit', 'hare', 'gull', 'crow', 'pigeon']) expect(asked.find((a) => a.name === name)?.calls, name).toBeGreaterThan(0);
    expect(checked.legs).toBeGreaterThan(1000);
    expect(Math.min(checked.birds, checked.air, checked.planted)).toBeGreaterThan(100);
  });

  it('reaches for a point carried on an authored joint as if planting on it', () => {
    const spec: gait.QuadLeg = { hip: { x: 0, y: 0 }, reach: 0, thigh: 2, shin: 2, bend: -1, fore: true, far: false, walksOn: { kind: 'toes', length: 1, lean: 20, fold: 60 } };
    const muzzle = { x: 3, y: 1 };
    const target = { x: muzzle.x + 0.5, y: muzzle.y - 0.2 };
    const reached = solveLimb(quad(spec), { x: 0, y: 0 }, { kind: 'reach', to: { on: 'skull', at: muzzle }, by: { x: 0.5, y: -0.2 }, step: { down: false, t: 0.4 } }, (h) => (typeof h === 'string' ? nowhere() : h.at));
    expect(reached).toEqual(gait.legsTo([spec], [{ x: 0, y: 0 }], [target], [{ down: false, t: 0.4 }])[0]);
  });
});

describe('the joints a limb owns', () => {
  const spec: gait.QuadLeg = { hip: { x: 4, y: 6 }, reach: 0.5, thigh: 3, shin: 3, bend: 1, fore: false, far: false, walksOn: { kind: 'toes', length: 1.5, lean: 15, fold: 70 } };
  const limb: LimbSpec = { ...quad(spec, 13), joints: { ...OWNED, tip: 'J4' } };
  const skeleton: Skeleton = { joints: [{ id: 'J4', parent: 'J3', derived: true, at: { x: 6.5, y: 13 }, role: { part: 'limb', pair: 1, side: 'near', index: 4 }, name: 'toe tip' }], bones: [], limbs: [limb] };
  const rest = standing(limb, spec.hip);

  it('stand where the leg stands at rest, its foot down on the ground ahead of its root', () => {
    expect(rest.foot).toEqual({ x: 4.5, y: 13 });
    expect(rest).toEqual(gait.legsTo([spec], [spec.hip], gait.restingFeet([spec], [spec.hip], 13))[0]);
  });

  it('turn with their bones from where they stand at rest, the foot and its toes with the paw', () => {
    const now = solveLimb(limb, { x: 5, y: 6.5 }, { kind: 'plant', at: { x: 6, y: 12.5 }, step: { down: false, t: 0.3 } }, nowhere);
    const frames = ownedFrames(skeleton, limb, rest, now);
    const points = ownedPoints(skeleton, limb, rest, now);
    const near = (a: Point | undefined, b: Point) => expect([a?.x, a?.y]).toEqual([expect.closeTo(b.x, 9), expect.closeTo(b.y, 9)]);
    // Each frame carries its joint, and the bone below it, from rest to now.
    near(applied(frames.get('J1') ?? translate(NaN, NaN), rest.knee), now.knee);
    near(applied(frames.get('J1') ?? translate(NaN, NaN), rest.ankle), now.ankle);
    near(applied(frames.get('J2') ?? translate(NaN, NaN), rest.foot), now.foot);
    near(applied(frames.get('J3') ?? translate(NaN, NaN), rest.foot), now.foot);
    expect(now.paw).not.toBe(0);
    near(points.get('J4'), applied(frames.get('J4') ?? translate(NaN, NaN), { x: 6.5, y: 13 }));
  });
});
