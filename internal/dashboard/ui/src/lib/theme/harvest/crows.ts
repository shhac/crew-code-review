import { inView, type Box, type PageMap } from '../floors';
import { placeIds, troupeSize } from '../group';
import { bodyOf, clampTo, lengthOf, pageAt, runAt, runsOf } from '../ledges';
import { apart } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import type { Alarm } from './alarm';
import { grainNear, type Chaff } from './chaff';
import { away, comeIn, CROUCH, flying, grounded, standing, stepCrow, takeOff, WALKER, type Bite, type Crow } from './crow';
import { arrive, flightAt, keepsApart, landFrom, leave, remaining, SPEED, type Clear, type Flight } from './flight';

// The crows as a family: two, or three where the page has room, feeding at
// spots they can get away from. A scarecrow's flap scatters them all off
// the page, nearest it first; they come back one at a time after a while,
// the first a scout. Now and then one leaves on its own and comes back
// somewhere else, which is how they move between ledges.
// design-docs/harvest/README.md has the rules.

// What the crows are placed against: the page, the grain, which routes
// are clear (the kits' air with its exits and the swept envelope), and a
// flying crow's envelope box at a point, to keep them apart in the air.
export type Field = { page: PageMap; chaff: ReadonlyMap<number, Chaff>; clear: Clear; envelope: (p: Point) => Box };
// alarm: the last alarm heard. restless: when one may next leave on its
// own. landed: when the next may come back (the last to land, and a wait).
export type Crows = { crows: Crow[]; size: 2 | 3; alarm: Alarm | null; restless: number; landed: number };
export type Spot = { floor: number; x: number };

// Feeding spots are this far apart, and need grain this near.
export const SPOT_APART = 90;
export const SPOT_GRAIN = 30;
const SPOT_STEP = 10;
// A spot is tried at most this many times for a way out or in per frame.
const TRIES = 12;
// Scattered, they take off this far apart, nearest the scarecrow first, and
// stay away this long after its last flap, each its own time.
export const STAGGER = { lo: 200, hi: 350 };
export const AWAY = { lo: 15000, hi: 25000 };
// The next comes back this long after the last has landed; a crow with
// nowhere to come back to looks again this often.
export const RETURN_GAP = { lo: 2000, hi: 6000 };
export const LOOK_AGAIN = 5000;
// One leaves on its own this often (first within FIRST_RESTLESS of being
// placed), and is away this long.
export const RESTLESS = { lo: 60000, hi: 120000 };
export const FIRST_RESTLESS = { lo: 20000, hi: 60000 };
export const RESTLESS_AWAY = { lo: 8000, hi: 15000 };
// A crow with no clear way off tries again this often; after STUCK it
// walks NUDGE px along its run and tries from there.
const RETRY = 200;
const STUCK = 2000;
const NUDGE = 20;

// Where a crow is on the page now, standing or flying; null away.
export function pointOf(c: Crow, page: PageMap, now: number): Point | null {
  if (c.mode === 'away') return null;
  if ((c.mode === 'depart' || c.mode === 'arrive') && c.flight) return flightAt(c.flight, now).at;
  const f = page.floors.get(c.floor);
  return f ? pageAt(f, c.x) : null;
}

// The box a crow standing at its feet p stays inside.
const standBox = (p: Point): Box => ({ left: p.x - WALKER.half, right: p.x + WALKER.half, top: p.y - WALKER.clear, bottom: p.y });

// Where the others are on the ledges and where each is heading.
const claimsOf = (crows: readonly Crow[]): Spot[] => crows
  .filter((c) => c.mode !== 'away' && c.mode !== 'depart' && c.floor >= 0)
  .flatMap((c) => [{ floor: c.floor, x: c.x }, { floor: c.floor, x: c.target }]);

// Every place on the page in view where a crow could feed, before the
// escape route is checked: its stand pose fits, grain lies near, and it
// keeps SPOT_APART from every claim on its ledge.
export function feedingSpots(field: Field, taken: readonly Spot[]): Spot[] {
  const { page, chaff } = field;
  return [...page.floors].flatMap(([floor, f]) => {
    if (!inView(f, page)) return [];
    return runsOf(f, page, WALKER).flatMap((r) => {
      const body = bodyOf(r, WALKER.half);
      const count = body.hi < body.lo ? 0 : Math.floor((body.hi - body.lo) / SPOT_STEP) + 1;
      return Array.from({ length: count }, (_, i) => body.lo + i * SPOT_STEP);
    }).filter((x) => grainNear(chaff, floor, x, SPOT_GRAIN) && taken.every((t) => t.floor !== floor || Math.abs(t.x - x) >= SPOT_APART))
      .map((x) => ({ floor, x }));
  });
}

const feetAt = (field: Field, s: Spot): Point | null => {
  const f = field.page.floors.get(s.floor);
  return f ? pageAt(f, s.x) : null;
};
const speedOf = (rand: Rand) => between(rand, SPEED.lo, SPEED.hi);
const escapes = (field: Field, s: Spot, now: number) => {
  const p = feetAt(field, s);
  return !!p && !!leave(p, field.page.width, field.clear, now, SPEED.lo);
};

// Shuffled by rand, so where crows go varies, and the same for a seed.
function shuffled<T>(items: readonly T[], rand: Rand): T[] {
  return items.map((item) => ({ item, key: rand() })).sort((a, b) => a.key - b.key).map((k) => k.item);
}

// A feeding spot with a way out, ledges nobody is on first.
function pickSpot(field: Field, taken: readonly Spot[], now: number, rand: Rand): Spot | null {
  const all = shuffled(feedingSpots(field, taken), rand);
  const lonely = all.filter((s) => !taken.some((t) => t.floor === s.floor));
  return [...lonely, ...all.filter((s) => !lonely.includes(s))].slice(0, TRIES).find((s) => escapes(field, s, now)) ?? null;
}

// Placed at feeding spots, scanning, two or three as the page has room;
// one with no spot waits away and looks again.
export function createCrows(field: Field, now: number, rand: Rand): Crows {
  const placed = placeIds<Crow>([0, 1, 2], (others, id) => {
    const spot = pickSpot(field, claimsOf(others), now, rand);
    return spot && standing(id, spot.floor, spot.x, rand() < 0.5 ? 1 : -1, now, rand);
  });
  const size = troupeSize(placed);
  const crows = Array.from({ length: size }, (_, id) => placed.find((c) => c.id === id) ?? away(id, now + LOOK_AGAIN));
  return { crows, size, alarm: null, restless: now + between(rand, FIRST_RESTLESS.lo, FIRST_RESTLESS.hi), landed: -Infinity };
}

const update = (g: Crows, ...changed: Crow[]): Crows => ({ ...g, crows: g.crows.map((c) => changed.find((d) => d.id === c.id) ?? c) });
const standingBoxes = (g: Crows, field: Field, but: number, now: number) => g.crows
  .filter((c) => c.id !== but && (grounded(c) || c.mode === 'takeoff'))
  .flatMap((c) => { const p = pointOf(c, field.page, now); return p ? [standBox(p)] : []; });
const flights = (g: Crows, but: number) => g.crows.filter((c) => c.id !== but && flying(c) && c.flight).flatMap((c) => (c.flight ? [c.flight] : []));
const apartInAir = (g: Crows, field: Field, c: Crow, f: Flight, now: number) => keepsApart(f, flights(g, c.id), standingBoxes(g, field, c.id, now), field.envelope);

// A scarecrow's alarm. A new one scatters every crow not already leaving,
// nearest the scarecrow first, a crow coming in turning back; each stays
// away a while after the flapping ends. A later end to the same flapping
// starts their waits again.
function hear(g: Crows, field: Field, alarm: Alarm | null, now: number, rand: Rand): Crows {
  if (!alarm || (g.alarm && g.alarm.at === alarm.at && g.alarm.until === alarm.until)) return g;
  if (g.alarm && g.alarm.at === alarm.at) {
    return { ...g, alarm, crows: g.crows.map((c) => (c.wait > 0 ? { ...c, back: Math.max(c.back, alarm.until + c.wait) } : c)) };
  }
  const scarecrow = { x: alarm.x, y: alarm.y };
  const waited = g.crows.map((c) => {
    const wait = between(rand, AWAY.lo, AWAY.hi);
    return { ...c, wait, back: alarm.until + wait };
  });
  const near = (c: Crow) => apart(pointOf(c, field.page, now) ?? scarecrow, scarecrow);
  const ground = waited.filter(grounded).sort((a, b) => near(a) - near(b));
  const times = ground.reduce<number[]>((ts, _, i) => [...ts, i === 0 ? now : ts[i - 1] + between(rand, STAGGER.lo, STAGGER.hi)], []);
  const crows = waited.map((c) => {
    const turn = ground.indexOf(c);
    if (turn >= 0) return { ...c, leave: times[turn] };
    if (c.mode !== 'arrive') return c;
    return turnBack(c, field, now, rand);
  });
  return { ...g, alarm, crows };
}

// An arriving crow turned round where it is: off the page from the air, or,
// with no way, taken away at once.
function turnBack(c: Crow, field: Field, now: number, rand: Rand): Crow {
  const at = c.flight ? flightAt(c.flight, now).at : null;
  const out = at && leave(at, field.page.width, field.clear, now, speedOf(rand), false);
  return out ? { ...c, mode: 'depart', since: now, until: Infinity, flight: out } : { ...away(c.id, c.back), wait: c.wait };
}

// The crows told to leave whose time has come take off, along a clear way
// out that keeps apart from the others; with none they wait and try again,
// and after a while walk a little along their run first.
function launch(g: Crows, field: Field, now: number, rand: Rand): Crows {
  const due = g.crows.filter((c) => c.leave !== null && c.leave <= now && grounded(c));
  return due.reduce((group, c) => {
    const p = pointOf(c, field.page, now);
    const out = p && leave(p, field.page.width, field.clear, now + CROUCH, speedOf(rand));
    if (out && apartInAir(group, field, c, out, now)) return update(group, { ...takeOff(c, out, now), stuck: -Infinity });
    const stuck = Number.isFinite(c.stuck) ? c.stuck : now;
    if (now - stuck < STUCK) return update(group, { ...c, stuck, leave: now + RETRY });
    const f = field.page.floors.get(c.floor);
    const run = f && runAt(f, field.page, WALKER, c.x);
    const body = run && bodyOf(run, WALKER.half);
    const target = body ? clampTo(body, c.x + (c.x - body.lo < body.hi - c.x ? NUDGE : -NUDGE)) : c.x;
    return update(group, { ...c, mode: 'walk', since: now, until: Infinity, target, dir: target < c.x ? -1 : 1, stuck: now, leave: now + 1000 + RETRY });
  }, g);
}

// Now and then one leaves on its own, never while another is in the air.
function restless(g: Crows, now: number, rand: Rand): Crows {
  if (now < g.restless || g.crows.some((c) => flying(c) || c.leave !== null)) return g;
  const ready = g.crows.filter((c) => c.mode === 'scan' || c.mode === 'walk' || c.mode === 'peck');
  const next = now + between(rand, RESTLESS.lo, RESTLESS.hi);
  if (!ready.length) return { ...g, restless: next };
  const c = ready[Math.min(ready.length - 1, Math.floor(rand() * ready.length))];
  return { ...update(g, { ...c, leave: now, wait: 0, back: now + between(rand, RESTLESS_AWAY.lo, RESTLESS_AWAY.hi) }), restless: next };
}

// One away crow whose time has come comes back, when none is arriving and
// the last has landed a while ago: to a feeding spot with a clear way in,
// farthest from the scarecrow first, somewhere other than where it left if
// it can. With none it looks again later.
function comeBack(g: Crows, field: Field, now: number, rand: Rand): Crows {
  if (now < g.landed || g.crows.some((c) => c.mode === 'arrive')) return g;
  const c = g.crows.find((d) => d.mode === 'away' && d.back <= now);
  if (!c) return g;
  const scarecrow = g.alarm && { x: g.alarm.x, y: g.alarm.y };
  const far = (s: Spot) => (scarecrow ? -apart(feetAt(field, s) ?? scarecrow, scarecrow) : 0);
  const left = (s: Spot) => !!c.from && c.from.floor === s.floor && Math.abs(c.from.x - s.x) < SPOT_APART;
  const spots = shuffled(feedingSpots(field, claimsOf(g.crows)), rand).sort((a, b) => Number(left(a)) - Number(left(b)) || far(a) - far(b));
  const landing = spots.slice(0, TRIES).reduce<{ spot: Spot; flight: Flight } | null>((found, s) => {
    if (found) return found;
    const p = feetAt(field, s);
    const flight = p && arrive(p, field.page.width, field.clear, now, speedOf(rand));
    return flight && apartInAir(g, field, c, flight, now) ? { spot: s, flight } : null;
  }, null);
  if (!landing) return update(g, { ...c, back: now + LOOK_AGAIN });
  return update(g, { ...comeIn(c, landing.flight, landing.spot.floor, landing.spot.x, now), wait: 0 });
}

// One frame for the family: the alarm, take-offs, a restless one, a
// return, then each crow in turn, seeing the others as they now are.
// Returns the bites the pecks made, for the grain.
export function stepCrows(g: Crows, field: Field, now: number, dt: number, rand: Rand, cursor: Cursor | null, alarm: Alarm | null): { group: Crows; bites: Bite[] } {
  const ready = comeBack(restless(launch(hear(g, field, alarm, now, rand), field, now, rand), now, rand), field, now, rand);
  const stepped = ready.crows.reduce<{ crows: Crow[]; bites: Bite[] }>((acc, _, i) => {
    const others = acc.crows.filter((__, j) => j !== i);
    const { crow, bite } = stepCrow(acc.crows[i], { scene: field.page, chaff: field.chaff, now, dt, rand, cursor, others });
    return { crows: acc.crows.map((o, j) => (j === i ? crow : o)), bites: bite ? [...acc.bites, bite] : acc.bites };
  }, { crows: ready.crows, bites: [] });
  const landedNow = stepped.crows.some((c, i) => c.mode === 'settle' && ready.crows[i].mode === 'arrive');
  return { group: { ...ready, crows: stepped.crows, landed: landedNow ? now + between(rand, RETURN_GAP.lo, RETURN_GAP.hi) : ready.landed }, bites: stepped.bites };
}

// After a layout change. A standing crow keeps its place while its run is
// still there with a way out, pulled inside it if it shrank; else it is
// placed afresh at a feeding spot, or taken away to come back later. A
// flying crow keeps its route while the rest of it is clear; a leaving one
// otherwise finds a new way out from where it is, an arriving one a new way
// down to its spot, or turns back; with no way it is taken away.
export function reconcileCrows(g: Crows, field: Field, now: number, rand: Rand): Crows {
  const crows = g.crows.reduce<Crow[]>((done, c) => {
    const others = [...done, ...g.crows.slice(done.length + 1)];
    return [...done, keep(c, others, field, now, rand)];
  }, []);
  return { ...g, crows };
}

function keep(c: Crow, others: readonly Crow[], field: Field, now: number, rand: Rand): Crow {
  if (c.mode === 'away') return c;
  if (c.mode === 'depart' || c.mode === 'takeoff') {
    if (c.flight && field.clear(remaining(c.flight, now), 'depart')) return c;
    const at = pointOf(c, field.page, now);
    const out = at && leave(at, field.page.width, field.clear, now, speedOf(rand), c.mode !== 'depart');
    return out ? { ...c, mode: 'depart', since: now, flight: out } : { ...away(c.id, c.back), wait: c.wait, from: c.from };
  }
  if (c.mode === 'arrive') {
    const spot = { floor: c.floor, x: c.x };
    const p = feetAt(field, spot);
    const f = field.page.floors.get(c.floor);
    const still = !!f && !!runAt(f, field.page, WALKER, c.x);
    if (still && c.flight && field.clear(remaining(c.flight, now), 'arrive')) return c;
    const at = c.flight && flightAt(c.flight, now).at;
    const down = still && p && at && landFrom(at, p, field.clear, now, speedOf(rand));
    return down ? { ...c, since: now, flight: down } : turnBack(c, field, now, rand);
  }
  const f = field.page.floors.get(c.floor);
  const run = f && runAt(f, field.page, WALKER, c.x);
  const body = run && bodyOf(run, WALKER.half);
  if (body && body.hi >= body.lo) {
    const placed = { ...c, x: clampTo(body, c.x), target: clampTo(body, c.target) };
    if (escapes(field, placed, now)) return placed;
  }
  const spot = pickSpot(field, claimsOf(others), now, rand);
  return spot ? { ...standing(c.id, spot.floor, spot.x, c.dir, now, rand), wait: c.wait } : away(c.id, now + LOOK_AGAIN);
}

// Under reduced motion: every crow standing still. One already standing
// keeps its place while its run is still there; the rest stand in the
// middle of the longest clear runs with a way out, SPOT_APART from each
// other, as many as the family has (or as the page has room for).
export function restingCrows(field: Field, previous: Crows | null): Crows {
  const size = previous?.size ?? 3;
  const kept = (previous?.crows ?? []).filter((c) => {
    const f = field.page.floors.get(c.floor);
    return (grounded(c) || c.mode === 'takeoff') && !!f && !!runAt(f, field.page, WALKER, c.x);
  }).map((c) => still(c.id, c.floor, c.x, c.dir));
  const runs = [...field.page.floors].flatMap(([floor, f]) => (inView(f, field.page) ? runsOf(f, field.page, WALKER).map((r) => ({ floor, body: bodyOf(r, WALKER.half) })) : []))
    .filter((r) => r.body.hi >= r.body.lo).sort((a, b) => lengthOf(b.body) - lengthOf(a.body));
  const ids = Array.from({ length: size }, (_, id) => id).filter((id) => !kept.some((k) => k.id === id));
  const placed = ids.reduce<Crow[]>((all, id) => {
    const spot = runs.map((r) => ({ floor: r.floor, x: (r.body.lo + r.body.hi) / 2 }))
      .find((s) => all.every((o) => o.floor !== s.floor || Math.abs(o.x - s.x) >= SPOT_APART) && escapes(field, s, 0));
    return spot ? [...all, still(id, spot.floor, spot.x, 1)] : all;
  }, kept);
  const fullSize = previous ? previous.size : troupeSize(placed);
  const crows = Array.from({ length: fullSize }, (_, id) => placed.find((c) => c.id === id) ?? away(id, Infinity));
  return { crows, size: fullSize, alarm: previous?.alarm ?? null, restless: Infinity, landed: -Infinity };
}

const still = (id: number, floor: number, x: number, dir: 1 | -1): Crow => ({ ...standing(id, floor, x, dir, 0, () => 0), until: Infinity });
