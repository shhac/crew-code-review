import { CHASE_SPEED, LOPE_SPEED, POSES } from '../../lib/theme/hares/hare';
import { gazeAt, hareRig, REFERENCE, type HarePose, type RigHare } from '../../lib/theme/hares/hare-rig';
import type { Drawing } from '../drawings';
import hareBolt from '../hare-pose-bolt.webp';
import hareGather from '../hare-pose-bound-gather.webp';
import hareReach from '../hare-pose-bound-reach.webp';
import hareBox from '../hare-pose-box.webp';
import hareFreeze from '../hare-pose-freeze.webp';
import hareGraze from '../hare-pose-graze.webp';
import hareLope from '../hare-pose-lope.webp';
import hareSit from '../hare-pose-sit.webp';
import hareReference from '../hare-reference.webp';
import type { Moment, RigCritter } from './critter';

const MODES: HarePose[] = ['bound', 'lope', 'graze', 'sit', 'alert', 'box', 'leap', 'stand'];

// The widths and heights are copied from design-docs/hares/export.py's
// printed output.
const DRAWINGS: Record<string, Drawing<HarePose>> = {
  standing: { src: hareReference, ...REFERENCE, at: REFERENCE, mode: 'stand' },
  'bound reach': { src: hareReach, width: 35.92, height: 14.25, mode: 'bound' },
  'bound gather': { src: hareGather, width: 20.83, height: 16.58 },
  bolt: { src: hareBolt, width: 33.58, height: 14.83 },
  lope: { src: hareLope, width: 21.17, height: 21.58, mode: 'lope' },
  graze: { src: hareGraze, width: 21.08, height: 11.58, mode: 'graze' },
  sit: { src: hareSit, width: 15.33, height: 23.33, mode: 'sit' },
  freeze: { src: hareFreeze, width: 20.75, height: 18.83, mode: 'alert' },
  box: { src: hareBox, width: 19.67, height: 25.67, mode: 'box' },
};

// A leap replays every 0.6s, from take-off to landing.
const hareAt = ({ mode, walked, now }: Moment): RigHare => ({ pose: MODES.find((m) => m === mode) ?? 'stand', walked, seed: 1, leapt: (now % 600) / 600 });

export const hare = {
  kind: 'rig',
  name: 'hare',
  modes: MODES,
  speed: LOPE_SPEED,
  walking: ['bound', 'lope'],
  pace: (mode, speed) => (mode === 'bound' ? (speed * CHASE_SPEED) / LOPE_SPEED : speed),
  pose: (at, look) => hareRig(hareAt(at), { now: at.now, ...look }),
  box: (at) => POSES[hareAt(at).pose],
  gaze: (dir, cursor) => gazeAt(dir, { x: 0, y: 0 }, cursor),
  drawings: DRAWINGS,
} satisfies RigCritter;
