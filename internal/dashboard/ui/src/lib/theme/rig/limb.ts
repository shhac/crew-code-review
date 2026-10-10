import type { Point } from '../pointer';
import { knees } from '../spidergait';

// A limb of two bones posed from its two ends, as spidergait.ts's knees are:
// of the two places its middle joint can be, the one on the given side of
// the line from root to end (1 its right as the page turns, -1 its left),
// where kneeToward picks the one further forward or back. An arm's elbow
// keeps to one side of the arm whichever way the arm points.
export function jointBeside(root: Point, end: Point, first: number, second: number, side: 1 | -1): Point {
  const [left, right] = knees(root, end, first, second);
  return side === 1 ? right : left;
}
