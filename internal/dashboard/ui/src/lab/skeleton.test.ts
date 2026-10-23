import { describe, expect, it } from 'vitest';
import type { Point } from '../lib/theme/pointer';
import { turnAbout, type DrawnLeg, type RigPose } from '../lib/theme/rig/rig';
import { bee } from './critters/bee';
import { gull } from './critters/gull';
import { CRITTERS } from './critters/registry';
import { rabbit } from './critters/rabbit';
import { layLabels, legendOf, litBy, parseCode, skeletonOf, type Skeleton } from './skeleton';

const at = (mode: string, now = 1300) => ({ mode, now, walked: 1.3 });
const look = { gaze: 0, still: false };
const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
const joint = (s: Skeleton, code: string) => s.joints.find((j) => j.code === code);
const bone = (s: Skeleton, code: string) => s.bones.find((b) => b.code === code);

const foot = { src: '', fur: '', width: 2, height: 1, heel: { x: 0, y: 0 } };
const leg = (): DrawnLeg => ({
  limb: { hip: { x: 0, y: 0 }, knee: { x: 0, y: 2 }, ankle: { x: 0, y: 4 }, foot: { x: 1, y: 5 }, paw: 0 },
  art: { bone: '', boneFur: '', foot, knee: true }, width: 1, haunch: 1, fore: false, taper: false,
});
const pose = (layers: RigPose['layers'], guides: RigPose['guides'] = []): RigPose => ({ width: 10, height: 10, anchor: { x: 5, y: 9 }, scale: 1, layers, guides });
const HIND = { legs: () => ({ pair: 1, limb: 'hind leg', upper: 'femur', middle: 'tibia', lower: 'metatarsus', foot: 'toes' }) };
const legs = (far: boolean, fur = false) => ({ kind: 'legs' as const, name: far ? 'far legs' : 'near legs', legs: [leg()], far, fur });

describe('skeletonOf', () => {
  it("codes a leg's joints from the body out and each bone between two of them, the foot's to its picture's tip", () => {
    const s = skeletonOf(pose([legs(false)], [{ name: 'stifle', at: { x: 0, y: 2 } }]), HIND);
    expect(s.groups).toEqual([{ code: 'L2', title: 'near hind leg', far: false }]);
    expect(s.joints.map((j) => [j.code, j.name])).toEqual([['L2J0', 'hip'], ['L2J1', 'stifle'], ['L2J2', 'ankle'], ['L2J3', 'foot'], ['L2J4', 'toe tip']]);
    expect(joint(s, 'L2J4')?.at).toEqual({ x: 3, y: 6 });
    expect(s.bones.map((b) => [b.code, b.name, b.from, b.to])).toEqual([
      ['L2B0', 'femur', 'L2J0', 'L2J1'], ['L2B1', 'tibia', 'L2J1', 'L2J2'], ['L2B2', 'metatarsus', 'L2J2', 'L2J3'], ['L2B3', 'toes', 'L2J3', 'L2J4'],
    ]);
  });

  it('reads each leg once, from its outlined pass, and through the groups it is drawn in', () => {
    const s = skeletonOf(pose([{ kind: 'group', turn: turnAbout(90, { x: 0, y: 0 }, 1, 0), layers: [legs(true), legs(true, true)] }]), HIND);
    expect(s.groups.map((g) => g.code)).toEqual(['L3']);
    expect(s.joints).toHaveLength(5);
    expect(s.joints.every((j) => j.far)).toBe(true);
    expect(joint(s, 'L3J1')?.at.x).toBeCloseTo(-1);
    expect(joint(s, 'L3J1')?.at.y).toBeCloseTo(0);
  });

  it("keeps a part's codes where its spec lists them, and its bones join any part's joints, near first", () => {
    const guides = [{ name: 'hip', at: { x: 0, y: 0 } }, { name: 'neck', at: { x: 6, y: 0 } }, { name: 'eye', at: { x: 7, y: -1 } }, { name: 'grip', at: { x: 9, y: 2 } }, { name: 'stands here', at: { x: 5, y: 9 } }];
    const s = skeletonOf(pose([legs(false)], guides), {
      ...HIND,
      head: { joints: ['neck', 'ear base', 'eye'], bones: [['neck', 'eye', 'skull']] },
      spine: { joints: ['tail root'], bones: [['tail root', 'hip', 'pelvis'], ['hip', 'neck', 'back']] },
    });
    expect(s.groups.map((g) => g.code)).toEqual(['L2', 'H', 'S', 'O']);
    expect(s.joints.filter((j) => !j.code.startsWith('L')).map((j) => [j.code, j.name])).toEqual([['HJ0', 'neck'], ['HJ2', 'eye'], ['OJ0', 'grip']]);
    expect(s.bones.filter((b) => !b.code.startsWith('L'))).toEqual([
      { code: 'HB0', name: 'skull', from: 'HJ0', to: 'HJ2', far: false }, { code: 'SB1', name: 'back', from: 'L2J0', to: 'HJ0', far: false },
    ]);
  });

  it("numbers the rabbit's limbs fore to hind, near before far, whatever the rig's order", () => {
    const s = skeletonOf(rabbit.pose(at('sit'), look), rabbit.bones);
    expect(s.groups.map((g) => `${g.code} ${g.title}`)).toEqual(['L0 near foreleg', 'L1 far foreleg', 'L2 near hind leg', 'L3 far hind leg', 'H head', 'S spine']);
    expect(s.joints.filter((j) => j.code.startsWith('L0')).map((j) => j.name)).toEqual(['shoulder', 'elbow', 'wrist (carpus)', 'forepaw', 'toe tip']);
    expect(s.bones.filter((b) => b.code.startsWith('L0')).map((b) => b.name)).toEqual(['humerus', 'radius and ulna', 'metacarpus', 'toes (phalanges)']);
    expect(s.bones.filter((b) => b.code.startsWith('L2')).map((b) => b.name)).toEqual(['femur', 'tibia and fibula', 'hind foot (metatarsus and toes)']);
    expect(bone(s, 'SB1')).toMatchObject({ from: 'L2J0', to: 'L0J0' });
    expect(bone(s, 'SB2')).toMatchObject({ from: 'L0J0', to: 'HJ0' });
    const wrist = (rabbit.pose(at('sit'), look).guides ?? []).filter((g) => g.name === 'wrist (carpus)').map((g) => g.at);
    expect(wrist.some((w) => near(w, joint(s, 'L0J2')?.at ?? { x: NaN, y: NaN }))).toBe(true);
  });

  it("numbers an insect's six legs front to back, near before far, from its joint marks", () => {
    const s = skeletonOf(bee.pose(at('crawl'), look), bee.bones);
    expect(s.groups.filter((g) => g.code.startsWith('L')).map((g) => `${g.code} ${g.title}`)).toEqual([
      'L0 near front leg', 'L1 far front leg', 'L2 near middle leg', 'L3 far middle leg', 'L4 near hind leg', 'L5 far hind leg',
    ]);
    expect(joint(s, 'L0J0')?.at.x ?? 0).toBeGreaterThan(joint(s, 'L4J0')?.at.x ?? 0);
    expect(bone(s, 'L5B1')?.name).toBe('tibia');
    expect(s.groups.some((g) => g.code === 'W0')).toBe(true);
  });

  it("makes a bird's marked wing its near forelimb, the back joining it to the near hip", () => {
    const s = skeletonOf(gull.pose(at('flap'), look), gull.bones);
    expect(s.groups.map((g) => g.code)).toEqual(['L0', 'L2', 'L3', 'S']);
    expect(s.joints.filter((j) => j.code.startsWith('L0')).map((j) => j.name)).toEqual(['shoulder', 'wrist', 'wingtip']);
    expect(bone(s, 'SB0')).toMatchObject({ from: 'L2J0', to: 'L0J0' });
  });

  it('finds bones for every animal drawn from parts, in every mode it has joints in (not one picture, asleep or curled up)', () => {
    for (const c of CRITTERS) {
      if (c.kind !== 'rig') continue;
      for (const mode of c.modes) {
        const p = c.pose(at(mode), look);
        if ((p.guides ?? []).length < 2) continue;
        const s = skeletonOf(p, c.bones ?? {});
        expect(s.bones.length, `${c.name} ${mode}`).toBeGreaterThan(0);
        expect(new Set(s.joints.map((j) => j.code)).size, `${c.name} ${mode}`).toBe(s.joints.length);
        expect(s.bones.every((b) => joint(s, b.from) && joint(s, b.to)), `${c.name} ${mode}`).toBe(true);
      }
    }
  });
});

describe('codes', () => {
  const s = skeletonOf(rabbit.pose(at('sit'), look), rabbit.bones);

  it('reads a code back to its part, kind and place', () => {
    expect(parseCode('L0B2')).toEqual({ group: 'L0', kind: 'B', index: 2 });
    expect(parseCode('W0J0')).toEqual({ group: 'W0', kind: 'J', index: 0 });
    expect(parseCode('elbow')).toBeNull();
  });

  it('lights a bone with its two joints, a joint alone', () => {
    expect([...litBy(s, 'L0B2')]).toEqual(['L0B2', 'L0J2', 'L0J3']);
    expect([...litBy(s, 'L0J1')]).toEqual(['L0J1']);
    expect(litBy(s, null).size).toBe(0);
  });

  it("lists a limb's rows along it, joint and bone in turn", () => {
    const [first] = legendOf(s);
    expect(first.group.code).toBe('L0');
    expect(first.rows.map((r) => r.code)).toEqual(['L0J0', 'L0B0', 'L0J1', 'L0B1', 'L0J2', 'L0B2', 'L0J3', 'L0B3', 'L0J4']);
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
