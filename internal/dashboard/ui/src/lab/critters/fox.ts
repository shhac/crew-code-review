import { LEAP, POSES, poseOf, SPEED, type Mode } from '../../lib/theme/aurora/fox';
import { foxRig, REFERENCE, type RigFox } from '../../lib/theme/aurora/fox-rig';
import type { Drawing } from '../drawings';
import foxBow from '../fox-pose-bow.webp';
import foxCrouch from '../fox-pose-crouch.webp';
import foxDig from '../fox-pose-dig.webp';
import foxPounce from '../fox-pose-pounce.webp';
import foxTrotPass from '../fox-pose-trot-pass.webp';
import foxTrotReach from '../fox-pose-trot-reach.webp';
import foxReference from '../fox-reference.webp';
import type { Moment, RigCritter } from './critter';

// The lab's labels for what the fox does, not the fox's own modes: its
// alert is asleep but looking up.
const MODES: { label: string; mode: Mode; look?: number }[] = [
  { label: 'trot', mode: 'trot' }, { label: 'stand', mode: 'settle' }, { label: 'stretch', mode: 'stretch' }, { label: 'crouch', mode: 'crouch' },
  { label: 'leap', mode: 'leap' }, { label: 'dig', mode: 'dig' }, { label: 'asleep', mode: 'asleep' }, { label: 'alert', mode: 'asleep', look: Infinity },
];

// The widths and heights are copied from design-docs/aurora/export.py's
// printed output.
const DRAWINGS: Record<string, Drawing> = {
  standing: { src: foxReference, ...REFERENCE, at: REFERENCE, mode: 'stand' },
  'trot reach': { src: foxTrotReach, width: 29.67, height: 16.5, mode: 'trot' },
  'trot pass': { src: foxTrotPass, width: 29.25, height: 16.83 },
  crouch: { src: foxCrouch, width: 31.42, height: 10.67, mode: 'crouch' },
  bow: { src: foxBow, width: 27.33, height: 18.75, mode: 'stretch' },
  pounce: { src: foxPounce, width: 32.08, height: 16.75, mode: 'leap' },
  dig: { src: foxDig, width: 27.08, height: 18.5, mode: 'dig' },
};

const foxAt = ({ mode, walked, now }: Moment): RigFox => {
  const pick = MODES.find((f) => f.label === mode) ?? MODES[0];
  // A leap replays every 0.9s: its flight, then a moment landed.
  return { mode: pick.mode, walked, seed: 1, until: now - (now % 900) + LEAP, ear: 0, look: pick.look ?? 0 };
};

export const fox = {
  kind: 'rig',
  name: 'fox',
  modes: MODES.map((m) => m.label),
  speed: SPEED,
  walking: ['trot'],
  pose: (at, { still }) => foxRig(foxAt(at), { now: at.now, still }),
  box: (at) => POSES[poseOf(foxAt(at), at.now)],
  drawings: DRAWINGS,
} satisfies RigCritter;
