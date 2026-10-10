import { clearRuns, clearance, inView, type Ledge, type PageMap, type Run } from '../floors';
import type { Cursor, Point } from '../pointer';
import { between, maxBy, pick, type Rand } from '../seed';
import type { End } from './hunt';
import { HOP_LENGTH, REST, type Pose } from './rabbit-rig';

// European rabbits on the ledges: sitting with their noses twitching,
// grooming, and hopping along in single hops with a pause between. A cursor
// passing near makes one sit up on alert; one that lingers makes it thump
// and bolt for cover, its scut showing, out at its ledge's end and in again
// at another's later. Now and then one hops to a free ledge end, nudges an
// egg into it and hops away. Everything is in ledge-local x, so a rabbit
// rides along with its card as the page scrolls.
// design-docs/easter/README.md has the full state table.

// The space each pose takes on the page, anchored at its bottom centre on
// the ledge: the box rabbit-rig.ts's drawing stays inside at every moment of
// its hops, strokes and stamps (its tests check this). Sitting up on alert
// is the one pose taller than a first-row card's 27px.
export const POSES: Record<Pose, { width: number; height: number }> = {
  sit: { width: 31, height: 26 },
  alert: { width: 31, height: 28 },
  groom: { width: 31, height: 27 },
  hop: { width: 31, height: 27 },
  nudge: { width: 40, height: 19 },
  thump: { width: 31, height: 23 },
};

// Hopping along, and bolting for cover, in page pixels a second.
export const SPEED = 50;
export const BOLT = 90;

// Wherever a rabbit sits or hops needs this much clear space above the
// ledge, counting REACH into the empty edge of a card or rule above.
const CLEAR = 27;
const REACH = 6;
const RUNS = { inset: 8, step: 4 };
const HALF = POSES.hop.width / 2;
const MIN_SPOT = 2 * HALF + 4;
const MIN_ENTRY = 90;
// A move along the ledge is at least two hops, at most about seven.
const MIN_MOVE = 2 * HOP_LENGTH;
const MAX_MOVE = 140;
// Rabbits keep at least this far apart, centre to centre.
export const SPACING = 60;
// Where the walked distance stands at rest between hops: a whole number of
// hops on from this, where its cycle has all four feet down.
export const AT_REST = REST * HOP_LENGTH;

const PASSING = 90;
const MOVING = 120;
const NEAR = 60;
const LINGER = 1000;
const ALERT = { lo: 1200, hi: 2000 };
export const GROOM = 2400;
export const NUDGE = 900;
export const THUMP = 500;
const AWAY = { lo: 1500, hi: 3000 };
const PAUSE = { lo: 100, hi: 350 };
const RESTLESS = { lo: 3000, hi: 8000 };
export const FADE = 14;
// The egg sits this far in from its ledge's end; a rabbit nudging it stands
// this far back from it, its nose at the egg.
const EGG_IN = 10;
const NOSE = 17;

export type Mode = 'sit' | 'alert' | 'groom' | 'hop' | 'nudge' | 'thump' | 'bolt' | 'exit' | 'away' | 'enter';
// Where a rabbit changing ledge is going: the end it hops in at, and where
// it will sit.
export type Trip = { floor: number; entry: number; x: number };
export type Rabbit = {
  id: number;
  seed: number;
  // Page pixels hopped in all, which drives its legs: at rest between hops
  // it stands at AT_REST plus whole hops.
  walked: number;
  floor: number;
  x: number;
  dir: 1 | -1;
  mode: Mode;
  // When the mode began, and when a timed one ends (sitting: when it gets
  // restless; alert: when it may settle again).
  since: number;
  until: number;
  // Hopping: hops still to make after the one under way; the one under way
  // (where it began, and walked then), or null at rest; and when the pause
  // before the next hop ends.
  hops: number;
  hop: { x: number; walked: number } | null;
  pause: number;
  // Where an entry began.
  from: number;
  // The ledge end it is leaving an egg at, while it goes there and nudges.
  egg: End | null;
  trip: Trip | null;
  // Since when a cursor has been close, or null.
  near: number | null;
  // Where the cursor that made it thump was, to bolt away from.
  scare: Point | null;
  // Sat up tall on alert, where there is room for it.
  tall: boolean;
  // The mode before, which the drawing eases out of.
  was: Mode;
  // An egg it has just left, for the hunt to take.
  left: { floor: number; end: End } | null;
};

const runs = (f: Ledge, scene: PageMap) => clearRuns(f, scene.obstacles, CLEAR, { ...RUNS, reach: REACH });
const length = (r: Run) => r.hi - r.lo;
const runAt = (f: Ledge, scene: PageMap, x: number) => runs(f, scene).find((r) => r.lo <= x && x <= r.hi) ?? null;
const body = (r: Run): Run => ({ lo: r.lo + HALF, hi: r.hi - HALF });
const within = (r: Run, x: number) => r.lo <= x && x <= r.hi;
const sign = (d: number): 1 | -1 => (d < 0 ? -1 : 1);
const widthOf = (f: Ledge) => f.right - f.left;
// The ends of a run that are also ends of its ledge.
function ends(f: Ledge, r: Run): number[] {
  const first = r.lo < RUNS.inset + RUNS.step, last = r.hi > widthOf(f) - RUNS.inset - RUNS.step;
  return [...(first ? [r.lo] : []), ...(last ? [r.hi] : [])];
}
const pagePoint = (f: Ledge, x: number, lift = 0): Point => ({ x: f.left + x, y: f.y - lift });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Who a rabbit is, kept across every change of place.
type Self = Pick<Rabbit, 'id' | 'seed' | 'walked'>;
export const fresh = (id: number): Self => ({ id, seed: id + 1, walked: AT_REST });

function sitAt(self: Self, floor: number, x: number, now: number, restless: number, dir: 1 | -1 = 1): Rabbit {
  return {
    ...self, floor, x, dir, mode: 'sit', since: now, until: now + restless, hops: 0, hop: null, pause: 0,
    from: x, egg: null, trip: null, near: null, scare: null, tall: false, was: 'sit', left: null,
  };
}
const become = (r: Rabbit, mode: Mode, now: number, over: Partial<Rabbit> = {}): Rabbit => ({ ...r, was: r.mode, mode, since: now, ...over });

// Where a rabbit's hops will bring it.
export const targetOf = (r: Pick<Rabbit, 'x' | 'hops' | 'hop' | 'dir'>) => (r.hop ? r.hop.x + r.dir * (r.hops + 1) * HOP_LENGTH : r.x + r.dir * r.hops * HOP_LENGTH);

// Where the others are, or are going.
type Claim = { floor: number; x: number };
const claims = (others: readonly Rabbit[]): Claim[] => others.flatMap((o) => [
  ...(o.mode === 'away' ? [] : [{ floor: o.floor, x: o.x }, { floor: o.floor, x: targetOf(o) }]),
  ...(o.trip ? [{ floor: o.trip.floor, x: o.trip.entry }, { floor: o.trip.floor, x: o.trip.x }] : []),
]);
const clearOf = (taken: readonly Claim[], floor: number, a: number, b: number) =>
  !taken.some((c) => c.floor === floor && c.x > Math.min(a, b) - SPACING && c.x < Math.max(a, b) + SPACING);

function freeOf(r: Run, cuts: readonly number[]): Run[] {
  return [...cuts].sort((a, b) => a - b).reduce<Run[]>((left, c) => left.flatMap((p) => [
    { lo: p.lo, hi: Math.min(p.hi, c - SPACING) },
    { lo: Math.max(p.lo, c + SPACING), hi: p.hi },
  ].filter((q) => q.hi >= q.lo)), [r]);
}

// Where a rabbit could sit: every clear run in view long enough, as the
// stretch its middle may use, away from the others. Ledges with no rabbit
// come first, so they spread out.
function spots(scene: PageMap, taken: readonly Claim[]): { floor: number; room: Run }[] {
  const all = [...scene.floors].flatMap(([floor, f]) => {
    if (!inView(f, scene)) return [];
    const cuts = taken.filter((c) => c.floor === floor).map((c) => c.x);
    return runs(f, scene).filter((r) => length(r) >= MIN_SPOT).flatMap((r) => freeOf(body(r), cuts).map((room) => ({ floor, room })));
  });
  const empty = all.filter((s) => !taken.some((c) => c.floor === s.floor));
  return empty.length ? empty : all;
}

export function createRabbit(scene: PageMap, now: number, rand: Rand, others: readonly Rabbit[] = [], self: Self = fresh(0)): Rabbit | null {
  const spot = maxBy(spots(scene, claims(others)), (s) => length(s.room));
  if (!spot) return null;
  return sitAt(self, spot.floor, between(rand, spot.room.lo, spot.room.hi), now, between(rand, 2000, 6000), rand() < 0.5 ? -1 : 1);
}

// Reduced motion: sitting, kept where it sat while that spot stays clear;
// otherwise in the middle of a free stretch, clear of `avoid`.
export function restingRabbit(scene: PageMap, previous: Rabbit | null, others: readonly Rabbit[] = [], self: Self = previous ?? fresh(0), avoid: readonly Rabbit[] = others): Rabbit | null {
  const still = (r: Rabbit): Rabbit => ({ ...r, walked: AT_REST, until: Infinity });
  if (previous && staysPut(previous, scene, others)) return still(sitAt(self, previous.floor, previous.x, 0, Infinity, previous.dir));
  const spot = maxBy(spots(scene, claims(avoid)), (s) => length(s.room));
  return spot ? still(sitAt(self, spot.floor, (spot.room.lo + spot.room.hi) / 2, 0, Infinity)) : null;
}

function staysPut(r: Rabbit, scene: PageMap, others: readonly Rabbit[]): boolean {
  if (r.mode === 'away') return false;
  const f = scene.floors.get(r.floor);
  const run = f && runAt(f, scene, r.x);
  return !!run && within(body(run), r.x) && clearOf(claims(others), r.floor, r.x, r.x);
}

const leaving = (r: Rabbit) => r.mode === 'exit' || (r.mode === 'bolt' && r.trip !== null);

// After a layout change. One out of sight keeps its trip. Otherwise it stays
// on its ledge, whatever it is doing, while the stretch under it is still
// clear and nobody is too close, its hops cut short where the run shrank;
// one leaving whose ledge end is now covered settles where it is. Failing
// that, it is placed sitting somewhere new, clear of `avoid`.
export function reconcileRabbit(r: Rabbit, scene: PageMap, now: number, rand: Rand, others: readonly Rabbit[] = [], avoid: readonly Rabbit[] = others): Rabbit | null {
  if (r.mode === 'away') return r;
  const f = scene.floors.get(r.floor);
  const run = f && runAt(f, scene, Math.max(RUNS.inset, Math.min(widthOf(f) - RUNS.inset, r.x)));
  const crowded = !clearOf(claims(others), r.floor, r.x, targetOf(r));
  const coming = r.mode === 'enter' || leaving(r);
  if (!f || !run || length(run) < 2 * HALF || crowded || (!coming && !within(body(run), r.x))) return createRabbit(scene, now, rand, avoid, r);
  if (leaving(r)) return ends(f, run).some((e) => Math.abs(e - targetOf(r)) <= HOP_LENGTH) ? r : settle(r, now);
  if (coming) return r;
  const room = body(run);
  const hops = Array.from({ length: r.hops + 1 }, (_, n) => r.hops - n).find((n) => within(room, targetOf({ ...r, hops: n }))) ?? 0;
  const egg = hops === r.hops ? r.egg : null;
  return { ...r, hops, egg };
}

// Where the rabbit is drawn, or null while it is out of sight.
export type RabbitView = Point & { pose: Pose; dir: 1 | -1; opacity: number };

// Faded out over FADE px before its ledge's end as it leaves, gone past
// it; faded in over FADE px from the other's as it comes in.
function fade(r: Rabbit, f: Ledge): number {
  if (leaving(r)) {
    const end = r.dir === 1 ? widthOf(f) - RUNS.inset : RUNS.inset;
    return Math.max(0, Math.min(1, ((end - r.x) * r.dir) / FADE));
  }
  if (r.mode === 'enter') return Math.min(1, Math.abs(r.x - r.from) / FADE);
  return 1;
}

export function poseOf(r: Pick<Rabbit, 'mode' | 'tall'>): Pose {
  switch (r.mode) {
    case 'alert': return r.tall ? 'alert' : 'sit';
    case 'groom': return 'groom';
    case 'nudge': return 'nudge';
    case 'thump': return 'thump';
    case 'hop': case 'bolt': case 'exit': case 'enter': return 'hop';
    default: return 'sit';
  }
}

export function rabbitView(r: Rabbit, scene: PageMap): RabbitView | null {
  const f = scene.floors.get(r.floor);
  if (!f || r.mode === 'away') return null;
  return { ...pagePoint(f, r.x), pose: poseOf(r), dir: r.dir, opacity: fade(r, f) };
}

const centre = (r: Rabbit, f: Ledge): Point => pagePoint(f, r.x, POSES.sit.height / 2);

// How much clear space is left above a pose standing at x (negative when it
// does not fit).
const spare = (f: Ledge, scene: PageMap, pose: Pose, x: number) => {
  const half = POSES[pose].width / 2;
  return clearance(f, scene.obstacles, x - half, x + half, REACH) - POSES[pose].height;
};

const settle = (r: Rabbit, now: number, restless = 3000): Rabbit =>
  become(r, 'sit', now, { until: now + restless, hops: 0, hop: null, trip: null, egg: null, near: null, scare: null });

// Off on a run of whole hops toward x: as many as fit short of it (or the
// nearest number, `round`), at least one.
function hopToward(r: Rabbit, mode: Mode, now: number, x: number, over: Partial<Rabbit> = {}, round = false): Rabbit {
  const n = Math.abs(x - r.x) / HOP_LENGTH;
  const hops = Math.max(1, round ? Math.round(n) : Math.floor(n + 1e-9));
  return become(r, mode, now, { dir: sign(x - r.x), hops, hop: null, pause: now, ...over });
}

// One step of a run of hops: each exactly HOP_LENGTH, so its feet land where
// its cycle puts them, with a pause between (none when bolting). Returns it
// moved, and whether its hops are done.
function hopping(r: Rabbit, now: number, dt: number, speed: number, rand: Rand): { r: Rabbit; done: boolean } {
  if (!r.hop) {
    if (r.hops === 0) return { r, done: true };
    if (now < r.pause) return { r, done: false };
    return hopping({ ...r, hops: r.hops - 1, hop: { x: r.x, walked: r.walked } }, now, dt, speed, rand);
  }
  const end = r.hop.walked + HOP_LENGTH;
  const walked = Math.min(end, r.walked + (speed * dt) / 1000);
  if (walked < end) return { r: { ...r, walked, x: r.hop.x + r.dir * (walked - r.hop.walked) }, done: false };
  const gap = speed === BOLT ? 0 : between(rand, PAUSE.lo, PAUSE.hi);
  const landed = { ...r, walked: end, x: r.hop.x + r.dir * HOP_LENGTH, hop: null, pause: now + gap };
  return { r: landed, done: landed.hops === 0 };
}

// Whether the hunt has room for an egg at this end of this ledge.
export type CanLay = (floor: number, end: End) => boolean;

// Somewhere to go when it gets restless: one time in three out to another
// ledge in view, one in three to a free ledge end to leave an egg (while no
// other rabbit is up to something), else along its own run; or nowhere, and
// it sits on.
function moveOn(r: Rabbit, scene: PageMap, now: number, rand: Rand, taken: readonly Claim[], othersBusy: boolean, canLay: CanLay): Rabbit {
  const f = scene.floors.get(r.floor);
  const run = f && runAt(f, scene, r.x);
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
function along(r: Rabbit, f: Ledge, run: Run, scene: PageMap, now: number, rand: Rand, taken: readonly Claim[], { away, bolt }: Along = { away: null, bolt: false }): Rabbit {
  const room = body(run);
  const xs = taken.filter((c) => c.floor === r.floor).map((c) => c.x);
  const lane = {
    lo: Math.max(room.lo, ...xs.filter((x) => x < r.x).map((x) => x + SPACING)),
    hi: Math.min(room.hi, ...xs.filter((x) => x > r.x).map((x) => x - SPACING)),
  };
  const reach = (d: -1 | 1) => (d < 0 ? r.x - lane.lo : lane.hi - r.x);
  const sides = ([-1, 1] as const).filter((d) => reach(d) >= MIN_MOVE);
  const side = away ? maxBy(sides, (d) => Math.abs(f.left + r.x + d * MIN_MOVE - away.x)) : maxBy(sides, reach);
  if (!side && bolt) return alertAt(settle(r, now), f, now, rand, spare(f, scene, 'alert', r.x) >= 0);
  if (!side) return settle(r, now, between(rand, RESTLESS.lo, RESTLESS.hi));
  const far = bolt ? reach(side) : Math.min(reach(side), between(rand, MIN_MOVE, MAX_MOVE));
  return hopToward(r, bolt ? 'bolt' : 'hop', now, r.x + side * far);
}

// A free ledge end its own run reaches, to leave an egg at: where it stands
// to nudge it there, its nose at the egg, and which end.
function layingSpot(r: Rabbit, f: Ledge, run: Run, scene: PageMap, taken: readonly Claim[], canLay: CanLay): { x: number; end: End } | null {
  const options = ends(f, run).flatMap((e) => {
    const end: End = e === run.lo ? 'left' : 'right';
    const at = end === 'left' ? EGG_IN + NOSE : widthOf(f) - EGG_IN - NOSE;
    const hops = Math.round(Math.abs(at - r.x) / HOP_LENGTH);
    const x = r.x + sign(at - r.x) * hops * HOP_LENGTH;
    const fits = hops > 0 && within({ lo: run.lo + POSES.nudge.width / 2 - EGG_IN, hi: run.hi - POSES.nudge.width / 2 + EGG_IN }, x) && spare(f, scene, 'nudge', x) >= 0;
    return fits && canLay(r.floor, end) && clearOf(taken, r.floor, r.x, x) ? [{ x: at, end }] : [];
  });
  return options[0] ?? null;
}

// A way out by one of its ledge's ends (away from `away` when given, else
// the nearer) to another ledge in view; null if there is none.
type Way = { trip: Trip; exit: number };
function way(r: Rabbit, f: Ledge, run: Run, scene: PageMap, rand: Rand, taken: readonly Claim[], away: Point | null): Way | null {
  const open = ends(f, run).filter((x) => clearOf(taken, r.floor, r.x, x));
  const exit = maxBy(open, (x) => (away ? dist(pagePoint(f, x), away) : -Math.abs(x - r.x)));
  const ways = entries(r, scene, rand, taken);
  const to = away ? maxBy(ways, (e) => dist(e.at, away)) : ways.length ? pick(rand, ways) : undefined;
  return exit !== undefined && to ? { trip: to.trip, exit } : null;
}

function entries(r: Rabbit, scene: PageMap, rand: Rand, taken: readonly Claim[]): { trip: Trip; at: Point }[] {
  return [...scene.floors].flatMap(([floor, g]) => {
    if (floor === r.floor || !inView(g, scene)) return [];
    return runs(g, scene).filter((run) => length(run) >= MIN_ENTRY).flatMap((run) => ends(g, run).flatMap((entry) => {
      const inward = entry === run.lo ? 1 : -1;
      const hops = Math.max(2, Math.floor(between(rand, 30 + HALF, length(run) - HALF) / HOP_LENGTH));
      const x = entry + inward * hops * HOP_LENGTH;
      return within(body(run), x) && clearOf(taken, floor, entry, x) ? [{ trip: { floor, entry, x }, at: pagePoint(g, entry) }] : [];
    }));
  });
}

// Off along its run to its ledge's end by whole hops, to leave by it: past
// the end by up to a hop, by when it has faded out.
function leave(r: Rabbit, mode: 'exit' | 'bolt', now: number, out: Way): Rabbit {
  const hops = Math.max(1, Math.ceil(Math.abs(out.exit - r.x) / HOP_LENGTH));
  return become(r, mode, now, { dir: sign(out.exit - r.x), hops, hop: null, pause: now, trip: out.trip, egg: null });
}

// How long a cursor has been close, and whether it is passing near enough
// to make it sit up, or has lingered long enough to make it thump.
function notice(r: Rabbit, f: Ledge, now: number, cursor: Cursor | null): { r: Rabbit; passing: boolean; lingered: boolean } {
  const away = cursor ? dist(cursor, centre(r, f)) : Infinity;
  const near = away < NEAR ? r.near ?? now : null;
  const passing = !!cursor && now - cursor.at < MOVING && away < PASSING;
  return { r: { ...r, near }, passing, lingered: near !== null && now - near >= LINGER };
}

// Whether a rabbit is up to something big: only one is at a time.
export const busy = (r: Rabbit) => ['thump', 'bolt', 'nudge', 'exit', 'away', 'enter'].includes(r.mode) || r.egg !== null;

// Sat up on alert (tall where there is room), until a while after the
// cursor has gone.
function alertAt(r: Rabbit, f: Ledge, now: number, rand: Rand, roomy: boolean): Rabbit {
  const until = now + between(rand, ALERT.lo, ALERT.hi);
  if (r.mode === 'alert') return { ...r, until };
  return become(r, 'alert', now, { until, tall: roomy });
}
export const rouse = (r: Rabbit, scene: PageMap, now: number, rand: Rand): Rabbit => {
  const f = scene.floors.get(r.floor);
  if (!f || (r.mode !== 'sit' && r.mode !== 'groom' && r.mode !== 'alert')) return r;
  return alertAt(r, f, now, rand, spare(f, scene, 'alert', r.x) >= 0);
};

// One step of a rabbit, given the others. dt is in milliseconds. canLay
// says where the hunt would take an egg.
export function stepRabbit(start: Rabbit, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null, others: readonly Rabbit[] = [], canLay: CanLay = () => false): Rabbit {
  const r = start.left ? { ...start, left: null } : start;
  const taken = claims(others);
  if (r.mode === 'away') return now < r.until ? r : arrive(r, scene, now, rand, others);
  const f = scene.floors.get(r.floor);
  if (!f) return r;
  const othersBusy = others.some(busy);
  switch (r.mode) {
    case 'sit':
    case 'alert':
    case 'groom': {
      const seen = notice(r, f, now, cursor);
      if (seen.lingered && !othersBusy) return become(seen.r, 'thump', now, { until: now + THUMP, near: null, scare: cursor && { x: cursor.x, y: cursor.y } });
      if (seen.passing || seen.lingered) return alertAt(seen.r, f, now, rand, spare(f, scene, 'alert', r.x) >= 0);
      if (now < r.until) return seen.r;
      if (r.mode !== 'sit') return settle(seen.r, now, between(rand, RESTLESS.lo, RESTLESS.hi));
      if (rand() < 0.25 && spare(f, scene, 'groom', r.x) >= 0) return become(seen.r, 'groom', now, { until: now + GROOM });
      return moveOn(seen.r, scene, now, rand, taken, othersBusy, canLay);
    }
    case 'thump': {
      if (now < r.until) return r;
      const run = runAt(f, scene, r.x);
      if (!run) return settle(r, now);
      const from = r.scare ?? cursor ?? pagePoint(f, r.x - r.dir * 40);
      const out = way(r, f, run, scene, rand, taken, from);
      return out ? leave(r, 'bolt', now, out) : along(r, f, run, scene, now, rand, taken, { away: from, bolt: true });
    }
    case 'nudge': {
      if (now < r.until || !r.egg) return r;
      const run = runAt(f, scene, r.x);
      const after = { ...r, egg: null, left: { floor: r.floor, end: r.egg } };
      return run ? along(after, f, run, scene, now, rand, taken, { away: pagePoint(f, r.egg === 'left' ? 0 : widthOf(f)), bolt: false }) : settle(after, now);
    }
    default: {
      const { r: moved, done } = hopping(r, now, dt, r.mode === 'bolt' ? BOLT : SPEED, rand);
      if (!done) return moved;
      if (leaving(moved)) return become(moved, 'away', now, { until: now + between(rand, AWAY.lo, AWAY.hi) });
      if (moved.egg) return become(moved, 'nudge', now, { until: now + NUDGE, dir: moved.egg === 'left' ? -1 : 1 });
      if (moved.mode === 'bolt') return alertAt(settle(moved, now), f, now, rand, spare(f, scene, 'alert', moved.x) >= 0);
      return settle(moved, now, between(rand, RESTLESS.lo, RESTLESS.hi));
    }
  }
}

// Out of sight, then in at the far ledge's end if that is still somewhere to
// go; if not, it turns up sitting somewhere else.
function arrive(r: Rabbit, scene: PageMap, now: number, rand: Rand, others: readonly Rabbit[]): Rabbit {
  const t = r.trip;
  if (t && stillOpen(t, scene) && clearOf(claims(others), t.floor, t.entry, t.x)) {
    return hopToward({ ...r, floor: t.floor, x: t.entry, from: t.entry, trip: null }, 'enter', now, t.x);
  }
  return createRabbit(scene, now, rand, others, r) ?? { ...r, until: now + 2000 };
}

function stillOpen(t: Trip, scene: PageMap): boolean {
  const g = scene.floors.get(t.floor);
  if (!g || !inView(g, scene)) return false;
  const run = runAt(g, scene, t.entry);
  return !!run && ends(g, run).includes(t.entry) && within(body(run), t.x);
}
