import { degrees, rad } from '../../math';
import type { Point } from '../../pointer';
import type { Turn } from '../rig';

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

export const translate = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
// SVG's rotate: clockwise on screen, y being down.
export const rotate = (angle: number): Affine => {
  const c = Math.cos(rad(angle)), s = Math.sin(rad(angle));
  return [c, s, -s, c, 0, 0];
};
export const scale = (x: number, y: number): Affine => [x, 0, 0, y, 0, 0];

// What a matrix does without moving anything: the same about the origin.
export const linear = (m: Affine): Affine => [m[0], m[1], m[2], m[3], 0, 0];
// How far it turns the x axis (degrees).
export const angleOf = (m: Affine) => degrees(Math.atan2(m[1], m[0]));

// A Turn as transformOf draws it, without a squash.
export const turnMatrix = (turn: Turn): Affine =>
  product(translate(turn.dx + turn.pivot.x, turn.dy + turn.pivot.y), rotate(turn.angle), translate(-turn.pivot.x, -turn.pivot.y));

export const matrixText = (m: Affine) => `matrix(${m.join(' ')})`;
