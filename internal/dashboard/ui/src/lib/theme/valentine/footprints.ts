import type { Reach } from '../floors';

// The space each of the cupid's poses takes on the page, from its anchor
// (the middle of its belly, where it hovers), in page pixels: the box
// cupid-rig.ts's drawing stays inside at every moment of its wingbeat, its
// legs' swing, its bob and its draw, either way round (its tests check
// this). Placement, routes and spacing all work from these.
export const FOOTPRINTS = {
  hover: { half: 23, up: 27.25, down: 16.25 },
  flight: { half: 22.25, up: 26.75, down: 17 },
  shoot: { half: 23.25, up: 27.75, down: 16.75 },
  dodge: { half: 23.75, up: 26.5, down: 14.75 },
} as const satisfies Record<string, Reach>;
export type Footprint = keyof typeof FOOTPRINTS;

// What a hover spot must hold: hovering, and anything it may do there (draw
// and loose, or dodge from it).
export const SPOT: Reach = {
  half: Math.max(...Object.values(FOOTPRINTS).map((f) => f.half)),
  up: Math.max(...Object.values(FOOTPRINTS).map((f) => f.up)),
  down: Math.max(...Object.values(FOOTPRINTS).map((f) => f.down)),
};
