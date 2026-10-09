// The widths and heights are copied from design-docs/<theme>/export.py's printed output.
import { REFERENCE as FOX_REFERENCE } from '../lib/theme/aurora/fox-rig';
import type { Mode as HogMode } from '../lib/theme/bonfire/hedgehog';
import { REFERENCE as HOG_REFERENCE } from '../lib/theme/bonfire/hedgehog-rig';
import type { Point } from '../lib/theme/pointer';
import type { RigPose } from '../lib/theme/rig/rig';
import foxBow from './fox-pose-bow.webp';
import foxCrouch from './fox-pose-crouch.webp';
import foxDig from './fox-pose-dig.webp';
import foxPounce from './fox-pose-pounce.webp';
import foxTrotPass from './fox-pose-trot-pass.webp';
import foxTrotReach from './fox-pose-trot-reach.webp';
import foxReference from './fox-reference.webp';
import hogHurry from './hedgehog-pose-hurry.webp';
import hogPeek from './hedgehog-pose-peek.webp';
import hogSniff from './hedgehog-pose-sniff.webp';
import hogWalkContact from './hedgehog-pose-walk-contact.webp';
import hogWalkPass from './hedgehog-pose-walk-pass.webp';
import hogReference from './hedgehog-reference.webp';

// A drawing of the animal laid over it to compare: the standing one its
// parts and legs were measured from (where its parts sat), or a key pose
// drawn from it, stood on the ledge, centred. A key pose names the lab mode
// it is the drawing of.
export type Drawing<Mode extends string = string> = { src: string; width: number; height: number; at?: Point; mode?: Mode };

const HEDGEHOG: Record<string, Drawing<HogMode>> = {
  standing: { src: hogReference, ...HOG_REFERENCE, at: HOG_REFERENCE },
  'walk contact': { src: hogWalkContact, width: 24, height: 16.25, mode: 'walk' },
  'walk pass': { src: hogWalkPass, width: 24.17, height: 16.5 },
  hurry: { src: hogHurry, width: 25.92, height: 15.33, mode: 'flee' },
  sniff: { src: hogSniff, width: 24.75, height: 14.33, mode: 'sniff' },
  peek: { src: hogPeek, width: 25.92, height: 15.83, mode: 'peek' },
};
// The fox's modes are the lab's labels for them, not the fox's own.
const FOX: Record<string, Drawing> = {
  standing: { src: foxReference, ...FOX_REFERENCE, at: FOX_REFERENCE, mode: 'stand' },
  'trot reach': { src: foxTrotReach, width: 29.67, height: 16.5, mode: 'trot' },
  'trot pass': { src: foxTrotPass, width: 29.25, height: 16.83 },
  crouch: { src: foxCrouch, width: 31.42, height: 10.67, mode: 'crouch' },
  bow: { src: foxBow, width: 27.33, height: 18.75, mode: 'stretch' },
  pounce: { src: foxPounce, width: 32.08, height: 16.75, mode: 'leap' },
  dig: { src: foxDig, width: 27.08, height: 18.5, mode: 'dig' },
};
const DRAWINGS: Partial<Record<string, Record<string, Drawing>>> = { hedgehog: HEDGEHOG, fox: FOX };

export const drawingsOf = (animal: string): Record<string, Drawing> => DRAWINGS[animal] ?? {};

// The drawing to show once the mode changes: the mode's own, or the one
// already shown. None shown stays none.
export function drawingFor(animal: string, mode: string, current: string): string {
  if (!current) return current;
  return Object.entries(drawingsOf(animal)).find(([, d]) => d.mode === mode)?.[0] ?? current;
}

// The pose with only the drawing in it, where it sat or stood on the anchor.
export const overlay = (pose: RigPose, d: Drawing): RigPose => {
  const at = d.at ?? { x: pose.anchor.x - d.width / 2, y: pose.anchor.y - d.height };
  return { ...pose, layers: [{ kind: 'image', name: 'reference', src: d.src, x: at.x, y: at.y, width: d.width, height: d.height }] };
};
