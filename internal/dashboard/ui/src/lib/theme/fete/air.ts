import type { Box } from '../floors';

// The wasps' air, in the shelf stage's own coordinates so they ride with
// it: the rail's air (the rail sky stretched down through the shelf's box,
// measured in viewport coordinates by the shared rail air) and June's own
// widening, an exit lane from the air's left edge out past the window's
// left edge, over the air's top half: the rail's empty left padding, which
// a chased wasp leaves by. design-docs/fete/README.md has the contract.

export type WaspAir = { air: Box; lane: Box };
// The rail's air as measured, in viewport coordinates.
export type RailAir = { left: number; top: number; width: number; height: number };

// How far past the window's edge the lane runs, so a wasp is wholly out of
// sight before it is gone.
export const OFF_SCREEN = 24;

// The air in the stage's coordinates, given where the stage's top left is in
// the viewport; none while the shelf is hidden.
export function waspAir(rail: RailAir | null, stage: { left: number; top: number }): WaspAir | null {
  if (!rail || rail.width <= 0 || rail.height <= 0) return null;
  const air = { left: rail.left - stage.left, right: rail.left + rail.width - stage.left, top: rail.top - stage.top, bottom: rail.top + rail.height - stage.top };
  return { air, lane: { left: -stage.left - OFF_SCREEN, right: air.left, top: air.top, bottom: air.top + (air.bottom - air.top) / 2 } };
}

const within = (box: Box, room: Box) => box.left >= room.left && box.right <= room.right && box.top >= room.top && box.bottom <= room.bottom;

// Whether a box is wholly in the air, or in the strip the lane and the air's
// top half make together.
export function inWaspAir(box: Box, w: WaspAir): boolean {
  if (within(box, w.air)) return true;
  return within(box, { left: w.lane.left, right: w.air.right, top: w.lane.top, bottom: w.lane.bottom });
}

// Where the window's left edge is, in the stage's coordinates.
export const windowEdge = (w: WaspAir) => w.lane.left + OFF_SCREEN;
