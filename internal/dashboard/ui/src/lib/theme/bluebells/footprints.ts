import type { Box } from '../floors';
import type { Point } from '../pointer';
import { ANCHOR, GROUND, REACH, SCALE } from './bee-rig';

// The space each of the bee's poses takes on the page, from the middle of
// its thorax (the point the models move), facing right: ahead of it, behind
// it, above and below, in page px. Each is the box her drawing stays inside
// at every moment of that pose's motion, wing blur, bob and pitch included,
// as bee-rig.ts measures it; facing left, ahead and behind swap. Placement,
// routes and spacing all work from these.
export type Footprint = { ahead: number; behind: number; up: number; down: number };

export const FOOTPRINTS = {
  perch: REACH.perch,
  crawl: REACH.crawl,
  land: REACH.land,
  hover: REACH.hover,
  fly: REACH.fly,
  bonk: REACH.bonk,
} as const satisfies Record<string, Footprint>;
export type Pose = keyof typeof FOOTPRINTS;

// From the thorax's middle down to her feet standing on a bell; and how
// far ahead of it she meets a wall, her antennae a pixel into it.
export const FEET = (GROUND - ANCHOR.y) * SCALE;
export const CONTACT = FOOTPRINTS.bonk.ahead - 1;

// The box a footprint takes with the thorax at p, facing dir.
export function boxAt(p: Point, f: Footprint, dir: 1 | -1): Box {
  const [left, right] = dir === 1 ? [f.behind, f.ahead] : [f.ahead, f.behind];
  return { left: p.x - left, right: p.x + right, top: p.y - f.up, bottom: p.y + f.down };
}

// The box a footprint may take facing either way, grown by `by` all round.
export function eitherWay(p: Point, f: Footprint, by = 0): Box {
  const half = Math.max(f.ahead, f.behind) + by;
  return { left: p.x - half, right: p.x + half, top: p.y - f.up - by, bottom: p.y + f.down + by };
}

export const grow = (b: Box, by: number): Box => ({ left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by });
