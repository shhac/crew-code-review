// Fixtures shared by the creature models' tests.
import type { Box, Ledge, Obstacle, PageMap } from './floors';

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

// The dashboard page in a 1440x900 window: the heading rule is floor 1, the
// cards 2, 3 and 4, with any extra obstacles (text, charts) given.
export function dashboardPage(extra: readonly Obstacle[] = [], cards: readonly Ledge[] = CARDS): PageMap {
  const floors = new Map<number, Ledge>([[1, HEADING], ...cards.map((c, i) => [i + 2, c] as const)]);
  return { floors, obstacles: [TITLE, ...cards.map(block), ...extra], width: 1440, height: 900 };
}

const meets = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

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

// Runs a model forward in 50ms steps from from to to, keeping every state it
// passes through, the starting one first.
export function steps<S>(start: S, from: number, to: number, step: (state: S, time: number) => S): S[] {
  const times = Array.from({ length: Math.floor((to - from) / 50) + 1 }, (_, i) => from + i * 50);
  return times.reduce((states, t) => [...states, step(states.at(-1)!, t)], [start]);
}
