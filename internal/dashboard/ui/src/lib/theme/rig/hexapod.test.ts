import { describe, expect, it } from 'vitest';
import { cycleLength } from '../spidergait';
import { stepsOf } from './gait';
import { airLegs, bonesOf, insectGait, legLayers, podAlong, standingLegs, walkingLegs, type InsectGait, type InsectLeg, type LegLook } from './hexapod';

const GROUND = 13.5;
const leg = (pair: InsectLeg['pair'], far: boolean, x: number, reach: number, bend: 1 | -1, lean: number): InsectLeg =>
  ({ pair, far, hip: { x, y: 8.6 }, femur: 2.3, tibia: 2.3, tarsus: 2, reach, bend, lean, curl: 20 });
// Near and far of each pair, fore to hind.
const LEGS: InsectLeg[] = [
  leg('fore', false, 14.6, 4, 1, 40), leg('fore', true, 14.3, 2.6, 1, 40),
  leg('mid', false, 13.3, 2.4, 1, 35), leg('mid', true, 12.8, 0.6, 1, 30),
  leg('hind', false, 10.5, -3.6, -1, -40), leg('hind', true, 9.9, -4, -1, -45),
];
const hips = LEGS.map((l) => l.hip);
const name = (l: InsectLeg) => `${l.far ? 'far' : 'near'} ${l.pair}`;
const downAt = (kind: InsectGait, phase: number) => {
  const gait = insectGait(LEGS, kind, 1.6, 0.6);
  const steps = stepsOf(phase * cycleLength(gait.stride, gait.stance), gait);
  return LEGS.filter((_, i) => steps[i].down).map(name).sort();
};

describe('insectGait', () => {
  it('walks the tripod: fore and hind of one side with the other side\'s middle leg', () => {
    expect(downAt('tripod', 0.25)).toEqual(['far fore', 'far hind', 'near mid']);
    expect(downAt('tripod', 0.75)).toEqual(['far mid', 'near fore', 'near hind']);
    // Between, all six are down for a moment, so it never falls.
    expect(downAt('tripod', 0.475)).toHaveLength(6);
  });

  it('keeps at least three feet down at every moment of every gait, four in a tetrapod, five in a wave', () => {
    const least = (kind: InsectGait) => Math.min(...Array.from({ length: 200 }, (_, i) => downAt(kind, i / 200).length));
    expect(least('tripod')).toBe(3);
    expect(least('tetrapod')).toBe(4);
    expect(least('wave')).toBe(5);
  });

  it('lifts diagonal pairs together in a tetrapod', () => {
    const lifted = (phase: number) => LEGS.map(name).filter((n) => !downAt('tetrapod', phase).includes(n)).sort();
    expect(lifted(1 / 6)).toEqual(['far fore', 'near hind']);
    expect(lifted(0.5)).toEqual(['far hind', 'near mid']);
    expect(lifted(5 / 6)).toEqual(['far mid', 'near fore']);
  });

  it('runs a wave up each side from the hind leg', () => {
    const lifted = (phase: number) => LEGS.map(name).filter((n) => !downAt('wave', phase).includes(n));
    expect([1 / 12, 3 / 12, 5 / 12].map(lifted)).toEqual([['near hind'], ['near mid'], ['near fore']]);
  });
});

describe('walkingLegs', () => {
  it('keeps a planted foot still on the ground while the body walks on', () => {
    const gait = insectGait(LEGS, 'tripod', 1.6, 0.6);
    const cycle = cycleLength(gait.stride, gait.stance);
    // The near mid leg is down through the first half of the cycle.
    const ground = (walked: number) => walkingLegs(LEGS, hips, walked, GROUND, gait)[2].foot.x + walked;
    expect(ground(0.05 * cycle)).toBeCloseTo(ground(0.4 * cycle));
    expect(walkingLegs(LEGS, hips, 0.2 * cycle, GROUND, gait)[2].foot.y).toBe(GROUND);
  });

  it('bends each knee to its own side, high, and keeps every bone its length', () => {
    const limbs = standingLegs(LEGS, hips, GROUND);
    limbs.forEach((l, i) => {
      expect(Math.hypot(l.knee.x - l.hip.x, l.knee.y - l.hip.y)).toBeCloseTo(LEGS[i].femur);
      expect(Math.hypot(l.ankle.x - l.knee.x, l.ankle.y - l.knee.y)).toBeCloseTo(LEGS[i].tibia);
      expect(Math.hypot(l.foot.x - l.ankle.x, l.foot.y - l.ankle.y)).toBeCloseTo(LEGS[i].tarsus);
      expect(l.foot.y).toBe(GROUND);
    });
    const [fore, , , , hind] = limbs;
    expect(fore.knee.x).toBeGreaterThan((fore.hip.x + fore.ankle.x) / 2);
    expect(hind.knee.x).toBeLessThan((hind.hip.x + hind.ankle.x) / 2);
  });
});

describe('airLegs', () => {
  const lowest = (hold: Parameters<typeof airLegs>[2]) => Math.max(...airLegs(LEGS, hips, hold).map((l) => l.foot.y));
  it('hangs the legs lower hovering than flying, and reaches them down and forward to land', () => {
    const tucked = lowest({ hang: 0, reach: 0, pitch: 0 });
    expect(lowest({ hang: 1, reach: 0, pitch: -40 })).toBeGreaterThan(tucked + 1.5);
    const stretch = (reach: number) => airLegs(LEGS, hips, { hang: 1, reach, pitch: -20 }).reduce((sum, l) => sum + Math.hypot(l.ankle.x - l.hip.x, l.ankle.y - l.hip.y), 0);
    expect(stretch(1)).toBeGreaterThan(stretch(0));
    const fore = (reach: number) => airLegs(LEGS, hips, { hang: 1, reach, pitch: -20 })[0].foot.x;
    expect(fore(1)).toBeGreaterThan(fore(0));
  });

  it('trails the hind legs and keeps the fore legs forward', () => {
    const [fore, , , , hind] = airLegs(LEGS, hips, { hang: 1, reach: 0, pitch: -30 });
    expect(fore.foot.x).toBeGreaterThan(fore.hip.x);
    expect(hind.foot.x).toBeLessThan(hind.hip.x - 1);
    // Drawn up at speed, the hind pair trails nearly straight back.
    const [, , , , trailing] = airLegs(LEGS, hips, { hang: 0, reach: 0, pitch: 0 });
    expect(trailing.foot.x).toBeLessThan(trailing.hip.x - 3.5);
    expect(trailing.foot.y - trailing.hip.y).toBeLessThan(2.5);
  });

  it('keeps every bone its length in the air, whatever the hold', () => {
    for (const hold of [{ hang: 0, reach: 0, pitch: -10 }, { hang: 1, reach: 0, pitch: -40 }, { hang: 0.5, reach: 0.7, pitch: -20 }]) {
      airLegs(LEGS, hips, hold).forEach((l, i) => {
        expect(Math.hypot(l.knee.x - l.hip.x, l.knee.y - l.hip.y)).toBeCloseTo(LEGS[i].femur);
        expect(Math.hypot(l.ankle.x - l.knee.x, l.ankle.y - l.knee.y)).toBeCloseTo(LEGS[i].tibia);
        expect(Math.hypot(l.foot.x - l.ankle.x, l.foot.y - l.ankle.y)).toBeCloseTo(LEGS[i].tarsus);
      });
    }
  });
});

describe('legLayers', () => {
  const look: LegLook = { widths: [0.7, 0.6, 0.4], outline: 0.15, ink: '#111', near: ['#444', '#444', '#543'], far: ['#333', '#333', '#432'], claw: 0.6 };
  it('draws each side\'s outlines under all its colour, the far side apart', () => {
    const { far, near } = legLayers(LEGS, standingLegs(LEGS, hips, GROUND), look);
    // Three legs a side, four strokes a leg (three bones and the claws), twice.
    expect(near).toHaveLength(24);
    expect(far).toHaveLength(24);
    const colours = near.map((l) => (l.kind === 'stroke' ? l.colour : ''));
    expect(colours.slice(0, 12).every((c) => c === '#111')).toBe(true);
    expect(colours.slice(12)).not.toContain('#111');
    expect(far.every((l) => l.kind === 'stroke' && l.name === 'far legs')).toBe(true);
  });

  it('hooks the claws down at the end of the tarsus, whichever way it points', () => {
    const [fore, , , , hind] = standingLegs(LEGS, hips, GROUND);
    const [, , , foreClaw] = bonesOf(fore, 0.6);
    const [, , , hindClaw] = bonesOf(hind, 0.6);
    expect(foreClaw[2].y).toBeGreaterThan(foreClaw[1].y);
    expect(hindClaw[2].y).toBeGreaterThan(hindClaw[1].y);
    expect(foreClaw[1].x).toBeGreaterThan(fore.foot.x);
    expect(hindClaw[1].x).toBeLessThan(hind.foot.x);
  });
});

describe('podAlong', () => {
  it('lays a shape along a bone, as long and as wide as asked', () => {
    const pod = podAlong({ x: 0, y: 0 }, { x: 0, y: 4 }, 0.5, 2, 1);
    const ys = pod.map((p) => p.y), xs = pod.map((p) => p.x);
    expect(Math.min(...ys)).toBeCloseTo(1);
    expect(Math.max(...ys)).toBeCloseTo(3);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 1);
  });
});
