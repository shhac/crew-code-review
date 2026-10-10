import { BEATS, EYE, FOOTPRINTS, hawkRig, REFERENCE, type HawkPose, type RigHawk } from '../../lib/theme/wimbledon/hawk-rig';
import type { Drawing } from '../drawings';
import hawkFlapDown from '../hawk-pose-flap-down.webp';
import hawkFlapUp from '../hawk-pose-flap-up.webp';
import hawkGlide from '../hawk-pose-glide.webp';
import type { Moment, RigCritter } from './critter';

// The Harris's hawk of summer tennis, held up in the air over the stage: it
// only ever flies, gliding low along a row of ledges and now and then
// flapping, at about 4.5 beats a second.
const MODES: { label: string; pose: HawkPose }[] = [{ label: 'glide', pose: 'glide' }, { label: 'flap', pose: 'flap' }];

// How far below the key pose's eye the rig's is, so a key pose is laid over
// the rig eye to eye; sizes and eyes in drawing units, as
// design-docs/wimbledon/export.py writes them.
const byEye = (src: string, width: number, height: number, eye: { x: number; y: number }, mode?: string): Drawing =>
  ({ src, width, height, at: { x: EYE.x - eye.x, y: EYE.y - eye.y }, mode });
const DRAWINGS: Record<string, Drawing> = {
  glide: { src: hawkGlide, ...REFERENCE, at: REFERENCE, mode: 'glide' },
  'flap, down': byEye(hawkFlapDown, 29.04, 22.18, { x: 25.49, y: 2.28 }, 'flap'),
  'flap, up': byEye(hawkFlapUp, 27.42, 24.94, { x: 23.85, y: 17.95 }),
};

const hawkAt = ({ mode, now }: Moment): RigHawk => {
  const pick = MODES.find((m) => m.label === mode) ?? MODES[0];
  return { pose: pick.pose, seed: 2, beat: (BEATS * now) / 1000, gaze: 0 };
};

export const hawk = {
  kind: 'rig',
  name: 'hawk',
  modes: MODES.map((m) => m.label),
  speed: 0,
  walking: [],
  lift: 8,
  pose: (at, { still }) => hawkRig(hawkAt(at), { now: at.now, still }),
  box: (at) => FOOTPRINTS[hawkAt(at).pose],
  drawings: DRAWINGS,
} satisfies RigCritter;
