import { around, meets } from '../air';
import type { Box, Ledge, PageMap, Reach } from '../floors';
import { inView } from '../floors';
import { between, type Rand } from '../seed';
import { durationOf, envelopeAt, escape, flying, lengthOfTrack, trackOf, type Route, type Sky, type Track } from './flight';
import { ENVELOPES, grounded, POSES, type Pigeon } from './pigeon';

// Every minute or two a single Harris's hawk sweeps low along the row of
// ledges the pigeons stand on, from one exit to the other, gliding. The
// pigeons on that row see it coming and fly away ahead of it, out of the
// window; it never lands and never catches anything. A sweep is planned
// whole before the hawk appears: every bird's reaction simulated frame by
// frame, every envelope in air and apart from every other, or no sweep.
// design-docs/wimbledon/README.md ("The hawk's sweep").

// Its glide's envelope over the whole glide (wings level, a 1px rise and
// fall, the tail), anchored at its belly line; the note's budget until the
// rig measures it.
export const GLIDE: Reach = { half: 23, up: 14, down: 0 };
// It glides this far above the row's ledges, at SPEED px/s, rising and
// falling BOB px over each BOB_MS.
export const ABOVE = 4;
export const SPEED = 360;
export const BOB = 1;
export const BOB_MS = 800;
// First 30 to 60s after the pigeons settle, then 70 to 140s apart; when no
// sweep can be planned, it tries again 10s later.
export const FIRST = [30000, 60000] as const;
export const AGAIN = [70000, 140000] as const;
export const RETRY = 10000;
// The pigeons on its row go 0.15s after it appears, 0.1s apart, the one
// farthest from it first; those on other rows that can keep clear of it
// follow 0.3 to 0.6s later.
export const FIRST_OFF = 150;
export const OFF_APART = 100;
export const FOLLOW = [300, 600] as const;
// They come back 5 to 10s after it has gone, one at a time 1.5 to 3s apart.
export const RETURN = [5000, 10000] as const;
export const RETURN_APART = [1500, 3000] as const;
// No two birds come nearer than this.
export const GAP = 6;
// Frames the sweep is simulated at.
const FRAME = 1000 / 60;

// Ledges side by side whose tops are within 2px of each other, none
// overlapping another, named by the leftmost.
export type Row = { id: number; floors: readonly number[]; y: number };
const SAME_ROW = 2;
export function rowsOf(page: PageMap): Row[] {
  const ledges = [...page.floors].sort(([, a], [, b]) => a.left - b.left);
  const rows = ledges.reduce<{ ids: number[]; members: Ledge[] }[]>((acc, [id, f]) => {
    const home = acc.find((r) => Math.abs(r.members[0].y - f.y) <= SAME_ROW && r.members.every((m) => m.right <= f.left || f.right <= m.left));
    if (!home) return [...acc, { ids: [id], members: [f] }];
    return acc.map((r) => (r === home ? { ids: [...r.ids, id], members: [...r.members, f] } : r));
  }, []);
  return rows.map((r) => ({ id: r.ids[0], floors: r.ids, y: Math.min(...r.members.map((m) => m.y)) }));
}
export const rowOf = (rows: readonly Row[], floor: number) => rows.find((r) => r.floors.includes(floor));

// A sweep: along the row (its leftmost ledge's local space), from `from`
// to `to` with its belly line `y` above the ledge, going dir, starting at
// start; the pigeons' take-offs and routes, those that only look up, and
// when each comes back.
export type Takeoff = { id: number; at: number; route: Route; track: Track };
export type Plan = {
  row: number; y: number; dir: 1 | -1; start: number; from: number; to: number; end: number;
  takeoffs: readonly Takeoff[]; alerts: readonly number[]; returns: readonly { id: number; at: number }[];
};

// Where its belly line is across the page from the rail's edge (the
// window's left with no rail column) to past the window's right edge,
// row-local.
function span(row: Ledge, sky: Sky): { from: number; to: number } {
  const left = sky.exits.left ?? 0;
  return { from: left - GLIDE.half - 1 - row.left, to: sky.exits.right + GLIDE.half + 1 - row.left };
}

// Whether the glide's envelope swept along the lane at ABOVE over the row
// stays in air from one exit to the other.
export function laneClear(row: Ledge, sky: Sky): boolean {
  const { from, to } = span(row, sky);
  const steps = Math.ceil((to - from) / 4);
  const box = (x: number): Box => glideBox(row, -ABOVE, x);
  return Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps).every((x, i, xs) => sky.clear(i ? join(box(xs[i - 1]), box(x)) : box(x)));
}
// The glide's box with its belly line `y` above the row's ledge and its
// middle at x (row-local), its rise and fall included.
const glideBox = (row: Ledge, y: number, x: number): Box => ({ left: row.left + x - GLIDE.half, right: row.left + x + GLIDE.half, top: row.y + y - GLIDE.up - BOB, bottom: row.y + y + BOB });
const join = (a: Box, b: Box): Box => ({ left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) });

// The hawk's belly point at now (row-local), or null outside its sweep.
export function hawkAt(plan: Plan, now: number): { x: number; y: number } | null {
  const ms = now - plan.start;
  const x = plan.from + (plan.dir * SPEED * ms) / 1000;
  if (ms < 0 || (plan.dir > 0 ? x > plan.to : x < plan.to)) return null;
  return { x, y: plan.y - BOB * Math.sin((2 * Math.PI * ms) / BOB_MS) };
}
// When it is wholly past the far exit.
const endOf = (from: number, to: number, start: number) => start + (1000 * Math.abs(to - from)) / SPEED;

const feetOf = (p: Pigeon, page: PageMap) => {
  const f = page.floors.get(p.floor);
  return f ? { x: f.left + p.x, y: f.y } : null;
};

// Every box drawn at now: the hawk's and each pigeon's, standing (alert) or
// along its flight, on the page; none for a bird out past its exit.
type Drawn = { id: number; box: Box };
function drawnAt(plan: Plan, pigeons: readonly Pigeon[], page: PageMap, now: number): Drawn[] | null {
  const row = page.floors.get(plan.row);
  if (!row) return null;
  const hawk = hawkAt(plan, now);
  const hawkBox = hawk && glideBox(row, plan.y, hawk.x);
  const birds = pigeons.flatMap((p): Drawn[] => {
    const off = plan.takeoffs.find((t) => t.id === p.id);
    const feet = feetOf(p, page);
    if (!feet) return [];
    if (!off || now < off.at) return [{ id: p.id, box: around(feet, { half: POSES.alert.width / 2, up: POSES.alert.height, down: 0 }) }];
    const f = page.floors.get(off.route.floor);
    const where = flying(off.track, now - off.at, false);
    if (!f || where.done) return [];
    const env = envelopeAt(ENVELOPES, where.s, lengthOfTrack(off.track), false);
    return [{ id: p.id, box: around({ x: f.left + where.at.x, y: f.y + where.at.y }, env) }];
  });
  return hawkBox ? [{ id: -1, box: hawkBox }, ...birds] : birds;
}

const grown = (b: Box, by: number): Box => ({ left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by });
const visible = (b: Box, page: PageMap) => b.right > 0 && b.left < page.width && b.bottom > 0 && b.top < page.height;

// The whole sweep, frame by frame from start to the last bird out: every
// box in air (or past an exit), and no two visible birds within GAP. Each
// frame's boxes are joined to the last's, so nothing between frames is
// missed.
export function simulate(plan: Plan, pigeons: readonly Pigeon[], page: PageMap, sky: Sky, from = plan.start): boolean {
  const last = Math.max(plan.end, ...plan.takeoffs.map((t) => t.at + durationOf(t.track, false)));
  const frames = Math.ceil((last - from) / FRAME);
  const all = Array.from({ length: frames + 1 }, (_, i) => drawnAt(plan, pigeons, page, from + i * FRAME));
  if (all.some((d) => d === null)) return false;
  return all.every((now, i) => {
    const before = i ? all[i - 1] ?? [] : [];
    const swept = (now ?? []).map((d) => {
      const prev = before.find((b) => b.id === d.id);
      return { id: d.id, box: prev ? join(prev.box, d.box) : d.box };
    });
    if (!swept.every((d) => sky.clear(d.box))) return false;
    const seen = swept.filter((d) => visible(d.box, page));
    return seen.every((a, j) => seen.slice(j + 1).every((b) => !meets(grown(a.box, GAP), b.box)));
  });
}

// A sweep along this row going dir, starting at start, with every pigeon's
// reaction; null when a pigeon on the row has no way out ahead of it, or
// the simulation finds any box out of air or two birds too close.
export function planOn(row: Row, dir: 1 | -1, pigeons: readonly Pigeon[], page: PageMap, sky: Sky, start: number, rand: Rand): Plan | null {
  const first = page.floors.get(row.id);
  if (!first || !laneClear(first, sky)) return null;
  const { from: lo, to: hi } = span(first, sky);
  const [from, to] = dir > 0 ? [lo, hi] : [hi, lo];
  const appears = start + (1000 * (2 * GLIDE.half + 1)) / SPEED;
  const way = dir > 0 ? 'right' : 'left';
  const onRow = pigeons.filter((p) => row.floors.includes(p.floor));
  // Farthest from where it comes in first: the one with the clearest way out.
  const entry = first.left + from;
  const order = [...onRow].sort((a, b) => Math.abs(pageX(b, page) - entry) - Math.abs(pageX(a, page) - entry));
  const routes = order.map((p) => ({ p, route: escapeOf(p, page, way, sky) }));
  if (routes.some((r) => !r.route)) return null;
  const ahead = routes.map(({ p, route }, k): Takeoff => ({ id: p.id, at: appears + FIRST_OFF + OFF_APART * k, route: route!, track: trackOf(route!) }));
  const follow = appears + FIRST_OFF + OFF_APART * ahead.length + between(rand, FOLLOW[0], FOLLOW[1]);
  const others = pigeons.filter((p) => !row.floors.includes(p.floor));
  const plan = (takeoffs: Takeoff[], alerts: number[]): Plan => {
    const end = endOf(from, to, start);
    const outOrder = takeoffs.map((t) => t.id);
    const returns = outOrder.reduce<{ id: number; at: number }[]>((acc, id) => [...acc, { id, at: acc.length ? acc[acc.length - 1].at + between(rand, RETURN_APART[0], RETURN_APART[1]) : end + between(rand, RETURN[0], RETURN[1]) }], []);
    return { row: row.id, y: -ABOVE, dir, start, from, to, end, takeoffs, alerts, returns };
  };
  // Those on other rows follow where their way out keeps clear of the
  // sweep; the rest look up until it has passed.
  const chosen = others.reduce<{ takeoffs: Takeoff[]; alerts: number[] }>((acc, p) => {
    const route = escapeOf(p, page, way, sky);
    const tried = route && { id: p.id, at: follow, route, track: trackOf(route) };
    if (tried && simulate(plan([...ahead, ...acc.takeoffs, tried], acc.alerts), pigeons, page, sky)) return { ...acc, takeoffs: [...acc.takeoffs, tried] };
    return { ...acc, alerts: [...acc.alerts, p.id] };
  }, { takeoffs: [], alerts: [] });
  const whole = plan([...ahead, ...chosen.takeoffs], chosen.alerts);
  return simulate(whole, pigeons, page, sky) ? whole : null;
}

const pageX = (p: Pigeon, page: PageMap) => (page.floors.get(p.floor)?.left ?? 0) + p.x;
function escapeOf(p: Pigeon, page: PageMap, way: 'left' | 'right', sky: Sky): Route | null {
  const f = page.floors.get(p.floor);
  return f ? escape(p.floor, f, p.x, way, ENVELOPES, sky) : null;
}

// A sweep now, if one can be planned: over a row with a pigeon on it in
// view and a lane at ABOVE; entering from the side farther from the
// nearest pigeon on the row, so they get the longest warning, and from the
// other side if that fails. Every pigeon must be on the ground.
export function planSweep(pigeons: readonly Pigeon[], page: PageMap, sky: Sky, now: number, rand: Rand): Plan | null {
  if (!pigeons.length || !pigeons.every(grounded)) return null;
  const rows = rowsOf(page);
  const watched = rows.filter((r) => pigeons.some((p) => r.floors.includes(p.floor) && inView(page.floors.get(p.floor)!, page)));
  return watched.reduce<Plan | null>((found, row) => {
    if (found) return found;
    const first = page.floors.get(row.id)!;
    const { from, to } = span(first, sky);
    const xs = pigeons.filter((p) => row.floors.includes(p.floor)).map((p) => pageX(p, page));
    const nearLeft = Math.min(...xs.map((x) => x - (first.left + from)));
    const nearRight = Math.min(...xs.map((x) => first.left + to - x));
    const dirs: (1 | -1)[] = nearLeft >= nearRight ? [1, -1] : [-1, 1];
    return dirs.reduce<Plan | null>((p, dir) => p ?? planOn(row, dir, pigeons, page, sky, now, rand), null);
  }, null);
}

// The hawk between sweeps and during one.
export type Hawk = { next: number; plan: Plan | null };
export const createHawk = (now: number, rand: Rand): Hawk => ({ next: now + between(rand, FIRST[0], FIRST[1]), plan: null });

// A frame on: its sweep ends once it is past the far exit; when its time
// comes it plans one if the page is calm (no ball in play, no bird in the
// air or away), or tries again shortly.
export function stepHawk(h: Hawk, pigeons: readonly Pigeon[], page: PageMap, sky: Sky, now: number, rand: Rand, calm: boolean): Hawk {
  if (h.plan) return now < h.plan.end ? h : { next: now + between(rand, AGAIN[0], AGAIN[1]), plan: null };
  if (now < h.next) return h;
  const plan = calm ? planSweep(pigeons, page, sky, now, rand) : null;
  return plan ? { next: Infinity, plan } : { next: now + RETRY, plan: null };
}

// After the page changes mid-sweep: the rest of it simulated again; if any
// of it is no longer clear the hawk is gone at once (and the flock sends
// its pigeons on or away by their own routes).
export function hawkRemeasured(h: Hawk, pigeons: readonly Pigeon[], page: PageMap, sky: Sky, now: number, rand: Rand): Hawk {
  if (!h.plan || simulate(h.plan, pigeons, page, sky, now)) return h;
  return { next: now + between(rand, AGAIN[0], AGAIN[1]), plan: null };
}

// What the hawk shows at now, on the page: its belly point and facing.
export function hawkView(h: Hawk, page: PageMap, now: number): { x: number; y: number; dir: 1 | -1 } | null {
  const plan = h.plan;
  const row = plan && page.floors.get(plan.row);
  const at = plan && hawkAt(plan, now);
  return plan && row && at ? { x: row.left + at.x, y: row.y + at.y, dir: plan.dir } : null;
}
