import type { Point } from '../spidergait';
import { reachingLegs, standingLegs, walkingLegs, type Gait, type QuadLeg } from '../rig/gait';
import { blinking, breath } from '../rig/life';
import { turnAbout, turned, type Fur, type Layer, type RigPose, type Turn } from '../rig/rig';
import { leapt, type Fox, type FoxView } from './fox';
import alertArt from './fox-alert.webp';
import curledArt from './fox-curled.webp';
import headArt from './fox-head.webp';
import tailArt from './fox-tail.webp';
import torsoArt from './fox-torso.webp';

// The fox put together from its parts (design-docs/aurora/export.py gives
// the art's display sizes): a tail, a torso and a head over its chest, on
// four legs drawn in code. Facing right, on the ledge at
// ANCHOR. Curled up asleep, or looking up from there, it is one picture.

const WIDTH = 30;
const HEIGHT = 23;
const GROUND = 22;
const ANCHOR = { x: 15, y: GROUND };
const TAIL = { x: 1, y: 3, width: 10.5, height: 11 };
const TAIL_ROOT = { x: 10, y: 12.5 };
const TORSO = { x: 9, y: 10.5, width: 13, height: 7.5 };
const HEAD = { x: 17.5, y: 5.5, width: 10.5, height: 10 };
const NECK = { x: 20.5, y: 12.5 };
const EYE = { x: 24.5, y: 10 };
// Where the head's back outline crosses the chest, painted over.
const SEAM = { x: 18.4, y: 13.2 };
const HIND = { x: 12.5, y: 16 };
const CURLED = { width: 20, height: 16.5 };
const ALERT = { width: 20, height: 18.5 };

const OUTLINE = '#0a0809';
const NEAR_FUR: Fur = { fill: '#f4f7fb', outline: OUTLINE };
const FAR_FUR: Fur = { fill: '#c3cfdd', outline: OUTLINE };
const FACE: Fur = { fill: '#fbfcfc', outline: OUTLINE };

// Hips just inside the torso's underside; the far pair a little behind and
// above the near, as they would be seen. Trotting, diagonal pairs move
// together: near fore with far hind, far fore with near hind.
const LEGS: QuadLeg[] = [
  { hip: { x: 13.2, y: 15.8 }, reach: -0.3, thigh: 2.7, shin: 2.8, beat: 0, bend: -1, far: true },
  { hip: { x: 20.2, y: 15.8 }, reach: 0.3, thigh: 2.7, shin: 2.8, beat: 0.5, bend: 1, far: true },
  { hip: { x: 12, y: 16 }, reach: -0.3, thigh: 2.7, shin: 2.8, beat: 0.5, bend: -1, far: false },
  { hip: { x: 19, y: 16 }, reach: 0.3, thigh: 2.7, shin: 2.8, beat: 0, bend: 1, far: false },
];
const FORE = [false, true, false, true];
const TROT: Gait = { stride: 5, lift: 1.8, stance: 0.5 };
const LEG = { width: 1.1, paw: 0.6 };
const FOOT = 0.9;
const FEET = GROUND - FOOT;

export type FoxLook = { now: number; still: boolean };

const ground = (hips: readonly Point[], dx: (fore: boolean) => number) => hips.map((h, i) => ({ x: h.x + dx(FORE[i]), y: FEET }));

// The body's turn and the legs under it, for each way the fox stands.
function stance(fox: Fox, look: FoxLook): { body: Turn; head: number; tail: number; legs: (hips: Point[]) => ReturnType<typeof standingLegs> } {
  const sway = look.still ? 0 : 4 * Math.sin(look.now / 700);
  const phase = fox.walked / (TROT.stride / TROT.stance);
  switch (look.still ? 'stand' : fox.mode) {
    case 'trot':
    case 'exit':
    case 'enter': {
      const body = turnAbout(0, HIND, 0, -0.4 * Math.abs(Math.sin(2 * Math.PI * phase)));
      const specs = (hips: Point[]) => LEGS.map((s, i) => ({ ...s, hip: hips[i] }));
      return { body, head: 1.5 * Math.sin(4 * Math.PI * phase), tail: 7 * Math.sin(2 * Math.PI * phase), legs: (hips) => walkingLegs(specs(hips), fox.walked, FEET, TROT) };
    }
    case 'stretch':
      // A play bow: the front sinks onto forelegs reaching forward.
      return { body: turnAbout(16, HIND), head: -12, tail: -22, legs: (hips) => reachingLegs(LEGS, hips, ground(hips, (fore) => (fore ? 5 : -0.3))) };
    case 'crouch':
      return { body: turnAbout(-4, HIND, 0, 1.6), head: 4, tail: -10, legs: (hips) => reachingLegs(LEGS, hips, ground(hips, (fore) => (fore ? 1 : -1))) };
    case 'leap': {
      // Nose up as it springs, nose down as it lands: hind legs trail, then
      // the forelegs reach for the snow.
      const t = leapt(fox, look.now);
      const reach = (h: Point, fore: boolean): Point => (fore ? { x: h.x + 1.5 + 2 * t, y: h.y + 2.5 + 2 * t } : { x: h.x - 3.5 + t, y: h.y + 3 - t });
      return { body: turnAbout(-28 + 56 * t, HIND), head: 10 * t, tail: -25 + 30 * t, legs: (hips) => reachingLegs(LEGS, hips, hips.map((h, i) => reach(h, FORE[i]))) };
    }
    case 'dig': {
      // Nose in the snow, forepaws scrabbling turn about.
      const scrabble = (i: number) => Math.sin(look.now / 55 + (i === 1 ? Math.PI : 0));
      const paws = (hips: Point[]) => hips.map((h, i) => (FORE[i] ? { x: h.x + 2.5 + 1.2 * scrabble(i), y: FEET - Math.max(0, 1.4 * scrabble(i)) } : { x: h.x - 0.3, y: FEET }));
      return { body: turnAbout(10, HIND), head: 22, tail: -18 + sway, legs: (hips) => reachingLegs(LEGS, hips, paws(hips)) };
    }
    default:
      return { body: turnAbout(0, HIND), head: 0, tail: sway, legs: (hips) => standingLegs(LEGS.map((s, i) => ({ ...s, hip: hips[i] })), FEET) };
  }
}

// Curled up asleep, or looking up from there, breathing slowly.
function curledUp(fox: Fox, look: FoxLook, alert: boolean): RigPose {
  const art = alert ? { src: alertArt, ...ALERT } : { src: curledArt, ...CURLED };
  const squash = look.still ? 1 : 1 + 0.035 * breath(fox.seed, look.now, 3400);
  const image: Layer = { kind: 'image', x: ANCHOR.x - art.width / 2, y: GROUND - art.height, ...art };
  return { width: WIDTH, height: HEIGHT, anchor: ANCHOR, layers: [{ kind: 'group', turn: turnAbout(0, ANCHOR), scaleY: squash, layers: [image] }] };
}

export function foxRig(fox: Fox, view: FoxView, look: FoxLook): RigPose {
  if (view.pose === 'curled' || view.pose === 'alert') return curledUp(fox, look, view.pose === 'alert');
  const { body, head, tail, legs } = stance(fox, look);
  const drawn = legs(LEGS.map((s) => turned(body, s.hip)));
  const shut = !look.still && blinking(fox.seed, look.now);
  const pick = (far: boolean) => drawn.filter((_, i) => LEGS[i].far === far);
  return {
    width: WIDTH, height: HEIGHT, anchor: ANCHOR,
    layers: [
      // Every leg starts behind the torso, so no hip shows on its fur; the
      // head sits in front, its ruff over the chest, so no seam crosses
      // the neck.
      { kind: 'legs', legs: pick(true), fur: FAR_FUR, ...LEG },
      { kind: 'legs', legs: pick(false), fur: NEAR_FUR, ...LEG },
      {
        kind: 'group', turn: body,
        layers: [
          { kind: 'group', turn: turnAbout(tail, TAIL_ROOT), layers: [{ kind: 'image', src: tailArt, ...TAIL }] },
          { kind: 'image', src: torsoArt, ...TORSO },
          {
            kind: 'group', turn: turnAbout(head, NECK),
            layers: [
              { kind: 'image', src: headArt, ...HEAD },
              { kind: 'patch', at: SEAM, rx: 1.1, ry: 2, fill: FACE.fill },
              ...(shut ? [{ kind: 'lid' as const, at: EYE, r: 0.85, fur: FACE }] : []),
            ],
          },
        ],
      },
    ],
  };
}
