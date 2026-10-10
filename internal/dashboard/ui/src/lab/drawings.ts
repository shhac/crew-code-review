import type { Point } from '../lib/theme/pointer';
import type { RigPose } from '../lib/theme/rig/rig';

// A drawing of the animal laid over it to compare: the standing one its
// parts and legs were measured from (where its parts sat), or a key pose
// drawn from it, stood on the ledge, centred. A key pose names the lab mode
// it is the drawing of.
export type Drawing<Mode extends string = string> = { src: string; width: number; height: number; at?: Point; mode?: Mode };

// The drawing to show once the mode changes: the mode's own, or the one
// already shown. None shown stays none.
export function drawingFor(drawings: Record<string, Drawing>, mode: string, current: string): string {
  if (!current) return current;
  return Object.entries(drawings).find(([, d]) => d.mode === mode)?.[0] ?? current;
}

// The pose with only the drawing in it, where it sat or stood on the anchor.
export const overlay = (pose: RigPose, d: Drawing): RigPose => {
  const at = d.at ?? { x: pose.anchor.x - d.width / 2, y: pose.anchor.y - d.height };
  return { ...pose, layers: [{ kind: 'image', name: 'reference', src: d.src, x: at.x, y: at.y, width: d.width, height: d.height }] };
};
