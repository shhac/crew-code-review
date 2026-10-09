import { describe, expect, it } from 'vitest';
import { cycleLength } from '../spidergait';
import { flexion, gaitPhase, legsTo, restingFeet, steppingFeet, swingsOf, type Gait, type QuadLeg } from './gait';

const GROUND = 20;
const WALK: Gait = { stride: 4, lift: 1.5, stance: 0.75 };
const fore: QuadLeg = { hip: { x: 14, y: 12 }, reach: 0, thigh: 4, shin: 4.5, beat: 0, bend: 1, far: false, fore: true };
const hind: QuadLeg = { ...fore, hip: { x: 4, y: 12 }, beat: 0.5, bend: -1, fore: false };
const hipsOf = (specs: readonly QuadLeg[]) => specs.map((s) => s.hip);
const walking = (specs: readonly QuadLeg[], walked: number) => legsTo(specs, hipsOf(specs), steppingFeet(specs, hipsOf(specs), walked, GROUND, WALK), swingsOf(specs, walked, WALK));

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
    expect(steppingFeet([fore], moved, 0, GROUND, WALK)[0].x - 20).toBeCloseTo(steppingFeet([fore], hipsOf([fore]), 0, GROUND, WALK)[0].x - 14);
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
  const toed: QuadLeg = { ...fore, toes: { length: 2, lean: 10, fold: 50 } };

  it('stands a toe-walker on a bone from its toes, the joint above behind the toes', () => {
    const [down] = legsTo([toed], [toed.hip], [{ x: 14, y: GROUND }]);
    expect(Math.hypot(down.ankle.x - down.foot.x, down.ankle.y - down.foot.y)).toBeCloseTo(2);
    expect(down.ankle.x).toBeLessThan(down.foot.x);
    expect(down.ankle.y).toBeLessThan(down.foot.y);
    expect(down.paw).toBe(0);
  });

  it('folds the paw back behind the joint, toes down, early in its swing, and tips it toes-up just before it lands', () => {
    const [early] = legsTo([toed], [toed.hip], [{ x: 14, y: GROUND - 1 }], [0.35]);
    expect(early.paw).toBeGreaterThan(40);
    expect(early.ankle.x).toBeGreaterThan(early.foot.x);
    const [late] = legsTo([toed], [toed.hip], [{ x: 14, y: GROUND - 0.2 }], [0.9]);
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

describe('swing', () => {
  it('is -1 while a foot is down and runs 0 to 1 through its step', () => {
    const cycle = cycleLength(WALK.stride, WALK.stance);
    expect(swingsOf([fore], 0.5 * cycle, WALK)).toEqual([-1]);
    expect(swingsOf([fore], 0.875 * cycle, WALK)[0]).toBeCloseTo(0.5);
  });

  it('folds most early in the swing, unfolds, and tips back just before landing', () => {
    expect(flexion(-1)).toBe(0);
    expect(flexion(0.375)).toBeCloseTo(1);
    expect(flexion(0.75)).toBeCloseTo(0);
    expect(flexion(0.875)).toBeLessThan(0);
    expect(flexion(1)).toBeCloseTo(0);
  });
});
