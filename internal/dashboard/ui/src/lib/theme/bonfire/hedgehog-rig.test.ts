import { describe, expect, it } from 'vitest';
import type { RigPose } from '../rig/rig';
import { firstShut, imagesOf, legsOf, lidsOf } from '../rig/test-rig';
import type { Hog, Mode } from './hedgehog';
import { hogRig, type HogLook } from './hedgehog-rig';

const hog = (mode: Mode, walked = 0): Hog => ({ id: 0, seed: 1, x: 0, dir: 1, mode, target: 0, until: 0, out: 0, walked });
const look = (over: Partial<HogLook> = {}): HogLook => ({ now: 0, at: { x: 100, y: 100 }, cursor: null, still: false, ...over });

// The head's group: the one holding the eyelid's place, nested in the body's.
const headTurn = (pose: RigPose) => {
  const body = pose.layers.find((l) => l.kind === 'group');
  const head = body?.kind === 'group' ? body.layers.find((l) => l.kind === 'group') : undefined;
  return head?.kind === 'group' ? head.turn.angle : NaN;
};
// A moment with the eye open, and one with it shut, for seed 1.
const OPEN = 3900;
const shutAt = () => firstShut((now) => hogRig(hog('sniff'), look({ now })))!;

describe('hedgehog rig', () => {
  it('stands on four legs with every foot on the ledge', () => {
    const feet = legsOf(hogRig(hog('sniff'), look())).map((l) => l.foot.y);
    expect(feet).toHaveLength(4);
    expect(new Set(feet).size).toBe(1);
    expect(feet[0]).toBeLessThan(hogRig(hog('sniff'), look()).anchor.y);
  });

  it('steps its legs as it walks, lifting one foot at a time', () => {
    const at = (walked: number) => legsOf(hogRig(hog('walk', walked), look()));
    expect(at(1)).not.toEqual(at(0));
    const ground = Math.max(...at(0).map((l) => l.foot.y));
    for (const walked of [0.3, 1.1, 2.0, 2.9]) {
      expect(at(walked).filter((l) => l.foot.y < ground - 1e-6).length).toBeLessThanOrEqual(1);
    }
  });

  it('blinks now and then, and never under reduced motion', () => {
    expect(lidsOf(hogRig(hog('sniff'), look({ now: OPEN })))).toHaveLength(0);
    const t = shutAt();
    expect(t).toBeDefined();
    expect(lidsOf(hogRig(hog('sniff'), look({ now: t, still: true })))).toHaveLength(0);
  });

  it('turns its head toward a cursor nearby, but only so far', () => {
    expect(headTurn(hogRig(hog('peek'), look({ now: OPEN })))).toBe(0);
    const above = headTurn(hogRig(hog('peek'), look({ now: OPEN, cursor: { x: 140, y: 20 } })));
    const below = headTurn(hogRig(hog('peek'), look({ now: OPEN, cursor: { x: 140, y: 140 } })));
    expect(above).toBeLessThan(0);
    expect(below).toBeGreaterThan(0);
    expect(Math.abs(above)).toBeLessThanOrEqual(14);
    expect(headTurn(hogRig(hog('peek'), look({ now: OPEN, cursor: { x: 600, y: 20 } })))).toBe(0);
  });

  it('looks the right way when facing left', () => {
    const left = { ...hog('peek'), dir: -1 as const };
    expect(headTurn(hogRig(left, look({ now: OPEN, cursor: { x: 60, y: 20 } })))).toBeLessThan(0);
  });

  it('dips its nose to sniff, and holds still under reduced motion', () => {
    expect(headTurn(hogRig(hog('sniff'), look({ now: OPEN })))).toBeGreaterThan(5);
    expect(headTurn(hogRig(hog('sniff'), look({ now: OPEN, still: true })))).toBe(0);
    expect(legsOf(hogRig(hog('walk', 1.3), look({ still: true })))).toEqual(legsOf(hogRig(hog('sniff'), look({ still: true }))));
  });

  it('is a ball when curled up, breathing', () => {
    const pose = hogRig(hog('curled'), look());
    expect(legsOf(pose)).toHaveLength(0);
    expect(imagesOf(pose)).toHaveLength(1);
    const squash = (now: number) => {
      const g = hogRig(hog('curled'), look({ now })).layers[0];
      return g.kind === 'group' ? g.scaleY : NaN;
    };
    expect(squash(0)).not.toBe(squash(1300));
  });
});
