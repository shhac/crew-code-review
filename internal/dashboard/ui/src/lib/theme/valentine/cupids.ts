import { around, inAir, sweeps, type Air } from '../air';
import { fromLedge, progress, toLedge } from '../anchored';
import { arcFrom, heading, lengthOf, quadratic, samples, type Arc } from '../curves';
import { inView, type Box, type Ledge, type Obstacle, type PageMap } from '../floors';
import { inTurn, placeIds, regroup, troupeSize } from '../group';
import { apart, degrees } from '../math';
import type { Cursor, Point } from '../pointer';
import type { Rand } from '../seed';
import { land, landable, prune, reconcileStuck, slantOf, burstsLeft, type Burst, type Stuck } from './arrows';
import { bowRaised, createCupid, cupidView, dodge, DASH, fresh, LOOSE, reconcileCupid, restingCupid, shooting, stepCupid, TURN, where, type Cupid } from './cupid';
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
// The group with one cupid changed.
const withCupid = (group: Cupids, id: number, change: (c: Cupid) => Cupid): Cupids => ({ ...group, cupids: group.cupids.map((c) => (c.id === id ? change(c) : c)) });
const lowerBow = (c: Cupid): Cupid => ({ ...c, mode: 'hover', target: null });

// Placed one after another, each away from those before it.
export function createCupids(air: Air, now: number, rand: Rand): Cupids {
  const three = placeIds<Cupid>([0, 1, 2], (others, id) => createCupid(air, now, rand, others, fresh(id), ROOMY));
  const target = troupeSize(three);
  const cupids = target === 3 ? three : placeIds<Cupid>([0, 1], (others, id) => createCupid(air, now, rand, others, fresh(id)));
  return empty(target, cupids);
}

// After a layout change: each cupid re-checked (cupid.ts) in id order, so
// the same one keeps a crowded spot, seeing only those settled before it;
// an arrow in the air dropped if its way or its landing no longer holds,
// spent arrows kept while their ledge and its clear stretch are there.
export function reconcileCupids(group: Cupids, air: Air, now: number, rand: Rand): Cupids {
  const cupids = regroup(group.cupids, group.target, (c, settled) => reconcileCupid(c, air, now, rand, settled), (others, id) => createCupid(air, now, rand, others, fresh(id), undefined, 'enter'));
  const f = group.flying;
  const flying = f && arrowStillClear(f, air, cupids, now) ? f : null;
  return { ...group, cupids, flying, stuck: reconcileStuck(group.stuck, air.page.floors, air.page.obstacles) };
}

// Reduced motion: each hovering still, kept where it was where it can be.
// Nothing shoots.
export function restingCupids(air: Air, previous: Cupids | null): Cupids {
  const group = previous ?? empty(createCupids(air, 0, () => 0.5).target, []);
  const cupids = regroup(group.cupids, group.target, (c, others) => restingCupid(air, c, others, c), (others, id) => restingCupid(air, null, others, fresh(id)));
  return { ...group, cupids, flying: null, stuck: [], bursts: [] };
}

// An arrow's arc on the page now, or null with its ledge gone.
export const arrowArc = (page: PageMap, f: Flying): Arc | null => fromLedge(page, f.floor, f.arc);

// Where an arrow's tip is, and the way it points (degrees, page), now.
export function arrowAt(page: PageMap, f: Flying, now: number): (Point & { angle: number }) | null {
  const arc = arrowArc(page, f);
  if (!arc) return null;
  const t = progress(f, now);
  const h = heading(arc, t);
  return { ...quadratic(arc, t), angle: degrees(Math.atan2(h.y, h.x)) };
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
  if (apart(from, to) > RANGE) return null;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const span = Math.abs(to.x - from.x);
  for (const k of RISES) {
    const arc = { from, via: { x: mid.x, y: Math.min(from.y, to.y) - k * span - 6 }, to };
    const h = heading(arc, 0);
    const aim = degrees(Math.atan2(h.y, h.x * dir));
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
  }).sort((a, b) => apart({ x: a.f.left + a.x, y: a.f.y }, cursor) - apart({ x: b.f.left + b.x, y: b.f.y }, cursor)).slice(0, NEAREST);
}

// A cursor still for a second, not yet shot at: the hovering cupid with a
// clear shot at the landing nearest the cursor turns to draw on it.
function startShot(group: Cupids, air: Air, now: number, cursor: Cursor): Cupids {
  const marked = { ...group, shotAt: cursor.at };
  const ready = group.cupids.filter((c) => c.mode === 'hover' && !c.flight && now >= c.calm);
  for (const landing of landings(air, cursor)) {
    const shots = ready.flatMap((c) => {
      const at = where(c, air.page, now);
      if (!at || !inAir(air.view, at)) return [];
      const shot = shotTo(air, at, landing.f, landing.x, shieldOf(air, group.cupids.filter((o) => o.id !== c.id), now));
      return shot ? [{ c, at, shot }] : [];
    }).sort((a, b) => apart(a.at, cursor) - apart(b.at, cursor));
    const best = shots[0];
    if (!best) continue;
    const target = { floor: landing.floor, x: landing.x, aim: best.shot.aim };
    const turned = withCupid(marked, best.c.id, (c) => ({ ...c, mode: 'turn', until: now + TURN, dir: best.shot.dir, target }));
    return { ...turned, stillAt: { x: cursor.x, y: cursor.y } };
  }
  return marked;
}

// Whether an arrow in the air may fly on: its ledge there and in reach, its
// way from where it is still clear, and its landing still room for it.
function arrowStillClear(f: Flying, air: Air, cupids: readonly Cupid[], now: number): boolean {
  const g = air.page.floors.get(f.floor);
  const arc = arrowArc(air.page, f);
  if (!g || !arc || !landable(g, air.page.obstacles, arc.to.x - g.left)) return false;
  return clearArc(air, arcFrom(arc, progress(f, now)), g, shieldOf(air, cupids.filter((c) => c.id !== f.by), now));
}

// The shooter's bow at the end of its aim: loosed along its arc if that is
// still clear from where it is now, else lowered.
function loose(group: Cupids, air: Air, c: Cupid, now: number, rand: Rand): Cupids {
  const lowered = withCupid(group, c.id, lowerBow);
  const target = c.target;
  const at = where(c, air.page, now);
  const g = target && air.page.floors.get(target.floor);
  if (!target || !at || !g) return lowered;
  const shot = shotTo(air, at, g, target.x, shieldOf(air, group.cupids.filter((x) => x.id !== c.id), now));
  const held = shot && toLedge(air.page, target.floor, shot.arc);
  if (!shot || !held || shot.dir !== c.dir) return lowered;
  const length = lengthOf((t) => quadratic(shot.arc, t));
  const flying: Flying = { key: `${c.id}:${group.count}`, by: c.id, floor: target.floor, arc: held, start: now, duration: Math.max(MIN_ARROW, (length / ARROW_SPEED) * 1000), seed: Math.floor(rand() * 1000) };
  const loosed = withCupid(group, c.id, (x) => ({ ...x, mode: 'loose', until: now + LOOSE, target: { ...target, aim: shot.aim } }));
  return { ...loosed, flying, lastShot: now, count: group.count + 1 };
}

// One step for all of them, each in turn seeing the others as they now are;
// then the shot: a drawn bow lowered if the cursor moved, loosed at the end
// of its aim; the arrow in the air flown on and landed; a new shot begun if
// the cursor is still.
export function stepCupids(group: Cupids, air: Air, now: number, dt: number, rand: Rand, cursor: Cursor | null): Cupids {
  const point = cursor && { x: cursor.x, y: cursor.y };
  const stepped = { ...group, cupids: inTurn(group.cupids, (c, others) => stepCupid(c, air, now, dt, rand, point, others)) };
  const lowered = movedOff(group, cursor) ? { ...stepped, cupids: stepped.cupids.map((c) => (bowRaised(c) ? lowerBow(c) : c)) } : stepped;
  const loosed = looseAimed(lowered, air, now, rand);
  const landed = flyOn(loosed, air, now);
  return shootIfStill(landed, air, now, cursor);
}

// Whether the cursor has gone, or moved off where it was still when a bow
// was drawn at it.
const movedOff = (group: Cupids, cursor: Cursor | null) => !cursor || (group.stillAt !== null && apart(group.stillAt, cursor) >= MOVED);

// The bow at the end of its aim, if any, loosed.
function looseAimed(group: Cupids, air: Air, now: number, rand: Rand): Cupids {
  const aimed = group.cupids.find((c) => c.mode === 'aim' && now >= c.until);
  return aimed ? loose(group, air, aimed, now, rand) : group;
}

// A new shot begun at a cursor still long enough, not yet shot at, with
// nothing in the air or being shot and the last shot cooled; otherwise,
// once no bow is busy, where the cursor was still is forgotten.
function shootIfStill(group: Cupids, air: Air, now: number, cursor: Cursor | null): Cupids {
  const busy = group.flying || group.cupids.some(shooting);
  const ready = cursor && !busy && now - cursor.at >= STILL && cursor.at !== group.shotAt && now - group.lastShot >= COOLDOWN;
  if (ready) return startShot({ ...group, stillAt: null }, air, now, cursor);
  return { ...group, stillAt: group.cupids.some(shooting) ? group.stillAt : null };
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
  return { ...group, cupids: inTurn(group.cupids, (c, others) => dodge(c, air, now, from, to, others)) };
}

// What is drawn for each cupid, in id order.
export const views = (group: Cupids, page: PageMap, now: number) => group.cupids.flatMap((c) => {
  const view = cupidView(c, page, now);
  return view ? [{ c, view }] : [];
});
