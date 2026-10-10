import { FOOTPRINTS, type WaspPose } from '../../lib/theme/fete/footprints';
import { ANCHOR, CRUISE, EYE, GROUND, REFERENCE, SCALE, eyeOf, waspRig, type RigWasp } from '../../lib/theme/fete/wasp-rig';
import { smooth } from '../../lib/theme/math';
import { gazeFrom } from '../../lib/theme/rig/gaze';
import type { Drawing } from '../drawings';
import cruise from '../wasp-pose-cruise.webp';
import feed from '../wasp-pose-feed.webp';
import hover from '../wasp-pose-hover.webp';
import land from '../wasp-pose-land.webp';
import reference from '../wasp-reference.webp';
import type { Moment, RigCritter } from './critter';

// June's common wasp (lib/theme/fete/wasp-rig.ts) on the insect rig. The
// lab's labels for what she does: her poses, feeding with its shuffles on a
// slow tripod, and a lift-off with the blur fading in, on a loop.
const MODES: { label: string; pose: WaspPose }[] = [
  { label: 'standing', pose: 'standing' }, { label: 'feed', pose: 'feed' }, { label: 'hover', pose: 'hover' },
  { label: 'land', pose: 'land' }, { label: 'lift off', pose: 'land' }, { label: 'cruise', pose: 'cruise' },
];

const waspAt = ({ mode, now, walked }: Moment, lean: number): RigWasp => {
  const pick = MODES.find((m) => m.label === mode) ?? MODES[0];
  const grounded = pick.pose === 'standing' || pick.pose === 'feed';
  const wings = grounded ? 0 : mode === 'lift off' ? smooth((now % 1500) / 350) : 1;
  const speed = pick.pose === 'cruise' ? CRUISE : 0;
  return { pose: pick.pose, seed: 1, walked: walked / SCALE, speed, lean, wings };
};

// Each key pose laid over the rig eye to eye: the widths, heights and eyes
// are copied from design-docs/fete/export.py's printed output.
const byEye = (src: string, width: number, height: number, eye: { x: number; y: number }, mode: string): Drawing => {
  const at = eyeOf(waspAt({ mode, now: 0, walked: 0 }, 0));
  return { src, width, height, at: { x: at.x - eye.x, y: at.y - eye.y }, mode };
};
const DRAWINGS: Record<string, Drawing> = {
  standing: { src: reference, ...REFERENCE, at: REFERENCE, mode: 'standing' },
  feed: byEye(feed, 29.67, 13.5, { x: 22.15, y: 8.36 }, 'feed'),
  hover: byEye(hover, 28.58, 23.42, { x: 20.25, y: 8.15 }, 'hover'),
  land: byEye(land, 27.25, 20.92, { x: 19.08, y: 8.59 }, 'land'),
  cruise: byEye(cruise, 31.42, 11.42, { x: 22.36, y: 4.62 }, 'cruise'),
};

const gaze = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: 15, reach: 80 });

export const wasp = {
  kind: 'rig',
  name: 'wasp',
  modes: MODES.map((m) => m.label),
  speed: 12,
  walking: ['feed'],
  lift: (GROUND - ANCHOR.y) * SCALE,
  pose: (at, { gaze: lean, still }) => waspRig(waspAt(at, lean), { now: at.now, still }),
  box: ({ mode }) => {
    const f = FOOTPRINTS[(MODES.find((m) => m.label === mode) ?? MODES[0]).pose];
    return { width: 2 * f.half, height: f.up, down: f.down };
  },
  gaze: (dir, cursor) => gaze(dir, { x: 0, y: -(GROUND - ANCHOR.y) * SCALE }, cursor),
  drawings: DRAWINGS,
} satisfies RigCritter;
