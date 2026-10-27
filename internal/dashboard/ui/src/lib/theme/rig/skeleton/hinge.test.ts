import { describe, expect, it } from 'vitest';
import type { Point } from '../../pointer';
import { rotate } from '../../spidergait';
import * as gait from '../gait';
import { held, kneeAngle, pawAngle, restingPaw, solveHinged } from './hinge';
import { planDiff } from './plan';
import type { Goal, HingedLeg } from './types';

const hinged = ({ hip, far, fore, bend, bendFrame, jointLimits, ...leg }: gait.QuadLeg): HingedLeg =>
  ({ ...leg, side: bend === 1 ? -1 : 1, ...(jointLimits ? { knee: jointLimits } : {}), paw: { rest: 0, limits: { min: -360, max: 360 } } });
const nowhere = (): Point => {
  throw new Error('no handle here');
};
// Legs of every kind a four-legged animal stands on, as legsTo posed them
// before they were hinged (a fox's toe walkers, a rabbit's forepaw and
// long hind sole, a hedgehog's short sole), each walked through a stride,
// every foot stepping, and what legsTo answered for each.
const LEGS: readonly gait.QuadLeg[] = [
  { hip: { x: 11.2, y: 11.2 }, reach: -1, thigh: 2.3, shin: 2.1, bend: 1, fore: false, far: false, walksOn: { kind: 'toes', length: 1.5, lean: 10, fold: 70 } },
  { hip: { x: 21, y: 10.4 }, reach: 0.3, thigh: 2.3, shin: 3.6, bend: -1, fore: true, far: false, walksOn: { kind: 'toes', length: 0.7, lean: 8, fold: 100 } },
  { hip: { x: 15, y: 13 }, reach: 1.8, thigh: 2.6, shin: 2.6, bend: -1, bendFrame: 'limb', fore: true, far: false, jointLimits: { min: 30, max: 175 }, walksOn: { kind: 'toes', length: 0.8, lean: 35, fold: 89 } },
  { hip: { x: 6.4, y: 11.6 }, reach: -3.1, thigh: 3.3, shin: 3.6, bend: 1, bendFrame: 'limb', fore: false, far: false, jointLimits: { min: 25, max: 180 }, walksOn: { kind: 'sole', toes: { x: 3.8, y: 1.5 }, peel: 62 } },
  { hip: { x: 5.9, y: 13 }, reach: 0, thigh: 1.1, shin: 1.1, bend: 1, fore: false, far: false, walksOn: { kind: 'sole', toes: { x: 2.84, y: 1.35 }, peel: 30 } },
];
const GROUND = 16.8;
const STRIDE: gait.Gait = { stride: 2.5, lift: 1.2, stance: 0.6, beats: [0, 0.25, 0.5, 0.75, 0.1] };
const asked = () => Array.from({ length: 1500 }, (_, k) => (k / 1500) * 3 * gait.gaitPhase(1, STRIDE) ** -1).flatMap((walked) => {
  const { feet, steps } = gait.stepping(LEGS, walked, GROUND, STRIDE);
  const hips = LEGS.map((l) => l.hip);
  const at = feet(hips);
  const was = gait.legsTo(LEGS, hips, at, steps);
  return LEGS.map((spec, i) => ({ spec, hip: hips[i], goal: { kind: 'plant', at: at[i], step: steps[i] } satisfies Goal, was: was[i] }));
});
const pose = (leg: HingedLeg, hip: Point, goal: Goal) => solveHinged(leg, hip, goal, () => (goal.kind === 'plant' ? goal.at : nowhere()));

describe('a leg bent at hinges', () => {
  const legs = asked();

  it('stands every planted foot as legsTo stood it, for legs of every kind four-legged animals stand on, through a stride', () => {
    const planted = legs.filter(({ goal }) => held(goal).contact === 1);
    planted.forEach(({ spec, hip, goal, was }) => expect(planDiff(pose(hinged(spec), hip, goal), was, 1e-9)).toEqual([]));
    expect(planted.length).toBeGreaterThan(2000);
  }, 60000);

  it('comes down onto its planted pose without a jump, as the pin takes its weight', () => {
    legs.filter(({ goal }) => held(goal).contact === 1).forEach(({ spec, hip, goal, was }) => {
      expect(planDiff(pose(hinged(spec), hip, { ...goal, contact: 1 - 1e-9 }), was, 1e-6)).toEqual([]);
    });
  }, 60000);

  const fore: HingedLeg = { reach: 1.8, thigh: 2.6, shin: 2.6, side: 1, knee: { min: 30, max: 175 }, walksOn: { kind: 'toes', length: 0.8, lean: 35, fold: 89 }, paw: { limits: { min: -20, max: 95 } } };
  const hip = { x: 15, y: 13 };
  const leg = { ...fore, paw: { ...fore.paw, rest: restingPaw(fore, hip, 16.8) } };

  it('rests its paw where it stands at rest, and hangs it there from the shin held free, folded as far as it is told', () => {
    const stood = pose(leg, hip, { kind: 'plant', at: { x: hip.x + leg.reach, y: 16.8 } });
    expect(pawAngle(stood, true)).toBeCloseTo(leg.paw.rest, 9);
    expect(stood.paw).toBe(0);
    const held = (fold: number) => pose(leg, hip, { kind: 'plant', at: { x: hip.x + 1, y: hip.y + 3 }, contact: 0, fold });
    expect(pawAngle(held(0), true)).toBeCloseTo(leg.paw.rest, 9);
    expect(pawAngle(held(0.5), true)).toBeCloseTo(leg.paw.rest + 44.5, 9);
    // Folded past its limits, it stops at them.
    expect(pawAngle(held(2), true)).toBeCloseTo(leg.paw.rest + 95, 9);
    // The paw turns with the bone up from the toes, from where that stands.
    const free = held(0.5);
    expect(free.paw).toBeCloseTo((Math.atan2(free.foot.y - free.ankle.y, free.foot.x - free.ankle.x) * 180) / Math.PI - (90 - 35), 9);
  });

  it('eases its toes into their own free turn from the bone up to them as the paw lifts, and lays them flat planted', () => {
    const toed = { ...leg, digits: 10 };
    const at = { x: hip.x + 1, y: hip.y + 3 };
    const palm = (limb: ReturnType<typeof pose>) => (Math.atan2(limb.foot.y - limb.ankle.y, limb.foot.x - limb.ankle.x) * 180) / Math.PI;
    const toes = (limb: ReturnType<typeof pose>) => limb.paw - palm(limb);
    expect(toes(pose(toed, hip, { kind: 'plant', at, contact: 0, fold: 0.5 }))).toBeCloseTo(10, 9);
    // A pose may hold them otherwise (a fist).
    expect(toes(pose(toed, hip, { kind: 'plant', at, contact: 0, digits: 75 }))).toBeCloseTo(75, 9);
    expect(pose(toed, hip, { kind: 'plant', at: { x: hip.x + leg.reach, y: 16.8 } }).paw).toBe(0);
    // Part way down, part way between flat and free, the toes keeping their
    // planted turn the longer.
    const landing = pose(toed, hip, { kind: 'plant', at, contact: 0.25 });
    const standing = 35 - 90;
    expect(landing.paw).toBeCloseTo(0.75 * (palm(landing) + standing + (10 - standing) * 0.75 * 0.75), 9);
  });

  it('bears only so much turn at a planted wrist, laying the paw down along a low forearm rather than kinking it', () => {
    // Its shoulder brought down low over a paw set out ahead.
    const at = { x: hip.x + 2, y: hip.y + 1.5 };
    const kinked = pose(leg, hip, { kind: 'plant', at });
    expect(pawAngle(kinked, true) - leg.paw.rest).toBeGreaterThan(20);
    const bearing = { ...leg, paw: { ...leg.paw, planted: { min: -40, max: 10 } } };
    const borne = pose(bearing, hip, { kind: 'plant', at });
    expect(pawAngle(borne, true) - leg.paw.rest).toBeLessThanOrEqual(10 + 1e-9);
    expect(pawAngle(borne, true) - leg.paw.rest).toBeGreaterThan(10 - 1e-3);
    expect([borne.foot.x, borne.foot.y, borne.paw]).toEqual([expect.closeTo(at.x, 9), expect.closeTo(at.y, 9), 0]);
    // A stance it bears stands as it always did.
    const standing = { kind: 'plant', at: { x: hip.x + leg.reach, y: 16.8 } } as const;
    expect(planDiff(pose(bearing, hip, standing), pose(leg, hip, standing), 0)).toEqual([]);
  });

  it('reaches its toes where they go, the knee bent its own way within its limits, or as near as it can', () => {
    const reach = (at: Point) => pose(leg, hip, { kind: 'plant', at, contact: 0 });
    const near = reach({ x: hip.x + 1.2, y: hip.y + 3.4 });
    expect([near.foot.x, near.foot.y]).toEqual([expect.closeTo(hip.x + 1.2, 9), expect.closeTo(hip.y + 3.4, 9)]);
    for (const at of [{ x: hip.x + 9, y: hip.y + 1 }, { x: hip.x + 0.1, y: hip.y + 0.2 }, { x: hip.x - 2, y: hip.y + 2.5 }]) {
      const limb = reach(at);
      expect(kneeAngle(limb, 1)).toBeGreaterThanOrEqual(30 - 1e-9);
      expect(kneeAngle(limb, 1)).toBeLessThanOrEqual(175 + 1e-9);
      expect(Math.hypot(limb.knee.x - limb.hip.x, limb.knee.y - limb.hip.y)).toBeCloseTo(2.6, 6);
      expect(Math.hypot(limb.ankle.x - limb.knee.x, limb.ankle.y - limb.knee.y)).toBeCloseTo(2.6, 6);
      expect(Math.hypot(limb.foot.x - limb.ankle.x, limb.foot.y - limb.ankle.y)).toBeCloseTo(0.8, 6);
    }
  });

  it('peels a planted sole up over its toes, and hangs a free one from the shin', () => {
    const sole: HingedLeg = { reach: -3.1, thigh: 3.3, shin: 3.6, side: -1, walksOn: { kind: 'sole', toes: { x: 3.8, y: 1.5 }, peel: 62 }, paw: { rest: -70, limits: { min: -30, max: 30 } } };
    const at = { x: 4, y: 16 };
    const pushing = pose(sole, { x: 7, y: 11 }, { kind: 'plant', at, step: { down: true, t: 0.9 } });
    expect(pushing.paw).toBeCloseTo(62 * gait.roll({ down: true, t: 0.9 }), 9);
    const free = pose(sole, { x: 7, y: 11 }, { kind: 'plant', at, contact: 0 });
    expect(pawAngle(free, false)).toBeCloseTo(-70, 9);
    // Its toes go where a flat foot's would.
    const toes = rotate({ x: free.foot.x + 3.8, y: free.foot.y + 1.5 }, free.foot, free.paw);
    expect([toes.x, toes.y]).toEqual([expect.closeTo(at.x + 3.8, 9), expect.closeTo(at.y + 1.5, 9)]);
    // One that opens off the ground opens from the shank as far as it is
    // folded, within its limits.
    const opening: HingedLeg = { ...sole, walksOn: { kind: 'sole', toes: { x: 3.8, y: 1.5 }, peel: 62, fold: 40 } };
    expect(pawAngle(pose(opening, { x: 7, y: 11 }, { kind: 'plant', at, contact: 0, fold: 0.5 }), false)).toBeCloseTo(-50, 9);
    expect(pawAngle(pose(opening, { x: 7, y: 11 }, { kind: 'plant', at, contact: 0, fold: 1 }), false)).toBeCloseTo(-40, 9);
  });
});
