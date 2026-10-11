import { inTurn } from '../group';
import type { Point } from '../pointer';
import { between } from '../seed';
import { inWaspAir, within } from './air';
import { flying, sweptFrom } from './flight';
import { FOOTPRINTS } from './footprints';
import { BLEND, LAP, LAPS, orbitFits, orbitOf, orbitPoint } from './orbit';
import { RECHECK, onOrbit, poseOf, resting, stepWasp, toCircle, toInspect, toLand, where, zoneOf, type Wasp, type World } from './wasp';

// The pair together: placed, stepped and reconciled in turn, the lower id
// first (group.ts's inTurn), so each sees where the other is or is going.

export function stepWasps(wasps: readonly Wasp[], world: World, dt: number): Wasp[] {
  return inTurn(wasps, (w, others) => stepWasp(w, others, world, dt));
}

const fresh = (id: number): Pick<Wasp, 'id' | 'seed' | 'spin' | 'face'> => ({ id, seed: id * 11 + 5, spin: id === 0 ? 1 : -1, face: id === 0 ? 1 : -1 });
const NOWHERE: Point = { x: 0, y: 0 };

// The two placed afresh: circling where their orbits fit, at seeded points
// on them (wasp 1's first inspection 1 to 3s behind wasp 0's), else
// resting on their spots; under reduced motion both standing on their
// spots, never stepped.
export function placeWasps(world: Omit<World, 'cursor'>, still = false): Wasp[] {
  const { places, now, rand } = world;
  return [0, 1].map((id): Wasp => {
    const base = { ...fresh(id), flight: null, angle: 0, lap: LAP[0], from: NOWHERE };
    if (still || !orbitFits(id, world)) return { ...base, ...resting({ ...base, mode: 'rest', since: now, until: now }, places, now), until: still ? Infinity : now + RECHECK };
    const angle = between(rand, 0, 2 * Math.PI);
    const lap = between(rand, ...LAP);
    const behind = id === 0 ? 0 : between(rand, 1000, 3000);
    // Already circling a moment ago, so it does not ease in from anywhere.
    const since = now - BLEND;
    const from = orbitPoint(orbitOf(id, places), angle, since, base.seed);
    return { ...base, mode: 'circle', since, angle: angle - (base.spin * 2 * Math.PI * BLEND) / lap, lap, from, until: now + behind + Math.round(between(rand, ...LAPS)) * lap };
  });
}

// After the air changes: a wasp that no longer fits where it is going is
// sent from where it is to its orbit, or, if that has no room, down to its
// spot; failing a clear way, it is set down on its spot. An away wasp keeps
// its timer.
export function reconcileWasps(wasps: readonly Wasp[], world: World): Wasp[] {
  return inTurn(wasps, (w, others) => reconcileWasp(w, others, world));
}

function reconcileWasp(w: Wasp, others: readonly Wasp[], world: World): Wasp {
  const { places, now } = world;
  const here = where(w, places, now);
  if (!here || w.mode === 'feed' || w.mode === 'rest' || w.mode === 'land') return w;
  if (stillFits(w, world)) return w;
  const moved = orbitFits(w.id, world) ? toCircle(w, here, world, others) : toLand(w, here, world, others);
  return moved ?? resting(w, places, now);
}

// Whether what it is doing still fits the air: the rest of its flight, and
// its orbit if it is circling or flying onto it.
function stillFits(w: Wasp, world: World): boolean {
  const { air, places, now } = world;
  if (w.flight && flying(w, now)) {
    const lane = w.mode === 'flee' || w.mode === 'return';
    const swept = sweptFrom(w.flight, FOOTPRINTS[poseOf(w)], now);
    if (!swept.every((b) => (lane ? inWaspAir(b, air) : within(b, air.air)))) return false;
  }
  if (w.mode === 'circle' || w.mode === 'dodge' || (w.mode === 'return' && onOrbit(w, places))) return orbitFits(w.id, world);
  return within(zoneOf(w.id, places), air.air);
}

// A test's cue (?theme-cue=land): wasp 0, circling, goes in to inspect the
// cake now, and so lands and feeds, rather than after its random laps.
export function inspectNow(wasps: readonly Wasp[], world: World): Wasp[] {
  return inTurn(wasps, (w, others) => {
    const here = where(w, world.places, world.now);
    if (w.id !== 0 || w.mode !== 'circle' || !here) return w;
    return toInspect(w, here, world, others) ?? w;
  });
}
