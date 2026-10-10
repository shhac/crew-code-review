import type { Box } from '../floors';
import type { Walker } from '../ledges';
import { FOOTPRINTS, type GullPose } from './gull-rig';

// The space each of the gull's poses takes on the page, from gull-rig.ts's
// footprints (its test measures them over every motion). A gull is placed
// by its rig's anchor, the point between its feet, in flight as on a
// ledge: a route is the anchor's path, and each footprint stands on it,
// `down` reaching below.

export type GroundPose = 'stand' | 'strut' | 'eye' | 'call';
// The poses a route is flown in: the run and lift-off, flapping flight, the
// dive and the flare.
export type AirPose = 'takeoff' | 'flap' | 'stoop' | 'flare';
export type Pose = Extract<GullPose, GroundPose | AirPose | 'settle'>;

// How far each pose reaches from the anchor.
export type Reach = { half: number; up: number; down: number };
export const reachOf = (pose: GullPose): Reach => {
  const { width, height, down = 0 } = FOOTPRINTS[pose];
  return { half: width / 2, up: height, down };
};
export const AIR: Record<AirPose, Reach> = { takeoff: reachOf('takeoff'), flap: reachOf('flap'), stoop: reachOf('stoop'), flare: reachOf('flare') };

// The box a pose takes up on the page, drawn with its anchor at p.
export function poseBox(pose: GullPose, p: { x: number; y: number }): Box {
  const r = reachOf(pose);
  return { left: p.x - r.half, right: p.x + r.half, top: p.y - r.up, bottom: p.y + r.down };
}

// The body's middle, this far above the anchor: what the cursor is near to
// or far from.
export const MIDDLE = 11;

// Where a gull stands or struts, all of it stays on a clear run with 27px
// above it (22px, and 6px up into the empty bottom edge of a card or rule
// above), 100px from any other gull, centre to centre: its widest pose on
// a ledge either side of its anchor.
const HALF = Math.max(...(['stand', 'strut', 'eye', 'call'] as const).map((p) => FOOTPRINTS[p].width)) / 2;
export const GULL: Walker = { clear: 27, reach: 6, half: HALF, spacing: 100 };
