import type { Box } from '../floors';
import type { Point } from '../pointer';

// The space each of the bee's poses takes on the page, from the middle of
// its thorax (the point the models move), facing right: ahead of it, behind
// it, above and below, in page px. Each is the box the drawing stays inside
// at every moment of that pose's motion, wing blur, bob and pitch included;
// facing left, ahead and behind swap. The rig's tests hold the drawing to
// these, and placement, routes and spacing all work from them.
// design-docs/bluebells/README.md has the table these come from.
export type Footprint = { ahead: number; behind: number; up: number; down: number };

export const FOOTPRINTS = {
  perch: { ahead: 9, behind: 11, up: 8, down: 5 },
  crawl: { ahead: 9, behind: 11, up: 8, down: 5 },
  land: { ahead: 10, behind: 12, up: 9, down: 11 },
  hover: { ahead: 9, behind: 13, up: 11, down: 10 },
  fly: { ahead: 10, behind: 14, up: 9, down: 9 },
  bonk: { ahead: 8, behind: 18, up: 11, down: 11 },
} as const satisfies Record<string, Footprint>;
export type Pose = keyof typeof FOOTPRINTS;

// From the thorax's middle to the front of the head, and down to the feet
// standing on a bell.
export const HEAD = 7;
export const FEET = 4;

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
