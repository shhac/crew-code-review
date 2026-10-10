import { describe, expect, it } from 'vitest';
import { cycleLength, rotate } from '../spidergait';
import { beatsFor, flexion, flightAt, flightLift, flightsOf, gaitPhase, legsTo, onSoles, restingFeet, roll, stepping, steppingFeet, stepsOf, type Gait, type Landings, type QuadLeg } from './gait';

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

describe('bounding', () => {
  // Legs as a rig lists them: far hind, far fore, near hind, near fore.
  const toes = { kind: 'toes', length: 3, lean: 20, fold: 40 } as const;
  const LEGS: QuadLeg[] = [
    { ...hind, far: true, walksOn: toes }, { ...fore, far: true }, { ...hind, walksOn: toes }, { ...fore },
  ];
  // A half-bound: forefeet one after the other, then the hind pair together,
  // then a flight to the next forefoot.
  const HALF_BOUND: Landings = { fore: { near: 0, far: 0.08 }, hind: { near: 0.45, far: 0.45 } };
  const gait = (stance: number, landings = HALF_BOUND): Gait => ({ stride: 6, lift: 2, stance, beats: beatsFor(LEGS, landings) });
  const landsAt = (g: Gait) => stepsOf(0, g).map((_, i) => {
    const cycle = cycleLength(g.stride, g.stance);
    // The first moment in a cycle each foot is down having just been up.
    return Array.from({ length: 1000 }, (_, k) => k / 1000).find((p) => stepsOf(p * cycle, g)[i].down && !stepsOf(((p - 0.001 + 1) % 1) * cycle, g)[i].down);
  });

  it('lands each foot when the landings say', () => {
    const at = landsAt(gait(0.25));
    expect(at[3]).toBeCloseTo(0, 2);
    expect(at[1]).toBeCloseTo(0.08, 2);
    expect(at[0]).toBeCloseTo(0.45, 2);
    expect(at[2]).toBeCloseTo(0.45, 2);
  });

  it('finds the flights, the long one after the hind feet push off', () => {
    const flights = flightsOf(gait(0.25));
    expect(flights).toHaveLength(2);
    const [gathered, extended] = [...flights].sort((a, b) => a.from - b.from);
    expect(gathered.from).toBeCloseTo(0.33);
    expect(gathered.length).toBeCloseTo(0.12);
    expect(extended.from).toBeCloseTo(0.7);
    expect(extended.length).toBeCloseTo(0.3);
    expect(flightAt(0.85, gait(0.25))?.t).toBeCloseTo(0.5);
    expect(flightAt(0.5, gait(0.25))).toBeNull();
  });

  it('has no flight when the feet are down long enough to overlap, as in a slow hop', () => {
    const hop: Landings = { fore: { near: 0, far: 0.1 }, hind: { near: 0.5, far: 0.5 } };
    expect(flightsOf(gait(0.6, hop))).toEqual([]);
    expect(flightLift(0.3, gait(0.6, hop), 3)).toBe(0);
  });

  it('carries the body up through a flight and down again, highest mid-flight', () => {
    const g = gait(0.25);
    expect(flightLift(0.85, g, 3)).toBeCloseTo(3);
    expect(flightLift(0.71, g, 3)).toBeLessThan(0.5);
    expect(flightLift(0.39, g, 3)).toBeCloseTo(1.2);
    expect(flightLift(0.2, g, 3)).toBe(0);
  });

  it('lets a toe walker down onto its whole foot, the hock behind the toes on the ground', () => {
    const [sat] = legsTo(onSoles([LEGS[2]], 1), [LEGS[2].hip], [{ x: 4, y: GROUND }]);
    expect(sat.ankle.y).toBeCloseTo(GROUND);
    expect(sat.ankle.x).toBeCloseTo(1);
    const [up] = legsTo(onSoles([LEGS[2]], 0), [LEGS[2].hip], [{ x: 4, y: GROUND }]);
    expect(up.ankle.y).toBeLessThan(GROUND - 2.5);
    // The forelegs are left on their toes.
    expect(onSoles(LEGS, 1)[3]).toEqual(LEGS[3]);
  });
});
