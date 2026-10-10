import { describe, expect, it } from 'vitest';
import { apart } from '../math';
import type { Point } from '../pointer';
import { cycleLength, rotate } from '../spidergait';
import { airFoot, airLegsTo, BIRD_STANCE, birdLegsTo, birdWalk, curledIn, headBob, peeled, stepLength, stepPhase, stepRise, type BirdLeg } from './bird';
import { stepping, stepsOf } from './gait';
import { legImages, piecesOf, type LimbArt } from './rig';

const GROUND = 20;
const foot = { src: 'toes.webp', fur: 'toes-fur.webp', width: 3, height: 1, heel: { x: 0.8, y: 0.3 } };
const ART: LimbArt = {
  bone: 'tarsus.webp', boneFur: 'tarsus-fur.webp', knee: true, inBody: true,
  thigh: { src: 'drumstick.webp', fur: 'drumstick-fur.webp' },
  foot, curled: { ...foot, src: 'curled.webp', fur: 'curled-fur.webp' },
};
// A gull-like leg: the hip high in the body, a short femur, the drumstick
// and the long tarsus.
const LEG: BirdLeg = {
  hip: { x: 10, y: 10 }, thigh: 3, shin: 4.5, bend: 1, reach: 0.5, far: false, fore: false,
  walksOn: { kind: 'toes', length: 5, lean: 8, fold: 60 }, toes: { x: 2.5, y: 0.7 }, peel: 25, art: ART, width: 1, haunch: 1.4,
};
const LEGS: BirdLeg[] = [{ ...LEG, far: true, hip: { x: 10.4, y: 9.8 } }, LEG];
const GAIT = birdWalk(4, 1.5);
const CYCLE = cycleLength(GAIT.stride, GAIT.stance);
const hipsOf = (legs: readonly BirdLeg[]) => legs.map((l) => l.hip);

const walking = (walked: number) => {
  const { feet, steps } = stepping(LEGS, walked, GROUND, GAIT);
  return birdLegsTo(LEGS, hipsOf(LEGS), feet(hipsOf(LEGS)), steps);
};
// Which side of the line from a to b a point is, as x grows rightward: > 0
// for ahead of a line running down.
const ahead = (a: Point, b: Point, p: Point) => (b.y - a.y) * (p.x - a.x) - (b.x - a.x) * (p.y - a.y);

describe("a bird's leg", () => {
  const [stood] = birdLegsTo([LEG], [LEG.hip], [{ x: LEG.hip.x + LEG.reach, y: GROUND }]);

  it('keeps every bone its length', () => {
    expect(apart(stood.hip, stood.knee)).toBeCloseTo(LEG.thigh);
    expect(apart(stood.knee, stood.ankle)).toBeCloseTo(LEG.shin);
    expect(apart(stood.ankle, stood.foot)).toBeCloseTo(LEG.walksOn.length);
  });

  it('bends as a bird\'s does: the knee forward, the intertarsal joint (the ankle) back', () => {
    expect(ahead(stood.hip, stood.ankle, stood.knee)).toBeGreaterThan(0);
    expect(ahead(stood.knee, stood.foot, stood.ankle)).toBeLessThan(0);
    // The tarsus leans its foot end ahead of the ankle.
    expect(stood.foot.x).toBeGreaterThan(stood.ankle.x);
  });

  it('stands on flat toes', () => {
    expect(stood.foot).toEqual({ x: LEG.hip.x + LEG.reach, y: GROUND });
    expect(stood.paw).toBe(0);
    expect(stood.curled).toBe(false);
  });

  it('draws no thigh: its pieces start at the knee, the drumstick then the tarsus', () => {
    const pieces = piecesOf({ limb: stood, art: ART, width: 1, haunch: 1.4, fore: false, taper: false });
    expect(pieces.map((p) => p.src)).toEqual(['drumstick.webp', 'tarsus.webp']);
    expect(pieces[0].from).toEqual(stood.knee);
    expect(pieces[0].width).toBe(1.4);
  });
});

describe("a bird's walk", () => {
  it('sets its two feet down half a cycle apart, each for more than half of it', () => {
    expect(GAIT.beats).toEqual([0, 0.5]);
    expect(GAIT.stance).toBe(BIRD_STANCE);
    const samples = Array.from({ length: 200 }, (_, i) => stepsOf((i / 200) * CYCLE, GAIT).filter((s) => s.down).length);
    expect(Math.min(...samples)).toBe(1);
    // Both down for a moment at each change: a fifth of the cycle in all.
    expect(samples.filter((n) => n === 2).length / samples.length).toBeCloseTo(2 * (BIRD_STANCE - 0.5), 1);
  });

  it('keeps a planted foot still on the ground while the body walks on', () => {
    // The first leg is down from 0 to 0.6 of the cycle.
    const floorX = (walked: number) => walking(walked)[0].foot.x + walked;
    expect(floorX(0.1 * CYCLE)).toBeCloseTo(floorX(0.3 * CYCLE));
    expect(walking(0.3 * CYCLE)[0].foot.y).toBe(GROUND);
  });

  it('lifts the heel first, about toe tips that stay planted, as it pushes off', () => {
    const late = 0.58 * CYCLE;
    const step = stepsOf(late, GAIT)[0];
    expect(step.down).toBe(true);
    expect(peeled(step)).toBeGreaterThan(0.5);
    const leg = walking(late)[0];
    expect(leg.foot.y).toBeLessThan(GROUND - 0.3);
    const { feet } = stepping(LEGS, late, GROUND, GAIT);
    const planted = feet(hipsOf(LEGS))[0];
    // The toes' tips, turned with the foot about the joint, stay on the ground where they were.
    const tips = rotate({ x: leg.foot.x + LEG.toes.x, y: leg.foot.y + LEG.toes.y }, leg.foot, leg.paw);
    expect(tips.x).toBeCloseTo(planted.x + LEG.toes.x);
    expect(tips.y).toBeCloseTo(GROUND + LEG.toes.y);
  });

  it('draws the toes together through the swing and spreads them to land', () => {
    expect(curledIn({ down: true, t: 0.5 })).toBe(false);
    expect(curledIn({ down: false, t: 0.05 })).toBe(false);
    expect(curledIn({ down: false, t: 0.5 })).toBe(true);
    expect(curledIn({ down: false, t: 0.9 })).toBe(false);
    const swinging = walking(0.8 * CYCLE)[0];
    expect(swinging.curled).toBe(true);
    const drawn = legImages({ limb: swinging, art: ART, width: 1, haunch: 1.4, fore: false, taper: false }, false);
    expect(drawn.filter((i) => i.opacity !== undefined).map((i) => [i.href, i.opacity])).toEqual([['toes.webp', 0], ['curled.webp', 1]]);
  });

  it('moves every joint smoothly through a whole cycle', () => {
    const at = Array.from({ length: 401 }, (_, i) => walking((i / 400) * CYCLE));
    const jumps = at.slice(1).map((leg, i) => Math.max(...leg.map((l, k) => Math.max(apart(l.knee, at[i][k].knee), apart(l.ankle, at[i][k].ankle), apart(l.foot, at[i][k].foot)))));
    expect(Math.max(...jumps)).toBeLessThan(0.2);
    // The toes turn smoothly, but for the moment they are drawn together or
    // spread again, a different drawing.
    const turns = at.slice(1).map((leg, i) => Math.max(...leg.map((l, k) => (l.curled === at[i][k].curled ? Math.abs(l.paw - at[i][k].paw) : 0))));
    expect(Math.max(...turns)).toBeLessThan(6);
  });

  it('lifts a swinging foot as far as its toes need to clear the ground', () => {
    const lowest = (walked: number) => {
      const { feet, steps } = stepping(LEGS, walked, GROUND - 0.7, GAIT);
      const legs = birdLegsTo(LEGS, hipsOf(LEGS), feet(hipsOf(LEGS)), steps, GROUND);
      return legs.map((l) => {
        const drawn = (l.curled && ART.curled) || ART.foot;
        const corners = [0, drawn.width].flatMap((x) => [0, drawn.height].map((y) => rotate({ x: l.foot.x + x - drawn.heel.x, y: l.foot.y + y - drawn.heel.y }, l.foot, l.paw)));
        return Math.max(...corners.map((c) => c.y));
      });
    };
    const all = Array.from({ length: 400 }, (_, i) => lowest((i / 400) * CYCLE)).flat();
    expect(Math.max(...all)).toBeLessThanOrEqual(GROUND + 1e-6);
  });

  it('counts each step from a foot landing to the next', () => {
    expect(stepPhase(0, GAIT)).toBeCloseTo(0);
    expect(stepPhase(0.25 * CYCLE, GAIT)).toBeCloseTo(0.5);
    expect(stepPhase(0.5 * CYCLE, GAIT)).toBeCloseTo(0);
    expect(stepPhase(0.99 * CYCLE, GAIT)).toBeCloseTo(0.98);
    expect(stepLength(GAIT)).toBeCloseTo(CYCLE / 2);
  });
});

describe('the head bob', () => {
  const THRUST = 0.45;
  const step = stepLength(GAIT);

  it('holds the head still in space through the hold, the body walking on beneath it', () => {
    const world = (walked: number) => walked + headBob(walked, GAIT, THRUST);
    expect(world(0.3 * CYCLE)).toBeCloseTo(world(0.45 * CYCLE));
    expect(world(0.8 * CYCLE)).toBeCloseTo(world(0.95 * CYCLE));
  });

  it('thrusts it forward a whole step from just after a foot lands, in double support', () => {
    const world = (walked: number) => walked + headBob(walked, GAIT, THRUST);
    const start = world(0), end = world(THRUST * step);
    expect(end - start).toBeCloseTo(step);
    // Landing starts double support: the other foot is still down.
    expect(stepsOf(0.01 * CYCLE, GAIT).every((s) => s.down)).toBe(true);
    expect(headBob(0.1 * CYCLE, GAIT, THRUST)).toBeGreaterThan(headBob(0, GAIT, THRUST));
  });

  it('bobs once a step, around where the head sits standing, with no jump', () => {
    const at = Array.from({ length: 801 }, (_, i) => headBob((i / 400) * CYCLE, GAIT, THRUST));
    // Eased into and out of the thrust, so a little past its ends.
    const half = (step * (1 - THRUST)) / 2;
    expect(Math.max(...at)).toBeGreaterThan(0.9 * half);
    expect(Math.max(...at)).toBeLessThan(1.1 * half);
    expect(Math.min(...at)).toBeLessThan(-0.9 * half);
    expect(Math.min(...at)).toBeGreaterThan(-1.1 * half);
    const jumps = at.slice(1).map((v, i) => Math.abs(v - at[i]));
    expect(Math.max(...jumps)).toBeLessThan(step * 0.05);
    expect(headBob(0, GAIT, THRUST)).toBeCloseTo(headBob(0.5 * CYCLE, GAIT, THRUST));
  });

  it('rides the body lowest as a foot lands and highest mid-step', () => {
    expect(stepRise(0, GAIT)).toBeCloseTo(0);
    expect(stepRise(0.25 * CYCLE, GAIT)).toBeCloseTo(1);
    expect(stepRise(0.5 * CYCLE, GAIT)).toBeCloseTo(0);
  });
});

describe('legs in the air', () => {
  const hips = hipsOf([LEG]);
  const length = LEG.thigh + LEG.shin + LEG.walksOn.length;
  const bones = (leg: { hip: Point; knee: Point; ankle: Point; foot: Point }) => {
    expect(apart(leg.hip, leg.knee)).toBeCloseTo(LEG.thigh);
    expect(apart(leg.knee, leg.ankle)).toBeCloseTo(LEG.shin);
    expect(apart(leg.ankle, leg.foot)).toBeCloseTo(LEG.walksOn.length);
  };

  it('tucks them up under the body, toes drawn together', () => {
    const [leg] = airLegsTo([LEG], hips, 0);
    expect(leg.foot.y - LEG.hip.y).toBeLessThan(0.5 * length);
    expect(leg.curled).toBe(true);
    bones(leg);
  });

  it('trails them back after a push off, and reaches them forward and down to land, toes spread', () => {
    expect(airFoot(LEG, LEG.hip, -1).x).toBeLessThan(LEG.hip.x - 0.5 * length);
    const [landing] = airLegsTo([LEG], hips, 1);
    expect(landing.foot.x).toBeGreaterThan(LEG.hip.x + 0.4 * length);
    expect(landing.foot.y).toBeGreaterThan(LEG.hip.y + 0.5 * length);
    expect(landing.curled).toBe(false);
    bones(landing);
    bones(airLegsTo([LEG], hips, -1)[0]);
    // Still a bird's: the ankle behind the line from the knee to the toes.
    expect(ahead(landing.knee, landing.foot, landing.ankle)).toBeLessThan(0);
  });

  it('moves smoothly from trailing through tucked to reaching', () => {
    const at = Array.from({ length: 201 }, (_, i) => airLegsTo([LEG], hips, -1 + i / 100)[0]);
    const jumps = at.slice(1).map((l, i) => Math.max(apart(l.foot, at[i].foot), apart(l.ankle, at[i].ankle), apart(l.knee, at[i].knee)));
    expect(Math.max(...jumps)).toBeLessThan(0.5);
  });
});
