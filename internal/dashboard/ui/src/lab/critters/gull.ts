import { FOOTPRINTS, FORAGE_SPEED, gullRig, EYE, REFERENCE, STRUT_SPEED, type GullPose, type RigGull } from '../../lib/theme/seaside/gull-rig';
import type { Drawing } from '../drawings';
import gullFlapDown from '../gull-pose-flap-down-2.webp';
import gullFlapUp from '../gull-pose-flap-up.webp';
import gullFlare from '../gull-pose-flare-2.webp';
import gullReference from '../gull-reference.webp';
import gullSwoop from '../gull-pose-swoop.webp';
import gullTakeoff from '../gull-pose-takeoff.webp';
import gullWalkContact from '../gull-pose-walk-contact.webp';
import gullWalkPass from '../gull-pose-walk-pass.webp';
import type { Moment, RigCritter } from './critter';

// The herring gull, the bird kit's test bird: its ground poses on the
// stage's floor, its flight poses held up in the air above it. Take-off,
// the flare and the settle each replay on a loop so they can be scrubbed
// through, at the seaside note's wingbeats: 2.8 a second cruising, 4 in the
// quick strokes of taking off and landing (Blake 1948).
const MODES: { label: string; pose: GullPose; every?: number; beats?: number }[] = [
  { label: 'stand', pose: 'stand' }, { label: 'strut', pose: 'strut' }, { label: 'forage', pose: 'forage' },
  { label: 'take-off', pose: 'takeoff', every: 1500, beats: 4 }, { label: 'flap', pose: 'flap', beats: 2.8 },
  { label: 'glide', pose: 'glide' }, { label: 'stoop', pose: 'stoop' },
  { label: 'flare', pose: 'flare', every: 600, beats: 4 }, { label: 'settle', pose: 'settle', every: 900 },
];
const AIRBORNE = ['flap', 'glide', 'stoop'];

// How far below the key pose's eye the rig's is, so a key pose is laid over
// the rig eye to eye; the widths and heights are copied from
// design-docs/seaside/export.py's printed output, the eyes measured where
// export.py's seeds found them.
const byEye = (src: string, width: number, height: number, eye: { x: number; y: number }, mode?: string): Drawing =>
  ({ src, width, height, at: { x: EYE.x - eye.x, y: EYE.y - eye.y }, mode });
const DRAWINGS: Record<string, Drawing> = {
  standing: { src: gullReference, ...REFERENCE, at: REFERENCE, mode: 'stand' },
  'walk contact': byEye(gullWalkContact, 24.67, 17.08, { x: 20.4, y: 1.45 }, 'strut'),
  'walk pass': byEye(gullWalkPass, 24.67, 17.08, { x: 20.46, y: 1.45 }),
  'take-off': byEye(gullTakeoff, 28.17, 25.67, { x: 23.69, y: 10.72 }, 'take-off'),
  'flap up': byEye(gullFlapUp, 25.5, 19.25, { x: 20.84, y: 12.02 }, 'flap'),
  'flap down': byEye(gullFlapDown, 26.92, 17.75, { x: 22.44, y: 1.42 }),
  swoop: byEye(gullSwoop, 26.58, 9.92, { x: 22.66, y: 5.75 }, 'stoop'),
  flare: byEye(gullFlare, 25.5, 25.92, { x: 20.97, y: 8.92 }, 'flare'),
};

const gullAt = ({ mode, now, walked }: Moment): RigGull => {
  const pick = MODES.find((m) => m.label === mode) ?? MODES[0];
  const time = pick.every ? now % pick.every : now;
  const beat = ((pick.beats ?? 0) * time) / 1000;
  // A take-off opens its wings for half a beat before the first stroke.
  return { pose: pick.pose, walked, seed: 1, beat: pick.pose === 'takeoff' ? beat - 0.5 : beat, t: pick.every ? time / pick.every : 0 };
};

export const gull = {
  kind: 'rig',
  name: 'gull',
  modes: MODES.map((m) => m.label),
  speed: STRUT_SPEED,
  walking: ['strut', 'forage'],
  pace: (mode, speed) => (mode === 'forage' ? (speed * FORAGE_SPEED) / STRUT_SPEED : speed),
  lift: (mode) => (AIRBORNE.includes(mode) ? 16 : 0),
  pose: (at, { still }) => gullRig(gullAt(at), { now: at.now, still }),
  box: (at) => FOOTPRINTS[gullAt(at).pose],
  drawings: DRAWINGS,
} satisfies RigCritter;
