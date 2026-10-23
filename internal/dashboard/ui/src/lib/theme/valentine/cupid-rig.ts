import { clamp, degrees, mixPoint, rad, smooth } from '../math';
import type { Point } from '../pointer';
import { blinking } from '../rig/life';
import { lidLayers, limbLayers, turnAbout, turned, type DrawnLeg, type Fur, type Layer, type LimbArt, type RigPose, type Turn } from '../rig/rig';
import { jointBeside } from '../rig/limb';
import { wingLayer, wingStroke, type Stroke } from '../rig/wings';
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
// drawn in code. Facing right, its anchor the middle of its belly, where it
// hovers. The parts were cut from one drawing of the cupid hovering
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

// A limb from its root to its end: the middle joint bent to one side, the
// end piece (fist or foot) turned to `paw`.
function limb(root: Point, end: Point, first: number, second: number, side: 1 | -1, paw: number): DrawnLeg['limb'] {
  const knee = jointBeside(root, end, first, second, side);
  return { hip: root, knee, ankle: end, foot: end, paw };
}
const arm = (l: DrawnLeg['limb']): DrawnLeg => ({ limb: l, art: ARM_ART, width: ARM.width, haunch: ARM.width, fore: true, taper: false });
const leg = (l: DrawnLeg['limb']): DrawnLeg => ({ limb: l, art: LEG_ART, width: LEG.width, haunch: LEG.haunch, fore: true, taper: false });

function wing(stroke: Stroke, far: boolean): Layer {
  const root = far ? { x: WING_ROOT.x + FAR_WING.x, y: WING_ROOT.y + FAR_WING.y } : WING_ROOT;
  const at = far ? { ...WING, x: WING.x + FAR_WING.x, y: WING.y + FAR_WING.y } : WING;
  return wingLayer({ kind: 'image', name: far ? 'far wing' : 'near wing', src: wingArt, ...at, far }, root, WING_AXIS, stroke);
}

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

// The arms from the shoulders the body carries, each fist turned along its
// forearm. An arm hanging loose is only carried along by its shoulder;
// drawing or loosing, the hands are held to the jaw and the arrow's line,
// so they turn with the body.
function armsOf(h: Hold, body: Turn) {
  const at = (p: Point) => turned(body, p);
  const nearShoulder = at(NEAR_SHOULDER), farShoulder = at(FAR_SHOULDER);
  const nearEnd = h.near(nearShoulder, at), farEnd = h.far(farShoulder, at);
  const nearArm = limb(nearShoulder, nearEnd.wrist, ARM.upper, ARM.fore, nearEnd.side, 0);
  const farArm = limb(farShoulder, farEnd.wrist, ARM.upper, ARM.fore, farEnd.side, 0);
  const fistTurn = (l: DrawnLeg['limb']) => ({ ...l, paw: angleOf(l.knee, l.foot) });
  return { near: fistTurn(nearArm), far: fistTurn(farArm), nearArm, farArm };
}

// The legs from the hips the body carries, swung as the hold says and a
// little with the body's turn, the far one a little behind.
function legsOf(h: Hold, body: Turn) {
  const legOf = (hip: Point, offset: number): DrawnLeg['limb'] => {
    const swing = h.legs.swing + offset + 0.3 * h.body.angle;
    const knee = along(hip, 90 - swing, LEG.thigh);
    const shin = swing - h.legs.bend;
    const foot = along(knee, 90 - shin, LEG.shin);
    return { hip, knee, ankle: foot, foot, paw: 60 - shin };
  };
  return { nearLeg: legOf(turned(body, NEAR_HIP), 0), farLeg: legOf(turned(body, FAR_HIP), -16) };
}

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
  const at = (p: Point) => turned(body, p);
  const { near, far, nearArm, farArm } = armsOf(h, body);
  const grip = along(far.foot, far.paw, GRIP);
  const nock = h.drawing ? along(near.foot, near.paw, GRIP) : null;
  // Drawing, the arrow lies from the nock over the bow fist, resting on it,
  // and the bow stands square to it.
  const shot = nock ? angleOf(nock, along(grip, h.aim - 90, REST)) : h.aim;
  const { nearLeg, farLeg } = legsOf(h, body);
  const nod = turnAbout(h.head, NECK);
  const drawnBow = bow(grip, shot, h.bend, nock);
  return {
    ...FRAME,
    layers: [
      { kind: 'group', turn: body, layers: [wing(h.stroke, true), wing(h.stroke, false)] },
      ...drawnBow.stave,
      ...limbLayers('far arm', arm(far), true),
      ...limbLayers('far leg', leg(farLeg), true),
      ...limbLayers('near leg', leg(nearLeg), false),
      {
        kind: 'group', turn: body, layers: [
          { kind: 'image', name: 'body', src: bodyArt, ...BODY },
          { kind: 'group', turn: nod, layers: [{ kind: 'image', name: 'head', src: headArt, ...HEAD }, ...lidLayers(!look.still && blinking(c.seed, now), EYE, 0.8, SKIN)] },
        ],
      },
      drawnBow.string,
      ...(h.arrow ? drawnBow.arrow : []),
      ...limbLayers('near arm', arm(near), false),
    ],
    guides: [
      { name: 'hovers here', at: ANCHOR }, { name: 'neck', at: at(NECK) }, { name: 'eye', at: at(turned(nod, EYE)) },
      { name: 'wing root', at: at(WING_ROOT) }, { name: 'grip', at: grip },
      ...[nearArm, farArm].flatMap((l) => [{ name: 'shoulder', at: l.hip }, { name: 'elbow', at: l.knee }, { name: 'wrist', at: l.foot }]),
      ...[nearLeg, farLeg].flatMap((l) => [{ name: 'hip', at: l.hip }, { name: 'knee', at: l.knee }, { name: 'ankle', at: l.foot }]),
    ],
  };
}
