import type { Reach } from './air';

// The space each of the cupid's poses takes on the page, from its anchor
// (the middle of its belly, where it hovers), in page pixels: the box
// cupid-rig.ts's drawing stays inside at every moment of its wingbeat, its
// legs' swing, its bob and its draw, either way round (its tests check
// this). Placement, routes and spacing all work from these.
export const FOOTPRINTS = {
  hover: { half: 24, up: 28, down: 17 },
  flight: { half: 23, up: 28, down: 17 },
  shoot: { half: 24, up: 29, down: 17 },
  dodge: { half: 25, up: 28, down: 15 },
} as const satisfies Record<string, Reach>;
export type Footprint = keyof typeof FOOTPRINTS;

// What a hover spot must hold: hovering, and anything it may do there (draw
// and loose, or dodge from it).
export const SPOT: Reach = {
  half: Math.max(...Object.values(FOOTPRINTS).map((f) => f.half)),
  up: Math.max(...Object.values(FOOTPRINTS).map((f) => f.up)),
  down: Math.max(...Object.values(FOOTPRINTS).map((f) => f.down)),
};
