import { inView, type Ledge, type Obstacle, type PageMap } from '../floors';
import { inTurn, placeInTurn } from '../group';
import type { Cursor, Point } from '../pointer';
import type { Rand } from '../seed';
import { heading, lengthOf, quadratic, samples, type Arc } from '../curves';
import { around, distance, sweeps, type Air, type Box } from './air';
import { land, landable, prune, reconcileStuck, slantOf, burstsLeft, type Burst, type Stuck } from './arrows';
import { createCupid, cupidView, dodge, DASH, fresh, LOOSE, reconcileCupid, restingCupid, shooting, stepCupid, TURN, where, type Cupid } from './cupid';
import { FOOTPRINTS } from './footprints';

// The cupids on the page together, and their arrows: how many to keep, the
// rules that keep them apart, and the shot, which the group decides since
// only one may draw at a time and the page has one cursor to aim near.

// An arrow in the air, held relative to the ledge it will land in.
export type Flying = { key: string; by: number; floor: number; arc: Arc; start: number; duration: number; seed: number };
export type Cupids = {
  // How many to keep: two, or three where the page had room when they were
  // placed.
  target: number;
  cupids: Cupid[];
  flying: Flying | null;
  stuck: Stuck[];
  bursts: Burst[];
  // When the last arrow was loosed, and the cursor's moment (its `at`)
  // already shot at, so a still cursor draws one shot, not one every 3s.
  lastShot: number;
  shotAt: number;
  // Where the cursor was still when a cupid began to draw at it.
  stillAt: Point | null;
  count: number;
};

const ROOMY = 120;
// The cursor counts as still after this long unmoved; a move this far from
// where it was still lowers a drawn bow.
const STILL = 1000;
const MOVED = 24;
const COOLDOWN = 3000;
const ARROW_SPEED = 420;
const MIN_ARROW = 300;
const RANGE = 420;
// The arrow's box: its length either way round its tip, and a margin.
const ARROW_LENGTH = 12;
const ARROW_MARGIN = 2;
// Aims a cupid can draw, degrees below straight ahead.
const AIMS = { lo: -35, hi: 75 };
// Where an arrow leaves the bow, from the cupid's anchor facing right.
const LAUNCH = { x: 12, y: -6 };
const NEAREST = 24;
const RISES = [0.25, 0.4, 0.12, 0.6];

const empty = (target: number, cupids: Cupid[]): Cupids => ({ target, cupids, flying: null, stuck: [], bursts: [], lastShot: -Infinity, shotAt: -Infinity, stillAt: null, count: 0 });

// Placed one after another, each away from those before it.
const placeAll = (ids: readonly number[], place: (others: Cupid[], id: number) => Cupid | null) => placeInTurn<number, Cupid>(ids, (id, placed) => place(placed, id));

export function createCupids(air: Air, now: number, rand: Rand): Cupids {
  const three = placeAll([0, 1, 2], (others, id) => createCupid(air, now, rand, others, fresh(id), ROOMY));
  const target = three.length === 3 ? 3 : 2;
  const cupids = target === 3 ? three : placeAll([0, 1], (others, id) => createCupid(air, now, rand, others, fresh(id)));
  return empty(target, cupids);
}

// Each kept where it can be, in id order, so the same cupid keeps a crowded
// spot; any missing placed afresh, up to the target and never beyond it.
function regroup(group: Cupids, keep: (c: Cupid, settled: Cupid[]) => Cupid | null, place: (others: Cupid[], id: number) => Cupid | null): Cupids {
  const kept = placeInTurn<Cupid, Cupid>(group.cupids, (c, settled) => keep(c, settled));
  const missing = Array.from({ length: group.target }, (_, id) => id).filter((id) => !kept.some((c) => c.id === id));
  const added = placeAll(missing, (others, id) => place([...kept, ...others], id));
  return { ...group, cupids: [...kept, ...added].sort((a, b) => a.id - b.id) };
}

// After a layout change: each cupid re-checked (cupid.ts), an arrow in the
// air dropped if its way or its landing no longer holds, spent arrows kept
// while their ledge and its clear stretch are there.
export function reconcileCupids(group: Cupids, air: Air, now: number, rand: Rand): Cupids {
  const regrouped = regroup(group, (c, settled) => reconcileCupid(c, air, now, rand, settled), (others, id) => createCupid(air, now, rand, others, fresh(id), undefined, 'enter'));
  const f = group.flying;
  const flying = f && arrowStillClear(f, air, regrouped.cupids, now) ? f : null;
  return { ...regrouped, flying, stuck: reconcileStuck(group.stuck, air.page.floors, air.page.obstacles) };
}

// Reduced motion: each hovering still, kept where it was where it can be.
// Nothing shoots.
export function restingCupids(air: Air, previous: Cupids | null): Cupids {
  const group = previous ?? empty(createCupids(air, 0, () => 0.5).target, []);
  const settled = regroup(group, (c, others) => restingCupid(air, c, others, c), (others, id) => restingCupid(air, null, others, fresh(id)));
  return { ...settled, flying: null, stuck: [], bursts: [] };
}

const origin = (page: PageMap, floor: number): Point | null => {
  const f = page.floors.get(floor);
  return f ? { x: f.left, y: f.y } : null;
};
const shiftArc = (a: Arc, by: Point): Arc => ({ from: { x: a.from.x + by.x, y: a.from.y + by.y }, via: { x: a.via.x + by.x, y: a.via.y + by.y }, to: { x: a.to.x + by.x, y: a.to.y + by.y } });

// An arrow's arc on the page now, or null with its ledge gone.
export function arrowArc(page: PageMap, f: Flying): Arc | null {
  const o = origin(page, f.floor);
  return o && shiftArc(f.arc, o);
}

// Where an arrow's tip is, and the way it points (degrees, page), now.
export function arrowAt(page: PageMap, f: Flying, now: number): (Point & { angle: number }) | null {
  const arc = arrowArc(page, f);
  if (!arc) return null;
  const t = Math.max(0, Math.min(1, (now - f.start) / f.duration));
  const h = heading(arc, t);
  return { ...quadratic(arc, t), angle: (Math.atan2(h.y, h.x) * 180) / Math.PI };
}

// The box an arrow takes with its tip at p, pointing along h: the shaft
// behind the tip, and a margin.
function arrowBox(p: Point, h: Point): Box {
  const length = Math.hypot(h.x, h.y) || 1;
  const tail = { x: p.x - (h.x / length) * ARROW_LENGTH, y: p.y - (h.y / length) * ARROW_LENGTH };
  return { left: Math.min(p.x, tail.x) - ARROW_MARGIN, right: Math.max(p.x, tail.x) + ARROW_MARGIN, top: Math.min(p.y, tail.y) - ARROW_MARGIN, bottom: Math.max(p.y, tail.y) + ARROW_MARGIN };
}

// Whether an arc is clear for an arrow landing in ledge f: its box swept
// along it stays in air, never within 20px of a cupid but the shooter, and
// it comes down to the ledge from above. The card whose top is the ledge is
// the one obstacle it may touch, and only with its tip.
function clearArc(air: Pick<Air, 'page' | 'room'>, arc: Arc, f: Ledge, cupids: readonly Box[]): boolean {
  const points = samples((t) => quadratic(arc, t));
  const own = (o: Obstacle) => !!o.block && Math.abs(o.top - f.y) <= 1 && o.left <= arc.to.x && arc.to.x <= o.right;
  const across = points.filter(({ p }) => p.x >= f.left && p.x <= f.right);
  if (across.some(({ p }) => p.y > f.y + 0.5)) return false;
  // The tip ends on the ledge line, so its last stretch meets the ledge's
  // own card, which is left out.
  return sweeps(air, points.map(({ t, p }) => arrowBox(p, heading(arc, t))), cupids, own);
}

// The other cupids, kept 20px clear of by an arrow.
const shieldOf = (air: Air, others: readonly Cupid[], now: number): Box[] => others.flatMap((o) => {
  const p = where(o, air.page, now);
  if (!p) return [];
  const b = around(p, FOOTPRINTS.hover);
  return [{ left: b.left - 20, right: b.right + 20, top: b.top - 20, bottom: b.bottom + 20 }];
});

// Where an arrow leaves a cupid's bow, facing dir.
const launchOf = (at: Point, dir: 1 | -1): Point => ({ x: at.x + dir * LAUNCH.x, y: at.y + LAUNCH.y });

// A shot from a cupid at `at` to a landing point on ledge f: the first arc,
// tried at a few heights, that is clear and that it can aim along.
function shotTo(air: Air, at: Point, f: Ledge, x: number, shield: readonly Box[]): { arc: Arc; aim: number; dir: 1 | -1 } | null {
  const to = { x: f.left + x, y: f.y };
  const dir: 1 | -1 = to.x >= at.x ? 1 : -1;
  const from = launchOf(at, dir);
  if (distance(from, to) > RANGE) return null;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const span = Math.abs(to.x - from.x);
  for (const k of RISES) {
    const arc = { from, via: { x: mid.x, y: Math.min(from.y, to.y) - k * span - 6 }, to };
    const h = heading(arc, 0);
    const aim = (Math.atan2(h.y, h.x * dir) * 180) / Math.PI;
    if (aim < AIMS.lo || aim > AIMS.hi) continue;
    if (clearArc(air, arc, f, shield)) return { arc, aim, dir };
  }
  return null;
}

// Landing points on ledges in view, every 8px where an arrow and its
// hearts fit, nearest the cursor first.
function landings(air: Air, cursor: Point): { floor: number; f: Ledge; x: number }[] {
  return [...air.page.floors].flatMap(([floor, f]) => {
    if (!inView(f, air.page)) return [];
    const xs = Array.from({ length: Math.max(0, Math.floor((f.right - f.left - 32) / 8) + 1) }, (_, i) => 16 + i * 8);
    return xs.filter((x) => landable(f, air.page.obstacles, x)).map((x) => ({ floor, f, x }));
  }).sort((a, b) => distance({ x: a.f.left + a.x, y: a.f.y }, cursor) - distance({ x: b.f.left + b.x, y: b.f.y }, cursor)).slice(0, NEAREST);
}

const visible = (air: Air, p: Point) => p.x >= air.view.left && p.x <= air.view.right && p.y >= air.view.top && p.y <= air.view.bottom;

// A cursor still for a second, not yet shot at: the hovering cupid with a
// clear shot at the landing nearest the cursor turns to draw on it.
function startShot(group: Cupids, air: Air, now: number, cursor: Cursor): Cupids {
  const marked = { ...group, shotAt: cursor.at };
  const ready = group.cupids.filter((c) => c.mode === 'hover' && !c.flight && now >= c.calm);
  for (const landing of landings(air, cursor)) {
    const shots = ready.flatMap((c) => {
      const at = where(c, air.page, now);
      if (!at || !visible(air, at)) return [];
      const shot = shotTo(air, at, landing.f, landing.x, shieldOf(air, group.cupids.filter((o) => o.id !== c.id), now));
      return shot ? [{ c, at, shot }] : [];
    }).sort((a, b) => distance(a.at, cursor) - distance(b.at, cursor));
    const best = shots[0];
    if (!best) continue;
    const target = { floor: landing.floor, x: landing.x, aim: best.shot.aim };
    const cupids = group.cupids.map((c) => (c.id === best.c.id ? { ...c, mode: 'turn' as const, until: now + TURN, dir: best.shot.dir, target } : c));
    return { ...marked, cupids, stillAt: { x: cursor.x, y: cursor.y } };
  }
  return marked;
}

// Whether an arrow in the air may fly on: its ledge there and in reach, its
// way from where it is still clear, and its landing still room for it.
function arrowStillClear(f: Flying, air: Air, cupids: readonly Cupid[], now: number): boolean {
  const g = air.page.floors.get(f.floor);
  const arc = arrowArc(air.page, f);
  if (!g || !arc || !landable(g, air.page.obstacles, arc.to.x - g.left)) return false;
  // The way still to go is the arc from t on: by de Casteljau, from the
  // point at t, its control a t of the way from the old one to the end.
  const t = Math.max(0, Math.min(1, (now - f.start) / f.duration));
  const via = { x: arc.via.x + (arc.to.x - arc.via.x) * t, y: arc.via.y + (arc.to.y - arc.via.y) * t };
  return clearArc(air, { from: quadratic(arc, t), via, to: arc.to }, g, shieldOf(air, cupids.filter((c) => c.id !== f.by), now));
}

// The shooter's bow at the end of its aim: loosed along its arc if that is
// still clear from where it is now, else lowered.
function loose(group: Cupids, air: Air, c: Cupid, now: number, rand: Rand): Cupids {
  const lowered = { ...group, cupids: group.cupids.map((o) => (o.id === c.id ? { ...o, mode: 'hover' as const, target: null } : o)) };
  const target = c.target;
  const at = where(c, air.page, now);
  const g = target && air.page.floors.get(target.floor);
  const o = target && origin(air.page, target.floor);
  if (!target || !at || !g || !o) return lowered;
  const shot = shotTo(air, at, g, target.x, shieldOf(air, group.cupids.filter((x) => x.id !== c.id), now));
  if (!shot || shot.dir !== c.dir) return lowered;
  const length = lengthOf((t) => quadratic(shot.arc, t));
  const flying: Flying = { key: `${c.id}:${group.count}`, by: c.id, floor: target.floor, arc: shiftArc(shot.arc, { x: -o.x, y: -o.y }), start: now, duration: Math.max(MIN_ARROW, (length / ARROW_SPEED) * 1000), seed: Math.floor(rand() * 1000) };
  const cupids = group.cupids.map((x) => (x.id === c.id ? { ...x, mode: 'loose' as const, until: now + LOOSE, target: { ...target, aim: shot.aim } } : x));
  return { ...group, cupids, flying, lastShot: now, count: group.count + 1 };
}

// One step for all of them, each in turn seeing the others as they now are;
// then the shot: a drawn bow lowered if the cursor moved, loosed at the end
// of its aim; the arrow in the air flown on and landed; a new shot begun if
// the cursor is still.
export function stepCupids(group: Cupids, air: Air, now: number, dt: number, rand: Rand, cursor: Cursor | null): Cupids {
  const point = cursor && { x: cursor.x, y: cursor.y };
  const stepped = { ...group, cupids: inTurn(group.cupids, (c, others) => stepCupid(c, air, now, dt, rand, point, others), (_, __, other) => other) };
  const moved = !cursor || (group.stillAt !== null && distance(group.stillAt, cursor) >= MOVED);
  const lowered = moved
    ? { ...stepped, cupids: stepped.cupids.map((c) => (c.mode === 'turn' || c.mode === 'draw' || c.mode === 'aim' ? { ...c, mode: 'hover' as const, target: null } : c)) }
    : stepped;
  const aimed = lowered.cupids.find((c) => c.mode === 'aim' && now >= c.until);
  const loosed = aimed ? loose(lowered, air, aimed, now, rand) : lowered;
  const landed = flyOn(loosed, air, now);
  const busy = landed.flying || landed.cupids.some(shooting);
  const ready = cursor && !busy && now - cursor.at >= STILL && cursor.at !== landed.shotAt && now - landed.lastShot >= COOLDOWN;
  return ready ? startShot({ ...landed, stillAt: null }, air, now, cursor) : { ...landed, stillAt: landed.cupids.some(shooting) ? landed.stillAt : null };
}

// The arrow flown on; landed, it sticks in its ledge and pops into hearts.
function flyOn(group: Cupids, air: Air, now: number): Cupids {
  const tidy = { ...group, stuck: prune(group.stuck, now), bursts: burstsLeft(group.bursts, now) };
  const f = group.flying;
  if (!f || now < f.start + f.duration) return tidy;
  const arc = arrowArc(air.page, f);
  const g = air.page.floors.get(f.floor);
  if (!arc || !g) return { ...tidy, flying: null };
  const h = heading(arc, 1);
  const x = arc.to.x - g.left;
  const stuck = land(tidy.stuck, { key: f.key, floor: f.floor, x, slant: slantOf(h.x, h.y), at: now, fading: Infinity }, now);
  return { ...tidy, flying: null, stuck, bursts: [...tidy.bursts, { key: f.key, floor: f.floor, x, at: now, seed: f.seed }] };
}

// A cursor stroke: moving fast enough, any cupid it passes close to dodges.
export function dash(group: Cupids, air: Air, now: number, from: Point, to: Point, speed: number): Cupids {
  if (speed < DASH) return group;
  return { ...group, cupids: inTurn(group.cupids, (c, others) => dodge(c, air, now, from, to, others), (_, __, other) => other) };
}

// What is drawn for each cupid, in id order.
export const views = (group: Cupids, page: PageMap, now: number) => group.cupids.flatMap((c) => {
  const view = cupidView(c, page, now);
  return view ? [{ c, view }] : [];
});
