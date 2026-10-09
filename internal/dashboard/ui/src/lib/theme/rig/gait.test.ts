import { describe, expect, it } from 'vitest';
import { cycleLength } from '../spidergait';
import { gaitPhase, legsTo, restingFeet, steppingFeet, type Gait, type QuadLeg } from './gait';

const GROUND = 20;
const WALK: Gait = { stride: 4, lift: 1.5, stance: 0.75 };
const fore: QuadLeg = { hip: { x: 14, y: 12 }, reach: 0, thigh: 4, shin: 4.5, beat: 0, bend: 1, far: false };
const hind: QuadLeg = { ...fore, hip: { x: 4, y: 12 }, beat: 0.5, bend: -1 };
const hipsOf = (specs: readonly QuadLeg[]) => specs.map((s) => s.hip);
const walking = (specs: readonly QuadLeg[], walked: number) => legsTo(specs, hipsOf(specs), steppingFeet(specs, hipsOf(specs), walked, GROUND, WALK));

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
  it('joins moved hips to chosen feet with legs of the right length', () => {
    const [leg] = legsTo([fore], [{ x: 10, y: 15 }], [{ x: 13, y: GROUND }]);
    expect(Math.hypot(leg.knee.x - 10, leg.knee.y - 15)).toBeCloseTo(fore.thigh);
    expect(Math.hypot(leg.foot.x - leg.knee.x, leg.foot.y - leg.knee.y)).toBeCloseTo(fore.shin);
  });
});
