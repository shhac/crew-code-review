import { crowGaze, crowRig, EYE, FOOTPRINTS, grounded, REFERENCE, SIDLE_SPEED, WALK_SPEED, type CrowPose, type RigCrow } from '../../lib/theme/harvest/crow-rig';
import crowAlert from '../crow-pose-alert.webp';
import crowFlightDown from '../crow-pose-flight-down-2.webp';
import crowFlightUp from '../crow-pose-flight-up-2.webp';
import crowLand from '../crow-pose-land-2.webp';
import crowPeck from '../crow-pose-peck.webp';
import crowReference from '../crow-reference.webp';
import crowTakeoff from '../crow-pose-takeoff-2.webp';
import crowWalk from '../crow-pose-walk.webp';
import type { Drawing } from '../drawings';
import type { Moment, RigCritter } from './critter';

// September's carrion crow: its ground poses on the stage's floor, its
// flight poses held up in the air above it. Pecking, the take-off, the
// flare and the settle each replay on a loop so they can be scrubbed
// through, at the harvest note's wingbeat, 3.8 a second.
const BEATS = 3.8;
const MODES: { label: string; pose: CrowPose; every?: number; beats?: number }[] = [
  { label: 'stand', pose: 'stand' }, { label: 'walk', pose: 'walk' }, { label: 'sidle', pose: 'sidle' },
  { label: 'peck', pose: 'peck', every: 350 }, { label: 'alert', pose: 'alert' },
  { label: 'take-off', pose: 'takeoff', every: 1500, beats: BEATS }, { label: 'flap', pose: 'flap', beats: BEATS },
  { label: 'skim', pose: 'skim', beats: BEATS }, { label: 'glide', pose: 'glide' },
  { label: 'flare', pose: 'flare', every: 600, beats: BEATS }, { label: 'settle', pose: 'settle', every: 900 },
];
const AIRBORNE = ['flap', 'skim', 'glide'];

// Each key pose laid over the rig eye to eye; the sizes and eyes are
// design-docs/harvest/export.py's printed output.
const byEye = (src: string, width: number, height: number, eye: { x: number; y: number }, mode?: string): Drawing =>
  ({ src, width, height, at: { x: EYE.x - eye.x, y: EYE.y - eye.y }, mode });
const DRAWINGS: Record<string, Drawing> = {
  standing: { src: crowReference, ...REFERENCE, at: REFERENCE, mode: 'stand' },
  walk: byEye(crowWalk, 37.08, 25.67, { x: 29.69, y: 3.16 }, 'walk'),
  peck: byEye(crowPeck, 38.58, 27.58, { x: 34.77, y: 20.51 }, 'peck'),
  alert: byEye(crowAlert, 33.67, 30.25, { x: 26.07, y: 2.69 }, 'alert'),
  'take-off': byEye(crowTakeoff, 41.33, 39.42, { x: 33.44, y: 12.94 }, 'take-off'),
  'flight up': byEye(crowFlightUp, 39.5, 27.83, { x: 32, y: 16.12 }, 'flap'),
  'flight down': byEye(crowFlightDown, 42.58, 28.17, { x: 34.65, y: 3.02 }),
  land: byEye(crowLand, 39.67, 36.83, { x: 31.23, y: 12.89 }, 'flare'),
};

const crowAt = ({ mode, now, walked }: Moment): RigCrow => {
  const pick = MODES.find((m) => m.label === mode) ?? MODES[0];
  const time = pick.every ? now % pick.every : now;
  const beat = ((pick.beats ?? 0) * time) / 1000;
  // A take-off opens its wings for half a beat before the first stroke.
  return { pose: pick.pose, walked, seed: 1, beat: pick.pose === 'takeoff' ? beat - 0.5 : beat, t: pick.every ? time / pick.every : 0 };
};

export const crow = {
  kind: 'rig',
  name: 'crow',
  modes: MODES.map((m) => m.label),
  speed: WALK_SPEED,
  walking: ['walk', 'sidle'],
  pace: (mode, speed) => (mode === 'sidle' ? (speed * SIDLE_SPEED) / WALK_SPEED : speed),
  lift: (mode) => (AIRBORNE.includes(mode) ? 20 : 0),
  pose: (at, { still, gaze }) => crowRig(crowAt(at), { now: at.now, still, gaze: grounded(crowAt(at).pose) ? gaze : 0 }),
  gaze: (dir, cursor) => crowGaze(dir, { x: 0, y: 0 }, cursor),
  box: (at) => FOOTPRINTS[crowAt(at).pose],
  drawings: DRAWINGS,
} satisfies RigCritter;
