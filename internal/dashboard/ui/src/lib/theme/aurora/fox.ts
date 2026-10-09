import { clearRuns, clearance, inView, type Ledge, type PageMap, type Run } from '../floors';
import type { Cursor, Point } from '../pointer';
import { between, maxBy, pick, type Rand } from '../seed';

// Arctic foxes asleep, each curled up on its own ledge or well apart on a
// shared one. A cursor passing makes an ear twitch; one that lingers close
// wakes that fox, and it stretches and trots off to sleep somewhere else,
// changing ledge only at a ledge's end, out of sight, while any others near
// it look up. Now and then, on its own, one wakes and pounces on something
// under the snow. Only one fox is ever up and about at a time, so they never
// cross. Everything is in ledge-local x, so a fox rides along with its card
// as the page scrolls. design-docs/aurora/README.md has the full state table.

// The space each pose takes, anchored at its bottom centre on the ledge:
// curled and alert are the art's display sizes (design-docs/aurora/export.py),
// the rest bound the fox as fox-rig.ts puts it together (its tests hold the
// drawing inside these).
export const POSES = {
  curled: { width: 20, height: 16.5 },
  alert: { width: 20, height: 18.5 },
  trot: { width: 31, height: 21 },
  bow: { width: 33, height: 20 },
  pounce: { width: 39, height: 24 },
} as const;
export type Pose = keyof typeof POSES;

// Wherever the fox lies or trots needs this much clear space above the ledge:
// the dashboard's gaps between cards are about 25px.
const CLEAR = 22;
// How the ledges are sampled for clear runs; a run reaching the first or
// last sample reaches its ledge's end.
const RUNS = { inset: 8, step: 4 };
// Somewhere to sleep is at least this long; somewhere to trot in to, longer.
const MIN_SPOT = 40;
const MIN_ENTRY = 90;
const MIN_MOVE = 60;

const EAR_REACH = 110;
const EAR = 450;
const EAR_REST = 1200;
// A cursor event this recent counts as the cursor passing.
const MOVING = 120;
const NEAR = 64;
const LINGER = 1500;
const WAKE = 500;
const STRETCH = 1100;
const SPEED = 40;
export const FADE = 14;
// Settling, it turns about twice.
const TURN = 300;
const SETTLE = 3 * TURN;
const CROUCH = 500;
const LEAP = 600;
const LEAP_LENGTH = 36;
const MAX_HOP = 12;
const MIN_HOP = 4;
const DIG = 900;
// Foxes on one ledge lie at least this far apart, centre to centre; one
// startled wakes those within LOOK_REACH on the page enough to look up.
const SPACING = 120;
const LOOK_REACH = 220;

export type Mode = 'asleep' | 'waking' | 'stretch' | 'trot' | 'exit' | 'away' | 'enter' | 'settle' | 'crouch' | 'leap' | 'dig';
// Where a fox changing ledge is going: the end of the ledge it trots in from,
// and where it will lie down.
export type Trip = { floor: number; entry: number; x: number };
export type Fox = {
  id: number;
  // Its own blinks and breaths, so no two foxes keep time.
  seed: number;
  // Distance trotted, which drives its steps.
  walked: number;
  // Looking up, roused by another fox or a cursor it may not run from yet,
  // until then.
  look: number;
  floor: number;
  x: number;
  dir: 1 | -1;
  mode: Mode;
  // When the current timed mode ends; asleep, when it wakes on its own.
  until: number;
  // Where a trot or a leap ends, and where a leap or an entry began.
  target: number;
  from: number;
  hop: number;
  trip: Trip | null;
  // The ear is up until ear, and cannot twitch again before earRest.
  ear: number;
  earRest: number;
  // Since when a cursor has been close, or null.
  near: number | null;
  // Whether this waking was the cursor's doing.
  startled: boolean;
};
const runs = (f: Ledge, scene: PageMap) => clearRuns(f, scene.obstacles, CLEAR, RUNS);
const length = (r: Run) => r.hi - r.lo;
const runAt = (f: Ledge, scene: PageMap, x: number) => runs(f, scene).find((r) => r.lo <= x && x <= r.hi) ?? null;
const clampTo = (r: Run, x: number) => Math.max(r.lo, Math.min(r.hi, x));
// Where it lies or trots, its whole body stays on the clear run, not just
// its middle: the part of the run its middle may use.
const HALF = POSES.trot.width / 2;
const body = (r: Run): Run => ({ lo: r.lo + HALF, hi: r.hi - HALF });
const within = (r: Run, x: number) => r.lo <= x && x <= r.hi;
const sign = (d: number): 1 | -1 => (d < 0 ? -1 : 1);
const flip = (d: 1 | -1): 1 | -1 => (d === 1 ? -1 : 1);
// The ends of a run that are also ends of its ledge, where the fox can come
// and go out of sight.
function ends(f: Ledge, r: Run): number[] {
  const first = r.lo < RUNS.inset + RUNS.step, last = r.hi > f.right - f.left - RUNS.inset - RUNS.step;
  return [...(first ? [r.lo] : []), ...(last ? [r.hi] : [])];
}
const pagePoint = (f: Ledge, x: number, lift = 0): Point => ({ x: f.left + x, y: f.y - lift });

// Who a fox is, kept across every change of place.
type Self = Pick<Fox, 'id' | 'seed' | 'walked'>;
const fresh = (id: number): Self => ({ id, seed: id + 1, walked: 0 });

function asleepAt(self: Self, floor: number, x: number, now: number, restless: number, dir: 1 | -1 = 1): Fox {
  return { ...self, look: 0, floor, x, dir, mode: 'asleep', until: now + restless, target: x, from: x, hop: 0, trip: null, ear: 0, earRest: 0, near: null, startled: false };
}

// Where the other foxes are, or are going: on the ledge they are on, where a
// trot or a leap will take them, and where a trip will bring them in.
type Claim = { floor: number; x: number };
const claims = (others: readonly Fox[]): Claim[] => others.flatMap((o) => [
  ...(o.mode === 'away' ? [] : [{ floor: o.floor, x: o.x }]),
  ...(o.mode === 'away' ? [] : [{ floor: o.floor, x: o.target }]),
  ...(o.trip ? [{ floor: o.trip.floor, x: o.trip.entry }, { floor: o.trip.floor, x: o.trip.x }] : []),
]);
// Whether the stretch from a to b, a fox's body included, keeps SPACING from
// every claim on that ledge.
const clearOf = (taken: readonly Claim[], floor: number, a: number, b: number) =>
  !taken.some((c) => c.floor === floor && c.x > Math.min(a, b) - SPACING && c.x < Math.max(a, b) + SPACING);

// A run with the stretches near other foxes taken out.
function freeOf(r: Run, cuts: readonly number[]): Run[] {
  return [...cuts].sort((a, b) => a - b).reduce<Run[]>((left, c) => left.flatMap((p) => [
    { lo: p.lo, hi: Math.min(p.hi, c - SPACING) },
    { lo: Math.max(p.lo, c + SPACING), hi: p.hi },
  ].filter((q) => q.hi >= q.lo)), [r]);
}

// Where a fox could lie: every clear run in view long enough, as the stretch
// its middle may use, away from the other foxes. Ledges with no fox on them
// come first, so foxes spread out.
function spots(scene: PageMap, taken: readonly Claim[]): { floor: number; room: Run }[] {
  const all = [...scene.floors].flatMap(([floor, f]) => {
    if (!inView(f, scene)) return [];
    const cuts = taken.filter((c) => c.floor === floor).map((c) => c.x);
    return runs(f, scene).filter((r) => length(r) >= MIN_SPOT).flatMap((r) => freeOf(body(r), cuts).map((room) => ({ floor, room })));
  });
  const empty = all.filter((s) => !taken.some((c) => c.floor === s.floor));
  return empty.length ? empty : all;
}

export function createFox(scene: PageMap, now: number, rand: Rand, others: readonly Fox[] = [], self: Self = fresh(0)): Fox | null {
  const spot = maxBy(spots(scene, claims(others)), (s) => length(s.room));
  if (!spot) return null;
  const x = between(rand, spot.room.lo, spot.room.hi);
  return asleepAt(self, spot.floor, x, now, between(rand, 20000, 40000), rand() < 0.5 ? -1 : 1);
}

// Reduced motion: asleep, and kept where it lay while that spot stays clear,
// so a scroll never moves it; otherwise in the middle of a free stretch.
export function restingFox(scene: PageMap, previous: Fox | null, others: readonly Fox[] = [], self: Self = previous ?? fresh(0)): Fox | null {
  const f = previous && scene.floors.get(previous.floor);
  const run = f && previous && runAt(f, scene, previous.x);
  const kept = previous && previous.mode !== 'away' && run && within(body(run), previous.x) && clearOf(claims(others), previous.floor, previous.x, previous.x);
  if (previous && kept) return asleepAt(self, previous.floor, previous.x, 0, Infinity, previous.dir);
  const spot = maxBy(spots(scene, claims(others)), (s) => length(s.room));
  return spot ? asleepAt(self, spot.floor, (spot.room.lo + spot.room.hi) / 2, 0, Infinity) : null;
}

// After a layout change. A fox out of sight keeps its trip (checked when it
// arrives). Otherwise it stays on its ledge, whatever it is doing, while the
// stretch under it is still clear and no other fox is too close, pulled back
// inside it if that shrank; if not, it is placed asleep somewhere new,
// without animation. Leaving, it only ever goes at a ledge's end: if that
// end is now covered, it trots to where the run stops instead and settles.
export function reconcileFox(fox: Fox, scene: PageMap, now: number, rand: Rand, others: readonly Fox[] = []): Fox | null {
  if (fox.mode === 'away') return fox;
  const f = scene.floors.get(fox.floor);
  const run = f && runAt(f, scene, clampTo({ lo: RUNS.inset, hi: f.right - f.left - RUNS.inset }, fox.x));
  const crowded = !clearOf(claims(others), fox.floor, fox.x, fox.x);
  if (!f || !run || length(run) < 2 * HALF || crowded) return createFox(scene, now, rand, others, fox);
  // Coming or going, it is at the run's end; otherwise all of it is on the run.
  const room = fox.mode === 'exit' || fox.mode === 'enter' ? run : body(run);
  const kept = { ...fox, x: clampTo(room, fox.x), target: clampTo(room, fox.target), from: clampTo(room, fox.from) };
  if (kept.mode !== 'exit' || ends(f, run).includes(kept.target)) return kept;
  return { ...kept, mode: 'trot', target: clampTo(body(run), kept.target), trip: null };
}

// Where the fox is drawn, or null while it is out of sight.
export type FoxView = Point & { pose: Pose; dir: 1 | -1; opacity: number };

// How far through its leap the fox is, 0 to 1.
export const leapt = (fox: Fox, now: number) => Math.max(0, Math.min(1, 1 - (fox.until - now) / LEAP));

// Leaving, it fades over the last FADE px before its ledge's end; entering,
// over the first FADE px from the other's.
function fade(fox: Fox): number {
  if (fox.mode === 'exit') return Math.min(1, Math.abs(fox.target - fox.x) / FADE);
  if (fox.mode === 'enter') return Math.min(1, Math.abs(fox.x - fox.from) / FADE);
  return 1;
}

export function foxView(fox: Fox, scene: PageMap, now: number): FoxView | null {
  const f = scene.floors.get(fox.floor);
  if (!f || fox.mode === 'away') return null;
  const t = leapt(fox, now);
  const lift = fox.mode === 'leap' ? 4 * fox.hop * t * (1 - t) : 0;
  // Settling, it turns about on the spot: a flip every TURN ms.
  const turns = fox.mode === 'settle' ? Math.floor(Math.max(0, now - (fox.until - SETTLE)) / TURN) : 0;
  return { ...pagePoint(f, fox.x, lift), pose: poseOf(fox, now), dir: turns % 2 ? flip(fox.dir) : fox.dir, opacity: fade(fox) };
}

function poseOf(fox: Fox, now: number): Pose {
  switch (fox.mode) {
    case 'asleep': return fox.ear > now || fox.look > now ? 'alert' : 'curled';
    case 'waking': return 'alert';
    case 'stretch': case 'crouch': return 'bow';
    case 'leap': case 'dig': return 'pounce';
    default: return 'trot';
  }
}

const centre = (fox: Fox, f: Ledge): Point => pagePoint(f, fox.x, POSES.curled.height / 2);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// How much clear space is left above a pose over the stretch from x0 to x1
// (its centre's travel); negative when it does not fit.
const spare = (f: Ledge, scene: PageMap, pose: Pose, x0: number, x1: number) => {
  const half = POSES[pose].width / 2;
  return clearance(f, scene.obstacles, Math.min(x0, x1) - half, Math.max(x0, x1) + half) - POSES[pose].height;
};

// A pounce needs the run ahead and room above for the arc; it prefers the
// way the fox already faces. Returns the leap, or null.
function pounce(fox: Fox, f: Ledge, scene: PageMap, taken: readonly Claim[]): { target: number; hop: number } | null {
  const run = runAt(f, scene, fox.x);
  if (!run) return null;
  const leaps = [fox.dir, -fox.dir].map((d) => fox.x + d * LEAP_LENGTH).filter((to) => within(body(run), to) && clearOf(taken, fox.floor, fox.x, to));
  // A pixel short of the space above, so the arc never touches what is there.
  const leap = leaps.map((target) => ({ target, hop: spare(f, scene, 'pounce', fox.x, target) - 1 })).find((l) => l.hop >= MIN_HOP);
  return leap ? { ...leap, hop: Math.min(MAX_HOP, leap.hop) } : null;
}

// Somewhere to go: another ledge in view it can trot in to, else further
// along its own run, away from the cursor when the cursor woke it; or
// nowhere, and it settles back down where it is. Never past another fox,
// nor to within SPACING of one.
function depart(fox: Fox, scene: PageMap, now: number, rand: Rand, cursor: Cursor | null, taken: readonly Claim[]): Fox {
  const f = scene.floors.get(fox.floor);
  const run = f && runAt(f, scene, fox.x);
  if (!f || !run) return settle(fox, now);
  const avoid = fox.startled ? cursor : null;
  // Farthest from the cursor that woke it, or any at random.
  const choose = <T>(items: readonly T[], away: (item: T, from: Point) => number) => {
    if (avoid) return maxBy(items, (item) => away(item, avoid));
    return items.length ? pick(rand, items) : undefined;
  };
  // Out by the end away from the cursor, or else the nearer one.
  const open = ends(f, run).filter((x) => clearOf(taken, fox.floor, fox.x, x));
  const exit = maxBy(open, (x) => (avoid ? dist(pagePoint(f, x), avoid) : -Math.abs(x - fox.x)));
  const way = exit === undefined ? undefined : choose(entries(fox, scene, rand, taken), (e, from) => dist(e.at, from));
  if (exit !== undefined && way) return { ...fox, mode: 'exit', target: exit, dir: sign(exit - fox.x), trip: way.trip };
  // Along its own run, stopping SPACING short of the nearest fox each way.
  const room = body(run);
  const blocks = taken.filter((c) => c.floor === fox.floor);
  const limit = (d: -1 | 1) => (d < 0
    ? Math.max(room.lo, ...blocks.filter((c) => c.x < fox.x).map((c) => c.x + SPACING))
    : Math.min(room.hi, ...blocks.filter((c) => c.x > fox.x).map((c) => c.x - SPACING)));
  const reachTo = (d: -1 | 1) => Math.abs(limit(d) - fox.x);
  const sides = ([-1, 1] as const).filter((d) => reachTo(d) >= MIN_MOVE);
  const side = choose(sides, (d, from) => Math.abs(f.left + fox.x + d * MIN_MOVE - from.x));
  if (!side) return settle(fox, now);
  return { ...fox, mode: 'trot', target: fox.x + side * between(rand, MIN_MOVE, reachTo(side)), dir: side };
}

// Every way onto another ledge in view: in at one of its ends (at, on the
// page), to lie down 30px or more inside.
function entries(fox: Fox, scene: PageMap, rand: Rand, taken: readonly Claim[]): { trip: Trip; at: Point }[] {
  return [...scene.floors].flatMap(([floor, g]) => {
    if (floor === fox.floor || !inView(g, scene)) return [];
    return runs(g, scene).filter((r) => length(r) >= MIN_ENTRY).flatMap((r) => ends(g, r).map((entry) => {
      const inward = entry === r.lo ? 1 : -1;
      return { trip: { floor, entry, x: entry + inward * between(rand, 30, length(r) - 16) }, at: pagePoint(g, entry) };
    })).filter((e) => clearOf(taken, floor, e.trip.entry, e.trip.x));
  });
}

const settle = (fox: Fox, now: number): Fox => ({ ...fox, mode: 'settle', until: now + SETTLE, trip: null });

function wake(fox: Fox, now: number, startled: boolean): Fox {
  return { ...fox, mode: 'waking', until: now + WAKE, startled, near: null, ear: 0 };
}

function walk(fox: Fox, dt: number): Fox {
  const step = SPEED * dt / 1000;
  const gap = fox.target - fox.x;
  const moved = Math.min(step, Math.abs(gap));
  return { ...fox, x: Math.abs(gap) > step ? fox.x + Math.sign(gap) * step : fox.target, walked: fox.walked + moved, dir: gap === 0 ? fox.dir : sign(gap) };
}

// Asleep, it still hears the cursor: how long it has been close, and whether
// it is passing near enough to twitch an ear.
function notice(fox: Fox, f: Ledge, now: number, cursor: Cursor | null): Fox {
  const away = cursor ? dist(cursor, centre(fox, f)) : Infinity;
  const near = away < NEAR ? fox.near ?? now : null;
  const passing = !!cursor && now - cursor.at < MOVING && away < EAR_REACH && now >= fox.earRest;
  return passing ? { ...fox, near, ear: now + EAR, earRest: now + EAR + EAR_REST } : { ...fox, near };
}

// Whether a fox is up and about: anything but asleep where it lies.
const up = (fox: Fox) => fox.mode !== 'asleep';

// One step of a fox's night, given the other foxes. dt is in milliseconds.
// While another is up, it sleeps on: a cursor lingering by it only makes it
// look up, and waking on its own waits a while.
export function stepFox(fox: Fox, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null, others: readonly Fox[] = []): Fox {
  const taken = claims(others);
  if (fox.mode === 'away') return now < fox.until ? fox : arrive(fox, scene, now, rand, others);
  const f = scene.floors.get(fox.floor);
  if (!f) return fox;
  switch (fox.mode) {
    case 'asleep': {
      const next = notice(fox, f, now, cursor);
      const busy = others.some(up);
      const lingered = next.near !== null && now - next.near >= LINGER;
      if (lingered) return busy ? { ...next, look: now + 300 } : wake(next, now, true);
      if (now < fox.until) return next;
      return busy ? { ...next, until: now + between(rand, 4000, 9000) } : wake(next, now, false);
    }
    case 'waking': {
      if (now < fox.until) return fox;
      if (fox.startled) return spare(f, scene, 'bow', fox.x, fox.x) >= 0 ? { ...fox, mode: 'stretch', until: now + STRETCH } : depart(fox, scene, now, rand, cursor, taken);
      const leap = pounce(fox, f, scene, taken);
      return leap ? { ...fox, mode: 'crouch', until: now + CROUCH, target: leap.target, hop: leap.hop, dir: sign(leap.target - fox.x) } : depart(fox, scene, now, rand, cursor, taken);
    }
    case 'stretch':
      return now < fox.until ? fox : depart(fox, scene, now, rand, cursor, taken);
    case 'crouch':
      return now < fox.until ? fox : { ...fox, mode: 'leap', from: fox.x, until: now + LEAP };
    case 'leap': {
      if (now >= fox.until) return { ...fox, x: fox.target, mode: 'dig', until: now + DIG };
      return { ...fox, x: fox.from + (fox.target - fox.from) * leapt(fox, now) };
    }
    case 'dig':
      return now < fox.until ? fox : settle(fox, now);
    case 'trot':
    case 'enter': {
      const moved = walk(fox, dt);
      return moved.x === fox.target ? settle(moved, now) : moved;
    }
    case 'exit': {
      const moved = walk(fox, dt);
      return moved.x === fox.target ? { ...moved, mode: 'away', until: now + between(rand, 1200, 2500) } : moved;
    }
    case 'settle':
      // Two turns about, so it lies down facing the way it came in.
      return now < fox.until ? fox : asleepAt(fox, fox.floor, fox.x, now, between(rand, 40000, 90000), fox.dir);
  }
}

// Out of sight, then in at the far ledge's end if that is still somewhere to
// go; if not, it turns up asleep somewhere else.
function arrive(fox: Fox, scene: PageMap, now: number, rand: Rand, others: readonly Fox[]): Fox {
  const trip = fox.trip;
  if (trip && stillOpen(trip, scene) && clearOf(claims(others), trip.floor, trip.entry, trip.x)) {
    return { ...fox, floor: trip.floor, x: trip.entry, from: trip.entry, target: trip.x, dir: sign(trip.x - trip.entry), mode: 'enter', trip: null };
  }
  return createFox(scene, now, rand, others, fox) ?? { ...fox, mode: 'away', until: now + 2000 };
}

// Whether a trip's way in is still there: its ledge in view, its entry still
// a clear end of that ledge, and the spot it was heading for in the same run.
function stillOpen(trip: Trip, scene: PageMap): boolean {
  const g = scene.floors.get(trip.floor);
  if (!g || !inView(g, scene)) return false;
  const run = runAt(g, scene, trip.entry);
  return !!run && ends(g, run).includes(trip.entry) && run.lo <= trip.x && trip.x <= run.hi;
}

// The foxes on the page: how many to keep (two, or three where the page had
// room for three when they were placed), and each one.
export type Foxes = { target: number; foxes: Fox[] };

// Placed one after another, each away from those before it.
function placeAll(count: number, place: (others: Fox[], id: number) => Fox | null, ids: readonly number[] = []): Fox[] {
  return Array.from({ length: count }, (_, i) => ids[i] ?? i).reduce<Fox[]>((placed, id) => {
    const fox = place(placed, id);
    return fox ? [...placed, fox] : placed;
  }, []);
}

export function createFoxes(scene: PageMap, now: number, rand: Rand): Foxes {
  const three = placeAll(3, (others, id) => createFox(scene, now, rand, others, fresh(id)));
  const target = three.length === 3 ? 3 : 2;
  return { target, foxes: three.slice(0, target) };
}

// Each kept where it can be, in id order so the same fox wins a crowded
// spot every time; then any missing placed afresh, up to the target and
// never beyond it, so scrolling never adds foxes.
function regroup(group: Foxes, keep: (fox: Fox, others: Fox[]) => Fox | null, place: (others: Fox[], id: number) => Fox | null): Foxes {
  const kept = group.foxes.reduce<Fox[]>((placed, fox) => {
    const next = keep(fox, placed);
    return next ? [...placed, next] : placed;
  }, []);
  const ids = Array.from({ length: group.target }, (_, i) => i).filter((id) => !kept.some((f) => f.id === id));
  const added = placeAll(group.target - kept.length, (others, id) => place([...kept, ...others], id), ids);
  return { ...group, foxes: [...kept, ...added].sort((a, b) => a.id - b.id) };
}

export function reconcileFoxes(group: Foxes, scene: PageMap, now: number, rand: Rand): Foxes {
  return regroup(group, (fox, others) => reconcileFox(fox, scene, now, rand, others), (others, id) => createFox(scene, now, rand, others, fresh(id)));
}

// Reduced motion: all asleep, each kept where it lay where it still can be.
export function restingFoxes(scene: PageMap, previous: Foxes | null): Foxes {
  const group = previous ?? { target: createFoxes(scene, 0, () => 0.5).target, foxes: [] };
  return regroup(group, (fox, others) => restingFox(scene, fox, others), (others, id) => restingFox(scene, null, others, fresh(id)));
}

// One step for all of them, each in turn seeing the others as they now are.
// One startled awake makes the others asleep within LOOK_REACH look up.
export function stepFoxes(group: Foxes, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Foxes {
  const foxes = group.foxes.reduce<Fox[]>((all, _, i) => {
    const fox = all[i];
    const next = stepFox(fox, scene, now, dt, rand, cursor, all.filter((_, j) => j !== i));
    const roused = fox.mode === 'asleep' && next.mode === 'waking' && next.startled;
    const at = roused ? foxPoint(next, scene) : null;
    return all.map((o, j) => {
      if (j === i) return next;
      const there = at && o.mode === 'asleep' ? foxPoint(o, scene) : null;
      return at && there && dist(at, there) <= LOOK_REACH ? { ...o, look: now + between(rand, 1200, 2000) } : o;
    });
  }, group.foxes);
  return { ...group, foxes };
}

const foxPoint = (fox: Fox, scene: PageMap): Point | null => {
  const f = scene.floors.get(fox.floor);
  return f ? pagePoint(f, fox.x) : null;
};
