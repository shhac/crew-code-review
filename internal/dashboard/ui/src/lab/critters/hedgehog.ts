import { HOG, HURRY, moving, SPEED, type Hog, type Mode } from '../../lib/theme/bonfire/hedgehog';
import { gazeAt, hogRig, REFERENCE } from '../../lib/theme/bonfire/hedgehog-rig';
import type { Drawing } from '../drawings';
import hogHurry from '../hedgehog-pose-hurry.webp';
import hogPeek from '../hedgehog-pose-peek.webp';
import hogSniff from '../hedgehog-pose-sniff.webp';
import hogWalkContact from '../hedgehog-pose-walk-contact.webp';
import hogWalkPass from '../hedgehog-pose-walk-pass.webp';
import hogReference from '../hedgehog-reference.webp';
import type { Moment, RigCritter } from './critter';

const MODES: Mode[] = ['walk', 'flee', 'sniff', 'peek', 'curled'];

// The widths and heights are copied from design-docs/bonfire/export.py's
// printed output.
const DRAWINGS: Record<string, Drawing<Mode>> = {
  standing: { src: hogReference, ...REFERENCE, at: REFERENCE },
  'walk contact': { src: hogWalkContact, width: 24, height: 16.25, mode: 'walk' },
  'walk pass': { src: hogWalkPass, width: 24.17, height: 16.5 },
  hurry: { src: hogHurry, width: 25.92, height: 15.33, mode: 'flee' },
  sniff: { src: hogSniff, width: 24.75, height: 14.33, mode: 'sniff' },
  peek: { src: hogPeek, width: 25.92, height: 15.83, mode: 'peek' },
};

// The rig draws it facing right whichever way it is going; the lab turns it.
const hogAt = ({ mode, walked }: Moment): Hog => ({ id: 0, seed: 1, x: 0, dir: 1, mode: MODES.find((m) => m === mode) ?? 'walk', target: 0, until: 0, out: 0, walked });

export const hedgehog = {
  kind: 'rig',
  name: 'hedgehog',
  modes: MODES,
  speed: SPEED,
  walking: MODES.filter(moving),
  pace: (mode, speed) => (mode === 'flee' ? (speed * HURRY) / SPEED : speed),
  pose: (at, look) => hogRig(hogAt(at), { now: at.now, ...look }),
  box: () => HOG,
  gaze: (dir, cursor) => gazeAt({ dir }, { x: 0, y: 0 }, cursor),
  drawings: DRAWINGS,
} satisfies RigCritter;
