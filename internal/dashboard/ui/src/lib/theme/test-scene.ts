// Fixtures shared by the creature models' tests.
import type { Ledge, PageMap } from './floors';

// A 1000x800 window holding these ledges and obstacles.
export const scene = (floors: [number, Ledge][], obstacles: PageMap['obstacles'] = []): PageMap => ({ floors: new Map(floors), obstacles, width: 1000, height: 800 });

// A stand-in for Math.random that always returns v.
export const fixed = (v: number) => () => v;

// Runs a model forward in 50ms steps from from to to, keeping every state it
// passes through, the starting one first.
export function steps<S>(start: S, from: number, to: number, step: (state: S, time: number) => S): S[] {
  const times = Array.from({ length: Math.floor((to - from) / 50) + 1 }, (_, i) => from + i * 50);
  return times.reduce((states, t) => [...states, step(states.at(-1)!, t)], [start]);
}
