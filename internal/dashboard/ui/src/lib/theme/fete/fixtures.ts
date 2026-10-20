import { meets } from '../air';
import type { Rand } from '../seed';
import { inWaspAir, waspAir, type WaspAir } from './air';
import { CAKE, JAR, type Places } from './table';
import { boxOf, type Pointer, type Wasp, type World } from './wasp';
import { reconcileWasps, stepWasps } from './wasps';

// The wasps' tests' table, airs and runs.

export const places: Places = { cake: CAKE, jar: JAR };
// The stage sits 34px in from the window's left edge (the rail's padding and
// the stage centred on the shelf), its top 700px down. The rail's air is the
// shelf's box (200px wide) with the sky above it, up to 240px tall.
export const STAGE = { left: 34, top: 700 };
const railAir = (above: number) => ({ left: 18, top: STAGE.top - above, width: 200, height: above + 72 });
// Tall: the whole sky. Medium: 54px above the cake's top, as on a 1024x768
// window, room for the low orbit only. Short: neither.
export const TALL = waspAir(railAir(262), STAGE)!;
export const MEDIUM = waspAir(railAir(54 - CAKE.y), STAGE)!;
export const SHORT = waspAir(railAir(20 - CAKE.y), STAGE)!;

const worldOf = (air: WaspAir, now: number, rand: Rand, cursor: Pointer | null = null): World => ({ air, places, now, rand, cursor });

// Runs the pair from `from` to `to`, calling look on each frame.
export function run(start: Wasp[], air: (now: number) => WaspAir, from: number, to: number, rand: Rand, cursor: (now: number) => Pointer | null = () => null, look: (w: Wasp[], now: number, air: WaspAir) => void = () => {}): Wasp[] {
  const frames = Math.round((to - from) / 16);
  return Array.from({ length: frames }, (_, i) => from + (i + 1) * 16).reduce((wasps, now) => {
    const a = air(now);
    const before = air(now - 16);
    const settled = a === before ? wasps : reconcileWasps(wasps, worldOf(a, now, rand));
    const next = stepWasps(settled, worldOf(a, now, rand, cursor(now)), 16);
    look(next, now, a);
    return next;
  }, start);
}

export const outsideAir = (wasps: Wasp[], now: number, air: WaspAir) => wasps.flatMap((w) => {
  const b = boxOf(w, places, now);
  return b && !inWaspAir(b, air) ? [`${w.id} ${w.mode} at ${now}`] : [];
});
export const touching = (wasps: Wasp[], now: number) => {
  const [a, b] = wasps.map((w) => boxOf(w, places, now));
  return a && b && meets(a, b) ? [`${wasps[0].mode}/${wasps[1].mode} at ${now}`] : [];
};
