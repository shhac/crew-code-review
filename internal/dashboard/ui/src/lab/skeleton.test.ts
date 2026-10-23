import { describe, expect, it } from 'vitest';
import type { Point } from '../lib/theme/pointer';
import { turnAbout, type DrawnLeg, type RigPose } from '../lib/theme/rig/rig';
import { bee } from './critters/bee';
import { CRITTERS } from './critters/registry';
import { rabbit } from './critters/rabbit';
import { layLabels, skeletonOf, type Bone } from './skeleton';

const at = (mode: string) => ({ mode, now: 1300, walked: 1.3 });
const look = { gaze: 0, still: false };
const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
const named = (bones: readonly Bone[], name: string) => bones.filter((b) => b.name === name);

const foot = { src: '', fur: '', width: 2, height: 1, heel: { x: 0, y: 0 } };
const leg = (far: boolean): DrawnLeg => ({
  limb: { hip: { x: 0, y: 0 }, knee: { x: 0, y: 2 }, ankle: { x: 0, y: 4 }, foot: { x: 1, y: 5 }, paw: 0 },
  art: { bone: '', boneFur: '', foot, knee: true }, width: 1, haunch: 1, fore: false, taper: false,
});
const pose = (layers: RigPose['layers'], guides: RigPose['guides'] = []): RigPose => ({ width: 10, height: 10, anchor: { x: 5, y: 9 }, scale: 1, layers, guides });
const NAMES = { legs: () => ({ upper: 'femur', middle: 'tibia', lower: 'metatarsus', foot: 'toes' }) };

describe('skeletonOf', () => {
  it('runs every bone of a leg from joint to joint, then along its foot to the toes', () => {
    const { bones } = skeletonOf(pose([{ kind: 'legs', name: 'near legs', legs: [leg(false)], far: false, fur: false }]), NAMES);
    expect(bones.map((b) => [b.name, b.from, b.to])).toEqual([
      ['femur', { x: 0, y: 0 }, { x: 0, y: 2 }], ['tibia', { x: 0, y: 2 }, { x: 0, y: 4 }],
      ['metatarsus', { x: 0, y: 4 }, { x: 1, y: 5 }], ['toes', { x: 1, y: 5 }, { x: 3, y: 6 }],
    ]);
  });

  it('reads each leg once, from its outlined pass, and through the groups it is drawn in', () => {
    const legs = [false, true].map((fur) => ({ kind: 'legs' as const, name: 'far legs', legs: [leg(true)], far: true, fur }));
    const { bones } = skeletonOf(pose([{ kind: 'group', turn: turnAbout(90, { x: 0, y: 0 }, 1, 0), layers: legs }]), NAMES);
    expect(bones).toHaveLength(4);
    expect(bones.every((b) => b.far)).toBe(true);
    expect(bones[0].to.x).toBeCloseTo(-1);
    expect(bones[0].to.y).toBeCloseTo(0);
  });

  it("tells a far joint's mark from its near twin's, and joins named marks by the near one", () => {
    const layers: RigPose['layers'] = [{ kind: 'legs', name: 'far legs', legs: [leg(true)], far: true, fur: false }];
    const guides = [{ name: 'hip', at: { x: 0, y: 0 } }, { name: 'hip', at: { x: 3, y: 0 } }, { name: 'neck', at: { x: 6, y: 0 } }, { name: 'stands here', at: { x: 5, y: 9 } }];
    const { joints, bones } = skeletonOf(pose(layers, guides), { between: [['hip', 'neck', 'back'], ['hip', 'tail', 'tail']] });
    expect(joints.map((j) => [j.name, j.far])).toEqual([['hip', true], ['hip', false], ['neck', false]]);
    expect(bones).toEqual([{ name: 'back', from: { x: 3, y: 0 }, to: { x: 6, y: 0 }, far: false }]);
  });

  it("gives the rabbit's forelegs four bones and its hind legs three, each ending on the rig's own joints", () => {
    const p = rabbit.pose(at('sit'), look);
    const { bones } = skeletonOf(p, rabbit.bones);
    expect(named(bones, 'metacarpus')).toHaveLength(2);
    expect(named(bones, 'toes (phalanges)')).toHaveLength(2);
    expect(named(bones, 'hind foot (metatarsus and toes)')).toHaveLength(2);
    expect(named(bones, 'metatarsus')).toHaveLength(0);
    const wrists = (p.guides ?? []).filter((g) => g.name === 'wrist (carpus)').map((g) => g.at);
    expect(named(bones, 'metacarpus').every((b) => wrists.some((w) => near(w, b.from)))).toBe(true);
  });

  it("runs an insect's legs through its joint marks, six legs of three bones", () => {
    const { bones } = skeletonOf(bee.pose(at('crawl'), look), bee.bones);
    expect(named(bones, 'tibia')).toHaveLength(6);
    expect(named(bones, 'tarsus').filter((b) => b.far)).toHaveLength(3);
  });

  it('finds bones for every animal drawn from parts, in every mode it has joints in (not one picture, asleep or curled up)', () => {
    for (const c of CRITTERS) {
      if (c.kind !== 'rig') continue;
      for (const mode of c.modes) {
        const p = c.pose(at(mode), look);
        if ((p.guides ?? []).length < 2) continue;
        expect(skeletonOf(p, c.bones ?? {}).bones.length, `${c.name} ${mode}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('layLabels', () => {
  const label = (text: string, x: number) => ({ text, at: { x, y: 0 }, toward: { x: 1, y: 0 }, px: 10 });

  it('lays a label beside its point, its way', () => {
    expect(layLabels([label('knee', 0)], 1)).toEqual([{ ...label('knee', 0), x: 5, y: 0, anchor: 'start', moved: false }]);
  });

  it('moves a label off one laid before it, and marks it moved off its own line', () => {
    const [first, second] = layLabels([label('stifle', 0), label('stifle', 0)], 1);
    expect(second.anchor === 'end' || Math.abs(second.y - first.y) >= 12).toBe(true);
    const crowded = layLabels([label('a', 0), label('a', 0), label('a', 0)], 1);
    expect(crowded[2].moved).toBe(true);
  });
});
