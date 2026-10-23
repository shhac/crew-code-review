import { blinking } from '../rig/life';
import { lidLayers, turnAbout, type Frame, type Fur, type RigPose } from '../rig/rig';
import { compose } from '../rig/skeleton/compose';
import { BIRD, head, picture, spine, tetrapod } from '../rig/skeleton/tetrapod';
import { wingOf } from '../rig/skeleton/wing';
import { flapping, gliding, type Flap, type WingArt, type WingPose } from '../rig/wings';
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
// and a hand, all hung on its skeleton (rig/skeleton). Facing right, its
// belly line on ANCHOR.
//
// The parts were cut from the glide drawing
// (design-docs/wimbledon/hawk-pose-glide-2.png), and the drawing units are
// that drawing's, on the same scale as the pigeon's, so the hawk is the
// size it should be beside them: export.py prints where each part sat.

// The pigeon's page scale: one for both birds.
const SCALE = 1.4;

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
const GLIDE: WingPose = { lift: 14, sweep: 25, fold: 20 };
// Its wingbeat: about 4.5 a second (a motion-capture study), the stroke
// broad and a little shallower than a pigeon's.
const FLAP: Flap = { top: 45, bottom: -40, down: 0.55, fold: 60, sweep: 20 };
export const BEATS = 4.5;

export type HawkPose = 'glide' | 'flap';
export type RigHawk = { pose: HawkPose; seed: number; beat: number; gaze: number };
type HawkLook = { now: number; still: boolean };

// Its skeleton: the body, the head on its neck with the eye on it, and the
// wings; no legs, its feet painted on. The far wing behind it all, the
// near over it all.
const NEAR_WING = wingOf({ art: WING, side: 'near', parent: 'body', root: NEAR_SHOULDER, tip: TIP, z: 0 });
const FAR_WING = wingOf({ art: WING, side: 'far', parent: 'body', root: FAR_SHOULDER, tip: TIP, z: 0 });
const HAWK = tetrapod(BIRD, {
  frame: FRAME,
  root: 'body',
  joints: [
    { id: 'body', parent: null, role: spine(2), at: MIDDLE, name: 'body pivot' },
    { id: 'skull', parent: 'body', role: spine(0), at: NECK, name: 'head joint' },
    { id: 'eye', parent: 'skull', role: head(0), at: EYE, name: 'eye' },
    ...FAR_WING.joints, ...NEAR_WING.joints,
  ],
  bones: [{ from: 'skull', to: 'body', name: 'neck and back line' }, ...FAR_WING.bones, ...NEAR_WING.bones],
  legs: [],
  ground: () => BELLY,
  order: [FAR_WING.pieces, picture('tail', 'body', tailArt, TAIL), picture('body', 'body', bodyArt, BODY), picture('head', 'skull', headArt, HEAD), 'eyelid', NEAR_WING.pieces],
  shapes: [{ id: 'eyelid', on: 'skull' }],
  stands: 'belly line',
  guides: () => [{ name: 'eye', at: 'eye' }, { name: 'shoulder', at: NEAR_WING.ids.shoulder }, { name: 'wrist', at: NEAR_WING.ids.wrist }, { name: 'wingtip', at: NEAR_WING.ids.tip }],
});

export function hawkRig(hawk: RigHawk, look: HawkLook): RigPose {
  const wings = hawk.pose === 'flap' && !look.still ? flapping(hawk.beat, FLAP) : gliding(GLIDE, look.still ? 0 : look.now, look.still ? 0 : 1, 1600);
  const [far, near] = [FAR_WING.pose(wings), NEAR_WING.pose(wings)];
  const joints = { ...far.joints, ...near.joints, skull: { angle: hawk.gaze } };
  const shapes = { eyelid: lidLayers(!look.still && blinking(hawk.seed, look.now), EYE, 0.55, MEMBRANE) };
  return compose(HAWK.body, () => ({ root: turnAbout(0, MIDDLE), joints, limbs: {}, show: { ...far.show, ...near.show }, z: {}, shapes }), look.now);
}

// The box each pose's drawing stays inside through its whole motion (page
// px, from its belly line; `down` below it), as hawk-rig.test.ts measures.
type Footprint = { width: number; height: number; down?: number };
export const FOOTPRINTS: Record<HawkPose, Footprint> = {
  glide: { width: 46, height: 16.5, down: 0.5 },
  flap: { width: 46, height: 33.5, down: 16 },
};
