import { mix, rad } from '../math';
import type { Point } from '../pointer';
import { hash } from '../seed';
import type { Layer } from './rig';

// An insect's antennae, drawn in code. Bees' and wasps' are elbowed
// (geniculate): a long first segment, the scape, from the face, then the
// flagellum from the elbow (the short pedicel between them is too small to
// show). In the drawing's own coordinates, facing right; angles in degrees,
// 0 straight ahead and 90 straight down, as the page turns.

// Where it starts on the face, how long its scape and flagellum are, which
// way the scape points, how far the flagellum turns from it at the elbow,
// and how much more it bends along its length (positive turns down).
export type Antenna = { base: Point; scape: number; flagellum: number; angle: number; elbow: number; curve: number };

const along = (from: Point, deg: number, length: number): Point => ({ x: from.x + Math.cos(rad(deg)) * length, y: from.y + Math.sin(rad(deg)) * length });

// The antenna's line: the base, the elbow, then the flagellum in a few
// pieces bending evenly through `curve` to its tip.
export function antennaPoints(a: Antenna): Point[] {
  const elbow = along(a.base, a.angle, a.scape);
  const pieces = 4;
  const start = a.angle + a.elbow;
  const flagellum = Array.from({ length: pieces }, (_, i) => i).reduce<Point[]>((points, i) => {
    const heading = mix(start, start + a.curve, (i + 0.5) / pieces);
    return [...points, along(points[points.length - 1], heading, a.flagellum / pieces)];
  }, [elbow]);
  return [a.base, ...flagellum];
}

// The antenna turned `by` degrees about its base: leaning toward something,
// or flicking.
export const turnedBy = (a: Antenna, by: number): Antenna => ({ ...a, angle: a.angle + by });

// An antenna as a stroke, named for the lab.
export const antennaLayer = (name: string, a: Antenna, width: number, colour: string): Layer =>
  ({ kind: 'stroke', name, points: antennaPoints(a), width, colour });

// A quick flick of the antennae, 0 to 1 and back: 120ms at a seeded moment
// in each 2.75s, so flicks come 1.5 to 4s apart, worked out from the seed
// and the time alone, like rig/life.ts's blinks (insects have no eyelids, so
// this, not a blink, is the sign of life).
const WINDOW = 2750;
const SPREAD = 1250;
const FLICK = 120;
export function flicking(seed: number, now: number): number {
  const n = Math.floor(now / WINDOW);
  const t = (now - n * WINDOW - hash(seed * 7907 + n) * SPREAD) / FLICK;
  if (t < 0 || t > 1) return 0;
  return Math.sin(Math.PI * t);
}
