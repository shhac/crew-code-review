import type { Ledge, PageMap, Run } from '../floors';
import { entries, exitEnd, ledgeEnds, lengthOf, runAt, widthOf, within, type Claim, type Entry, type Trip } from '../ledges';
import { apart, sign } from '../math';
import type { Point } from '../pointer';
import { between, maxBy, pick, type Rand } from '../seed';
import type { End } from './hunt';
import {
  alertAt, become, body, clear, HALF, hopToward, POSES, RABBIT, RESTLESS, settle, spareFor, SPACING, type CanLay, type Rabbit,
} from './rabbit';
import { HOP_LENGTH } from './rabbit-rig';

// Where a rabbit goes when it gets restless, bolts, or has left an egg:
// out to another ledge, to a free ledge end to leave an egg, or along its
// own run.

const MIN_ENTRY = 90;
// A move along the ledge is at least two hops, at most about seven.
const MIN_MOVE = 2 * HOP_LENGTH;
const MAX_MOVE = 140;
// The egg sits this far in from its ledge's end; a rabbit nudging it stands
// this far back from it, its nose at the egg.
const EGG_IN = 10;
const NOSE = 17;

// Somewhere to go when it gets restless: one time in three out to another
// ledge in view, one in three to a free ledge end to leave an egg (while no
// other rabbit is up to something), else along its own run; or nowhere, and
// it sits on.
export function moveOn(r: Rabbit, scene: PageMap, now: number, rand: Rand, taken: readonly Claim[], othersBusy: boolean, canLay: CanLay): Rabbit {
  const f = scene.floors.get(r.floor);
  const run = f && runAt(f, scene, RABBIT, r.x);
  if (!f || !run) return settle(r, now);
  const roll = rand();
  const out = !othersBusy && roll < 1 / 3 ? way(r, f, run, scene, rand, taken, null) : null;
  if (out) return leave(r, 'exit', now, out);
  const lay = !othersBusy && roll < 2 / 3 ? layingSpot(r, f, run, scene, taken, canLay) : null;
  if (lay) return hopToward(r, 'hop', now, lay.x, { egg: lay.end }, true);
  return along(r, f, run, scene, now, rand, taken);
}

// Along its own run, at least two hops, stopping SPACING short of the
// nearest rabbit each way: to the side with more room, or the side away
// from `away`; bolting, as far as it can that way. With nowhere to go it
// sits on (bolting, on alert).
type Along = { away: Point | null; bolt: boolean };
export function along(r: Rabbit, f: Ledge, run: Run, scene: PageMap, now: number, rand: Rand, taken: readonly Claim[], { away, bolt }: Along = { away: null, bolt: false }): Rabbit {
  const room = body(run);
  const xs = taken.filter((c) => c.floor === r.floor).map((c) => c.lo);
  const lane = {
    lo: Math.max(room.lo, ...xs.filter((x) => x < r.x).map((x) => x + SPACING)),
    hi: Math.min(room.hi, ...xs.filter((x) => x > r.x).map((x) => x - SPACING)),
  };
  const reach = (d: -1 | 1) => (d < 0 ? r.x - lane.lo : lane.hi - r.x);
  const sides = ([-1, 1] as const).filter((d) => reach(d) >= MIN_MOVE);
  const side = away ? maxBy(sides, (d) => Math.abs(f.left + r.x + d * MIN_MOVE - away.x)) : maxBy(sides, reach);
  if (!side && bolt) return alertAt(settle(r, now), scene, now, rand);
  if (!side) return settle(r, now, between(rand, RESTLESS.lo, RESTLESS.hi));
  const far = bolt ? reach(side) : Math.min(reach(side), between(rand, MIN_MOVE, MAX_MOVE));
  return hopToward(r, bolt ? 'bolt' : 'hop', now, r.x + side * far);
}

// A free ledge end its own run reaches, to leave an egg at: where it stands
// to nudge it there, its nose at the egg, and which end.
function layingSpot(r: Rabbit, f: Ledge, run: Run, scene: PageMap, taken: readonly Claim[], canLay: CanLay): { x: number; end: End } | null {
  const options = ledgeEnds(f, run).flatMap((e) => {
    const end: End = e === run.lo ? 'left' : 'right';
    const at = end === 'left' ? EGG_IN + NOSE : widthOf(f) - EGG_IN - NOSE;
    const hops = Math.round(Math.abs(at - r.x) / HOP_LENGTH);
    const x = r.x + sign(at - r.x) * hops * HOP_LENGTH;
    const fits = hops > 0 && within({ lo: run.lo + POSES.nudge.width / 2 - EGG_IN, hi: run.hi - POSES.nudge.width / 2 + EGG_IN }, x) && spareFor(f, scene, 'nudge', x) >= 0;
    return fits && canLay(r.floor, end) && clear(taken, r.floor, r.x, x) ? [{ x: at, end }] : [];
  });
  return options[0] ?? null;
}

// A way out by one of its ledge's ends (away from `away` when given, else
// the nearer) to another ledge in view; null if there is none.
export type Way = { trip: Trip; exit: number };
export function way(r: Rabbit, f: Ledge, run: Run, scene: PageMap, rand: Rand, taken: readonly Claim[], away: Point | null): Way | null {
  const exit = exitEnd(f, run, r, taken, SPACING, away);
  const ways = waysOn(r, scene, rand, taken);
  const to = away ? maxBy(ways, (e) => apart(e.at, away)) : ways.length ? pick(rand, ways) : undefined;
  return exit !== undefined && to ? { trip: to.trip, exit } : null;
}

// Every way onto another ledge in view: in at one of its ends, to sit a
// whole number of hops (two or more) inside, all of it on the run.
function waysOn(r: Rabbit, scene: PageMap, rand: Rand, taken: readonly Claim[]): Entry[] {
  return entries(scene, RABBIT, r.floor, MIN_ENTRY, taken, (run, entry, inward) => {
    const hops = Math.max(2, Math.floor(between(rand, 30 + HALF, lengthOf(run) - HALF) / HOP_LENGTH));
    const x = entry + inward * hops * HOP_LENGTH;
    return within(body(run), x) ? x : null;
  });
}

// Off along its run to its ledge's end by whole hops, to leave by it: past
// the end by up to a hop, by when it has faded out.
export function leave(r: Rabbit, mode: 'exit' | 'bolt', now: number, out: Way): Rabbit {
  const hops = Math.max(1, Math.ceil(Math.abs(out.exit - r.x) / HOP_LENGTH));
  return become(r, mode, now, { dir: sign(out.exit - r.x), hops, hop: null, pause: now, trip: out.trip, egg: null });
}
