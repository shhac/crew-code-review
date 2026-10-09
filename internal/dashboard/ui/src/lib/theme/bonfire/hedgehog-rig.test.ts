import { describe, expect, it } from 'vitest';
import type { RigPose } from '../rig/rig';
import { firstShut, guideAt, imagesOf, legsOf, lidsOf, pageReach, solesOf } from '../rig/test-rig';
import { HOG, type Hog, type Mode } from './hedgehog';
import { gazeAt, hogRig, type HogLook } from './hedgehog-rig';

const hog = (mode: Mode, walked = 0): Hog => ({ id: 0, seed: 1, x: 0, dir: 1, mode, target: 0, until: 0, out: 0, walked });
const look = (over: Partial<HogLook> = {}): HogLook => ({ now: 0, gaze: 0, still: false, ...over });

// The head's group: the one holding the eyelid's place, nested in the body's.
const headTurn = (pose: RigPose) => {
  const body = pose.layers.find((l) => l.kind === 'group');
  const head = body?.kind === 'group' ? body.layers.find((l) => l.kind === 'group') : undefined;
  return head?.kind === 'group' ? head.turn.angle : NaN;
};
// Legs are listed (legsOf, solesOf) far hind, far fore, near hind, near fore.
// Whether each leg is lifted, at each of `count` moments through `distance`.
const lifts = (mode: Mode, distance: number, count = 400) => Array.from({ length: count }, (_, i) => {
  const pose = hogRig(hog(mode, (i * distance) / count), look());
  return solesOf(pose).map((y) => y < pose.anchor.y - 1e-6);
});
// The order legs set down in, by their places in legsOf.
const landings = (frames: boolean[][]) => frames.slice(1).flatMap((now, i) => now.flatMap((up, leg) => (frames[i][leg] && !up ? [leg] : [])));

// A moment with the eye open, and one with it shut, for seed 1.
const OPEN = 3900;
const shutAt = () => firstShut((now) => hogRig(hog('sniff'), look({ now })))!;

describe('hedgehog rig', () => {
  // Homes and spacing work from HOG, so the drawing must never reach past
  // it on the page, whatever its stride, sniff or glance toward the cursor.
  it('stays inside its footprint, whatever it does and wherever it looks', () => {
    const modes: Mode[] = ['walk', 'flee', 'home', 'sniff', 'peek', 'curled'];
    const moments = Array.from({ length: 240 }, (_, i) => i * 15);
    const rigs = modes.flatMap((mode) => [-14, -7, 0, 7, 14].flatMap((gaze) => moments.map((now) => hogRig(hog(mode, now / 30), look({ now, gaze })))));
    const most = (of: (rig: RigPose) => number) => Math.max(...rigs.map(of));
    expect(most((r) => pageReach(r).left)).toBeLessThanOrEqual(HOG.width / 2);
    expect(most((r) => pageReach(r).right)).toBeLessThanOrEqual(HOG.width / 2);
    expect(most((r) => pageReach(r).top)).toBeLessThanOrEqual(HOG.height);
    // Its feet stand on the ledge and its nose stays above it; neither
    // ever sinks into it.
    expect(most((r) => Math.max(...solesOf(r)) - r.anchor.y)).toBeLessThanOrEqual(1e-6);
    expect(most((r) => (guideAt(r, 'nose')?.y ?? -Infinity) - r.anchor.y)).toBeLessThan(0);
  });

  it('stands on four legs with every foot on the ledge', () => {
    const feet = legsOf(hogRig(hog('sniff'), look())).map((l) => l.foot.y);
    expect(feet).toHaveLength(4);
    expect(new Set(feet).size).toBe(1);
    expect(feet[0]).toBeLessThan(hogRig(hog('sniff'), look()).anchor.y);
  });

  it('walks a hind foot, then the forefoot on its side, then the other side, three feet always down', () => {
    const frames = lifts('walk', 40);
    expect(Math.max(...frames.map((f) => f.filter(Boolean).length))).toBe(1);
    const order = landings(frames);
    expect(order.length).toBeGreaterThan(8);
    // Near hind, near fore, far hind, far fore, round again.
    const next = new Map([[2, 3], [3, 0], [0, 1], [1, 2]]);
    order.slice(1).forEach((leg, i) => expect(leg).toBe(next.get(order[i])));
  });

  it('trots when it hurries, the diagonal pairs together', () => {
    const frames = lifts('flee', 40);
    expect(Math.max(...frames.map((f) => f.filter(Boolean).length))).toBe(2);
    for (const [farHind, farFore, nearHind, nearFore] of frames) {
      expect(nearHind).toBe(farFore);
      expect(farHind).toBe(nearFore);
    }
  });

  it('keeps its feet down while they are down, and rolls each over its toes to push off', () => {
    const poses = Array.from({ length: 200 }, (_, i) => hogRig(hog('walk', i * 0.1), look()));
    for (const pose of poses) expect(solesOf(pose).filter((y) => Math.abs(y - pose.anchor.y) < 1e-6).length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...poses.flatMap((p) => legsOf(p).map((l) => l.paw)))).toBeGreaterThan(20);
  });

  it('peeking, raises only its near forefoot, its toes hanging', () => {
    const pose = hogRig(hog('peek'), look({ now: OPEN }));
    const lifted = solesOf(pose).map((y) => y < pose.anchor.y - 1e-6);
    expect(lifted).toEqual([false, false, false, true]);
    expect(legsOf(pose)[3].paw).toBeGreaterThan(0);
  });

  it('hurrying, carries its body higher than walking', () => {
    const hipsAt = (mode: Mode) => {
      const hips = hogRig(hog(mode, 0), look()).guides?.filter((g) => g.name === 'hip' || g.name === 'shoulder') ?? [];
      return hips.reduce((sum, g) => sum + g.at.y, 0) / hips.length;
    };
    expect(hipsAt('walk') - hipsAt('flee')).toBeCloseTo(0.5, 1);
  });

  it('blinks now and then, and never under reduced motion', () => {
    expect(lidsOf(hogRig(hog('sniff'), look({ now: OPEN })))).toHaveLength(0);
    const t = shutAt();
    expect(t).toBeDefined();
    expect(lidsOf(hogRig(hog('sniff'), look({ now: t, still: true })))).toHaveLength(0);
  });

  it('turns its head toward a cursor nearby, but only so far', () => {
    const at = { x: 100, y: 100 };
    expect(gazeAt(hog('peek'), at, null)).toBe(0);
    const above = gazeAt(hog('peek'), at, { x: 140, y: 20 });
    const below = gazeAt(hog('peek'), at, { x: 140, y: 140 });
    expect(above).toBeLessThan(0);
    expect(below).toBeGreaterThan(0);
    expect(Math.abs(above)).toBeLessThanOrEqual(14);
    expect(gazeAt(hog('peek'), at, { x: 600, y: 20 })).toBe(0);
    // Peeking, it also lifts its nose to test the air.
    const peeking = headTurn(hogRig(hog('peek'), look({ now: OPEN })));
    expect(peeking).toBeLessThan(0);
    expect(headTurn(hogRig(hog('peek'), look({ now: OPEN, gaze: above })))).toBeCloseTo(peeking + above);
  });

  it('looks the right way when facing left', () => {
    expect(gazeAt({ dir: -1 }, { x: 100, y: 100 }, { x: 60, y: 20 })).toBeLessThan(0);
  });

  it('nods gently on the move, never jumping from one step to the next', () => {
    // A frame at a hurry (34px/s, 60 frames a second) moves it about 0.6px.
    const turns = Array.from({ length: 300 }, (_, i) => headTurn(hogRig(hog('flee', i * 0.6), look({ now: i * 16, gaze: 10 }))));
    expect(Math.max(...turns) - Math.min(...turns)).toBeGreaterThan(2);
    expect(Math.max(...turns.map((t) => Math.abs(t)))).toBeLessThanOrEqual(2);
    expect(Math.max(...turns.slice(1).map((t, i) => Math.abs(t - turns[i])))).toBeLessThan(0.5);
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
