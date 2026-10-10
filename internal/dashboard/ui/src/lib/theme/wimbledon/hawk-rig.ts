import { blinking } from '../rig/life';
import { lidLayers, turnAbout, turned, type Frame, type Fur, type Layer, type RigPose } from '../rig/rig';
import { birdWing, flapping, gliding, wingPoint, type Flap, type WingArt, type WingPose } from '../rig/wings';
import armUnderArt from './hawk-arm-under.webp';
import armArt from './hawk-arm.webp';
import bodyArt from './hawk-body.webp';
import handUnderArt from './hawk-hand-under.webp';
import handArt from './hawk-hand.webp';
import headArt from './hawk-head.webp';
import tailArt from './hawk-tail.webp';

// The Harris's hawk put together from its parts on the bird kit's wings: a
// gliding body with its feet tucked under the tail painted on (it never
// lands or strikes), a head that can turn a little toward what it passes,
// the closed tail with its white base and tip, and two wings each of an arm
// and a hand. Facing right, its belly line on ANCHOR.
//
// The parts were cut from the glide drawing
// (design-docs/wimbledon/hawk-pose-glide-2.png), and the drawing units are
// that drawing's, on the same scale as the pigeon's, so the hawk is the
// size it should be beside them: export.py prints where each part sat.

// The pigeon's page scale: one for both birds.
export const SCALE = 1.4;

const BELLY = 8.59;
const ANCHOR = { x: 17, y: BELLY };
const FRAME: Frame = { width: 34.25, height: 9.8, anchor: ANCHOR, scale: SCALE };
export const REFERENCE = { x: 1, y: 1, width: 32.25, height: 7.83 };
const BODY = { x: 9.15, y: 1.65, width: 18.25, height: 7.17 };
const HEAD = { x: 24.62, y: 1, width: 8.67, height: 6.42 };
const TAIL = { x: 1.03, y: 3.11, width: 10.67, height: 4.67 };
export const EYE = { x: 29.71, y: 3.23 };
const NECK = { x: 25.6, y: 4.2 };
const MIDDLE = { x: 17, y: 5 };
const MEMBRANE: Fur = { fill: '#d9d2c4', outline: '#3a2a1c' };

// The wing, drawn flat with its span up the picture: broad, its arm about
// half its length and its hand the rest (a Harris's hawk's wing, 103 to
// 120cm of span, is nearly the bird's length).
const WING: WingArt = {
  name: 'wing', shoulder: { x: 0, y: 0 }, wrist: { x: -1.4, y: -12.6 },
  arm: { upper: armArt, under: armUnderArt, x: -5.6, y: -14.2, width: 7.67, height: 14.42 },
  hand: { upper: handArt, under: handUnderArt, x: -6.6, y: -25.4, width: 8.92, height: 15.33 },
};
const TIP = { x: -2.5, y: -25 };
const NEAR_SHOULDER = { x: 23.4, y: 3.4 };
const FAR_SHOULDER = { x: 24.2, y: 3 };
// Gliding low and fast over the ground, its wings held out just above level,
// a little swept, rocking a degree as the air moves them.
export const GLIDE: WingPose = { lift: 14, sweep: 25, fold: 20 };
// Its wingbeat: about 4.5 a second (a motion-capture study), the stroke
// broad and a little shallower than a pigeon's.
export const FLAP: Flap = { top: 45, bottom: -40, down: 0.55, fold: 60, sweep: 20 };
export const BEATS = 4.5;

export type HawkPose = 'glide' | 'flap';
export type RigHawk = { pose: HawkPose; seed: number; beat: number; gaze: number };
export type HawkLook = { now: number; still: boolean };

const image = (name: string, src: string, box: { x: number; y: number; width: number; height: number }): Layer => ({ kind: 'image', name, src, ...box });

export function hawkRig(hawk: RigHawk, look: HawkLook): RigPose {
  const wings = hawk.pose === 'flap' && !look.still ? flapping(hawk.beat, FLAP) : gliding(GLIDE, look.still ? 0 : look.now, look.still ? 0 : 1, 1600);
  const body = turnAbout(0, MIDDLE);
  const head = turnAbout(hawk.gaze, NECK);
  const layers: Layer[] = [
    birdWing(WING, wings, FAR_SHOULDER, true),
    image('tail', tailArt, TAIL),
    image('body', bodyArt, BODY),
    { kind: 'group', turn: head, layers: [image('head', headArt, HEAD), ...lidLayers(!look.still && blinking(hawk.seed, look.now), EYE, 0.55, MEMBRANE)] },
    birdWing(WING, wings, NEAR_SHOULDER, false),
  ];
  return {
    ...FRAME,
    layers: [{ kind: 'group', turn: body, layers }],
    guides: [
      { name: 'belly line', at: ANCHOR }, { name: 'eye', at: turned(head, EYE) }, { name: 'shoulder', at: NEAR_SHOULDER },
      { name: 'wrist', at: wingPoint(WING, wings, NEAR_SHOULDER, WING.wrist, false) },
      { name: 'wingtip', at: wingPoint(WING, wings, NEAR_SHOULDER, TIP, true) },
    ],
  };
}

// The box each pose's drawing stays inside through its whole motion (page
// px, from its belly line; `down` below it), as hawk-rig.test.ts measures.
export type Footprint = { width: number; height: number; down?: number };
export const FOOTPRINTS: Record<HawkPose, Footprint> = {
  glide: { width: 46, height: 16.5, down: 0.5 },
  flap: { width: 46, height: 33.5, down: 16 },
};
