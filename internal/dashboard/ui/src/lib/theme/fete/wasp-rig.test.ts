import { describe, expect, it } from 'vitest';
import type { Point } from '../pointer';
import type { Layer, RigPose } from '../rig/rig';
import { flatLayers, lidsOf, rigBounds } from '../rig/test-rig';
import { FOOTPRINTS, STAND, type WaspPose } from './footprints';
import { ANCHOR, GROUND, SCALE, waspRig, type RigWasp } from './wasp-rig';

const POSES: WaspPose[] = ['standing', 'feed', 'hover', 'land', 'cruise'];
const grounded = (pose: WaspPose) => pose === 'standing' || pose === 'feed';
const wasp = (pose: WaspPose, over: Partial<RigWasp> = {}): RigWasp => ({ pose, seed: 2, walked: 0, speed: 0, lean: 0, wings: grounded(pose) ? 0 : 1, ...over });
const strokes = (pose: RigPose, name: string) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'stroke' && l.name === name ? [l] : []));
// Each leg's claws: the first point of the last stroke of each leg's
// coloured pass (four strokes a leg).
const feet = (pose: RigPose): Point[] => ['near legs', 'far legs'].flatMap((name) => {
  const drawn = strokes(pose, name);
  const fills = drawn.slice(drawn.length / 2);
  return fills.filter((_, i) => i % 4 === 3).map((claws) => claws.points[0]);
});
// A whole cycle of every motion: the bob, the shuffle, the antennae
// flicking, tapping and leaning, the shimmering third wing.
const moments = Array.from({ length: 180 }, (_, i) => ({ now: i * 29, walked: i * 0.13, lean: [-15, 0, 15][i % 3] }));

// How far a pose's drawing reaches from her anchor, in page pixels, at the
// worst moment of its cycle, either way round.
function measured(pose: WaspPose) {
  const all = moments.flatMap((m) => [0, 60, 200].map((speed) => rigBounds(waspRig(wasp(pose, { walked: m.walked, lean: m.lean, speed }), { now: m.now, still: false }))));
  const left = Math.max(...all.map((b) => ANCHOR.x - b.left)), right = Math.max(...all.map((b) => b.right - ANCHOR.x));
  return { half: Math.max(left, right) * SCALE, up: Math.max(...all.map((b) => ANCHOR.y - b.top)) * SCALE, down: Math.max(...all.map((b) => b.bottom - ANCHOR.y)) * SCALE };
}

describe('the wasp', () => {
  it('is 16px from her jaws to the tip of her gaster', () => {
    const pose = waspRig(wasp('standing'), { now: 0, still: true });
    const body = flatLayers(pose.layers).flatMap((l) => (l.kind === 'image' && ['gaster', 'thorax', 'head'].includes(l.name) ? [l] : []));
    const length = (Math.max(...body.map((l) => l.x + l.width)) - Math.min(...body.map((l) => l.x))) * SCALE;
    expect(length).toBeGreaterThan(15.5);
    expect(length).toBeLessThan(16.5);
  });

  for (const pose of POSES) {
    it(`stays inside her ${pose} footprint through its whole cycle, either way round`, () => {
      const m = measured(pose);
      const f = FOOTPRINTS[pose];
      expect(m.half, `${pose} ${JSON.stringify(m)}`).toBeLessThanOrEqual(f.half);
      expect(m.up, `${pose} ${JSON.stringify(m)}`).toBeLessThanOrEqual(f.up);
      expect(m.down, `${pose} ${JSON.stringify(m)}`).toBeLessThanOrEqual(f.down);
    });
  }

  it('stands with her claws where the model puts what she stands on', () => {
    expect((GROUND - ANCHOR.y) * SCALE).toBeCloseTo(STAND, 6);
  });

  it('stands on all six feet, on three or more shuffling, never below the ground', () => {
    for (const m of moments) {
      expect(feet(waspRig(wasp('standing'), { now: m.now, still: false })).filter((f) => Math.abs(f.y - GROUND) < 1e-9)).toHaveLength(6);
      const shuffling = feet(waspRig(wasp('feed', { walked: m.walked }), { now: m.now, still: false }));
      expect(shuffling.filter((f) => Math.abs(f.y - GROUND) < 1e-9).length).toBeGreaterThanOrEqual(3);
      expect(Math.max(...shuffling.map((f) => f.y))).toBeLessThanOrEqual(GROUND + 1e-9);
    }
  });

  it('carries all six legs on her thorax', () => {
    const pose = waspRig(wasp('standing'), { now: 0, still: true });
    const thorax = flatLayers(pose.layers).find((l): l is Extract<Layer, { kind: 'image' }> => l.kind === 'image' && l.name === 'thorax');
    const coxae = (pose.guides ?? []).filter((g) => g.name === 'coxa').map((g) => g.at);
    expect(coxae).toHaveLength(6);
    for (const c of coxae) {
      expect(c.x).toBeGreaterThan(thorax!.x - 1);
      expect(c.x).toBeLessThan(thorax!.x + thorax!.width);
      expect(c.y).toBeLessThan(thorax!.y + thorax!.height + 1);
    }
  });

  it('never blinks: an insect has no eyelids', () => {
    for (const pose of POSES) for (const m of moments) expect(lidsOf(waspRig(wasp(pose), { now: m.now, still: false }))).toEqual([]);
  });

  it('beats her wings as a shimmering blur in flight, folded on the cake', () => {
    const blur = (p: RigPose) => strokes(p, 'wing blur').length;
    expect(blur(waspRig(wasp('hover'), { now: 0, still: false }))).toBe(1);
    expect(blur(waspRig(wasp('feed'), { now: 0, still: false }))).toBe(0);
    // The third wing is somewhere new each frame.
    const third = (now: number) => JSON.stringify(waspRig(wasp('hover'), { now, still: false }).layers.at(-1));
    expect(new Set([0, 17, 34, 51].map(third)).size).toBeGreaterThan(2);
  });

  it('taps the sugar with her antennae in turn while she feeds', () => {
    const tip = (name: string, now: number) => strokes(waspRig(wasp('feed'), { now, still: false }), name)[1].points.at(-1)!.y;
    const near = Array.from({ length: 60 }, (_, i) => tip('near antenna', i * 20));
    const far = Array.from({ length: 60 }, (_, i) => tip('far antenna', i * 20));
    expect(Math.max(...near) - Math.min(...near)).toBeGreaterThan(0.5);
    expect(near.findIndex((y) => y === Math.max(...near))).not.toBe(far.findIndex((y) => y === Math.max(...far)));
  });

  it('holds still under reduced motion: standing, wings folded, nothing moving', () => {
    const drawn = (now: number, pose: WaspPose) => waspRig(wasp(pose, { walked: now / 50, speed: 40, lean: 10 }), { now, still: true });
    const first = drawn(0, 'hover');
    for (const now of [500, 1234, 4321]) expect(drawn(now, 'cruise')).toEqual(first);
    expect(strokes(first, 'wing blur')).toEqual([]);
    expect(feet(first).every((f) => Math.abs(f.y - GROUND) < 1e-9)).toBe(true);
  });
});
