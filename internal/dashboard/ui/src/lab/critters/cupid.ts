import { BEATS, poseFootprint } from '../../lib/theme/valentine/cupid';
import { cupidRig, EYE, REFERENCE, type CupidPose, type RigCupid } from '../../lib/theme/valentine/cupid-rig';
import { FOOTPRINTS } from '../../lib/theme/valentine/footprints';
import aim from '../cupid-pose-aim.webp';
import dodge from '../cupid-pose-dodge.webp';
import flit from '../cupid-pose-flit.webp';
import reference from '../cupid-reference.webp';
import release from '../cupid-pose-release.webp';
import type { Drawing } from '../drawings';
import type { Moment, RigCritter } from './critter';

// The lab's labels for what a cupid does: its own poses, the draw and the
// loose replaying on a loop so each can be scrubbed through.
const MODES: { label: string; pose: CupidPose; every?: number; takes?: number }[] = [
  { label: 'hover', pose: 'hover' }, { label: 'flit', pose: 'flight' },
  { label: 'draw', pose: 'draw', every: 1200, takes: 600 }, { label: 'aim', pose: 'aim' },
  { label: 'loose', pose: 'loose', every: 900, takes: 450 }, { label: 'dodge', pose: 'dodge' },
];
// How far below the key pose's eye the rig's is, so a key pose is laid over
// the rig eye to eye; the widths, heights and eyes are copied from
// design-docs/valentine/export.py's printed output.
const byEye = (width: number, height: number, eye: { x: number; y: number }, mode: string): Drawing =>
  ({ src: '', width, height, at: { x: EYE.x - eye.x, y: EYE.y - eye.y }, mode });
const DRAWINGS: Record<string, Drawing> = {
  hovering: { src: reference, ...REFERENCE, at: REFERENCE, mode: 'hover' },
  flit: { ...byEye(21.58, 24.25, { x: 17.84, y: 9.48 }, 'flit'), src: flit },
  aim: { ...byEye(26.17, 27.42, { x: 14.94, y: 7.87 }, 'aim'), src: aim },
  release: { ...byEye(21.08, 25.25, { x: 13.98, y: 7.17 }, 'loose'), src: release },
  dodge: { ...byEye(20.5, 22.83, { x: 11.97, y: 6.54 }, 'dodge'), src: dodge },
};

const cupidAt = ({ mode, now, walked }: Moment): RigCupid => {
  const pick = MODES.find((m) => m.label === mode) ?? MODES[0];
  const progress = pick.every && pick.takes ? Math.min(1, (now % pick.every) / pick.takes) : 1;
  // Flying, the dial's speed is its speed ahead.
  const speed = pick.pose === 'flight' ? walked / Math.max(0.001, now / 1000) : 0;
  return { pose: pick.pose, seed: 1, beat: (now / 1000) * BEATS[pick.pose], progress, aim: 25, speed, accel: 0, gaze: 0 };
};

export const cupid = {
  kind: 'rig',
  name: 'cupid',
  modes: MODES.map((m) => m.label),
  speed: 150,
  walking: ['flit'],
  lift: FOOTPRINTS.hover.down + 8,
  pose: (at, { still }) => cupidRig(cupidAt(at), { now: at.now, still }),
  box: (at) => {
    const f = FOOTPRINTS[poseFootprint(cupidAt(at).pose)];
    return { width: 2 * f.half, height: f.up, down: f.down };
  },
  drawings: DRAWINGS,
} satisfies RigCritter;
