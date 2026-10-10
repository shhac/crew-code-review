import type { Box, PageMap, Run } from '../floors';
import { apart, clamp, mixPoint, smooth } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import { clear, type BeeAir } from './beeair';
import { approaches, fitsAt, frameAt, hoverSpot, lastBell, onPage, perchSpot, spotIn, visitable, type Flower, type Spot } from './flowers';
import { boxAt, CONTACT, FOOTPRINTS, type Pose } from './footprints';
import { along, flyReach, holdRoute, originOf, placeRoute, plan, routeOf, type Frame, type Route } from './route';

// One bumblebee: perched on a bell, crawling up to the next, warming up,
// lifting off, hovering, bumbling to another flower along a planned route,
// braking in two steps and landing; darting out of a moving cursor's way;
// now and then flying head first into a card's side. Every place is held
// by a frame (a ledge, or the rail), so a bee rides with its card on
// scroll. Pure: the group (bees.ts) steps the bees in turn and keeps them
// apart. design-docs/bluebells/README.md has the state table and the
// airspace contract.

export type Mode = 'perch' | 'crawl' | 'shiver' | 'takeoff' | 'hover' | 'fly' | 'approach' | 'land' | 'dodge' | 'bonk' | 'bounce' | 'leave' | 'away';

// Why it is flying.
export type Purpose = 'visit' | 'dodge' | 'bonk' | 'leave' | 'enter';
export type Flight = {
  frame: Frame;
  // Held by the frame.
  route: Route;
  // How far along it has flown, and how fast it is going (px/s).
  s: number;
  v: number;
  purpose: Purpose;
  start: number;
};
// A wall it is flying at: where its head will touch (held by the wall's
// card) and which way it faces.
export type Bonk = { contact: Spot; dir: 1 | -1 };

export type Bee = {
  id: number;
  // Its own timings and bumbling, so no two keep time.
  seed: number;
  mode: Mode;
  since: number;
  // When a timed mode ends.
  until: number;
  // Where it is (its thorax), or where a timed move set off from; and
  // where a timed move ends.
  at: Spot;
  to: Spot | null;
  dir: 1 | -1;
  // The flower it is on or going to, the bell, and how many bells of it
  // it has visited.
  flower: string | null;
  bell: number;
  visited: number;
  flight: Flight | null;
  bonk: Bonk | null;
  // A dodge waiting on its takeoff, and where the cursor was; after a
  // dodge, where the cursor was, to choose a flower away from.
  startled: Point | null;
  fled: Point | null;
  // When it may dodge again; when it began to look for a way it could not
  // find; and which way it last travelled.
  calm: number;
  stuck: number;
  heading: Point | null;
  // Fading in or out (enter, a leave with no way out).
  fade: { from: number; to: number; at: number } | null;
  // Never yet placed: the page had no flower for it when the group was
  // made (still loading, say), so it is put on one as soon as there is.
  unplaced?: boolean;
};

// Timings in ms, speeds in px/s, per the note's state table.
const PERCH = [3000, 8000] as const;
const CRAWL_SPEED = 10;
const MAX_CRAWL = 8;
const VISITS = 3;
const SHIVER = 400;
const TAKEOFF = 250;
const HOVER = [400, 1200] as const;
const DAZE = 700;
const AFTER_DODGE = 300;
const CRUISE = 70;
const ARRIVE = 25;
const ACCEL = 140;
const BRAKE = 110;
const STEP = 250;
const PAUSE = 100;
const BRAKING = 2 * STEP + PAUSE;
const SETTLE = [200, 500] as const;
const LAND = 70;
const DODGE_SPEED = 140;
const DODGE_ACCEL = 700;
export const DODGE_REACH = 56;
export const STARTLE = 40;
const DART = [30, 40] as const;
const CALM = 800;
export const MOVING = 120;
// The last stretch at a wall is flown level and straight, as long as there
// is room for: 30px, or less where the air beside the wall is narrower.
const LEADS = [30, 24, 18, 12] as const;
const BOUNCE = 180;
const BACK = 8;
const AWAY = [3000, 8000] as const;
const STUCK = 2000;
const FADE = 300;
// A still cursor is kept this far from a route.
const STILL_CLEAR = 40;
// Choosing: near flowers first, and the way it was already going.
const NEAR = 80;
const AHEAD = 1.5;
const TRIES = 5;

const towards = (v: number, target: number, rate: number, dt: number) => (v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt));

// A bee's flowers by key.
export type Flowers = ReadonlyMap<string, Flower>;

// What a bee needs to know to take a step: the air, the flowers, those the
// others have claimed, the others' boxes it must keep clear of (grown by
// the spacing), the cursor, and what the group allows it.
export type Context = {
  air: BeeAir;
  flowers: Flowers;
  claimed: ReadonlySet<string>;
  others: readonly Box[];
  cursor: Cursor | null;
  bonks: readonly WallSide[];
  mayBonk: boolean;
  mayDodge: boolean;
};

// A card side a bee may fly into: its card, x, the side its air is on, and
// the stretches (px down from the card's top) where a bonk and its bounce
// fit in front of it.
export type WallSide = { floor: number; x: number; side: -1 | 1; top: number; runs: readonly Run[] };

// What a mode looks like, for its footprint.
export function poseOf(b: Bee, now: number, page?: PageMap): Pose {
  switch (b.mode) {
    case 'perch': case 'shiver': return 'perch';
    case 'crawl': return 'crawl';
    case 'land': return 'land';
    case 'fly': case 'dodge': case 'leave': return 'fly';
    case 'bounce': return 'bonk';
    case 'bonk': return page && headGap(b, page, now) < 4 ? 'bonk' : 'fly';
    default: return 'hover';
  }
}

// How far its head still is from the wall on a bonk's dash.
function headGap(b: Bee, page: PageMap, now: number): number {
  const here = where(b, page, now), contact = b.bonk && onPage(page, b.bonk.contact);
  return here && contact ? Math.abs(contact.x - here.x) : Infinity;
}

// The bumbling across a route: seeded, bounded by 3.2px, faded in and out
// over its first and last 24px so a route starts and ends where it says.
export function wobble(seed: number, t: number): number {
  const a = seed * 1.7, b = seed * 3.1;
  return clamp(2 * (Math.sin(2 * Math.PI * 1.3 * t + a) + 0.6 * Math.sin(2 * Math.PI * 2.9 * t + b)), -3.2, 3.2);
}

function flightPoint(b: Bee, f: Flight, page: PageMap, now: number): Point | null {
  const o = originOf(page, f.frame);
  if (!o) return null;
  const route = placeRoute(f.route, o);
  const { p, dx, dy } = along(route, f.s);
  if (f.purpose === 'dodge') return p;
  const len = Math.hypot(dx, dy) || 1;
  const fade = smooth(f.s / 24) * smooth((route.length - f.s) / 24);
  const w = wobble(b.seed, (now - f.start) / 1000) * fade;
  return { x: p.x - (dy / len) * w, y: p.y + (dx / len) * w };
}

// Where its thorax is now, on the page; null when it is away or its frame
// has gone.
export function where(b: Bee, page: PageMap, now: number): Point | null {
  if (b.mode === 'away') return null;
  if (b.flight) return flightPoint(b, b.flight, page, now);
  const at = onPage(page, b.at);
  const to = b.to && onPage(page, b.to);
  if (!at) return null;
  if (!to) return at;
  const t = (now - b.since) / Math.max(1, b.until - b.since);
  switch (b.mode) {
    case 'crawl': return mixPoint(at, to, smooth(t));
    case 'takeoff': return mixPoint(at, to, smooth(t));
    case 'land': return mixPoint(at, to, smooth(t));
    case 'bonk': return mixPoint(at, to, clamp(t, 0, 1));
    // Out, easing to a stop.
    case 'bounce': return mixPoint(at, to, 1 - (1 - clamp(t, 0, 1)) ** 2);
    case 'approach': return mixPoint(at, to, braking(now - b.since));
    default: return at;
  }
}

// Two braking steps: most of the way, a breath, then the rest.
function braking(ms: number): number {
  if (ms < STEP) return 0.65 * (1 - (1 - ms / STEP) ** 2);
  if (ms < STEP + PAUSE) return 0.65;
  return 0.65 + 0.35 * (1 - (1 - clamp((ms - STEP - PAUSE) / STEP, 0, 1)) ** 2);
}

// The box it takes up now.
export function boxOf(b: Bee, page: PageMap, now: number): Box | null {
  const p = where(b, page, now);
  return p && boxAt(p, FOOTPRINTS[poseOf(b, now, page)], b.dir);
}

const self = (id: number) => ({ id, seed: id * 7 + 3 });

// Perched on bell i of a flower from now, restless after `rest` ms.
export function perchOn(base: Pick<Bee, 'id' | 'seed'> & Partial<Bee>, f: Flower, i: number, now: number, rest: number, dir: 1 | -1, visited = 1): Bee {
  return {
    calm: now, stuck: -Infinity, heading: null, startled: null, fled: null, fade: null, bonk: null, ...base,
    mode: 'perch', since: now, until: now + rest, at: perchSpot(f, i), to: null, dir, flower: f.key, bell: i, visited, flight: null,
  };
}

// A new bee perched on a flower, restless after a while.
export function placedBee(id: number, f: Flower, now: number, rest: number, dir: 1 | -1): Bee {
  return perchOn(self(id), f, 0, now, rest, dir);
}

// Away, coming back after a while.
export function awayBee(base: Pick<Bee, 'id' | 'seed'> & Partial<Bee>, now: number, rand: Rand): Bee {
  return {
    calm: now, stuck: -Infinity, heading: null, startled: null, fled: null, bonk: null, ...base,
    mode: 'away', since: now, until: now + between(rand, ...AWAY), at: { frame: 'rail', x: 0, y: 0 }, to: null,
    dir: 1, flower: null, bell: 0, visited: 0, flight: null, fade: null,
  };
}

const moving = (cursor: Cursor | null, now: number) => !!cursor && now - cursor.at < MOVING;
const still = (cursor: Cursor | null, now: number) => !!cursor && now - cursor.at >= MOVING;
// A cursor at rest, kept clear of by a route.
const restingCursor = (cursor: Cursor | null, now: number): Box[] => (still(cursor, now) && cursor
  ? [{ left: cursor.x - STILL_CLEAR, right: cursor.x + STILL_CLEAR, top: cursor.y - STILL_CLEAR, bottom: cursor.y + STILL_CLEAR }]
  : []);

const timed = (b: Bee, mode: Mode, now: number, ms: number, to: Spot | null = null): Bee => ({ ...b, mode, since: now, until: now + ms, to });
const hoverHere = (b: Bee, at: Spot, now: number, ms: number): Bee => ({ ...b, mode: 'hover', since: now, until: now + ms, at, to: null, flight: null });

// Off on a flight held by a frame.
function flyOff(b: Bee, air: BeeAir, route: Route, frame: Frame, purpose: Purpose, now: number, mode: Mode = purpose === 'dodge' ? 'dodge' : purpose === 'leave' ? 'leave' : 'fly'): Bee | null {
  const o = originOf(air.page, frame);
  if (!o) return null;
  const end = route.curves.at(-1)?.to, first = route.curves[0]?.from;
  const dir = end && first && Math.abs(end.x - first.x) > 1 ? (end.x > first.x ? 1 : -1) : b.dir;
  return { ...b, mode, since: now, until: Infinity, to: null, dir, flight: { frame, route: holdRoute(route, o), s: 0, v: purpose === 'dodge' ? 40 : 0, purpose, start: now } };
}

// One step of a bee's own. dt in ms.
export function stepBee(b: Bee, ctx: Context, now: number, dt: number, rand: Rand): Bee {
  if (b.flight && (b.mode === 'fly' || b.mode === 'dodge' || b.mode === 'leave')) return flyOn(b, ctx, now, dt, rand);
  const flower = b.flower ? ctx.flowers.get(b.flower) : undefined;
  switch (b.mode) {
    case 'perch': return perched(b, flower, ctx, now, rand);
    case 'crawl': return now < b.until ? b : perchOn(b, flower ?? nowhere(b), b.bell, now, between(rand, ...PERCH), b.dir, b.visited);
    case 'shiver': return now < b.until ? b : takeOff(b, flower, ctx, now, rand);
    case 'takeoff': return now < b.until ? b : hoverHere(b, b.to ?? b.at, now, between(rand, ...HOVER));
    case 'approach': return now < b.until ? b : timed({ ...b, at: b.to ?? b.at }, 'land', now, LAND, flower ? perchSpot(flower, b.bell) : null);
    case 'land': return now < b.until || !flower ? b : perchOn(b, flower, b.bell, now, between(rand, ...PERCH), b.dir, b.visited);
    case 'bonk': return now < b.until ? b : bounce(b, now);
    case 'bounce': return now < b.until ? b : hoverHere({ ...b, bonk: null }, b.to ?? b.at, now, DAZE);
    case 'away': return comeBack(b, ctx, now, rand);
    case 'leave': return now < b.until ? b : awayBee(b, now, rand);
    default: return hovering(b, ctx, now, rand);
  }
}

// A flower that has gone: the bee is put somewhere by the group's
// reconciliation, so this only keeps the types whole.
const nowhere = (b: Bee): Flower => ({ key: b.flower ?? '', frame: b.at.frame, bells: [{ x: b.at.x, y: b.at.y }], box: { left: b.at.x, right: b.at.x, top: b.at.y, bottom: b.at.y } });

// Perched: crawls up to the next bell while there is one to visit near
// enough, else warms up and goes. A moving cursor close by: straight off,
// to dodge.
function perched(b: Bee, flower: Flower | undefined, ctx: Context, now: number, rand: Rand): Bee {
  const here = where(b, ctx.air.page, now);
  const cursor = ctx.cursor;
  if (here && cursor && moving(cursor, now) && ctx.mayDodge && now >= b.calm && apart(here, cursor) < STARTLE) {
    return takeOff({ ...b, startled: { x: cursor.x, y: cursor.y } }, flower, ctx, now, rand);
  }
  if (now < b.until || !flower) return b;
  const next = b.bell + 1;
  const up = next <= lastBell(flower) && b.visited < VISITS ? flower.bells[next] : null;
  const from = flower.bells[b.bell];
  const gap = up && from ? apart(up, from) : Infinity;
  if (up && gap <= MAX_CRAWL && fitsAt(ctx.air, perchSpot(flower, next), 'crawl', b.dir, false, ctx.others)) {
    const dir = Math.abs(up.x - from.x) > 0.5 ? (up.x > from.x ? 1 : -1) : b.dir;
    return { ...timed(b, 'crawl', now, (gap / CRAWL_SPEED) * 1000, perchSpot(flower, next)), bell: next, visited: b.visited + 1, dir };
  }
  return timed(b, 'shiver', now, SHIVER);
}

// Lifting off its bell to a spot beside the flower, the side clear of the
// others, nearest first; with none clear, it stays perched and tries again.
function takeOff(b: Bee, flower: Flower | undefined, ctx: Context, now: number, rand: Rand): Bee {
  const spots = flower ? approaches(ctx.air, flower, b.bell, ctx.others) : [];
  const page = ctx.air.page;
  const from = where(b, page, now);
  const spot = spots.find((s) => {
    const p = onPage(page, s);
    return p && from && clear(ctx.air, liftBox(from, p, b.dir), { also: ctx.others });
  });
  if (!spot) return { ...b, mode: 'perch', since: now, until: now + between(rand, 500, 1000) };
  const p = onPage(page, spot);
  const dir = p && from && Math.abs(p.x - from.x) > 1 ? (p.x > from.x ? 1 : -1) : b.dir;
  return { ...timed(b, 'takeoff', now, TAKEOFF, spot), dir };
}

// What a lift off from a to b sweeps: the hover footprint at both ends and
// everything between.
function liftBox(a: Point, c: Point, dir: 1 | -1): Box {
  const x = boxAt(a, FOOTPRINTS.hover, dir), y = boxAt(c, FOOTPRINTS.hover, dir);
  return { left: Math.min(x.left, y.left), right: Math.max(x.right, y.right), top: Math.min(x.top, y.top), bottom: Math.max(x.bottom, y.bottom) };
}

// Hovering: a dodge first if one is waiting, then, its time up, a bonk now
// and then or another flower. With nowhere to go it hovers on, and after
// 2s leaves.
function hovering(b: Bee, ctx: Context, now: number, rand: Rand): Bee {
  const here = where(b, ctx.air.page, now);
  if (!here) return b;
  if (b.startled) return dodge({ ...b, startled: null }, ctx, now, b.startled);
  const cursor = ctx.cursor;
  if (cursor && moving(cursor, now) && ctx.mayDodge && now >= b.calm && apart(here, cursor) < DODGE_REACH) return dodge(b, ctx, now, cursor);
  if (now < b.until) return b;
  const stuckSince = Number.isFinite(b.stuck) ? b.stuck : now;
  const bonked = ctx.mayBonk && rand() < 1 / 8 && !(cursor && apart(here, cursor) < 120) ? bonkFrom(b, ctx, here, now) : null;
  if (bonked) return bonked;
  const visit = visitFrom(b, ctx, here, now, rand, b.fled);
  if (visit) return { ...visit, stuck: -Infinity, fled: null };
  if (now - stuckSince >= STUCK) return leave(b, ctx, here, now, rand);
  return { ...b, until: now + 500, stuck: stuckSince };
}

// Off to another flower: among those visitable and unclaimed, near ones
// and those the way it was going more likely, a few tried in a weighted
// random order until one has a clear way in. avoid: a point to fly away
// from (a cursor it dodged).
function visitFrom(b: Bee, ctx: Context, here: Point, now: number, rand: Rand, avoid: Point | null): Bee | null {
  const page = ctx.air.page;
  const candidates = [...ctx.flowers.values()].flatMap((f) => {
    if (f.key === b.flower || ctx.claimed.has(f.key) || !visitable(ctx.air, f, ctx.others)) return [];
    const p = onPage(page, hoverSpot(f, 0));
    if (!p) return [];
    const d = { x: p.x - here.x, y: p.y - here.y };
    if (avoid && d.x * (avoid.x - here.x) + d.y * (avoid.y - here.y) > 0) return [];
    const h = b.heading;
    const cos = h ? (d.x * h.x + d.y * h.y) / ((Math.hypot(d.x, d.y) || 1) * (Math.hypot(h.x, h.y) || 1)) : 0;
    return [{ f, w: (1 / (apart(p, here) + NEAR)) * (cos >= 0.5 ? AHEAD : 1) }];
  });
  const order = weightedOrder(candidates, rand).slice(0, TRIES);
  const also = [...ctx.others, ...restingCursor(ctx.cursor, now)];
  for (const { f } of order) {
    const sides = approaches(ctx.air, f, 0, also).sort((x, y) => apart(onPage(page, x) ?? here, here) - apart(onPage(page, y) ?? here, here));
    for (const side of sides) {
      const to = onPage(page, side), over = onPage(page, hoverSpot(f, 0));
      if (!to || !over) continue;
      const route = plan(ctx.air, here, to, { also, into: { x: (over.x - to.x) * 2, y: 0 } });
      const going = route && flyOff({ ...b, flower: f.key, bell: 0, visited: 0 }, ctx.air, route, f.frame, 'visit', now);
      if (going) return { ...going, heading: { x: to.x - here.x, y: to.y - here.y } };
    }
  }
  return null;
}

// Items in a random order, each drawn with a chance in proportion to its
// weight from those left.
function weightedOrder<T extends { w: number }>(items: readonly T[], rand: Rand): T[] {
  return items.map((it) => ({ it, k: -Math.log(Math.max(1e-9, rand())) / it.w })).sort((a, c) => a.k - c.k).map((x) => x.it);
}

// A dart away from a cursor: eight ways, the one most directly away first,
// to a spot 30 to 40px off whose way there is clear. None: it holds where
// it is, hovering, which is always in air.
export function dodge(b: Bee, ctx: Context, now: number, cursor: Point): Bee {
  const page = ctx.air.page;
  const here = where(b, page, now);
  const calmed = { ...b, calm: now + CALM, bonk: null, startled: null, fled: cursor };
  if (!here) return calmed;
  const away = Math.atan2(here.y - cursor.y, here.x - cursor.x);
  const turns = [0, 1, -1, 2, -2, 3, -3, 4].map((k) => away + (k * Math.PI) / 4);
  const reach = DART[0] + (DART[1] - DART[0]) * ((b.seed * 0.37) % 1);
  for (const a of turns) {
    const to = { x: here.x + Math.cos(a) * reach, y: here.y + Math.sin(a) * reach };
    const curve = { from: here, c1: mixPoint(here, to, 1 / 3), c2: mixPoint(here, to, 2 / 3), to };
    const route = routeOf([curve]);
    const box = liftBox(here, to, b.dir);
    const hold = frameAt(ctx.air, to);
    if (!hold || !clear(ctx.air, { left: box.left - 3, right: box.right + 3, top: box.top - 3, bottom: box.bottom + 3 }, { also: ctx.others, view: true })) continue;
    const off = flyOff({ ...calmed, flower: null }, ctx.air, route, hold.frame, 'dodge', now);
    if (off) return { ...off, heading: { x: to.x - cursor.x, y: to.y - cursor.y } };
  }
  const held = frameAt(ctx.air, here);
  return held ? hoverHere({ ...calmed, flower: null, flight: null }, held, now, AFTER_DODGE) : calmed;
}

// A bonk: a wall run in view with room for the bonk and its bounce, its
// height the nearest to the bee's own, and a clear way to a spot LEAD px in
// front of it, from which the last stretch is flown level and straight.
function bonkFrom(b: Bee, ctx: Context, here: Point, now: number): Bee | null {
  const page = ctx.air.page;
  const fp = FOOTPRINTS.bonk;
  const options = ctx.bonks.flatMap((w) => {
    const o = originOf(page, w.floor);
    if (!o) return [];
    return w.runs.flatMap((r) => {
      const lo = w.top + r.lo - 2 + fp.up, hi = w.top + r.hi + 2 - fp.down;
      if (hi < lo) return [];
      const y = clamp(here.y, lo, hi);
      const contact = { x: w.x + w.side * CONTACT, y };
      const lead = LEADS.map((d) => ({ x: contact.x + w.side * d, y })).find((p) => clear(ctx.air, flyReach(p), { view: true }));
      return lead ? [{ w, o, contact, lead, d: apart(lead, here) }] : [];
    });
  }).sort((x, y) => x.d - y.d).slice(0, 3);
  const also = [...ctx.others, ...restingCursor(ctx.cursor, now)];
  for (const { w, o, contact, lead } of options) {
    const dir = w.side === 1 ? -1 : 1;
    const route = plan(ctx.air, here, lead, { also, into: { x: dir * 40, y: 0 } });
    const off = route && flyOff(b, ctx.air, route, w.floor, 'bonk', now);
    if (off) return { ...off, flower: null, bonk: { contact: { frame: w.floor, x: contact.x - o.x, y: contact.y - o.y }, dir } };
  }
  return null;
}

// The knock: 8px back from the wall, easing out, then a daze.
function bounce(b: Bee, now: number): Bee {
  const contact = b.bonk?.contact ?? b.at;
  const dir = b.bonk?.dir ?? b.dir;
  return { ...timed({ ...b, at: contact, dir }, 'bounce', now, BOUNCE, { ...contact, x: contact.x - dir * BACK }), flight: null };
}

// Flying on along its route: speeding up to its cruise, slowing to arrive.
// At the end: a visit brakes in to land, a dodge hovers, a bonk's lead
// turns into the last straight dash at the wall, a leave goes away.
function flyOn(b: Bee, ctx: Context, now: number, dt: number, rand: Rand): Bee {
  const f = b.flight;
  if (!f) return b;
  const cursor = ctx.cursor;
  const here = where(b, ctx.air.page, now);
  if (here && cursor && b.mode !== 'dodge' && moving(cursor, now) && ctx.mayDodge && now >= b.calm && apart(here, cursor) < DODGE_REACH) return dodge(b, ctx, now, cursor);
  const fast = f.purpose === 'dodge';
  const [top, end, rate] = fast ? [DODGE_SPEED, 40, DODGE_ACCEL] : f.purpose === 'bonk' ? [CRUISE, CRUISE, ACCEL] : [CRUISE, ARRIVE, ACCEL];
  const left = f.route.length - f.s;
  const target = Math.min(top, Math.sqrt(end * end + 2 * (fast ? DODGE_ACCEL : BRAKE) * Math.max(0, left)));
  const v = towards(f.v, target, rate, dt / 1000);
  const s = Math.min(f.route.length, f.s + (v * dt) / 1000);
  const flown = { ...b, flight: { ...f, s, v }, dir: facingOn(b, f, s) };
  if (s < f.route.length) return flown;
  const page = ctx.air.page;
  const there = where(flown, page, now);
  const spot = there && spotIn(f.frame, there, page);
  if (!spot) return awayBee(b, now, rand);
  const flower = b.flower ? ctx.flowers.get(b.flower) : undefined;
  switch (f.purpose) {
    case 'visit': case 'enter': {
      if (!flower) return hoverHere(flown, spot, now, between(rand, ...HOVER));
      const over = hoverSpot(flower, 0);
      const overPage = onPage(page, over);
      const dir = overPage && there && Math.abs(overPage.x - there.x) > 1 ? (overPage.x > there.x ? 1 : -1) : flown.dir;
      return { ...timed({ ...flown, at: spot, flight: null, dir }, 'approach', now, BRAKING + between(rand, ...SETTLE), over), bell: 0, visited: 1 };
    }
    case 'bonk': {
      const contact = b.bonk && onPage(page, b.bonk.contact);
      if (!b.bonk || !contact || !there) return hoverHere(flown, spot, now, between(rand, ...HOVER));
      const held = spotIn(b.bonk.contact.frame, there, page);
      if (!held) return hoverHere(flown, spot, now, between(rand, ...HOVER));
      return timed({ ...flown, at: held, dir: b.bonk.dir, flight: null }, 'bonk', now, (apart(there, contact) / CRUISE) * 1000, b.bonk.contact);
    }
    case 'leave': return awayBee(b, now, rand);
    default: return hoverHere({ ...flown, calm: Math.max(b.calm, now) }, spot, now, AFTER_DODGE);
  }
}

// Which way it faces along a flight: the way it is heading, keeping the way
// it faced while that is nearly straight up or down.
function facingOn(b: Bee, f: Flight, s: number): 1 | -1 {
  const { dx } = along(f.route, Math.min(f.route.length, s + 2));
  return Math.abs(dx) > 0.05 ? (dx > 0 ? 1 : -1) : b.dir;
}

// Nowhere to go: out of the window through the top or the bottom, along
// the nearer of main's margins if a way exists, else it fades where it is.
function leave(b: Bee, ctx: Context, here: Point, now: number, rand: Rand): Bee {
  const page = ctx.air.page;
  const main = page.main;
  const exits = main ? [here.x, main.left + 30, main.right - 30].flatMap((x) => [{ x, y: -40 }, { x, y: page.height + 40 }]) : [];
  const also = [...ctx.others, ...restingCursor(ctx.cursor, now)];
  for (const out of exits.sort((p, q) => apart(p, here) - apart(q, here)).slice(0, 4)) {
    const route = plan(ctx.air, here, out, { also });
    const frame = frameAt(ctx.air, here);
    const off = route && frame && flyOff({ ...b, flower: null }, ctx.air, route, frame.frame, 'leave', now);
    if (off) return off;
  }
  return { ...timed({ ...b, flower: null, flight: null }, 'leave', now, FADE), fade: { from: 1, to: 0, at: now } };
}

// Away: after its time, and once there is a flower to come to, it flies in
// from beyond the window's edge nearest the flower; with no way in from
// there, it fades in beside the flower instead.
function comeBack(b: Bee, ctx: Context, now: number, rand: Rand): Bee {
  if (now < b.until) return b;
  const page = ctx.air.page;
  const open = [...ctx.flowers.values()].filter((f) => !ctx.claimed.has(f.key) && visitable(ctx.air, f, ctx.others));
  const f = open.sort((x, y) => (onPage(page, hoverSpot(x, 0))?.y ?? 0) - (onPage(page, hoverSpot(y, 0))?.y ?? 0))[Math.floor(rand() * open.length)];
  if (!f) return { ...b, until: now + 1000 };
  const side = approaches(ctx.air, f, 0, ctx.others)[0];
  const to = side && onPage(page, side);
  if (!side || !to) return { ...b, until: now + 1000 };
  const starts = [{ x: to.x, y: to.y < page.height / 2 ? -40 : page.height + 40 }, { x: to.x, y: to.y < page.height / 2 ? page.height + 40 : -40 }];
  const also = [...ctx.others, ...restingCursor(ctx.cursor, now)];
  for (const from of starts) {
    const over = onPage(page, hoverSpot(f, 0));
    const route = plan(ctx.air, from, to, { also, into: over ? { x: (over.x - to.x) * 2, y: 0 } : undefined });
    const off = route && flyOff({ ...b, flower: f.key, bell: 0, visited: 0, fade: null }, ctx.air, route, f.frame, 'enter', now, 'fly');
    if (off) return off;
  }
  return { ...hoverHere({ ...b, flower: f.key, bell: 0, visited: 0 }, side, now, between(rand, ...HOVER)), fade: { from: 0, to: 1, at: now } };
}

// How visible it is: fading in or out over FADE ms.
export function opacityOf(b: Bee, now: number): number {
  if (b.mode === 'away') return 0;
  if (!b.fade) return 1;
  const t = clamp((now - b.fade.at) / FADE, 0, 1);
  return b.fade.from + (b.fade.to - b.fade.from) * t;
}

// What the drawing needs: where, which way, its pose, how fast it is going,
// how far it has crawled, how far its wings are going (0 folded to 1
// beating), how long since a bonk knocked it back, how visible it is, and
// the flower and bell it is on (which dips under it). Seen from the side, a
// bee banking into a turn shows nothing a page can draw, so it does not.
export type BeeView = Point & {
  dir: 1 | -1; pose: Pose; mode: Mode; speed: number; walked: number; wings: number; knocked?: number; opacity: number;
  on: { flower: string; bell: number } | null;
};
// Warming up, the body trembles this much (px) at this rate, the wings still.
const TREMBLE = 0.2;
const TREMBLE_HZ = 25;
// Knocked off a wall, the blur dims to half for a moment.
const DIM = 120;

export function beeView(b: Bee, page: PageMap, now: number): BeeView | null {
  const p = where(b, page, now);
  if (!p) return null;
  const f = b.flight;
  const since = now - b.since;
  const speed = f ? f.v : b.mode === 'bonk' ? CRUISE : 0;
  const on = (b.mode === 'perch' || b.mode === 'shiver' || b.mode === 'crawl') && b.flower ? { flower: b.flower, bell: b.bell } : null;
  const wings = on ? 0 : b.mode === 'takeoff' ? clamp(since / TAKEOFF, 0, 1) : b.mode === 'bounce' && since < DIM ? 0.5 : 1;
  const tremble = b.mode === 'shiver' ? TREMBLE * Math.sin((2 * Math.PI * TREMBLE_HZ * since) / 1000) : 0;
  return {
    x: p.x + tremble, y: p.y, dir: b.dir, pose: poseOf(b, now, page), mode: b.mode, speed,
    walked: b.mode === 'crawl' ? (since / 1000) * CRAWL_SPEED : 0, wings,
    ...(b.mode === 'bounce' ? { knocked: since } : {}), opacity: opacityOf(b, now), on,
  };
}

