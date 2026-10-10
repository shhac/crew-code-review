import { BOLT, POSES, SPEED } from '../../lib/theme/easter/rabbit';
import { rabbitRig, REFERENCE, type Pose, type RigRabbit } from '../../lib/theme/easter/rabbit-rig';
import type { Drawing } from '../drawings';
import rabbitAlert from '../rabbit-pose-alert.webp';
import rabbitExtend from '../rabbit-pose-extend.webp';
import rabbitGather from '../rabbit-pose-gather.webp';
import rabbitGroom from '../rabbit-pose-groom.webp';
import rabbitNudge from '../rabbit-pose-nudge.webp';
import rabbitSit from '../rabbit-pose-sit.webp';
import rabbitThump from '../rabbit-pose-thump.webp';
import rabbitReference from '../rabbit-reference.webp';
import type { Moment, RigCritter } from './critter';

// The lab's labels for what the rabbit does: a bolt is a hop at full tilt.
const MODES: { label: string; pose: Pose; bolting?: boolean }[] = [
  { label: 'hop', pose: 'hop' }, { label: 'bolt', pose: 'hop', bolting: true }, { label: 'sit', pose: 'sit' }, { label: 'alert', pose: 'alert' },
  { label: 'groom', pose: 'groom' }, { label: 'nudge', pose: 'nudge' }, { label: 'thump', pose: 'thump' },
];

// The widths and heights are copied from design-docs/easter/export.py's
// printed output.
const DRAWINGS: Record<string, Drawing> = {
  standing: { src: rabbitReference, ...REFERENCE, at: REFERENCE },
  sit: { src: rabbitSit, width: 16.08, height: 17.08, mode: 'sit' },
  gather: { src: rabbitGather, width: 17.67, height: 15.92, mode: 'hop' },
  extend: { src: rabbitExtend, width: 27.42, height: 13 },
  alert: { src: rabbitAlert, width: 12.33, height: 22.42, mode: 'alert' },
  groom: { src: rabbitGroom, width: 14.67, height: 18.92, mode: 'groom' },
  nudge: { src: rabbitNudge, width: 22.67, height: 12.42, mode: 'nudge' },
  thump: { src: rabbitThump, width: 18.5, height: 15.58, mode: 'thump' },
};

const rabbitAt = ({ mode, walked, now }: Moment): RigRabbit => {
  const pick = MODES.find((m) => m.label === mode) ?? MODES[0];
  return { pose: pick.pose, walked, since: now, seed: 1, bolting: pick.bolting };
};

export const rabbit = {
  kind: 'rig',
  name: 'rabbit',
  modes: MODES.map((m) => m.label),
  speed: SPEED,
  walking: ['hop', 'bolt'],
  pace: (mode, speed) => (mode === 'bolt' ? (speed * BOLT) / SPEED : speed),
  pose: (at, look) => rabbitRig(rabbitAt(at), { now: at.now, ...look }),
  box: (at) => POSES[rabbitAt(at).pose],
  drawings: DRAWINGS,
} satisfies RigCritter;
