import type { Reach } from '../floors';
import { ANCHOR, GROUND, SCALE } from './wasp-rig';

// The space each of the wasp's poses takes, from her anchor (the middle of
// her body), in page pixels: the box wasp-rig.ts's drawing stays inside at
// every moment of its wing blur, its legs' and antennae's movement and its
// bob, either way round (wasp-rig.test.ts samples each whole cycle). The
// model places, routes and keeps the two wasps apart with these. They are
// larger than the note's first targets: the blur's ghost wings reach well
// above her, and her long legs hang below her in the air.
export const FOOTPRINTS = {
  standing: { half: 10, up: 4, down: 7.5 },
  feed: { half: 10.5, up: 4, down: 7.5 },
  hover: { half: 9.5, up: 11.5, down: 11 },
  land: { half: 9.5, up: 11, down: 11 },
  cruise: { half: 10, up: 11.5, down: 10.5 },
} as const satisfies Record<string, Reach>;
export type WaspPose = keyof typeof FOOTPRINTS;

// Standing or feeding, her anchor is this far above what she stands on.
export const STAND = (GROUND - ANCHOR.y) * SCALE;
