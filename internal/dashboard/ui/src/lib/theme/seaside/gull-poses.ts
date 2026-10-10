import type { Reach } from '../floors';
import type { Walker } from '../ledges';

// The space each of the gull's poses takes on the page, in page pixels.
// These are the design note's numbers, measured from the key poses at the
// page scale; the rig test pins the real ones (pageReach over every cycle)
// and these follow it.

// On a ledge: the box each pose stays inside, standing on its feet.
export const GROUND = {
  stand: { width: 36.5, height: 25.5 },
  strut: { width: 38, height: 26.5 },
  eye: { width: 32, height: 27 },
  call: { width: 31, height: 27 },
} as const;
export type GroundPose = keyof typeof GROUND;

// How far the body's middle stands above its feet: where a flight leaves
// the ledge from and lands back on it.
export const LIFT = 14;

// In the air (and the run and touchdown that join it to a ledge): how far
// each pose reaches from the body's middle, wings at every point of their
// beat and the bank included.
export const AIR = {
  takeoff: { half: 15.5, up: 14, down: LIFT },
  flight: { half: 22, up: 23, down: 23 },
  swoop: { half: 20.5, up: 10, down: 10 },
  flare: { half: 17, up: 20, down: LIFT },
} as const satisfies Record<string, Reach>;
export type AirPose = keyof typeof AIR;
export type Pose = GroundPose | AirPose;
export const inAir = (pose: Pose): pose is AirPose => pose in AIR;

// The box a pose takes up on the page, drawn with its body's middle at p.
export function poseBox(pose: Pose, p: { x: number; y: number }) {
  if (inAir(pose)) {
    const r = AIR[pose];
    return { left: p.x - r.half, right: p.x + r.half, top: p.y - r.up, bottom: p.y + r.down };
  }
  const size = GROUND[pose];
  return { left: p.x - size.width / 2, right: p.x + size.width / 2, top: p.y + LIFT - size.height, bottom: p.y + LIFT };
}

// Where a gull stands or struts, all of it stays on a clear run with 27px
// above it (22px, and 6px up into the empty bottom edge of a card or rule
// above), 100px from any other gull, centre to centre.
export const GULL: Walker = { clear: 27, reach: 6, half: GROUND.strut.width / 2, spacing: 100 };
