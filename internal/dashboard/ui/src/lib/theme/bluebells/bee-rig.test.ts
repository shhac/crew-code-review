import { describe, expect, it } from 'vitest';
import type { Point } from '../pointer';
import type { Layer, RigPose } from '../rig/rig';
import { flatLayers, lidsOf, rigBounds } from '../rig/test-rig';
import { ANCHOR, beeRig, GROUND, REACH, SCALE, type BeePose, type RigBee } from './bee-rig';

const POSES: BeePose[] = ['perch', 'crawl', 'scurry', 'hover', 'fly', 'land', 'bonk'];
const grounded = (pose: BeePose) => pose === 'perch' || pose === 'crawl' || pose === 'scurry';
const bee = (pose: BeePose, over: Partial<RigBee> = {}): RigBee => ({ pose, seed: 2, walked: 0, speed: 0, lean: 0, wings: grounded(pose) ? 0 : 1, ...over });
const strokes = (pose: RigPose, name: string) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'stroke' && l.name === name ? [l] : []));
// Each leg's claws, where its tarsus ends: the first point of the last
// stroke of each leg's coloured pass (four strokes a leg).
const feet = (pose: RigPose): Point[] => ['near legs', 'far legs'].flatMap((name) => {
  const drawn = strokes(pose, name);
  const fills = drawn.slice(drawn.length / 2);
  return fills.filter((_, i) => i % 4 === 3).map((claws) => claws.points[0]);
});
// A whole cycle of every motion: the bob, the stride, the antennae
// flicking and leaning.
const moments = Array.from({ length: 160 }, (_, i) => ({ now: i * 31, walked: i * 0.11, lean: [-15, 0, 15][i % 3] }));

describe('the bee', () => {
  it('is 18px from her jaws to the tip of her tail', () => {
    const pose = beeRig(bee('perch'), { now: 0, still: true });
    const body = flatLayers(pose.layers).flatMap((l) => (l.kind === 'image' && ['abdomen', 'thorax', 'head'].includes(l.name) ? [l] : []));
    const length = (Math.max(...body.map((l) => l.x + l.width)) - Math.min(...body.map((l) => l.x))) * SCALE;
    expect(length).toBeGreaterThan(17.5);
    expect(length).toBeLessThan(18.75);
  });

  for (const pose of POSES) {
    it(`stays inside her ${pose} reach through its whole cycle`, () => {
      const reach = REACH[pose];
      for (const speeds of pose === 'fly' ? [0, 30, 70, 140] : [0]) {
        for (const m of moments) {
          const b = rigBounds(beeRig(bee(pose, { walked: m.walked, lean: m.lean, speed: speeds, knocked: m.now % 700 }), { now: m.now, still: false }));
          const at = `${pose} at ${m.now}ms, ${speeds}px/s`;
          expect((ANCHOR.x - b.left) * SCALE, at).toBeLessThanOrEqual(reach.behind);
          expect((b.right - ANCHOR.x) * SCALE, at).toBeLessThanOrEqual(reach.ahead);
          expect((ANCHOR.y - b.top) * SCALE, at).toBeLessThanOrEqual(reach.up);
          expect((b.bottom - ANCHOR.y) * SCALE, at).toBeLessThanOrEqual(reach.down);
        }
      }
    });
  }

  it('stands on all six feet perched, on four or more crawling and three or more scurrying, never below the ground', () => {
    const down = (pose: BeePose, m: (typeof moments)[number]) => feet(beeRig(bee(pose, { walked: m.walked }), { now: m.now, still: false }));
    for (const m of moments) {
      expect(down('perch', m).filter((f) => Math.abs(f.y - GROUND) < 1e-9)).toHaveLength(6);
      expect(down('crawl', m).filter((f) => Math.abs(f.y - GROUND) < 1e-9).length).toBeGreaterThanOrEqual(4);
      expect(down('scurry', m).filter((f) => Math.abs(f.y - GROUND) < 1e-9).length).toBeGreaterThanOrEqual(3);
      for (const pose of POSES.filter(grounded)) expect(Math.max(...down(pose, m).map((f) => f.y))).toBeLessThanOrEqual(GROUND + 1e-9);
    }
  });

  it('carries all six legs on her thorax', () => {
    const pose = beeRig(bee('perch'), { now: 0, still: true });
    const thorax = flatLayers(pose.layers).find((l): l is Extract<Layer, { kind: 'image' }> => l.kind === 'image' && l.name === 'thorax');
    const coxae = (pose.guides ?? []).filter((g) => g.name === 'coxa').map((g) => g.at);
    expect(coxae).toHaveLength(6);
    for (const c of coxae) {
      expect(c.x).toBeGreaterThan(thorax!.x);
      expect(c.x).toBeLessThan(thorax!.x + thorax!.width);
      expect(c.y).toBeLessThan(thorax!.y + thorax!.height);
    }
  });

  it('never blinks: an insect has no eyelids', () => {
    for (const pose of POSES) for (const m of moments) expect(lidsOf(beeRig(bee(pose), { now: m.now, still: false }))).toEqual([]);
  });

  it('beats her wings as a blur in flight, folded perched', () => {
    const blur = (p: RigPose) => strokes(p, 'wing blur').length;
    expect(blur(beeRig(bee('hover'), { now: 0, still: false }))).toBe(1);
    expect(blur(beeRig(bee('perch'), { now: 0, still: false }))).toBe(0);
    // The blur is steady: the same at any two moments of a hover but for the bob.
    const fan = (now: number) => strokes(beeRig(bee('hover'), { now, still: false }), 'wing blur')[0].points;
    expect(fan(100)).toEqual(fan(2345));
  });

  it('fades the blur in as she lifts off', () => {
    const fanOpacity = (wings: number) => flatLayers(beeRig(bee('land', { wings }), { now: 0, still: false }).layers)
      .find((l) => l.kind === 'group' && l.layers.some((c) => c.kind === 'stroke' && c.name === 'wing blur'));
    expect(fanOpacity(0)).toBeUndefined();
    const half = fanOpacity(0.5), full = fanOpacity(1);
    expect(half?.kind === 'group' && full?.kind === 'group' && (half.opacity ?? 0) < (full.opacity ?? 0)).toBe(true);
  });

  it('flicks her antennae now and then, and leans them toward a cursor', () => {
    const tip = (over: Partial<RigBee>, now: number) => strokes(beeRig(bee('perch', over), { now, still: false }), 'near antenna')[1].points.at(-1)!;
    const tips = Array.from({ length: 400 }, (_, i) => tip({}, i * 10).y);
    expect(Math.min(...tips)).toBeLessThan(Math.max(...tips) - 0.5);
    const still = moments.map((m) => m.now).find((now) => tip({}, now).y === tip({}, 0).y && now > 0) ?? 0;
    expect(tip({ lean: -15 }, still).y).toBeLessThan(tip({}, still).y);
  });

  it('holds still under reduced motion: perched, wings folded, nothing moving', () => {
    const drawn = (now: number, pose: BeePose) => beeRig(bee(pose, { walked: now / 50, speed: 40 }), { now, still: true });
    const first = drawn(0, 'hover');
    for (const now of [500, 1234, 4321]) expect(drawn(now, 'fly')).toEqual(first);
    expect(strokes(first, 'wing blur')).toEqual([]);
    expect(feet(first).every((f) => Math.abs(f.y - GROUND) < 1e-9)).toBe(true);
  });
});
