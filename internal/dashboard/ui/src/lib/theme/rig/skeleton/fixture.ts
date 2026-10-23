// A made-up animal built on a skeleton, only for tests: it uses every kind
// of attachment (its body and head on joints, a foot on its joint's own
// frame, its tail rigid on a bone, its neck a span, its legs bars), a head
// with two variants, curled and spread feet, and a z override that brings
// its tail over its body. It is also drawn as rigs are drawn today, from
// the same numbers, so the two can be held to the same rendered plan.
import { degrees } from '../../math';
import type { Point } from '../../pointer';
import { curledIn } from '../bird';
import { legsTo, stepping, type QuadLeg, type Step } from '../gait';
import { blinking, breath } from '../life';
import { turnAbout, turned, type DrawnLeg, type Foot, type Frame, type Layer, type LimbArt, type RigPose, type Turn } from '../rig';
import { compose } from './compose';
import type { Body, JointSpec, LimbSpec, Piece, PoseSpec, Role, Skeleton } from './types';

export const SCALE = 1.5;
const GROUND = 18;
const FRAME: Frame = { width: 30, height: 20, anchor: { x: 15, y: GROUND }, scale: SCALE };
const PELVIS = { x: 12, y: 10 };
const SKULL = { x: 21, y: 8 };
const EAR = { x: 21.5, y: 5.5 };
const TAIL = { x: 5, y: 9.5 };
const TAIL_TIP = { x: 1.5, y: 6.5 };
const MUZZLE = { x: 24, y: 10.5 };
const BODY_BOX = { x: 3, y: 4, width: 19, height: 10 };
const HEAD_BOX = { x: 18, y: 3, width: 9, height: 8 };
const EARS_BOX = { x: 19.5, y: 1, width: 4, height: 5 };
const TAIL_BOX = { x: 1, y: 5, width: 5.5, height: 5 };
const NECK_BOX = { x: 16, y: 4, width: 6, height: 7 };
const NECK_ROOT = { x: 17, y: 10 };
const NECK_TOP = { x: 21, y: 6 };
const NECK_HELD = 1.5;

const TOES: Foot = { src: 'fixture-foot.webp', fur: 'fixture-foot-fur.webp', width: 3, height: 1.6, heel: { x: 0.9, y: 0.5 } };
const CURLED: Foot = { src: 'fixture-curled.webp', fur: 'fixture-curled-fur.webp', width: 2, height: 1.4, heel: { x: 0.8, y: 0.6 } };
const FEET = GROUND - (TOES.height - TOES.heel.y);
const THIGH = { src: 'fixture-thigh.webp', fur: 'fixture-thigh-fur.webp', anchors: { start: 0.2, end: 0.9 } };
const ART: LimbArt = { bone: 'fixture-bone.webp', boneFur: 'fixture-bone-fur.webp', knee: true, foot: TOES, curled: CURLED, thigh: THIGH };
const WIDTH = 1.4;
const HAUNCH = 2.4;
const HIND: QuadLeg = { hip: { x: 8, y: 12.5 }, reach: 0, thigh: 2.6, shin: 2.4, bend: 1, fore: false, far: false, walksOn: { kind: 'toes', length: 1.3, lean: 12, fold: 15 } };
const FORE: QuadLeg = { hip: { x: 18.5, y: 12.5 }, reach: 0.3, thigh: 2.2, shin: 2.6, bend: -1, fore: true, far: false, walksOn: { kind: 'toes', length: 0.8, lean: 35, fold: 15 } };
const LEGS = [HIND, FORE];
const GAIT = { stride: 2.4, lift: 1, stance: 0.6, beats: [0, 0.5] };

export type Mode = 'walk' | 'stand' | 'curl';
export const MODES: readonly Mode[] = ['walk', 'stand', 'curl'];
export type Moment = { mode: Mode; now: number; walked: number; still: boolean };

// What it is doing at a moment, in numbers both builds share: the body's
// turn and breath, the head's nod, the ears' and the tail's turns, where
// the feet go and how far through its step each is (a foot in the air is
// drawn curled, as a bird's are), whether it blinks, and whether its tail is over its body.
type Stance = { body: Turn; breath: number; nod: Turn; ears: number; tail: number; feet: (hips: readonly Point[]) => Point[]; steps: readonly Step[]; blink: boolean; tailOver: boolean; reach: boolean };
function stanceOf({ mode, now, walked, still }: Moment): Stance {
  const t = still ? 0 : now;
  const resting = (hips: readonly Point[]) => LEGS.map((s, i) => ({ x: hips[i].x + s.reach, y: FEET }));
  const base = { breath: 1, ears: 0, tail: 0, feet: resting, steps: [], blink: !still && blinking(3, now), tailOver: false, reach: false };
  if (mode === 'walk' && !still) {
    const phase = walked / SCALE / 3;
    const { feet, steps } = stepping(LEGS, walked / SCALE, FEET, GAIT);
    return { ...base, body: turnAbout(0, PELVIS, 0, -0.2 * Math.abs(Math.sin(2 * Math.PI * phase))), nod: turnAbout(4 * Math.sin(2 * Math.PI * phase - 0.6), SKULL), ears: -6 * Math.sin(2 * Math.PI * phase), tail: 10 * Math.sin(2 * Math.PI * phase), feet, steps };
  }
  if (mode === 'curl') {
    return { ...base, body: turnAbout(-4, PELVIS), nod: turnAbout(25, SKULL, -0.3, 0.2), tail: 35 + 3 * Math.sin(t / 300), tailOver: true, reach: true };
  }
  return { ...base, body: turnAbout(0, PELVIS), breath: 1 + 0.03 * breath(3, t, 2200), nod: turnAbout(-5 + 2 * Math.sin(t / 900), SKULL), ears: 4 * Math.sin(t / 700) };
}

// Curled up, the forefoot reaches for the muzzle, held up off the ground.
const REACHING: Step = { down: false, t: 0.5 };
const BY = { x: -2.5, y: 1.5 };

// Built on its skeleton.
const role = (part: 'spine' | 'head', index: number): Role => ({ part, index });
const leg = (pair: 0 | 1) => (index: 0 | 1 | 2 | 3 | 4): Role => ({ part: 'limb', pair, side: 'near', index });
const derived = (id: string, parent: string, r: Role, name: string, at: Point = { x: 0, y: 0 }): JointSpec => ({ id, parent, role: r, at, name, derived: true });
const limbJoints = (code: string, pair: 0 | 1, root: Point, names: readonly string[], tip: Point): JointSpec[] => [
  { id: `${code}J0`, parent: 'pelvis', role: leg(pair)(0), at: root, name: names[0] },
  derived(`${code}J1`, `${code}J0`, leg(pair)(1), names[1]), derived(`${code}J2`, `${code}J1`, leg(pair)(2), names[2]),
  derived(`${code}J3`, `${code}J2`, leg(pair)(3), names[3]), derived(`${code}J4`, `${code}J3`, leg(pair)(4), 'toe tip', tip),
];
const limbOf = (code: string, pair: 0 | 1, spec: QuadLeg): LimbSpec => ({
  id: code, pair, side: 'near', ground: FEET, solve: 'quad',
  joints: { root: `${code}J0`, middle: `${code}J1`, lower: `${code}J2`, end: `${code}J3`, tip: `${code}J4` },
  leg: { reach: spec.reach, thigh: spec.thigh, shin: spec.shin, bend: spec.bend, walksOn: spec.walksOn },
});
const toeTip = (spec: QuadLeg) => ({ x: spec.hip.x + spec.reach + TOES.width - TOES.heel.x, y: GROUND });
const SKELETON = {
  joints: [
    { id: 'pelvis', parent: null, role: role('spine', 2), at: PELVIS, name: 'pelvis' },
    { id: 'skull', parent: 'pelvis', role: role('spine', 0), at: SKULL, name: 'skull', limits: { min: -30, max: 30 } },
    { id: 'ear', parent: 'skull', role: role('head', 0), at: EAR, name: 'ear base' },
    { id: 'tail', parent: 'pelvis', role: role('spine', 3), at: TAIL, name: 'tail root' },
    { id: 'tail tip', parent: 'tail', role: role('spine', 4), at: TAIL_TIP, name: 'tail tip' },
    ...limbJoints('L0', 0, FORE.hip, ['shoulder', 'elbow', 'wrist', 'toes'], toeTip(FORE)),
    ...limbJoints('L2', 1, HIND.hip, ['hip', 'stifle', 'hock', 'toes'], toeTip(HIND)),
  ],
  bones: [
    { from: 'tail', to: 'tail tip', name: 'tail' },
    ...['L0', 'L2'].flatMap((code) => [
      { from: `${code}J0`, to: `${code}J1`, name: 'upper' }, { from: `${code}J1`, to: `${code}J2`, name: 'middle' },
      { from: `${code}J2`, to: `${code}J3`, name: 'lower' }, { from: `${code}J3`, to: `${code}J4`, name: 'toes' },
    ]),
  ],
  limbs: [limbOf('L2', 1, HIND), limbOf('L0', 0, FORE)],
} satisfies Skeleton;

// The draw order: the tail behind it all (over it when curled), the legs
// outlined under the body, the neck outlined under it and as fur over its
// cut, the ears under the head, the legs' fur over the body's edge.
const Z = { tail: 0, legs: 1, neck: 2, body: 3, neckFur: 4, ears: 5, head: 6, legFur: 7, tailOver: 8 } as const;
const bars = (code: string): Piece[] => [
  { id: `${code} upper`, art: { drawn: { src: THIGH.src, fur: THIGH.fur } }, at: { kind: 'bar', from: `${code}J0`, to: `${code}J1`, thick: HAUNCH, anchors: THIGH.anchors }, draws: [{ id: `${code} upper`, z: Z.legs }, { id: `${code} upper, fur`, z: Z.legFur, fur: true, flush: true }] },
  { id: `${code} middle`, art: { drawn: { src: ART.bone, fur: ART.boneFur } }, at: { kind: 'bar', from: `${code}J1`, to: `${code}J2`, thick: WIDTH }, draws: [{ id: `${code} middle`, z: Z.legs }, { id: `${code} middle, fur`, z: Z.legFur, fur: true }] },
  { id: `${code} lower`, art: { drawn: { src: ART.bone, fur: ART.boneFur } }, at: { kind: 'bar', from: `${code}J2`, to: `${code}J3`, thick: WIDTH }, draws: [{ id: `${code} lower`, z: Z.legs }, { id: `${code} lower, fur`, z: Z.legFur, fur: true }] },
  {
    id: `${code} foot`, hide: 'opacity', at: { kind: 'joint', to: `${code}J3`, local: true }, draws: [{ id: `${code} foot`, z: Z.legs }, { id: `${code} foot, fur`, z: Z.legFur, fur: true }],
    art: Object.fromEntries(([['toes', TOES], ['curled', CURLED]] as const).map(([key, f]) => [key, { src: f.src, fur: f.fur, box: { x: -f.heel.x, y: -f.heel.y, width: f.width, height: f.height } }])),
  },
];
export const BODY: Body = {
  frame: FRAME,
  skeleton: SKELETON,
  pieces: [
    { id: 'tail', art: { drawn: { src: 'fixture-tail.webp', box: TAIL_BOX } }, at: { kind: 'bone', from: 'tail', to: 'tail tip' }, draws: [{ id: 'tail', z: Z.tail }] },
    ...bars('L2'), ...bars('L0'),
    {
      id: 'neck', art: { drawn: { src: 'fixture-neck.webp', fur: 'fixture-neck-fur.webp', box: NECK_BOX } }, draws: [{ id: 'neck', z: Z.neck }, { id: 'neck, fur', z: Z.neckFur, fur: true }],
      at: { kind: 'span', from: { on: 'pelvis', at: NECK_ROOT }, to: { on: 'skull', at: NECK_TOP }, art: { from: NECK_ROOT, to: NECK_TOP }, fixed: NECK_HELD },
    },
    { id: 'body', art: { drawn: { src: 'fixture-body.webp', box: BODY_BOX } }, at: { kind: 'joint', to: 'pelvis' }, draws: [{ id: 'body', z: Z.body }] },
    { id: 'ears', art: { drawn: { src: 'fixture-ears.webp', box: EARS_BOX } }, at: { kind: 'joint', to: 'ear' }, draws: [{ id: 'ears', z: Z.ears }] },
    { id: 'head', art: { open: { src: 'fixture-head.webp', box: HEAD_BOX }, shut: { src: 'fixture-head-shut.webp', box: HEAD_BOX } }, at: { kind: 'joint', to: 'skull' }, draws: [{ id: 'head', z: Z.head }] },
  ],
};

// Each limb's goal: stepping or standing, its foot curled while it is up.
export function poseOf(at: Moment): PoseSpec {
  const s = stanceOf(at);
  const hips = LEGS.map((l) => turned(s.body, l.hip));
  const feet = s.feet(hips);
  const goal = (i: number) => ({ kind: 'plant', at: feet[i], step: s.steps[i] }) as const;
  const curled = (i: number) => (s.reach && i === 1) || curledIn(s.steps[i]);
  return {
    root: s.body,
    joints: { pelvis: { squash: { by: s.breath } }, skull: { angle: s.nod.angle, shift: { x: s.nod.dx, y: s.nod.dy } }, ear: { angle: s.ears }, tail: { angle: s.tail } },
    limbs: { L2: goal(0), L0: s.reach ? { kind: 'reach', to: { on: 'skull', at: MUZZLE }, by: BY, step: REACHING } : goal(1) },
    show: { head: s.blink ? 'shut' : 'open', 'L2 foot': curled(0) ? 'curled' : 'toes', 'L0 foot': curled(1) ? 'curled' : 'toes' },
    z: s.tailOver ? { tail: Z.tailOver } : {},
  };
}

export const fixtureRig = (at: Moment): RigPose => compose(BODY, (now) => poseOf({ ...at, now }), at.now);

// The same animal drawn as rigs are drawn today: nested groups turned about
// hand-placed pivots, legs posed by legsTo and drawn by their layers, its
// rigid tail turned about its root as far as its bone has turned.
const squashed = (p: Point, pivot: Point, by: number): Point => ({ x: p.x, y: pivot.y + (p.y - pivot.y) * by });
const picture = (name: string, src: string, box: { x: number; y: number; width: number; height: number }, hidden = false): Layer => ({ kind: 'image', name, src, ...box, hidden });
const lean = (from: Point, to: Point) => degrees(Math.atan2(to.x - from.x, from.y - to.y));
const direction = (from: Point, to: Point) => degrees(Math.atan2(to.y - from.y, to.x - from.x));

function neckLayer(nod: Turn, src: string): Layer {
  const top = turned(nod, NECK_TOP);
  const length = Math.hypot(NECK_TOP.x - NECK_ROOT.x, NECK_TOP.y - NECK_ROOT.y);
  const stood: Layer = { kind: 'group', turn: turnAbout(-lean(NECK_ROOT, NECK_TOP), NECK_ROOT), layers: [picture('neck', src, NECK_BOX)] };
  const stretched: Layer = { kind: 'group', turn: turnAbout(0, { x: NECK_ROOT.x, y: NECK_ROOT.y - NECK_HELD }), foreshorten: (Math.hypot(top.x - NECK_ROOT.x, top.y - NECK_ROOT.y) - NECK_HELD) / (length - NECK_HELD), layers: [stood] };
  return { kind: 'group', turn: turnAbout(lean(NECK_ROOT, top), NECK_ROOT), layers: [stretched] };
}

export function legacyFixture(at: Moment): RigPose {
  const s = stanceOf(at);
  const hips = LEGS.map((l) => turned(s.body, l.hip));
  const feet = s.feet(hips);
  const nodded = (p: Point) => turned(s.body, squashed(turned(s.nod, p), PELVIS, s.breath));
  const muzzle = nodded(MUZZLE);
  const posed = legsTo(LEGS, hips, s.reach ? [feet[0], { x: muzzle.x + BY.x, y: muzzle.y + BY.y }] : feet, s.reach ? [s.steps[0], REACHING] : s.steps);
  const curled = (i: number) => (s.reach && i === 1) || curledIn(s.steps[i]);
  const legs: DrawnLeg[] = posed.map((limb, i) => ({ limb: { ...limb, curled: curled(i) }, art: ART, width: WIDTH, haunch: HAUNCH, fore: LEGS[i].fore, taper: false }));
  const tailFrom = turned(s.body, squashed(TAIL, PELVIS, s.breath));
  const tailTo = turned(s.body, squashed(turned(turnAbout(s.tail, TAIL), TAIL_TIP), PELVIS, s.breath));
  const tail: Layer = { kind: 'group', turn: turnAbout(direction(tailFrom, tailTo) - direction(TAIL, TAIL_TIP), TAIL, tailFrom.x - TAIL.x, tailFrom.y - TAIL.y), layers: [picture('tail', 'fixture-tail.webp', TAIL_BOX)] };
  const head: Layer = {
    kind: 'group', turn: s.nod,
    layers: [{ kind: 'group', turn: turnAbout(s.ears, EAR), layers: [picture('ears', 'fixture-ears.webp', EARS_BOX)] }, picture('head', 'fixture-head.webp', HEAD_BOX, s.blink), picture('head', 'fixture-head-shut.webp', HEAD_BOX, !s.blink)],
  };
  const body: Layer = { kind: 'group', turn: s.body, scaleY: s.breath, layers: [neckLayer(s.nod, 'fixture-neck.webp'), picture('body', 'fixture-body.webp', BODY_BOX), neckLayer(s.nod, 'fixture-neck-fur.webp'), head] };
  const side = (fur: boolean): Layer => ({ kind: 'legs', name: 'near legs', legs, far: false, fur });
  return { ...FRAME, layers: s.tailOver ? [side(false), body, side(true), tail] : [tail, side(false), body, side(true)] };
}
