import { BEATS, EYE, FOOTPRINTS, pigeonRig, REFERENCE, WALK_SPEED, SHY_SPEED, type PigeonPose, type RigPigeon } from '../../lib/theme/wimbledon/pigeon-rig';
import type { Drawing } from '../drawings';
import pigeonAlert from '../pigeon-pose-alert.webp';
import pigeonFlightDown from '../pigeon-pose-flight-down.webp';
import pigeonFlightUp from '../pigeon-pose-flight-up.webp';
import pigeonLand from '../pigeon-pose-land.webp';
import pigeonPeck from '../pigeon-pose-peck.webp';
import pigeonTakeoff from '../pigeon-pose-takeoff.webp';
import pigeonWalkHold from '../pigeon-pose-walk-hold.webp';
import pigeonWalkThrust from '../pigeon-pose-walk-thrust.webp';
import pigeonReference from '../pigeon-reference.webp';
import type { Moment, RigCritter } from './critter';

// The feral pigeon of summer tennis: its ground poses on the stage's floor,
// its flight held up in the air above it. A peck, the take-off, the landing
// flare and the settle each replay on a loop so they can be scrubbed
// through, at the note's wingbeats: 7 a second in the quick strokes of
// taking off and landing, 5.5 in level flight.
const MODES: { label: string; pose: PigeonPose; every?: number; beats?: number }[] = [
  { label: 'stand', pose: 'stand' }, { label: 'walk', pose: 'walk' }, { label: 'shy', pose: 'walk' },
  { label: 'peck', pose: 'peck', every: 450 }, { label: 'alert', pose: 'alert' },
  { label: 'take-off', pose: 'takeoff', every: 1500, beats: BEATS.quick }, { label: 'fly', pose: 'fly', beats: BEATS.cruise },
  { label: 'land', pose: 'land', every: 700, beats: BEATS.quick }, { label: 'settle', pose: 'settle', every: 600 },
];

// How far below the key pose's eye the rig's is, so a key pose is laid over
// the rig eye to eye; sizes and eyes in drawing units, as
// design-docs/wimbledon/export.py writes them.
const byEye = (src: string, width: number, height: number, eye: { x: number; y: number }, mode?: string): Drawing =>
  ({ src, width, height, at: { x: EYE.x - eye.x, y: EYE.y - eye.y }, mode });
const DRAWINGS: Record<string, Drawing> = {
  standing: { src: pigeonReference, ...REFERENCE, at: REFERENCE, mode: 'stand' },
  'walk, thrust': byEye(pigeonWalkThrust, 26.42, 16.67, { x: 23.17, y: 1.78 }, 'walk'),
  'walk, hold': byEye(pigeonWalkHold, 20.65, 15.6, { x: 17.62, y: 1.8 }),
  peck: byEye(pigeonPeck, 20.64, 13.47, { x: 18.97, y: 9.5 }, 'peck'),
  alert: byEye(pigeonAlert, 18.92, 18.8, { x: 15.69, y: 1.41 }, 'alert'),
  'take-off': byEye(pigeonTakeoff, 21.3, 22.98, { x: 18.14, y: 8.32 }, 'take-off'),
  'flight, down': byEye(pigeonFlightDown, 23.29, 15.45, { x: 20.2, y: 1.82 }, 'fly'),
  'flight, up': byEye(pigeonFlightUp, 22.67, 11.84, { x: 19.76, y: 3.76 }),
  land: byEye(pigeonLand, 23.89, 28.28, { x: 20.11, y: 10.22 }, 'land'),
};

const pigeonAt = ({ mode, now, walked }: Moment): RigPigeon => {
  const pick = MODES.find((m) => m.label === mode) ?? MODES[0];
  const time = pick.every ? now % pick.every : now;
  const beat = ((pick.beats ?? 0) * time) / 1000;
  // A take-off opens its wings for half a beat before the first stroke.
  return { pose: pick.pose, walked, seed: 1, beat: pick.pose === 'takeoff' ? beat - 0.5 : beat, t: pick.every ? time / pick.every : 0 };
};

export const pigeon = {
  kind: 'rig',
  name: 'pigeon',
  modes: MODES.map((m) => m.label),
  speed: WALK_SPEED,
  walking: ['walk', 'shy'],
  pace: (mode, speed) => (mode === 'shy' ? (speed * SHY_SPEED) / WALK_SPEED : speed),
  lift: (mode) => (mode === 'fly' ? 14 : 0),
  pose: (at, { still }) => pigeonRig(pigeonAt(at), { now: at.now, still }),
  box: (at) => FOOTPRINTS[pigeonAt(at).pose],
  drawings: DRAWINGS,
} satisfies RigCritter;
