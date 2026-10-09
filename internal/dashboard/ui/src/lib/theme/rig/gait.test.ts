import { describe, expect, it } from 'vitest';
import { cycleLength, rotate } from '../spidergait';
import { flexion, gaitPhase, legsTo, restingFeet, roll, stepping, steppingFeet, stepsOf, type Gait, type QuadLeg } from './gait';

const GROUND = 20;
// Beats for [fore, hind], or a lone leg stepping on the first.
const WALK: Gait = { stride: 4, lift: 1.5, stance: 0.75, beats: [0, 0.5] };
const fore: QuadLeg = { hip: { x: 14, y: 12 }, reach: 0, thigh: 4, shin: 4.5, bend: 1, far: false, fore: true };
const hind: QuadLeg = { ...fore, hip: { x: 4, y: 12 }, bend: -1, fore: false };
const hipsOf = (specs: readonly QuadLeg[]) => specs.map((s) => s.hip);
const walking = (specs: readonly QuadLeg[], walked: number) => {
  const { feet, steps } = stepping(specs, walked, GROUND, WALK);
  return legsTo(specs, hipsOf(specs), feet(hipsOf(specs)), steps);
};

describe('stepping', () => {
  it('keeps a planted foot still on the floor while the body walks on', () => {
    const cycle = cycleLength(WALK.stride, WALK.stance);
    const floorX = (walked: number) => walking([fore], walked)[0].foot.x + walked;
    expect(floorX(0.2 * cycle)).toBeCloseTo(floorX(0.5 * cycle));
    expect(walking([fore], 0.4 * cycle)[0].foot.y).toBe(GROUND);
  });

  it('lifts each foot in its own beat', () => {
    const cycle = cycleLength(WALK.stride, WALK.stance);
    const [f, h] = walking([fore, hind], 0.85 * cycle);
    expect(f.foot.y).toBeLessThan(GROUND);
    expect(h.foot.y).toBe(GROUND);
  });

  it('bends fore knees forward and hind hocks back', () => {
    const [f, h] = walking([fore, hind], 0);
    expect(f.knee.x).toBeGreaterThan((f.hip.x + f.foot.x) / 2);
    expect(h.knee.x).toBeLessThan((h.hip.x + h.foot.x) / 2);
  });

  it('steps from hips the body has moved', () => {
    const moved = [{ x: 20, y: 13 }];
    const steps = stepsOf(0, WALK);
    expect(steppingFeet([fore], moved, steps, GROUND, WALK)[0].x - 20).toBeCloseTo(steppingFeet([fore], hipsOf([fore]), steps, GROUND, WALK)[0].x - 14);
  });

  it('counts the phase in whole stride cycles', () => {
    expect(gaitPhase(cycleLength(WALK.stride, WALK.stance) * 2.5, WALK)).toBeCloseTo(2.5);
  });
});

describe('restingFeet', () => {
  it('stands every foot on the floor at its reach below its hip', () => {
    const specs = [fore, { ...hind, reach: -1 }];
    expect(restingFeet(specs, hipsOf(specs), GROUND)).toEqual([{ x: 14, y: GROUND }, { x: 3, y: GROUND }]);
  });
});

describe('legsTo', () => {
  const toed: QuadLeg = { ...fore, walksOn: { kind: 'toes', length: 2, lean: 10, fold: 50 } };

  it('stands a toe-walker on a bone from its toes, the joint above behind the toes', () => {
    const [down] = legsTo([toed], [toed.hip], [{ x: 14, y: GROUND }]);
    expect(Math.hypot(down.ankle.x - down.foot.x, down.ankle.y - down.foot.y)).toBeCloseTo(2);
    expect(down.ankle.x).toBeLessThan(down.foot.x);
    expect(down.ankle.y).toBeLessThan(down.foot.y);
    expect(down.paw).toBe(0);
  });

  it('folds the paw back behind the joint, toes down, early in its swing, and tips it toes-up just before it lands', () => {
    const [early] = legsTo([toed], [toed.hip], [{ x: 14, y: GROUND - 1 }], [{ down: false, t: 0.35 }]);
    expect(early.paw).toBeGreaterThan(40);
    expect(early.ankle.x).toBeGreaterThan(early.foot.x);
    const [late] = legsTo([toed], [toed.hip], [{ x: 14, y: GROUND - 0.2 }], [{ down: false, t: 0.9 }]);
    expect(late.paw).toBeLessThan(0);
    expect(Math.hypot(early.knee.x - early.ankle.x, early.knee.y - early.ankle.y)).toBeCloseTo(toed.shin);
  });
  it('ends at the foot itself where there is no bone up from the toes', () => {
    const [leg] = legsTo([fore], [fore.hip], [{ x: 14, y: GROUND }]);
    expect(leg.ankle).toEqual(leg.foot);
  });

  it('joins moved hips to chosen feet with legs of the right length', () => {
    const [leg] = legsTo([fore], [{ x: 10, y: 15 }], [{ x: 13, y: GROUND }]);
    expect(Math.hypot(leg.knee.x - 10, leg.knee.y - 15)).toBeCloseTo(fore.thigh);
    expect(Math.hypot(leg.foot.x - leg.knee.x, leg.foot.y - leg.knee.y)).toBeCloseTo(fore.shin);
  });
});

describe('steps', () => {
  const swing = (t: number) => ({ down: false, t });

  it('counts each foot through its time down, then through its swing', () => {
    const cycle = cycleLength(WALK.stride, WALK.stance);
    expect(stepsOf(0.375 * cycle, WALK)[0]).toEqual({ down: true, t: 0.5 });
    expect(stepsOf(0.875 * cycle, WALK)[0].down).toBe(false);
    expect(stepsOf(0.875 * cycle, WALK)[0].t).toBeCloseTo(0.5);
  });

  it('folds a paw most early in the swing, unfolds it, and tips it back just before landing', () => {
    expect(flexion({ down: true, t: 0.5 })).toBe(0);
    expect(flexion(swing(0.375))).toBeCloseTo(1);
    expect(flexion(swing(0.75))).toBeCloseTo(0);
    expect(flexion(swing(0.875))).toBeLessThan(0);
    expect(flexion(swing(1))).toBeCloseTo(0);
  });

  it('keeps a sole flat through most of its time down, peels its heel up to push off, and lands it flat', () => {
    expect(roll()).toBe(0);
    expect(roll({ down: true, t: 0.5 })).toBe(0);
    expect(roll({ down: true, t: 0.8 })).toBeGreaterThan(0);
    expect(roll({ down: true, t: 1 })).toBeCloseTo(1);
    expect(roll(swing(0))).toBeCloseTo(1);
    expect(roll(swing(0.4))).toBeLessThan(1);
    expect(roll(swing(0.9))).toBe(0);
  });
});

describe('a sole walker', () => {
  const sole: QuadLeg = { ...fore, walksOn: { kind: 'sole', toes: { x: 2, y: 1 }, peel: 30 } };

  it('stands on its heel, flat, with no bone up from the toes', () => {
    const [leg] = legsTo([sole], [sole.hip], [{ x: 14, y: GROUND }], [{ down: true, t: 0.3 }]);
    expect(leg.foot).toEqual({ x: 14, y: GROUND });
    expect(leg.ankle).toEqual(leg.foot);
    expect(leg.paw).toBe(0);
  });

  it('rolls over its planted toes as it pushes off: the heel lifts, the toes stay put', () => {
    const [leg] = legsTo([sole], [sole.hip], [{ x: 14, y: GROUND }], [{ down: true, t: 1 }]);
    expect(leg.paw).toBeCloseTo(30);
    expect(leg.foot.y).toBeLessThan(GROUND - 0.5);
    // The toe tips, turned with the foot about its heel, are where they were.
    const tips = rotate({ x: leg.foot.x + 2, y: leg.foot.y + 1 }, leg.foot, leg.paw);
    expect(tips.x).toBeCloseTo(16);
    expect(tips.y).toBeCloseTo(GROUND + 1);
  });

  it('moves smoothly from pushing off into its swing', () => {
    const cycle = cycleLength(WALK.stride, WALK.stance);
    const at = (walked: number) => walking([sole], walked)[0];
    const [before, after] = [at(0.7499 * cycle), at(0.7501 * cycle)];
    expect(Math.hypot(after.foot.x - before.foot.x, after.foot.y - before.foot.y)).toBeLessThan(0.01);
    expect(Math.abs(after.paw - before.paw)).toBeLessThan(0.1);
  });
});
