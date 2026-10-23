import { describe, expect, it } from 'vitest';
import { rabbitRig as rabbitDrawnAsBefore } from '../lib/theme/easter/rabbit-rig-legacy';
import { crowRig as crowDrawnAsBefore } from '../lib/theme/harvest/crow-rig-legacy';
import type { Point } from '../lib/theme/pointer';
import { turnAbout, type DrawnLeg, type RigPose } from '../lib/theme/rig/rig';
import { gullRig as gullDrawnAsBefore } from '../lib/theme/seaside/gull-rig-legacy';
import { pigeonRig as pigeonDrawnAsBefore } from '../lib/theme/wimbledon/pigeon-rig-legacy';
import { bee } from './critters/bee';
import { BIRD, mammalHead, mammalLeg, mammalSpine } from './critters/bones';
import { crowAt } from './critters/crow';
import { gullAt } from './critters/gull';
import { hawk } from './critters/hawk';
import { pigeonAt } from './critters/pigeon';
import { rabbitAt } from './critters/rabbit';
import { CRITTERS } from './critters/registry';
import { layColumns, legendOf, litBy, parseCode, skeletonFromPosed, skeletonOf, type BoneNames, type Skeleton } from './skeleton';

const at = (mode: string, now = 1300) => ({ mode, now, walked: 1.3 });
const look = { gaze: 0, still: false };
const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
const joint = (s: Skeleton, code: string) => s.joints.find((j) => j.code === code);
const bone = (s: Skeleton, code: string) => s.bones.find((b) => b.code === code);
// The reader's own subject: the rabbit as rigs were drawn before it had its
// own skeleton, read off its drawing with the names its lab entry gave it,
// as an animal not yet on a skeleton still is.
const drawnRabbit = (mode: string) => rabbitDrawnAsBefore(rabbitAt(at(mode)), { now: at(mode).now, ...look });
const RABBIT_BONES: BoneNames = {
  legs: ({ fore }) => (fore ? mammalLeg({ fore }) : { ...mammalLeg({ fore }), foot: 'hind foot (metatarsus and toes)' }),
  head: mammalHead('ear base', 'eye', 'nose'),
  spine: mammalSpine(true),
};

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

  it('runs the spine from the head joint to the tail through the limbs\' roots, and the head\'s features from the head joint out', () => {
    const guides = [{ name: 'hip', at: { x: 0, y: 0 } }, { name: 'neck', at: { x: 6, y: 0 } }, { name: 'eye', at: { x: 7, y: -1 } }, { name: 'grip', at: { x: 9, y: 2 } }, { name: 'stands here', at: { x: 5, y: 9 } }];
    const tail = { kind: 'group' as const, turn: turnAbout(0, { x: -3, y: 1 }, 0.5, 0), layers: [{ kind: 'image' as const, name: 'tail', src: '', x: 0, y: 0, width: 1, height: 1 }] };
    const s = skeletonOf(pose([legs(false), tail], guides), {
      ...HIND,
      spine: [{ mark: 'neck', name: 'head joint', line: 'neck line' }, { mark: 'shoulder' }, { mark: 'hip', line: 'pelvis line' }, { pivot: 'tail', name: 'tail root' }],
      head: { joints: [{ mark: 'ear base' }, { mark: 'eye' }], bones: [['head joint', 'eye', 'skull']] },
    });
    expect(s.groups.map((g) => g.code)).toEqual(['L2', 'S', 'H', 'O']);
    expect(s.joints.filter((j) => !j.code.startsWith('L')).map((j) => [j.code, j.name, j.at])).toEqual([
      ['SJ0', 'head joint', { x: 6, y: 0 }], ['SJ1', 'tail root', { x: -2.5, y: 1 }], ['HJ0', 'eye', { x: 7, y: -1 }], ['OJ0', 'grip', { x: 9, y: 2 }],
    ]);
    expect(s.bones.filter((b) => !b.code.startsWith('L'))).toEqual([
      { code: 'SB0', name: 'neck line (head joint to hip)', from: 'SJ0', to: 'L2J0', far: false },
      { code: 'SB1', name: 'pelvis line (hip to tail root)', from: 'L2J0', to: 'SJ1', far: false },
      { code: 'HB0', name: 'skull', from: 'SJ0', to: 'HJ0', far: false },
    ]);
  });

  it("numbers the rabbit's limbs fore to hind, near before far, whatever the rig's order", () => {
    const s = skeletonOf(drawnRabbit('sit'), RABBIT_BONES);
    expect(s.groups.map((g) => `${g.code} ${g.title}`)).toEqual(['L0 near foreleg', 'L1 far foreleg', 'L2 near hind leg', 'L3 far hind leg', 'S spine', 'H head']);
    expect(s.joints.filter((j) => j.code.startsWith('L0')).map((j) => j.name)).toEqual(['shoulder', 'elbow', 'wrist (carpus)', 'forepaw', 'toe tip']);
    expect(s.bones.filter((b) => b.code.startsWith('L0')).map((b) => b.name)).toEqual(['humerus', 'radius and ulna', 'metacarpus', 'toes (phalanges)']);
    expect(s.bones.filter((b) => b.code.startsWith('L2')).map((b) => b.name)).toEqual(['femur', 'tibia and fibula', 'hind foot (metatarsus and toes)']);
    expect(s.bones.filter((b) => b.code.startsWith('S')).map((b) => [b.code, b.from, b.to])).toEqual([['SB0', 'SJ0', 'L0J0'], ['SB1', 'L0J0', 'L2J0'], ['SB2', 'L2J0', 'SJ1']]);
    expect(s.joints.filter((j) => /^[SH]/.test(j.code)).map((j) => `${j.code} ${j.name}`)).toEqual(['SJ0 head joint (neck)', 'SJ1 tail root', 'HJ0 ear base', 'HJ1 eye', 'HJ2 nose']);
    expect(bone(s, 'HB0')).toMatchObject({ name: 'skull', from: 'SJ0', to: 'HJ2' });
    const wrist = (drawnRabbit('sit').guides ?? []).filter((g) => g.name === 'wrist (carpus)').map((g) => g.at);
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

  it("makes a bird's marked wing its near forelimb, its spine from the pivots its pictures turn about", () => {
    const p = gullDrawnAsBefore(gullAt(at('flap')), { now: at('flap').now, still: false });
    const s = skeletonOf(p, BIRD);
    expect(s.groups.map((g) => g.code)).toEqual(['L0', 'L1', 'L2', 'L3', 'S', 'H']);
    expect(s.joints.filter((j) => j.code.startsWith('L1')).map((j) => [j.name, j.far])).toEqual([['shoulder', true], ['wrist', true], ['wingtip', true]]);
    // The far wing's shoulder is its group's root, posed by the rig: where the far wing joins the body.
    expect(joint(s, 'L1J0')?.at.x).not.toBeCloseTo(joint(s, 'L0J0')?.at.x ?? 0);
    expect(s.joints.filter((j) => j.code.startsWith('L0')).map((j) => j.name)).toEqual(['shoulder', 'wrist', 'wingtip']);
    expect(s.bones.filter((b) => b.code.startsWith('S')).map((b) => [b.from, b.to])).toEqual([['SJ0', 'L0J0'], ['L0J0', 'SJ1'], ['SJ1', 'L2J0'], ['L2J0', 'SJ2']]);
    expect(s.joints.filter((j) => /^[SH]/.test(j.code)).map((j) => j.name)).toEqual(['head joint', 'body pivot', 'tail root', 'jaw hinge (lower mandible)']);
    const walking = skeletonOf(pigeonDrawnAsBefore(pigeonAt(at('stand')), { now: at('stand').now, still: false }), BIRD);
    expect(walking.joints.filter((j) => j.code.startsWith('S')).map((j) => j.name)).toEqual(['head joint', 'neck base', 'body pivot', 'tail root']);
    expect(skeletonOf(crowDrawnAsBefore(crowAt(at('walk')), { now: at('walk').now, ...look }), BIRD).bones.filter((b) => b.code.startsWith('S'))).toHaveLength(3);
    // The hawk's tail is drawn in its body's group, so has no pivot of its own.
    expect(skeletonOf(hawk.pose(at('glide'), look), hawk.bones).joints.filter((j) => j.code.startsWith('S')).map((j) => j.name)).toEqual(['head joint', 'body pivot']);
  });

  it("carries a near wing's marks to the far wing drawn the same, by the far wing's own group, never a fanned tail's", () => {
    const wing = (far: boolean, dx: number) => ({
      kind: 'group' as const, turn: turnAbout(0, { x: 0, y: 0 }, dx, 0), foreshorten: 0.5,
      layers: [{ kind: 'image' as const, name: 'wing arm', src: '', x: 0, y: 0, width: 1, height: 1, far }],
    });
    const tail = { ...wing(false, 9), layers: [{ kind: 'image' as const, name: 'tail, fanned', src: '', x: 0, y: 0, width: 1, height: 1 }] };
    const marks = [{ name: 'shoulder', at: { x: 1, y: 0 } }, { name: 'wrist', at: { x: 1, y: -2 } }, { name: 'wingtip', at: { x: 2, y: -4 } }];
    const s = skeletonOf(pose([wing(true, 4), tail, wing(false, 1)], marks), { marked: [{ joints: ['shoulder', 'wrist', 'wingtip'], bones: ['arm', 'hand'], limb: () => 'wing', pair: 0, twin: true }] });
    expect(s.groups.map((g) => `${g.code} ${g.title}`)).toEqual(['L0 near wing', 'L1 far wing']);
    expect(s.joints.filter((j) => j.code.startsWith('L1')).map((j) => j.at)).toEqual([{ x: 4, y: 0 }, { x: 4, y: -2 }, { x: 5, y: -4 }]);
  });

  it('finds bones for every animal drawn from parts, in every mode it has joints in (not one picture, asleep or curled up)', () => {
    for (const c of CRITTERS) {
      if (c.kind !== 'rig') continue;
      for (const mode of c.modes) {
        const p = c.pose(at(mode), look);
        if ((p.guides ?? []).length < 2) continue;
        // As the lab draws it: from its own skeleton where it is built on one.
        const s = p.skeleton ? skeletonFromPosed(p.skeleton) : skeletonOf(p, c.bones ?? {});
        expect(s.bones.length, `${c.name} ${mode}`).toBeGreaterThan(0);
        expect(new Set(s.joints.map((j) => j.code)).size, `${c.name} ${mode}`).toBe(s.joints.length);
        expect(s.bones.every((b) => joint(s, b.from) && joint(s, b.to)), `${c.name} ${mode}`).toBe(true);
      }
    }
  });
});

describe('codes', () => {
  const s = skeletonOf(drawnRabbit('sit'), RABBIT_BONES);

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

describe('layColumns', () => {
  const label = (text: string, x: number, y: number) => ({ text, at: { x, y }, px: 10 });
  const around = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

  it('stands each label beyond the skeleton on its own side, at its point\'s height while there is room', () => {
    expect(layColumns([label('L0J0', 90, 5), label('L2J0', 10, 40)], 1, around)).toEqual([
      { ...label('L2J0', 10, 40), x: -22, y: 40, anchor: 'end' }, { ...label('L0J0', 90, 5), x: 122, y: 5, anchor: 'start' },
    ]);
  });

  it('stacks crowded labels a line apart, in their points\' order, centred where they would be', () => {
    const laid = layColumns([label('b', 80, 1), label('a', 80, 0), label('c', 80, 2)], 1, around);
    expect(laid.map((l) => l.text)).toEqual(['a', 'b', 'c']);
    expect(laid.map((l) => l.y)).toEqual([-12.5, 1, 14.5]);
  });
});
