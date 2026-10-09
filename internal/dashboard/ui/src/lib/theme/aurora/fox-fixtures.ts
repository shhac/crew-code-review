// Ledges, cursors and foxes shared by the fox models' tests.
import type { Ledge } from '../floors';
import type { Cursor } from '../pointer';
import { fixed, scene } from '../test-scene';
import { createFox, type Fox } from './fox';

// A heading rule with room above it, and a card top below with the 22px the
// dashboard's first row of cards has.
export const rule: Ledge = { left: 100, right: 700, y: 200, base: 200, room: 40, headroom: Infinity, kind: 'heading' };
export const card: Ledge = { left: 100, right: 400, y: 222, base: 500, room: 22, headroom: 22, kind: 'card' };
export const still = (x: number, y: number, at = -Infinity): Cursor => ({ x, y, at });

// A fox asleep at x on a ledge (floor 1 the rule, any other the card), never
// waking on its own unless told to.
export const asleep = (floor: number, x: number, over: Partial<Fox> = {}): Fox =>
  ({ ...createFox(scene([[floor, floor === 1 ? rule : card]]), 0, fixed(0.5))!, floor, x, target: x, from: x, until: Infinity, ...over });
