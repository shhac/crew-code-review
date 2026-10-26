import { describe, expect, it, vi } from 'vitest';
import { momentsOf, type RigCritter } from '../../../../lab/critters/critter';
import { fox, foxAt } from '../../../../lab/critters/fox';
import { hare, hareAt } from '../../../../lab/critters/hare';
import { hedgehog, hogAt } from '../../../../lab/critters/hedgehog';
import { rabbit, rabbitAt } from '../../../../lab/critters/rabbit';
import { foxRig } from '../../aurora/fox-rig-legacy';
import { hogRig } from '../../bonfire/hedgehog-rig-legacy';
import { rabbitRig } from '../../easter/rabbit-rig-legacy';
import { hareRig } from '../../hares/hare-rig-legacy';
import type { Point } from '../../pointer';
import * as gait from '../gait';
import { held, kneeAngle, pawAngle, restingPaw, solveHinged } from './hinge';
import { planDiff } from './plan';
import type { Goal, HingedLeg } from './types';

// Every leg the four-legged animals asked legsTo for, as they were drawn
// before their legs were hinged.
vi.mock('../gait', async (original) => {
  const real = await original<typeof import('../gait')>();
  return { ...real, legsTo: vi.fn(real.legsTo) };
});

const hinged = ({ hip, far, fore, bend, bendFrame, jointLimits, ...leg }: gait.QuadLeg): HingedLeg =>
  ({ ...leg, side: bend === 1 ? -1 : 1, ...(jointLimits ? { knee: jointLimits } : {}), paw: { rest: 0, limits: { min: -360, max: 360 } } });
const nowhere = (): Point => {
  throw new Error('no handle here');
};
const asked = () => {
  const before: RigCritter[] = [
    { ...hedgehog, pose: (at, look) => hogRig(hogAt(at), { now: at.now, ...look }) }, { ...rabbit, pose: (at, look) => rabbitRig(rabbitAt(at), { now: at.now, ...look }) },
    { ...fox, pose: (at, look) => foxRig(foxAt(at), { now: at.now, ...look }) }, { ...hare, pose: (at, look) => hareRig(hareAt(at), { now: at.now, ...look }) },
  ];
  vi.mocked(gait.legsTo).mockClear();
  before.forEach((critter) => critter.kind === 'rig' && momentsOf(critter).forEach((at) => [false, true].forEach((still) => critter.pose(at, { gaze: 0, still }))));
  const { calls, results } = vi.mocked(gait.legsTo).mock;
  return calls.flatMap(([specs, hips, feet, steps = []], n) => specs.map((spec, i) => ({ spec, hip: hips[i], goal: { kind: 'plant', at: feet[i], step: steps[i] } satisfies Goal, was: results[n].value[i] })));
};
const pose = (leg: HingedLeg, hip: Point, goal: Goal) => solveHinged(leg, hip, goal, () => (goal.kind === 'plant' ? goal.at : nowhere()));

describe('a leg bent at hinges', () => {
  const legs = asked();

  it('stands every planted foot as legsTo stood it, for every animal on four legs, over the moments the lab shows', () => {
    const planted = legs.filter(({ goal }) => held(goal).contact === 1);
    planted.forEach(({ spec, hip, goal, was }) => expect(planDiff(pose(hinged(spec), hip, goal), was, 0)).toEqual([]));
    expect(planted.length).toBeGreaterThan(20000);
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
    expect(free.foot).toEqual(at);
  });
});
