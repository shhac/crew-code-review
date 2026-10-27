import { describe, expect, it, vi } from 'vitest';
import { momentsOf } from '../../../../lab/critters/critter';
import { CRITTERS } from '../../../../lab/critters/registry';
import type { Point } from '../../pointer';
import * as bird from '../bird';
import * as gait from '../gait';
import { jointBeside } from '../limb';
import { applied, translate } from './affine';
import { planDiff } from './plan';
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

describe('a limb\'s constraint', () => {
  it('poses every leg of every animal as legsTo, birdLegsTo, airLegsTo and plantedLegs do, over the moments the lab shows', () => {
    // Every moment the lab shows each animal in, moving and held still; and
    // a bird's leg on no hinges walked through a stride and stood, as the
    // birds were drawn before theirs were hinged.
    CRITTERS.forEach((critter) => critter.kind === 'rig' && momentsOf(critter).forEach((at) => [false, true].forEach((still) => critter.pose(at, { gaze: 0, still }))));
    const leg: bird.BirdLeg = {
      hip: { x: 16.8, y: 12 }, reach: 1.1, far: false, fore: false, thigh: 1.7, shin: 1.42, bend: 1, art: { bone: '', boneFur: '', knee: true, inBody: true, foot: { src: '', fur: '', width: 4.08, height: 1.92, heel: { x: 0.82, y: 0.57 } } }, width: 0.75,
      walksOn: { kind: 'toes', length: 2.68, lean: 14, fold: -40 }, toes: { x: 3.26, y: 1.35 }, peel: 22,
    };
    const walk = bird.birdWalk(4.4, 1.4);
    Array.from({ length: 200 }, (_, k) => k * 0.05).forEach((walked) => {
      const { feet, steps } = gait.stepping([leg], walked, 16.65, walk);
      bird.birdLegsTo([leg], [leg.hip], feet([leg.hip]), steps, 17.2);
      bird.plantedLegs([leg], [{ x: leg.hip.x, y: leg.hip.y + walked / 10 }], 16.65);
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
    expect(checked.legs).toBeGreaterThan(1000);
    expect(Math.min(checked.birds, checked.air, checked.planted)).toBeGreaterThan(100);
  }, 60000);

  it('reaches for a point carried on an authored joint as if planting on it', () => {
    const spec: gait.QuadLeg = { hip: { x: 0, y: 0 }, reach: 0, thigh: 2, shin: 2, bend: -1, fore: true, far: false, walksOn: { kind: 'toes', length: 1, lean: 20, fold: 60 } };
    const muzzle = { x: 3, y: 1 };
    const target = { x: muzzle.x + 0.5, y: muzzle.y - 0.2 };
    const reached = solveLimb(quad(spec), { x: 0, y: 0 }, { kind: 'reach', to: { on: 'skull', at: muzzle }, by: { x: 0.5, y: -0.2 }, step: { down: false, t: 0.4 } }, (h) => (typeof h === 'string' ? nowhere() : h.at));
    expect(reached).toEqual(gait.legsTo([spec], [{ x: 0, y: 0 }], [target], [{ down: false, t: 0.4 }])[0]);
  });
});

describe('a limb standing otherwise in one pose', () => {
  it('poses the foot on what the goal says it stands on, as legsTo does with the leg so changed', () => {
    const spec: gait.QuadLeg = { hip: { x: 0, y: 0 }, reach: 0, thigh: 2.5, shin: 2.8, bend: 1, fore: false, far: false, walksOn: { kind: 'toes', length: 2, lean: 30, fold: 40 } };
    const [soles] = gait.onSoles([spec], 1);
    const goal = { kind: 'plant', at: { x: 0.5, y: 5 }, step: { down: false, t: 0.3 }, walksOn: soles.walksOn } as const;
    expect(solveLimb(quad(spec), { x: 0, y: 0 }, goal, nowhere)).toEqual(gait.legsTo([soles], [{ x: 0, y: 0 }], [goal.at], [goal.step])[0]);
    expect(solveLimb(quad(spec), { x: 0, y: 0 }, goal, nowhere)).not.toEqual(solveLimb(quad(spec), { x: 0, y: 0 }, { ...goal, walksOn: undefined }, nowhere));
  });
});

describe('an arm, and a limb posed by angles', () => {
  const limb = (solve: 'arm' | 'angles'): LimbSpec => {
    const member = { id: 'L0', pair: 0, side: 'near', joints: OWNED, ground: 10 } as const;
    if (solve === 'arm') return { ...member, solve, leg: { thigh: 2.5, shin: 2.4, reach: 1 } };
    return { ...member, solve: 'hinged', leg: { thigh: 2.5, shin: 2.4, reach: 1, side: -1, paw: { rest: -30, limits: { min: 0, max: 0 } } } };
  };
  const along = (from: Point, deg: number, length: number): Point => ({ x: from.x + Math.cos((deg * Math.PI) / 180) * length, y: from.y + Math.sin((deg * Math.PI) / 180) * length });

  it('bends an arm\'s elbow to the side it is asked to, as jointBeside does, its fist along the forearm', () => {
    for (const side of [1, -1] as const) {
      const root = { x: 1, y: 2 }, at = { x: 4, y: 3.5 };
      const knee = jointBeside(root, at, 2.5, 2.4, side);
      const arm = solveLimb(limb('arm'), root, { kind: 'plant', at, side }, nowhere);
      expect(arm).toEqual({ hip: root, knee, ankle: at, foot: at, paw: (Math.atan2(at.y - knee.y, at.x - knee.x) * 180) / Math.PI });
    }
  });

  it('swings a limb from its root and bends its lower bone back, its foot kept at its turn from the shin, as the cupid\'s legs are, hanging straight down at rest', () => {
    const root = { x: 1, y: 2 };
    const knee = along(root, 90 - 20, 2.5);
    const posed = solveLimb(limb('angles'), root, { kind: 'angles', swing: 20, bend: 45 }, nowhere);
    expect(planDiff(posed, { hip: root, knee, ankle: along(knee, 90 - (20 - 45), 2.4), foot: along(knee, 90 - (20 - 45), 2.4), paw: 60 - (20 - 45) }, 1e-12)).toEqual([]);
    const rest = standing(limb('angles'), root);
    expect([rest.foot.x, rest.foot.y]).toEqual([expect.closeTo(1, 9), expect.closeTo(2 + 4.9, 9)]);
    expect(() => solveLimb(limb('arm'), root, { kind: 'angles', swing: 20, bend: 45 }, nowhere)).toThrow(/angles/);
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

describe('a bird\'s legs carried in the air', () => {
  const spec: bird.BirdLeg = {
    hip: { x: 0, y: 0 }, reach: 0, thigh: 2, shin: 1.5, bend: 1, fore: false, far: false,
    walksOn: { kind: 'toes', length: 1.3, lean: 6, fold: 45 }, toes: { x: 2, y: 1 }, peel: 25,
    art: { bone: 'b', boneFur: 'b', knee: true, inBody: true, foot: { src: 'f', fur: 'f', width: 2, height: 1, heel: { x: 0.5, y: 0.5 } } }, width: 0.5, haunch: 1,
  };
  const root = { x: 1, y: 2 };
  const turned = (p: Point, by: number) => {
    const a = (by * Math.PI) / 180;
    return { x: root.x + (p.x - root.x) * Math.cos(a) - (p.y - root.y) * Math.sin(a), y: root.y + (p.x - root.x) * Math.sin(a) + (p.y - root.y) * Math.cos(a) };
  };

  it('tucked up, turn with the body as it holds them; trailing or reaching, meet the ground as it lies', () => {
    const page = (reach: number) => solveLimb(birdLimb(spec), root, { kind: 'air', reach }, nowhere, -20);
    const carried = (reach: number) => solveLimb(birdLimb(spec), root, { kind: 'air', reach, carried: true }, nowhere, -20);
    const tucked = page(0);
    expect(planDiff(carried(0), { ...tucked, knee: turned(tucked.knee, -20), ankle: turned(tucked.ankle, -20), foot: turned(tucked.foot, -20), paw: tucked.paw - 20 }, 1e-9)).toEqual([]);
    expect(planDiff(carried(1), page(1), 1e-9)).toEqual([]);
    expect(planDiff(carried(-1), page(-1), 1e-9)).toEqual([]);
    expect(planDiff(carried(0.5), page(0.5), 1e-9)).not.toEqual([]);
  });
});

