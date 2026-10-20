// Fixtures shared by the creature models' tests.
import { meets, type Box } from './box';
import type { Ledge, Obstacle, PageMap } from './floors';
import type { Rand } from './seed';

// A 1000x800 window holding these ledges and obstacles.
export const scene = (floors: [number, Ledge][], obstacles: PageMap['obstacles'] = []): PageMap => ({ floors: new Map(floors), obstacles, width: 1000, height: 800 });

// A page laid out as the dashboard's are: a heading rule with its title at
// the left, and a row of cards 22px below it with gaps between them, the
// first-row clearance an animal has day to day.
export const HEADING: Ledge = { left: 300, right: 1300, y: 160, base: 160, room: 60, headroom: Infinity, kind: 'heading' };
export const TITLE: Obstacle = { left: 300, right: 600, top: 100, bottom: 150 };
const card = (left: number, right: number): Ledge => ({ left, right, y: 182, base: 400, room: 22, headroom: 22, kind: 'card' });
export const CARDS = [card(300, 646), card(660, 1006), card(1020, 1300)];
const block = (f: Ledge): Obstacle => ({ left: f.left, right: f.right, top: f.y, bottom: f.base, block: true });

// main's box on that page, beside a 236px rail.
export const MAIN: Box = { left: 236, right: 1440, top: 0, bottom: 1600 };

// The dashboard page in a 1440x900 window: the heading rule is floor 1, the
// cards 2, 3 and 4, with any extra obstacles (text, charts) given, and main
// measured where a test asks for it (MAIN, as the dashboard has it).
export function dashboardPage(extra: readonly Obstacle[] = [], cards: readonly Ledge[] = CARDS, { main }: { main?: Box } = {}): PageMap {
  const floors = new Map<number, Ledge>([[1, HEADING], ...cards.map((c, i) => [i + 2, c] as const)]);
  return { floors, obstacles: [TITLE, ...cards.map(block), ...extra], width: 1440, height: 900, ...(main ? { main } : {}) };
}

// Whether none of these boxes, taken up by something drawn, meets the
// page's content: its text, controls and charts. A card's own box is not
// content; walkers stand into its empty edges.
export const clearOfContent = (boxes: readonly Box[], page: PageMap) => boxes.every((b) => !page.obstacles.some((o) => !o.block && meets(b, o)));

// A stand-in for Math.random that always returns v.
export const fixed = (v: number) => () => v;

// A repeatable stand-in for Math.random that varies, for long runs.
export function seeded(seed: number): () => number {
  const state = { n: seed };
  return () => {
    state.n = (state.n * 1664525 + 1013904223) % 4294967296;
    return state.n / 4294967296;
  };
}

// A troupe as each month's layer places it (layout.ts's TroupeModel), and
// the members it shows (those away left out).
export type Placed<T, S, M> = {
  create(scene: S, now: number, rand: Rand): T;
  reconcile(group: T, scene: S, now: number, rand: Rand): T;
  members(group: T): readonly M[];
};

// A troupe placed on `page`, then laid out again on `crowded` (the same
// page after a layout change leaves it less room): every pair of the
// members it then shows that `spaced`, the month's own spacing rule, says
// are too close. None, for a reconcile that keeps its spacing.
export function spacedAfterRelayout<T, S, M>(troupe: Placed<T, S, M>, page: S, crowded: S, spaced: (a: M, b: M) => boolean, rand: Rand = seeded(1)): [M, M][] {
  const after = troupe.reconcile(troupe.create(page, 0, rand), crowded, 1000, rand);
  const shown = troupe.members(after);
  return shown.flatMap((a, i) => shown.slice(i + 1).flatMap((b): [M, M][] => (spaced(a, b) ? [] : [[a, b]])));
}

// Runs a model forward in 50ms steps from from to to, keeping every state it
// passes through, the starting one first.
export function steps<S>(start: S, from: number, to: number, step: (state: S, time: number) => S): S[] {
  const times = Array.from({ length: Math.floor((to - from) / 50) + 1 }, (_, i) => from + i * 50);
  return times.reduce((states, t) => [...states, step(states.at(-1)!, t)], [start]);
}
