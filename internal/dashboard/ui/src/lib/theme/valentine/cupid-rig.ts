import { clamp, degrees, mixPoint, rad, smooth } from '../math';
import type { Point } from '../pointer';
import { blinking } from '../rig/life';
import { lidLayers, turnAbout, turned, type ArtLeg, type Fur, type Layer, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { rootsOf } from '../rig/skeleton/forward';
import { standing } from '../rig/skeleton/limbs';
import { head, limbPieces, picture, spine } from '../rig/skeleton/tetrapod';
import type { Body, Goal, JointSpec, LimbSpec, PoseSpec, Role, Skeleton } from '../rig/skeleton/types';
import { wingStroke, type Stroke } from '../rig/wings';
import armFurArt from './cupid-arm-fur.webp';
import armArt from './cupid-arm.webp';
import bodyArt from './cupid-body.webp';
import footFurArt from './cupid-foot-fur.webp';
import footArt from './cupid-foot.webp';
import handFurArt from './cupid-hand-fur.webp';
import handArt from './cupid-hand.webp';
import headArt from './cupid-head.webp';
import shinFurArt from './cupid-shin-fur.webp';
import shinArt from './cupid-shin.webp';
import thighFurArt from './cupid-thigh-fur.webp';
import thighArt from './cupid-thigh.webp';
import wingArt from './cupid-wing.webp';

// A cupid put together from its parts: a body (its tunic and quiver), a
// head over the neck, two wings beating behind it, arms and legs of limb
// art laid along bones posed in code, and a bow, its string and an arrow
// drawn in code, all hung on its skeleton (rig/skeleton). Facing right, its
// anchor the middle of its belly, where it hovers. The parts were cut from one drawing of the cupid hovering
// (design-docs/valentine/cupid-reference.png) and the drawing units are
// that drawing's: export.py prints where each part sat in it, which is
// where it sits here. The critters lab lays that drawing, or a key pose for
// the mode shown, over the rig to compare.

// Page pixels per drawing unit, for every pose.
const SCALE = 1.5;

const ANCHOR = { x: 12.4, y: 17.5 };
const FRAME = { width: 23, height: 28, anchor: ANCHOR, scale: SCALE };
// The standing drawing, for the lab to lay over the rig: where it sits.
export const REFERENCE = { x: 1, y: 1, width: 19, height: 25.17 };
const BODY = { x: 5.64, y: 8.9, width: 10.33, height: 12.58 };
const HEAD = { x: 6.32, y: 1.03, width: 11.58, height: 11 };
const WING = { x: 1.3, y: 5, width: 8.33, height: 11.17 };
const NECK = { x: 12.4, y: 11.3 };
export const EYE = { x: 14.7, y: 8.2 };
// Where each wing joins the back, and how far behind and above the near one
// the far one sits.
const WING_ROOT = { x: 8.6, y: 13.6 };
const FAR_WING = { x: 2, y: -1.8 };
// The wing's long axis, root to tip, as drawn: the upstroke turns it
// edge-on, squashing it across this axis.
const WING_AXIS = -129;

const SKIN: Fur = { fill: '#f9d3b4', outline: '#1d0f0b' };
const GOLD = '#f2c14e';
const INK = '#3a2208';
const ROSE = '#e8436b';

// The arms and legs: two pieces each along posed bones, a fist or a foot at
// the end, each piece outlined and then as fur alone.
const HAND = { src: handArt, fur: handFurArt, width: 2.42, height: 2.08, heel: { x: 0.35, y: 1.04 } };
const FOOT = { src: footArt, fur: footFurArt, width: 3.17, height: 2.5, heel: { x: 1.2, y: 0.55 } };
const ARM_ART: LimbArt = { bone: armArt, boneFur: armFurArt, thigh: { src: armArt, fur: armFurArt }, knee: true, foot: HAND };
const LEG_ART: LimbArt = { bone: shinArt, boneFur: shinFurArt, thigh: { src: thighArt, fur: thighFurArt }, knee: true, foot: FOOT };
const ARM = { upper: 2.5, fore: 2.4, width: 1.9 };
const LEG = { thigh: 2.6, shin: 2.6, haunch: 2.7, width: 2.15 };
// Shoulders and hips, in the body's own frame: the near arm hangs at the
// front of the body, the far one comes from behind its chest; the hips are
// up under the tunic.
const NEAR_SHOULDER = { x: 10.4, y: 13 };
const FAR_SHOULDER = { x: 14.2, y: 14 };
const NEAR_HIP = { x: 11.6, y: 20.2 };
const FAR_HIP = { x: 10.4, y: 19.9 };
// Where the drawing wrist anchors on a level shot at full draw, its fist
// under the jaw: as near the shoulder as lays the forearm level back from
// the string, so the elbow points straight back behind the shoulder at the
// hand's height, as an archer's does. Where it flies back to, past the
// cheek, as the string is loosed. Aiming up or down, both turn about the
// shoulder with the arrow, keeping the forearm on the arrow's line.
const JAW = { x: 11.07, y: 11.2 };
const FOLLOW = { x: 9.4, y: 10.6 };
// How far ahead of its wrist a fist's middle is: where the drawing fist
// holds the nock and the bow fist grips the bow.
const GRIP = 1.1;
// The bow arm at full draw, shoulder to wrist: straight but for a soft
// elbow. The arrow rests on the bow fist, this far above its middle.
const BOW_ARM = 4.85;
const REST = 0.8;
// The bow: half its length, how far its limbs curve back from the grip
// braced and at full draw, and the arrow's length.
const BOW = 4.8;
const BRACED = 1.3;
const DRAWN = 2.1;
const ARROW = 9.5;
// How far back the head tips to look up at a cursor, at most: any further
// and it reaches past the top of the hover footprint.
const LOOK_UP = -8;

// What the cupid is doing, as far as the drawing cares.
export type CupidPose = 'hover' | 'flight' | 'draw' | 'aim' | 'loose' | 'dodge';
export type RigCupid = {
  pose: CupidPose;
  seed: number;
  // Wingbeats so far: what the wings and the body's lift keep time with.
  beat: number;
  // How far through drawing or loosing, 0 to 1.
  progress: number;
  // Where the bow points, degrees below straight ahead.
  aim: number;
  // Flying, its speed ahead and how fast that is changing, in page px/s
  // and px/s²: what the body's pitch and the legs' swing follow.
  speed: number;
  accel: number;
  // The head's turn toward the cursor, degrees, nose down positive.
  gaze: number;
};
type CupidLook = { now: number; still: boolean };

const along = (from: Point, deg: number, length: number): Point => ({ x: from.x + Math.cos(rad(deg)) * length, y: from.y + Math.sin(rad(deg)) * length });
const angleOf = (from: Point, to: Point) => degrees(Math.atan2(to.y - from.y, to.x - from.x));

// The bow in the far fist at `grip`, pointing `aim` degrees: its stave
// curving back from the grip, bent `bend`, its string from tip to tip
// through `nock`, and the arrow from the nock along the aim. The stave goes
// behind the fist that grips it; the string and arrow in front of the body.
function bow(grip: Point, aim: number, bend: number, nock: Point | null): { stave: Layer[]; string: Layer; arrow: Layer[] } {
  const length = BOW - 0.35 * (bend - BRACED);
  const at = (s: number): Point => {
    const across = along(grip, aim + 90, s * length);
    return along(across, aim, -bend * s * s);
  };
  const stave = Array.from({ length: 11 }, (_, i) => at(-1 + i / 5));
  // The recurve's tips curl forward.
  const curl = (s: 1 | -1) => along(along(at(s), aim, 0.55), aim + 90, s * 0.25);
  const line = [curl(-1), ...stave, curl(1)];
  const top = at(-1), bottom = at(1);
  const string = [top, nock ?? mixPoint(top, bottom, 0.5), bottom];
  const tail = nock ?? mixPoint(top, bottom, 0.5);
  const shaft = [tail, along(tail, aim, ARROW)];
  const head = heart(along(tail, aim, ARROW + 0.5), aim, 0.85);
  const fletch = heart(along(tail, aim, 0.6), aim, 0.7);
  return {
    stave: [
      { kind: 'stroke', name: 'bow', points: line, width: 1.05, colour: INK },
      { kind: 'stroke', name: 'bow, gold', points: line, width: 0.6, colour: GOLD },
    ],
    string: { kind: 'stroke', name: 'string', points: string, width: 0.14, colour: INK },
    arrow: [
      { kind: 'stroke', name: 'arrow', points: shaft, width: 0.62, colour: INK },
      { kind: 'stroke', name: 'arrow, gold', points: shaft, width: 0.3, colour: GOLD },
      { kind: 'stroke', name: 'arrow fletching', points: fletch, width: 0.18, colour: INK, fill: ROSE },
      { kind: 'stroke', name: 'arrow head', points: head, width: 0.18, colour: INK, fill: ROSE },
    ],
  };
}

// A small heart at p, its point toward `aim`, `size` across.
function heart(p: Point, aim: number, size: number): Point[] {
  const k = size / 6;
  const outline = [[0, 2.6], [-1.8, 1.2], [-3, -0.6], [-2.6, -2.4], [-1.2, -3], [0, -2.1], [1.2, -3], [2.6, -2.4], [3, -0.6], [1.8, 1.2]];
  // Drawn with its point down (+y), turned so it points along the aim.
  return outline.map(([x, y]) => {
    const r = rad(aim - 90);
    return { x: p.x + k * (x * Math.cos(r) - y * Math.sin(r)), y: p.y + k * (x * Math.sin(r) + y * Math.cos(r)) };
  });
}

// How it holds itself for each pose: the body's turn, the wings' stroke, the
// arms' ends, the legs' swing, how far the bow is bent and where its string
// is, and whether an arrow is nocked. An arm's end is set from its shoulder
// on the page, or, held to the body (the hand at the jaw), put on the page
// from the body's own frame by `at`.
type Arm = (shoulder: Point, at: (p: Point) => Point) => { wrist: Point; side: 1 | -1 };
type Hold = {
  body: Turn;
  stroke: Stroke;
  head: number;
  near: Arm;
  far: Arm;
  aim: number;
  bend: number;
  drawing: boolean;
  arrow: boolean;
  legs: { swing: number; bend: number };
};

// Hanging loose: the near arm down at its side, the far one holding the bow
// up in front of the tummy, as in the reference.
const hanging = (shoulder: Point) => ({ wrist: { x: shoulder.x - 1.3, y: shoulder.y + 4.5 }, side: -1 as const });
const holdingBow = (shoulder: Point) => ({ wrist: { x: shoulder.x + 3.3, y: shoulder.y + 1.4 }, side: 1 as const });

// How far the body bends toward an aim, as an archer bends at the waist,
// so the hands keep their places at the jaw and on the arrow's line; the
// arms turn about the shoulders for the rest. Leaning back for a shot
// upward it goes the whole way, or the arrow would cross its face. It bends
// about its chest, which keeps the wings inside the shooting footprint.
const CHEST = { x: 12.4, y: 13.5 };
const stoop = (aim: number) => clamp(aim < 0 ? aim : aim * 0.6, -35, 30);

// Full draw at `aim`, in the body's own frame, the body bent toward it: the
// drawing wrist at the jaw and where it follows through to, turned about
// the shoulder with the arrow, and the bow wrist, the bow arm reaching from
// its shoulder to where the line under the arrow, through the bow fist's
// middle, is in reach. So the arrow runs from the string at the jaw over
// the bow fist.
function fullDraw(aim: number) {
  const about = turnAbout(aim - stoop(aim), NEAR_SHOULDER);
  const within = about.angle;
  const wrist = turned(about, JAW);
  const under = along(along(wrist, within, GRIP), within + 90, REST);
  const reach = BOW_ARM + GRIP;
  const w = { x: under.x - FAR_SHOULDER.x, y: under.y - FAR_SHOULDER.y };
  const u = { x: Math.cos(rad(within)), y: Math.sin(rad(within)) };
  const toward = w.x * u.x + w.y * u.y;
  const ahead = -toward + Math.sqrt(toward * toward - (w.x * w.x + w.y * w.y - reach * reach));
  const fist = along(under, within, ahead);
  return { wrist, follow: turned(about, FOLLOW), bow: mixPoint(FAR_SHOULDER, fist, BOW_ARM / reach) };
}

function hold(c: RigCupid, now: number): Hold {
  const kick = 6 * Math.sin((2 * Math.PI * now) / 2300 + c.seed);
  const lean = -8;
  const hover = wingStroke(c.beat, 12, 75);
  const reachOut = (aim: number, by: number) => (shoulder: Point) => ({ wrist: along(shoulder, aim, by), side: 1 as const });
  switch (c.pose) {
    case 'flight': {
      // Pitched forward with speed, the wings beating more up and down over
      // a wider arc, the legs trailing as it speeds up and swinging forward
      // as it slows.
      const pitch = clamp(c.speed / 150, 0, 1) * 32;
      return {
        body: turnAbout(pitch, ANCHOR), stroke: wingStroke(c.beat, 18 - pitch, 95), head: -pitch * 0.4,
        near: (s) => ({ wrist: { x: s.x - 3.6, y: s.y + 3 }, side: -1 }), far: holdingBow, aim: pitch, bend: BRACED, drawing: false, arrow: false,
        legs: { swing: clamp(15 - pitch * 2 - clamp(c.accel / 40, -20, 20), -60, 35), bend: 30 },
      };
    }
    case 'draw':
    case 'aim': {
      // The bow arm rises toward the aim as the string hand pulls back to
      // the jaw, the body bending toward the aim.
      const t = c.pose === 'aim' ? 1 : smooth(c.progress);
      const full = fullDraw(c.aim);
      return {
        body: turnAbout(lean * (1 - t) + stoop(c.aim) * t, mixPoint(ANCHOR, CHEST, t)), stroke: hover, head: clamp(c.aim * 0.3, 0, 15) * t,
        near: (_, at) => ({ wrist: at(mixPoint(hanging(NEAR_SHOULDER).wrist, full.wrist, t)), side: -1 }),
        far: (s, at) => ({ wrist: mixPoint(holdingBow(s).wrist, at(full.bow), t), side: 1 }),
        aim: c.aim * t, bend: BRACED + (DRAWN - BRACED) * t, drawing: true, arrow: true, legs: { swing: 12 + kick, bend: 40 },
      };
    }
    case 'loose': {
      // The string hand flies back past the cheek and the bow arm holds,
      // then both come down.
      const flung = smooth(c.progress / 0.25);
      const down = smooth((c.progress - 0.6) / 0.4);
      const full = fullDraw(c.aim);
      const back = mixPoint(full.wrist, full.follow, flung);
      return {
        body: turnAbout(lean * down + stoop(c.aim) * (1 - down), mixPoint(ANCHOR, CHEST, 1 - down)), stroke: hover, head: clamp(c.aim * 0.3, 0, 15) * (1 - down),
        near: (_, at) => ({ wrist: at(mixPoint(back, hanging(NEAR_SHOULDER).wrist, down)), side: -1 }),
        far: (s, at) => ({ wrist: mixPoint(at(full.bow), holdingBow(s).wrist, down), side: 1 }),
        aim: c.aim * (1 - down), bend: BRACED, drawing: false, arrow: false, legs: { swing: 12 + kick * 1.5, bend: 40 },
      };
    }
    case 'dodge':
      // Startled: leaning back away, arms flung up and out, legs tucked,
      // wings flared and fluttering.
      return {
        body: turnAbout(-18, ANCHOR), stroke: wingStroke(c.beat, 20, 60), head: -10,
        near: reachOut(-150, 4.2), far: reachOut(-40, 4.4), aim: -60, bend: BRACED, drawing: false, arrow: false,
        legs: { swing: 55, bend: 100 },
      };
    default:
      return {
        body: turnAbout(lean, ANCHOR), stroke: hover, head: Math.max(LOOK_UP, c.gaze),
        near: hanging, far: holdingBow, aim: 0, bend: BRACED, drawing: false, arrow: false, legs: { swing: 15 + kick, bend: 45 + kick },
      };
  }
}

// Its skeleton: the body, which turns about where it hovers (drawing, its
// chest); the head on its neck with the eye on it; each wing at its root
// on the back; each arm from its shoulder to its fist, its grip on the
// fist, the elbow to whichever side the hold has it; each leg from its hip,
// swung and bent by angles.
const wingRole = (far: boolean): Role => ({ part: 'wing', side: far ? 'far' : 'near', index: 0 });
const FAR_ROOT = { x: WING_ROOT.x + FAR_WING.x, y: WING_ROOT.y + FAR_WING.y };
type Member = { code: string; root: Point; far: boolean; arm: boolean };
const LIMBS: readonly Member[] = [
  { code: 'L0', root: NEAR_SHOULDER, far: false, arm: true }, { code: 'L1', root: FAR_SHOULDER, far: true, arm: true },
  { code: 'L2', root: NEAR_HIP, far: false, arm: false }, { code: 'L3', root: FAR_HIP, far: true, arm: false },
];
const NAMES = {
  arm: { joints: ['shoulder', 'elbow', 'wrist', 'hand', 'grip (the fist\'s middle)'], bones: ['humerus', 'radius and ulna', '', 'hand'] },
  leg: { joints: ['hip', 'knee', 'ankle', 'foot', 'toe tip'], bones: ['femur', 'tibia and fibula', '', 'foot'] },
} as const;
// An arm stands at rest hanging under its shoulder; a leg hangs straight.
const HANG = ARM.upper + ARM.fore - 0.4;
// Where each limb's end is at rest, and its tip: an arm's grip along its
// fist (turned as the fist is at rest), a leg's toes at the front of its
// foot.
const restEnd = (l: Member): Point => (l.arm ? { x: l.root.x, y: l.root.y + HANG } : { x: l.root.x, y: l.root.y + LEG.thigh + LEG.shin });
const restTip = (l: Member): Point => {
  const end = restEnd(l);
  if (!l.arm) return { x: end.x + FOOT.width - FOOT.heel.x, y: end.y + FOOT.height - FOOT.heel.y };
  return along(end, standing(limbSpec(l), l.root).paw, GRIP);
};
function limbJoints(l: Member): JointSpec[] {
  const names = NAMES[l.arm ? 'arm' : 'leg'];
  const role = (index: 0 | 1 | 2 | 3 | 4): Role => ({ part: 'limb', pair: l.arm ? 0 : 1, side: l.far ? 'far' : 'near', index });
  return ([0, 1, 2, 3, 4] as const).map((k) => ({
    id: `${l.code}J${k}`, parent: k ? `${l.code}J${k - 1}` : 'body', role: role(k), at: k === 4 ? restTip(l) : l.root, name: names.joints[k], ...(k ? { derived: true } : {}),
  }));
}
const limbBones = (l: Member) => NAMES[l.arm ? 'arm' : 'leg'].bones.flatMap((name, k) => (name ? [{ from: `${l.code}J${k}`, to: `${l.code}J${k + 1}`, name }] : []));
const limbSpec = (l: Member): LimbSpec => ({
  id: l.code, pair: l.arm ? 0 : 1, side: l.far ? 'far' : 'near', ground: restEnd(l).y, solve: l.arm ? 'arm' : 'angles',
  joints: { root: `${l.code}J0`, middle: `${l.code}J1`, lower: `${l.code}J2`, end: `${l.code}J3`, tip: `${l.code}J4` },
  leg: l.arm ? { thigh: ARM.upper, shin: ARM.fore, reach: 0 } : { thigh: LEG.thigh, shin: LEG.shin, reach: 0 },
});
// Each limb's art as rigs lay it (tetrapod.ts's limbPieces): an arm's or a
// leg's two pieces and its fist or foot.
const artLeg = (l: Member): ArtLeg => (l.arm
  ? { hip: l.root, reach: 0, thigh: ARM.upper, shin: ARM.fore, bend: 1, fore: true, far: l.far, art: ARM_ART, width: ARM.width, haunch: ARM.width }
  : { hip: l.root, reach: 0, thigh: LEG.thigh, shin: LEG.shin, bend: 1, fore: true, far: l.far, art: LEG_ART, width: LEG.width, haunch: LEG.haunch });
const SKELETON: Skeleton = {
  joints: [
    { id: 'body', parent: null, role: spine(2), at: ANCHOR, name: 'body pivot (where it hovers, or drawing its chest)' },
    { id: 'skull', parent: 'body', role: spine(0), at: NECK, name: 'head joint (neck)' },
    { id: 'eye', parent: 'skull', role: head(0), at: EYE, name: 'eye' },
    { id: 'W0', parent: 'body', role: wingRole(false), at: WING_ROOT, name: 'wing root' },
    { id: 'W1', parent: 'body', role: wingRole(true), at: FAR_ROOT, name: 'wing root' },
    ...LIMBS.flatMap(limbJoints),
  ],
  bones: [{ from: 'skull', to: 'body', name: 'neck and back line' }, { from: 'eye', to: 'skull', name: 'skull' }, ...LIMBS.flatMap(limbBones)],
  limbs: LIMBS.map(limbSpec),
};

// The draw order: the wings behind it all, then the bow's stave behind the
// fist that grips it, the far arm and leg, the near leg, the body and head,
// the string and the arrow in front of the body, and the near arm over it
// all; each limb outlined then as fur alone.
const Z = { wings: 0, stave: 1, farArm: 2, farLeg: 4, nearLeg: 6, body: 8, head: 9, eyelid: 10, string: 11, arrow: 12, nearArm: 13 } as const;
const limbZ = (l: Member) => {
  const z = l.arm ? (l.far ? Z.farArm : Z.nearArm) : l.far ? Z.farLeg : Z.nearLeg;
  return { outlined: z, fur: z + 1 };
};
const wingPiece = (far: boolean) => ({
  ...picture(far ? 'far wing' : 'near wing', far ? 'W1' : 'W0', wingArt, far ? { ...WING, x: WING.x + FAR_WING.x, y: WING.y + FAR_WING.y } : WING),
  side: far ? 'far' : 'near',
} as const);
const withZ = <P extends { draws: readonly { id: string; z: number }[] }>(p: P, z: number): P => ({ ...p, draws: p.draws.map((d) => ({ ...d, z })) });
const CUPID: Body = {
  frame: FRAME,
  skeleton: SKELETON,
  pieces: [
    withZ(wingPiece(true), Z.wings), withZ(wingPiece(false), Z.wings),
    ...LIMBS.flatMap((l) => limbPieces(artLeg(l), l.code, limbZ(l), `${l.far ? 'far' : 'near'} ${l.arm ? 'arm' : 'leg'}`)),
    withZ(picture('body', 'body', bodyArt, BODY), Z.body), withZ(picture('head', 'skull', headArt, HEAD), Z.head),
  ],
  shapes: [{ id: 'stave', on: 'L1J3', z: Z.stave }, { id: 'eyelid', on: 'skull', z: Z.eyelid }, { id: 'string', on: 'L0J3', z: Z.string }, { id: 'arrow', on: 'L0J3', z: Z.arrow }],
  stands: 'hovers here',
  titles: { L0: 'arm', L1: 'arm', L2: 'leg', L3: 'leg' },
  guides: [
    { name: 'neck', at: 'skull' }, { name: 'eye', at: 'eye' }, { name: 'wing root', at: { on: 'body', at: WING_ROOT } }, { name: 'grip', at: 'L1J4' },
    ...['L0', 'L1'].flatMap((c) => [{ name: 'shoulder', at: `${c}J0` }, { name: 'elbow', at: `${c}J1` }, { name: 'wrist', at: `${c}J3` }]),
    ...['L2', 'L3'].flatMap((c) => [{ name: 'hip', at: `${c}J0` }, { name: 'knee', at: `${c}J1` }, { name: 'ankle', at: `${c}J3` }]),
  ],
};

// A wing's stroke as its joint's pose: turned about its root, lifted and
// falling with the stroke, squashed across its long axis.
const wingPose = (stroke: Stroke) => ({ angle: stroke.angle, shift: { x: 0, y: stroke.lift }, squash: { by: stroke.squash, axis: WING_AXIS } });

// Held still under reduced motion: hovering upright, wings spread, legs
// hanging, the bow held in front.
const STILL: RigCupid = { pose: 'hover', seed: 0, beat: 0.25, progress: 0, aim: 0, speed: 0, accel: 0, gaze: 0 };

export function cupidRig(cupid: RigCupid, look: CupidLook): RigPose {
  const c = look.still ? { ...STILL, seed: cupid.seed } : cupid;
  const now = look.still ? 0 : look.now;
  const h = hold(c, now);
  // The slow bob of a hover, and a lift on each downstroke.
  const bob = look.still ? 0 : Math.sin((2 * Math.PI * now) / 1600 + c.seed) + 0.25 * Math.sin(2 * Math.PI * c.beat);
  const body: Turn = { ...h.body, dy: h.body.dy + bob };
  const joints = { skull: { angle: h.head }, W0: wingPose(h.stroke), W1: wingPose(h.stroke) };
  // The arms from the shoulders the body carries. An arm hanging loose is
  // only carried along by its shoulder; drawing or loosing, the hands are
  // held to the jaw and the arrow's line, so they turn with the body. The
  // legs from the hips, swung as the hold says and a little with the
  // body's turn, the far one a little behind.
  const roots = rootsOf(SKELETON, { root: body, joints });
  const at = (p: Point) => turned(body, p);
  const reach = (code: string, arm: Arm): Goal => {
    const end = arm(roots.get(code) ?? at(NEAR_SHOULDER), at);
    return { kind: 'plant', at: end.wrist, side: end.side };
  };
  const swung = (offset: number): Goal => {
    const swing = h.legs.swing + offset + 0.3 * h.body.angle;
    return { kind: 'angles', swing, bend: h.legs.bend, paw: 60 - (swing - h.legs.bend) };
  };
  const limbs = { L0: reach('L0', h.near), L1: reach('L1', h.far), L2: swung(0), L3: swung(-16) };
  // The bow in the far fist, its string through the drawing fist; drawing,
  // the arrow lies from the nock over the bow fist, resting on it, and the
  // bow stands square to it.
  const drawnBow = (limb: (id: string) => { foot: Point; paw: number }) => {
    const far = limb('L1'), near = limb('L0');
    const grip = along(far.foot, far.paw, GRIP);
    const nock = h.drawing ? along(near.foot, near.paw, GRIP) : null;
    const shot = nock ? angleOf(nock, along(grip, h.aim - 90, REST)) : h.aim;
    return bow(grip, shot, h.bend, nock);
  };
  const inFrame = (layers: readonly Layer[], local: (p: Point) => Point): Layer[] => layers.map((l) => (l.kind === 'stroke' ? { ...l, points: l.points.map(local) } : l));
  const shapes: PoseSpec['shapes'] = {
    stave: ({ limb, local }) => inFrame(drawnBow(limb).stave, local),
    eyelid: lidLayers(!look.still && blinking(c.seed, now), EYE, 0.8, SKIN),
    string: ({ limb, local }) => inFrame([drawnBow(limb).string], local),
    arrow: ({ limb, local }) => (h.arrow ? inFrame(drawnBow(limb).arrow, local) : []),
  };
  return compose(CUPID, () => ({ root: body, joints, limbs, show: {}, z: {}, shapes }), now);
}
