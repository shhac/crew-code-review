import type { Box, Reach } from '../floors';
import type { Point } from '../pointer';
import { within, type WaspAir } from './air';
import { FOOTPRINTS } from './footprints';
import type { Places } from './table';

// The two wasps' orbits round the cake: wasp 0's low round it, wasp 1's
// above it, each an ellipse that drifts a little off true and bobs, and the
// band of air each keeps to while circling.

export type Orbit = { c: Point; rx: number; ry: number };

// Each orbit drifts a little off true and bobs, so no two laps match.
const DRIFT_X = 3;
const DRIFT_Y = 2;
const BOB = 1;
// The low orbit round the cake, and the high one above it; the high one's
// height is worked out so the two bands' boxes stay APART.
const LOWER = { lift: 8, across: 12, deep: 9 };
const UPPER = { across: 4, deep: 7 };
export const APART = 6;
// Blending onto an orbit, a lap's time, and how many laps it circles at a
// time.
export const BLEND = 300;
export const LAP = [1600, 2400] as const;
export const LAPS = [2, 5] as const;

// The box a footprint of `reach` can ever take on an orbit, drifting and
// bobbing.
export function bandOf(o: Orbit, reach: Reach = FOOTPRINTS.hover): Box {
  return {
    left: o.c.x - o.rx - DRIFT_X - reach.half, right: o.c.x + o.rx + DRIFT_X + reach.half,
    top: o.c.y - o.ry - DRIFT_Y - BOB - reach.up, bottom: o.c.y + o.ry + DRIFT_Y + BOB + reach.down,
  };
}

export function orbitOf(id: number, places: Places): Orbit {
  const { cake } = places;
  const lower = { c: { x: cake.x, y: cake.y - LOWER.lift }, rx: cake.half + LOWER.across, ry: LOWER.deep };
  if (id === 0) return lower;
  const bottom = bandOf(lower).top - APART;
  return { c: { x: cake.x, y: bottom - FOOTPRINTS.hover.down - BOB - DRIFT_Y - UPPER.deep }, rx: cake.half + UPPER.across, ry: UPPER.deep };
}

// Whether its orbit's whole band is in the air.
export const orbitFits = (id: number, w: { air: WaspAir; places: Places }) => within(bandOf(orbitOf(id, w.places)), w.air.air);

export function orbitPoint(o: Orbit, theta: number, now: number, seed: number): Point {
  return {
    x: o.c.x + o.rx * Math.cos(theta) + DRIFT_X * Math.sin((2 * Math.PI * now) / 3700 + seed),
    y: o.c.y + o.ry * Math.sin(theta) + DRIFT_Y * Math.sin((2 * Math.PI * now) / 5300 + 2 * seed) + BOB * Math.sin((2 * Math.PI * now) / 900 + 3 * seed),
  };
}
export const trueOrbitPoint = (o: Orbit, theta: number): Point => ({ x: o.c.x + o.rx * Math.cos(theta), y: o.c.y + o.ry * Math.sin(theta) });
// Circling: its angle at `since`, which way round it goes, and a lap's time.
export type Lapping = { angle: number; spin: 1 | -1; lap: number; since: number };
export const thetaAt = (w: Lapping, now: number) => w.angle + (w.spin * 2 * Math.PI * Math.max(0, now - w.since)) / w.lap;
// The angle on an orbit nearest a point.
export const nearestTheta = (o: Orbit, p: Point) => Math.atan2((p.y - o.c.y) / o.ry, (p.x - o.c.x) / o.rx);
