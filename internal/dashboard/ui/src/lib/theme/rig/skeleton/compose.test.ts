import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Point } from '../../pointer';
import { legsTo, type QuadLeg } from '../gait';
import Rig from '../Rig.svelte';
import { legImages, lidLayers, stillPicture, turnAbout, turned, type DrawnLeg, type Frame, type Layer, type LimbArt, type RigPose } from '../rig';
import { rigBounds } from '../test-rig';
import { compose } from './compose';
import { rootsOf } from './forward';
import { wholePicture } from './picture';
import { planDiff, planOf } from './plan';
import type { Body, JointSpec, LimbSpec, Piece, PoseSpec, Skeleton } from './types';

const FRAME: Frame = { width: 30, height: 20, anchor: { x: 15, y: 18 }, scale: 1.5 };
const drawing = (layers: readonly Layer[]): RigPose => ({ ...FRAME, layers });
const joint = (id: string, parent: string | null, at: Point, more: Partial<JointSpec> = {}): JointSpec =>
  ({ id, parent, at, role: { part: 'spine', index: 0 }, name: id, ...more });
const posing = (over: Partial<PoseSpec> = {}): PoseSpec => ({ root: turnAbout(0, { x: 0, y: 0 }), joints: {}, limbs: {}, show: {}, z: {}, ...over });
const drawn = (body: Body, pose: PoseSpec | ((now: number) => PoseSpec), now = 0) => compose(body, typeof pose === 'function' ? pose : () => pose, now);
// Two drawings draw the same, guides aside (a composed animal marks its
// joints).
const same = (a: RigPose, b: RigPose) => planDiff({ ...planOf(a), guides: [] }, { ...planOf(b), guides: [] });

const box = { x: 4, y: 3, width: 8, height: 5 };
const picture = (name: string, src: string, b = box, hidden = false): Layer => ({ kind: 'image', name, src, ...b, hidden });

describe('a piece hung on a joint', () => {
  const skeleton: Skeleton = { joints: [joint('body', null, { x: 10, y: 8 }), joint('skull', 'body', { x: 14, y: 6 })], bones: [], limbs: [] };
  const head: Piece = { id: 'head', art: { open: { src: 'head.webp', box }, shut: { src: 'head-shut.webp', box } }, at: { kind: 'joint', to: 'skull' }, draws: [{ id: 'head', z: 1 }] };
  const body: Body = { frame: FRAME, skeleton, pieces: [{ id: 'body', art: { drawn: { src: 'body.webp', box: { x: 2, y: 2, width: 16, height: 10 } } }, at: { kind: 'joint', to: 'body' }, draws: [{ id: 'body', z: 0 }] }, head] };
  const root = turnAbout(-12, { x: 10, y: 8 }, 0.5, -0.3);

  it('is drawn as a picture in its joint\'s groups, the body breathing and the head turned in it', () => {
    const pose = posing({ root, joints: { body: { squash: { by: 1.03 } }, skull: { angle: 20, shift: { x: 0.4, y: 0 } } } });
    const groups = drawing([{
      kind: 'group', turn: root, scaleY: 1.03,
      layers: [picture('body', 'body.webp', { x: 2, y: 2, width: 16, height: 10 }), { kind: 'group', turn: turnAbout(20, { x: 14, y: 6 }, 0.4, 0), layers: [picture('head', 'head.webp'), picture('head', 'head-shut.webp', box, true)] }],
    }]);
    expect(same(drawn(body, pose), groups)).toEqual([]);
  });

  it('shows the variant the pose asks for, every other one mounted but unseen, or none', () => {
    const shown = (show: PoseSpec['show']) => drawn(body, posing({ show })).layers.flatMap((l) => (l.kind === 'piece' && !l.hidden ? [l.src] : []));
    expect(shown({})).toEqual(['body.webp', 'head.webp']);
    expect(shown({ head: 'shut' })).toEqual(['body.webp', 'head-shut.webp']);
    expect(shown({ head: false })).toEqual(['body.webp']);
    expect(drawn(body, posing({ show: { head: false } })).layers).toHaveLength(3);
    expect(() => drawn(body, posing({ show: { head: 'yawn' } }))).toThrow(/no yawn/);
  });

  it('keeps every draw in its slot from frame to frame, moving one only where the pose moves its z', () => {
    const ids = (pose: PoseSpec) => drawn(body, pose).layers.map((l) => (l.kind === 'piece' ? l.id : ''));
    expect(ids(posing())).toEqual(['body', 'head (open)', 'head (shut)']);
    expect(ids(posing({ joints: { skull: { angle: 30 } } }))).toEqual(ids(posing()));
    expect(ids(posing({ z: { head: -1 } }))).toEqual(['head (open)', 'head (shut)', 'body']);
    expect(() => ids(posing({ z: { tail: 2 } }))).toThrow(/no draw tail/);
  });

  it('draws each slot as one image placed by its matrix, and its box counts in the bounds', () => {
    const pose = drawn(body, posing({ root, joints: { skull: { angle: 20 } } }));
    const markup = render(Rig, { props: { pose, x: 0, y: 0 } }).body;
    expect(markup).toMatch(/<image[^>]*href="head\.webp"[^>]*transform="matrix\([^)]+\)"/);
    expect(markup).toMatch(/href="head-shut\.webp"[^>]*visibility="hidden"/);
    const groups = drawing([{ kind: 'group', turn: root, layers: [picture('body', 'body.webp', { x: 2, y: 2, width: 16, height: 10 }), { kind: 'group', turn: turnAbout(20, { x: 14, y: 6 }), layers: [picture('head', 'head.webp')] }] }]);
    expect(rigBounds(pose)).toEqual(expect.objectContaining(Object.fromEntries(Object.entries(rigBounds(groups)).map(([k, v]) => [k, expect.closeTo(v, 9)]))));
  });
});

describe('a piece hung on a bone, or stretched between two handles', () => {
  const tailRoot = { x: 6, y: 9 };
  const skeleton: Skeleton = {
    joints: [joint('body', null, { x: 12, y: 9 }), joint('tail', 'body', tailRoot), joint('tail tip', 'tail', { x: 2, y: 6 }), joint('skull', 'body', { x: 18, y: 5 })],
    bones: [{ from: 'tail', to: 'tail tip', name: 'tail' }],
    limbs: [],
  };
  // Measured in the neck's own picture, as the pigeon's are (pigeon-rig.ts).
  const NECK = { x: 14, y: 3, width: 6, height: 6 };
  const ROOT = { x: 15, y: 8.5 }, TOP = { x: 18.5, y: 4.2 }, HELD = 1.3;
  const tail: Piece = { id: 'tail', art: { drawn: { src: 'tail.webp', box: { x: 1, y: 5, width: 6, height: 4 } } }, at: { kind: 'bone', from: 'tail', to: 'tail tip' }, draws: [{ id: 'tail', z: 0 }] };
  const neck: Piece = {
    id: 'neck', art: { drawn: { src: 'neck.webp', fur: 'neck-fur.webp', box: NECK } }, draws: [{ id: 'neck', z: 1 }, { id: 'neck, fur', z: 2, fur: true }],
    at: { kind: 'span', from: { on: 'body', at: ROOT }, to: { on: 'skull', at: TOP }, art: { from: ROOT, to: TOP }, fixed: HELD },
  };
  const body: Body = { frame: FRAME, skeleton, pieces: [tail, neck] };

  it('carries a bone\'s piece rigidly as the bone turns', () => {
    const pose = posing({ root: turnAbout(8, { x: 12, y: 9 }), joints: { tail: { angle: -25 } } });
    const groups = drawing([{ kind: 'group', turn: turnAbout(8, { x: 12, y: 9 }), layers: [{ kind: 'group', turn: turnAbout(-25, tailRoot), layers: [picture('tail', 'tail.webp', { x: 1, y: 5, width: 6, height: 4 })] }] }]);
    expect(same({ ...drawn(body, pose), layers: drawn(body, pose).layers.slice(0, 1) }, groups)).toEqual([]);
  });

  it('measures a bone with the breath above it taken out, though its joints are drawn breathing', () => {
    const breathing = drawn(body, posing({ root: turnAbout(8, { x: 12, y: 9 }), joints: { body: { squash: { by: 1.2 } }, tail: { angle: -25 } } }));
    const tip = breathing.skeleton?.joints.find((j) => j.id === 'tail tip')?.at;
    expect(tip && turned(turnAbout(8, { x: 12, y: 9 }), turned(turnAbout(-25, tailRoot), { x: 2, y: 6 })).y - tip.y).not.toBeCloseTo(0, 3);
    expect(breathing.skeleton?.bones.map((b) => b.length)).toEqual([expect.closeTo(Math.hypot(4, 3), 9)]);
  });

  it('stretches a span as the pigeon\'s neck is stood up, stretched from where it is held and leant to the head, breath and all', () => {
    const lean = (from: Point, to: Point) => (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
    const length = Math.hypot(TOP.x - ROOT.x, TOP.y - ROOT.y);
    const neckOf = (head: Parameters<typeof turned>[0], src: string): Layer => {
      const top = turned(head, TOP);
      const stood: Layer = { kind: 'group', turn: turnAbout(-lean(ROOT, TOP), ROOT), layers: [picture('neck', src, NECK)] };
      const stretched: Layer = { kind: 'group', turn: turnAbout(0, { x: ROOT.x, y: ROOT.y - HELD }), foreshorten: (Math.hypot(top.x - ROOT.x, top.y - ROOT.y) - HELD) / (length - HELD), layers: [stood] };
      return { kind: 'group', turn: turnAbout(lean(ROOT, top), ROOT), layers: [stretched] };
    };
    for (const [angle, shift, breath] of [[30, { x: 1.2, y: 0.4 }, 1], [-10, { x: 2, y: -0.5 }, 1.04]] as const) {
      const root = turnAbout(5, { x: 12, y: 9 }, 0.2, 0.1);
      const head = turnAbout(angle, { x: 18, y: 5 }, shift.x, shift.y);
      const pose = posing({ root, joints: { body: { squash: { by: breath } }, skull: { angle, shift } } });
      const composed = drawn(body, pose);
      const groups = drawing([{ kind: 'group', turn: root, scaleY: breath, layers: [neckOf(head, 'neck.webp'), neckOf(head, 'neck-fur.webp')] }]);
      expect(same({ ...composed, layers: composed.layers.slice(1) }, groups)).toEqual([]);
    }
  });
});

describe('a leg built on a limb', () => {
  const foot = { src: 'foot.webp', fur: 'foot-fur.webp', width: 3, height: 2, heel: { x: 1, y: 1.2 } };
  const curled = { src: 'curled.webp', fur: 'curled-fur.webp', width: 2, height: 2.4, heel: { x: 0.8, y: 0.5 } };
  const art: LimbArt = { bone: 'bone.webp', boneFur: 'bone-fur.webp', thigh: { src: 'thigh.webp', fur: 'thigh-fur.webp', anchors: { start: 0.2, end: 0.9 } }, knee: true, foot, curled };
  const leg: QuadLeg = { hip: { x: 8, y: 10 }, reach: 0.5, thigh: 3, shin: 3, bend: 1, fore: false, far: true, walksOn: { kind: 'toes', length: 1.4, lean: 12, fold: 60 } };
  const limb: LimbSpec = { id: 'hind', pair: 1, side: 'far', joints: { root: 'L3J0', middle: 'L3J1', lower: 'L3J2', end: 'L3J3' }, ground: 15.8, solve: 'quad', leg: { reach: 0.5, thigh: 3, shin: 3, bend: 1, walksOn: leg.walksOn } };
  const role = (index: 0 | 1 | 2 | 3) => ({ part: 'limb', pair: 1, side: 'far', index }) as const;
  const skeleton: Skeleton = {
    joints: [
      joint('body', null, { x: 12, y: 9 }), joint('L3J0', 'body', leg.hip, { role: role(0) }),
      ...(['L3J1', 'L3J2', 'L3J3'] as const).map((id, i) => joint(id, 'L3J0', { x: 0, y: 0 }, { derived: true, role: role(i === 0 ? 1 : i === 1 ? 2 : 3) })),
    ],
    bones: [{ from: 'L3J0', to: 'L3J1', name: 'femur' }, { from: 'L3J1', to: 'L3J2', name: 'tibia' }, { from: 'L3J2', to: 'L3J3', name: 'metatarsus' }],
    limbs: [limb],
  };
  const bar = (id: string, from: string, to: string, thick: number, src: string, fur: string, anchors?: { start: number; end: number }): Piece =>
    ({ id, art: { drawn: { src, fur } }, at: { kind: 'bar', from, to, thick, anchors }, side: 'far', draws: [{ id, z: 0 }, { id: `${id}, fur`, z: 1, fur: true, flush: id === 'thigh' }] });
  const footPiece: Piece = {
    id: 'foot', side: 'far', hide: 'opacity', at: { kind: 'joint', to: 'L3J3', local: true }, draws: [{ id: 'foot', z: 0 }, { id: 'foot, fur', z: 1, fur: true }],
    art: { toes: { src: foot.src, fur: foot.fur, box: { x: -foot.heel.x, y: -foot.heel.y, width: foot.width, height: foot.height } }, curled: { src: curled.src, fur: curled.fur, box: { x: -curled.heel.x, y: -curled.heel.y, width: curled.width, height: curled.height } } },
  };
  const body: Body = { frame: FRAME, skeleton, pieces: [bar('thigh', 'L3J0', 'L3J1', 2.4, 'thigh.webp', 'thigh-fur.webp', { start: 0.2, end: 0.9 }), bar('shank', 'L3J1', 'L3J2', 1.6, 'bone.webp', 'bone-fur.webp'), bar('toes', 'L3J2', 'L3J3', 1.6, 'bone.webp', 'bone-fur.webp'), footPiece] };

  it('lays its bars and its foot exactly as legImages does, the far side shaded and the fur pass flush from the hip', () => {
    const root = turnAbout(-6, { x: 12, y: 9 }, 0, -0.4);
    for (const [at, step] of [[{ x: 9, y: 15.8 }, { down: true, t: 0.5 }], [{ x: 10, y: 14.6 }, { down: false, t: 0.4 }]] as const) {
      const curl = !step.down;
      const pose = posing({ root, joints: { body: { squash: { by: 1.05 } } }, limbs: { hind: { kind: 'plant', at, step } }, show: { foot: curl ? 'curled' : 'toes' } });
      const hip = turned(root, leg.hip);
      const [posed] = legsTo([leg], [hip], [at], [step]);
      const drawnLeg: DrawnLeg = { limb: { ...posed, curled: curl }, art, width: 1.6, haunch: 2.4, fore: false, taper: false };
      const groups = drawing([false, true].map((fur) => ({ kind: 'legs', name: 'far legs', legs: [drawnLeg], far: true, fur })));
      expect(legImages(drawnLeg, false).map((i) => i.href)).toEqual(['thigh.webp', 'bone.webp', 'bone.webp', 'foot.webp', 'curled.webp']);
      expect(same(drawn(body, pose), groups)).toEqual([]);
      expect(drawn(body, pose).layers.every((l) => l.kind === 'piece' && l.leg)).toBe(true);
    }
  });

  it('places the joints the limb owns where the solver puts them, coded by role, its root turned with the body but never breathing', () => {
    const root = turnAbout(10, { x: 12, y: 9 });
    const pose = drawn(body, posing({ root, joints: { body: { squash: { by: 1.2 } } } }));
    const hip = turned(root, leg.hip);
    const [standing] = legsTo([leg], [hip], [{ x: hip.x + 0.5, y: 15.8 }]);
    expect(pose.skeleton?.limbs.map((l) => [l.code, l.limb])).toEqual([['L3', standing]]);
    expect(pose.skeleton?.joints.map((j) => [j.code, j.derived, j.far])).toEqual([['SJ0', false, false], ['L3J0', false, true], ['L3J1', true, true], ['L3J2', true, true], ['L3J3', true, true]]);
    expect(pose.skeleton?.bones.map((b) => b.code)).toEqual(['L3B0', 'L3B1', 'L3B2']);
    expect(pose.skeleton?.bones.map((b) => b.length)).toEqual([expect.closeTo(3, 9), expect.closeTo(3, 9), expect.closeTo(1.4, 9)]);
  });
});

describe('a trailing joint', () => {
  const skeleton: Skeleton = { joints: [joint('body', null, { x: 10, y: 8 }), joint('tail', 'body', { x: 4, y: 8 }, { trail: { lag: 90 } })], bones: [], limbs: [] };
  const tail: Piece = { id: 'tail', art: { drawn: { src: 'tail.webp', box: { x: 0, y: 5, width: 5, height: 4 } } }, at: { kind: 'joint', to: 'tail' }, draws: [{ id: 'tail', z: 0 }] };
  const body: Body = { frame: FRAME, skeleton, pieces: [tail] };
  const bounce = (now: number) => posing({ root: turnAbout(10 * Math.sin(now / 200), { x: 10, y: 8 }, 0, Math.sin(now / 150)), joints: { tail: { angle: 5 * Math.cos(now / 300) } } });

  it('turns as it did a lag before, hanging where it is now', () => {
    const now = 1234;
    const was = bounce(now - 90), is = bounce(now);
    const at = turned(is.root, { x: 4, y: 8 });
    const angle = was.root.angle + (was.joints.tail?.angle ?? 0);
    const groups = drawing([{ kind: 'group', turn: turnAbout(angle, { x: 4, y: 8 }, at.x - 4, at.y - 8), layers: [picture('tail', 'tail.webp', { x: 0, y: 5, width: 5, height: 4 })] }]);
    expect(same(drawn(body, bounce, now), groups)).toEqual([]);
  });
});

describe('shapes, guides and a whole picture', () => {
  const EYE = { x: 16, y: 6 };
  const FUR = { fill: '#fdd79b', outline: '#140c05' };
  const skeleton: Skeleton = { joints: [joint('body', null, { x: 10, y: 8 }), joint('skull', 'body', { x: 14, y: 6 }), joint('eye', 'skull', EYE, { role: { part: 'head', index: 0 } })], bones: [], limbs: [] };
  const body: Body = {
    frame: FRAME, skeleton,
    pieces: [{ id: 'head', art: { drawn: { src: 'head.webp', box } }, at: { kind: 'joint', to: 'skull' }, draws: [{ id: 'head', z: 1 }] }],
    shapes: [{ id: 'eyelid', on: 'skull', z: 2 }],
    guides: [{ name: 'neck', at: { on: 'body', at: { x: 14, y: 6 } } }, { name: 'eye', at: 'eye' }],
  };
  const root = turnAbout(6, { x: 10, y: 8 }, 0, -0.5);
  const pose = (shut: boolean) => posing({ root, joints: { body: { squash: { by: 1.04 } }, skull: { angle: 15, shift: { x: 0.8, y: 0 } } }, shapes: { eyelid: lidLayers(shut, EYE, 0.9, FUR) } });

  it('draws an eyelid hung on a joint as it is drawn in that joint\'s group, keeping its slot while the eye is open', () => {
    const nod = turnAbout(15, { x: 14, y: 6 }, 0.8, 0);
    for (const shut of [false, true]) {
      const groups = drawing([{ kind: 'group', turn: root, scaleY: 1.04, layers: [{ kind: 'group', turn: nod, layers: [picture('head', 'head.webp'), ...lidLayers(shut, EYE, 0.9, FUR)] }] }]);
      const composed = drawn(body, pose(shut));
      expect(same(composed, groups)).toEqual([]);
      expect(composed.layers.map((l) => l.kind)).toEqual(['piece', 'frame']);
    }
  });

  it('marks the points it names, where it stands first', () => {
    const marks = drawn(body, pose(false)).guides ?? [];
    // On the breathing body, so breathing with it.
    const neck = turned(root, { x: 14, y: 8 - 2 * 1.04 });
    expect(marks.map((g) => g.name)).toEqual(['stands here', 'neck', 'eye']);
    expect([marks[1].at.x, marks[1].at.y]).toEqual([expect.closeTo(neck.x, 9), expect.closeTo(neck.y, 9)]);
  });

  it('finds each limb\'s root before its goals, turned with the body and never breathing', () => {
    const limb: LimbSpec = { id: 'hind', pair: 1, side: 'near', joints: { root: 'hip', middle: 'k', lower: 'a', end: 'f' }, ground: 15, solve: 'quad', leg: { reach: 0, thigh: 2, shin: 2, bend: 1 } };
    const legged: Skeleton = { ...skeleton, joints: [...skeleton.joints, joint('hip', 'body', { x: 7, y: 10 })], limbs: [limb] };
    const hip = rootsOf(legged, { root, joints: { body: { squash: { by: 1.3 } } } }).get('hind');
    const want = turned(root, { x: 7, y: 10 });
    expect([hip?.x, hip?.y]).toEqual([expect.closeTo(want.x, 9), expect.closeTo(want.y, 9)]);
  });

  it('draws one breathing picture as stillPicture does, marking only where it stands', () => {
    const ball = { name: 'ball', src: 'ball.webp', width: 9, height: 8 };
    const picture = wholePicture(FRAME, ball);
    for (const squash of [1, 1.04]) expect(planDiff(planOf(picture(squash)), planOf(stillPicture(FRAME, ball, squash)))).toEqual([]);
  });
});
