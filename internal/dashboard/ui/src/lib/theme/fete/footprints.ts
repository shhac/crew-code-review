import type { Reach } from '../floors';

// The space each of the wasp's poses takes, from its anchor (the middle of
// its thorax), in page pixels: the box the rig's drawing must stay inside at
// every moment of its wing blur, its legs' and antennae's movement and its
// tilt, either way round. The model places, routes and keeps the two wasps
// apart with these; the rig's tests hold the drawing to them.
// design-docs/fete/README.md has the targets (a wasp 16px long).
export const FOOTPRINTS = {
  standing: { half: 10, up: 5, down: 5 },
  feed: { half: 10, up: 5, down: 5 },
  hover: { half: 9, up: 8, down: 8 },
  land: { half: 9, up: 7, down: 8 },
  cruise: { half: 10, up: 6, down: 7 },
} as const satisfies Record<string, Reach>;
export type WaspPose = keyof typeof FOOTPRINTS;

// Standing or feeding, its thorax is this far above what it stands on.
export const STAND = 5;
