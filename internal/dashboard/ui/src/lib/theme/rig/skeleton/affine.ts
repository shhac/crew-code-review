import type { Point } from '../../pointer';

// SVG's [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f.
export type Affine = readonly [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

// a then b, read as SVG reads a transform list: b is applied first.
const times = (a: Affine, b: Affine): Affine => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];

// The matrices as a transform list writes them, left to right.
export const product = (...ms: readonly Affine[]): Affine => ms.reduce(times, IDENTITY);

export const applied = (m: Affine, p: Point): Point => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
