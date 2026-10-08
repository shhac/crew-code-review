import { clearRuns, clearance, type Ledge, type PageMap, type Run } from '../floors';
import type { Point } from '../pointer';
import { between, type Rand } from '../seed';

// An Arctic fox asleep, curled up on a ledge. A cursor passing makes its ear
// twitch; one that lingers close wakes it, and it stretches and trots off to
// sleep somewhere else, changing ledge only at a ledge's end, out of sight.
// Now and then, on its own, it wakes and pounces on something under the snow.
// Everything is in ledge-local x, so the fox rides along with its card as the
// page scrolls. design-docs/aurora/README.md has the full state table.

// The poses' display sizes (design-docs/aurora/export.py), each anchored at
// its bottom centre on the ledge.
export const POSES = {
  curled: { width: 20, height: 16.5 },
  alert: { width: 20, height: 18.5 },
  trot: { width: 32, height: 19 },
  bow: { width: 26.5, height: 23.5 },
  pounce: { width: 25, height: 30 },
} as const;
export type Pose = keyof typeof POSES;

// Wherever the fox lies or trots needs this much clear space above the ledge:
// the dashboard's gaps between cards are about 25px.
const CLEAR = 22;
const INSET = 8;
const TOP_MARGIN = 70;
const BOTTOM_MARGIN = 30;
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

export type Mode = 'asleep' | 'waking' | 'stretch' | 'trot' | 'exit' | 'away' | 'enter' | 'settle' | 'crouch' | 'leap' | 'dig';
// Where a fox changing ledge is going: the end of the ledge it trots in from,
// and where it will lie down.
export type Trip = { floor: number; entry: number; x: number };
export type Fox = {
  floor: number;
  x: number;
  dir: 1 | -1;
  mode: Mode;
  // When the current timed mode ends.
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
  // When it wakes on its own, and whether this waking was the cursor's doing.
  restless: number;
  startled: boolean;
};
// The last place the cursor moved to, and when.
export type Cursor = Point & { at: number };

const inView = (f: Ledge, scene: PageMap) => f.y >= TOP_MARGIN && f.y <= scene.height - BOTTOM_MARGIN && f.left >= 0 && f.right <= scene.width;
const runs = (f: Ledge, scene: PageMap) => clearRuns(f, scene.obstacles, CLEAR, { inset: INSET });
const length = (r: Run) => r.hi - r.lo;
const runAt = (f: Ledge, scene: PageMap, x: number) => runs(f, scene).find((r) => r.lo <= x && x <= r.hi) ?? null;
const clampTo = (r: Run, x: number) => Math.max(r.lo, Math.min(r.hi, x));
const sign = (d: number): 1 | -1 => (d < 0 ? -1 : 1);
const flip = (d: 1 | -1): 1 | -1 => (d === 1 ? -1 : 1);
// The ends of a run that are also ends of its ledge, where the fox can come
// and go out of sight.
function ends(f: Ledge, r: Run): number[] {
  const step = 4;
  return [r.lo < INSET + step ? [r.lo] : [], r.hi > f.right - f.left - INSET - step ? [r.hi] : []].flat();
}
const pagePoint = (f: Ledge, x: number, lift = 0): Point => ({ x: f.left + x, y: f.y - lift });

function asleepAt(floor: number, x: number, now: number, restless: number, dir: 1 | -1 = 1): Fox {
  return { floor, x, dir, mode: 'asleep', until: Infinity, target: x, from: x, hop: 0, trip: null, ear: 0, earRest: 0, near: null, restless: now + restless, startled: false };
}

// The longest clear run on a ledge in view.
function bestSpot(scene: PageMap): { floor: number; run: Run } | null {
  const spots = [...scene.floors].flatMap(([floor, f]) => (inView(f, scene) ? runs(f, scene).map((run) => ({ floor, run })) : []));
  return spots.filter((s) => length(s.run) >= MIN_SPOT).reduce<{ floor: number; run: Run } | null>((best, s) => (!best || length(s.run) > length(best.run) ? s : best), null);
}

export function createFox(scene: PageMap, now: number, rand: Rand): Fox | null {
  const spot = bestSpot(scene);
  if (!spot) return null;
  const x = between(rand, spot.run.lo + 16, spot.run.hi - 16);
  return asleepAt(spot.floor, x, now, between(rand, 20000, 40000), rand() < 0.5 ? -1 : 1);
}

// Reduced motion: asleep, and kept where it lay while that spot stays clear,
// so a scroll never moves it.
export function restingFox(scene: PageMap, previous: Fox | null): Fox | null {
  const f = previous && scene.floors.get(previous.floor);
  if (previous && previous.mode !== 'away' && f && runAt(f, scene, previous.x)) return asleepAt(previous.floor, previous.x, 0, Infinity, previous.dir);
  const spot = bestSpot(scene);
  return spot && asleepAt(spot.floor, (spot.run.lo + spot.run.hi) / 2, 0, Infinity);
}

// After a layout change. A fox out of sight keeps its trip (checked when it
// arrives). Otherwise it stays on its ledge, whatever it is doing, while the
// stretch under it is still clear, pulled back inside it if that shrank; if
// not, it is placed asleep somewhere new, without animation.
export function reconcileFox(fox: Fox, scene: PageMap, now: number, rand: Rand): Fox | null {
  if (fox.mode === 'away') return fox;
  const f = scene.floors.get(fox.floor);
  const run = f && runAt(f, scene, clampTo({ lo: INSET, hi: f.right - f.left - INSET }, fox.x));
  if (!run) return createFox(scene, now, rand);
  return { ...fox, x: clampTo(run, fox.x), target: clampTo(run, fox.target), from: clampTo(run, fox.from) };
}

// Where the fox is drawn, or null while it is out of sight.
export type FoxView = Point & { pose: Pose; dir: 1 | -1; opacity: number };

export function foxView(fox: Fox, scene: PageMap, now: number): FoxView | null {
  const f = scene.floors.get(fox.floor);
  if (!f || fox.mode === 'away') return null;
  const t = Math.max(0, Math.min(1, 1 - (fox.until - now) / LEAP));
  const lift = fox.mode === 'leap' ? 4 * fox.hop * t * (1 - t) : 0;
  // Settling, it turns about on the spot: a flip every TURN ms.
  const turns = fox.mode === 'settle' ? Math.floor(Math.max(0, now - (fox.until - SETTLE)) / TURN) : 0;
  const opacity = fox.mode === 'exit' ? Math.abs(fox.target - fox.x) / FADE : fox.mode === 'enter' ? Math.abs(fox.x - fox.from) / FADE : 1;
  return { ...pagePoint(f, fox.x, lift), pose: poseOf(fox, now), dir: turns % 2 ? flip(fox.dir) : fox.dir, opacity: Math.min(1, opacity) };
}

function poseOf(fox: Fox, now: number): Pose {
  switch (fox.mode) {
    case 'asleep': return fox.ear > now ? 'alert' : 'curled';
    case 'waking': return 'alert';
    case 'stretch': case 'crouch': return 'bow';
    case 'leap': case 'dig': return 'pounce';
    default: return 'trot';
  }
}

const centre = (fox: Fox, f: Ledge): Point => pagePoint(f, fox.x, POSES.curled.height / 2);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Whether a pose fits over the stretch from x0 to x1 (its centre's travel).
const fits = (f: Ledge, scene: PageMap, pose: Pose, x0: number, x1: number, extra = 0) => {
  const half = POSES[pose].width / 2;
  return clearance(f, scene.obstacles, Math.min(x0, x1) - half, Math.max(x0, x1) + half) >= POSES[pose].height + extra;
};

// A pounce needs the run ahead and room above for the arc; it prefers the
// way the fox already faces. Returns the leap, or null.
function pounce(fox: Fox, f: Ledge, scene: PageMap): { target: number; hop: number } | null {
  const run = runAt(f, scene, fox.x);
  if (!run) return null;
  const leaps = [fox.dir, -fox.dir].map((d) => fox.x + d * LEAP_LENGTH).filter((to) => to >= run.lo && to <= run.hi);
  const half = POSES.pounce.width / 2;
  const target = leaps.find((to) => fits(f, scene, 'pounce', fox.x, to, MIN_HOP + 1));
  if (target === undefined) return null;
  const room = clearance(f, scene.obstacles, Math.min(fox.x, target) - half, Math.max(fox.x, target) + half);
  return { target, hop: Math.min(MAX_HOP, room - POSES.pounce.height - 1) };
}

// Somewhere to go: another ledge in view it can trot in to, else further
// along its own run, away from the cursor when the cursor woke it; or
// nowhere, and it settles back down where it is.
function depart(fox: Fox, scene: PageMap, now: number, rand: Rand, cursor: Cursor | null): Fox {
  const f = scene.floors.get(fox.floor);
  const run = f && runAt(f, scene, fox.x);
  if (!f || !run) return settle(fox, now);
  const avoid = fox.startled ? cursor : null;
  const trips = [...scene.floors].flatMap(([floor, g]) => {
    if (floor === fox.floor || !inView(g, scene)) return [];
    return runs(g, scene).filter((r) => length(r) >= MIN_ENTRY).flatMap((r) => ends(g, r).map((entry) => {
      const inward = entry === r.lo ? 1 : -1;
      return { floor, entry, x: entry + inward * between(rand, 30, length(r) - 16), at: pagePoint(g, entry) };
    }));
  });
  const exits = ends(f, run);
  if (trips.length && exits.length) {
    const trip = avoid ? trips.reduce((a, b) => (dist(b.at, avoid) > dist(a.at, avoid) ? b : a)) : trips[Math.floor(between(rand, 0, trips.length - 0.001))];
    const away = (x: number) => (avoid ? dist(pagePoint(f, x), avoid) : -Math.abs(x - fox.x));
    const exit = exits.reduce((a, b) => (away(b) > away(a) ? b : a));
    return { ...fox, mode: 'exit', target: exit, dir: sign(exit - fox.x), trip: { floor: trip.floor, entry: trip.entry, x: trip.x } };
  }
  const sides = ([-1, 1] as const).filter((d) => (d < 0 ? fox.x - run.lo : run.hi - fox.x) >= MIN_MOVE);
  if (!sides.length) return settle(fox, now);
  const side = avoid ? sides.reduce((a, b) => (Math.abs(f.left + fox.x + b * MIN_MOVE - avoid.x) > Math.abs(f.left + fox.x + a * MIN_MOVE - avoid.x) ? b : a)) : sides[Math.floor(between(rand, 0, sides.length - 0.001))];
  const reach = side < 0 ? fox.x - run.lo : run.hi - fox.x;
  const target = fox.x + side * between(rand, MIN_MOVE, reach);
  return { ...fox, mode: 'trot', target, dir: side };
}

const settle = (fox: Fox, now: number): Fox => ({ ...fox, mode: 'settle', until: now + SETTLE, trip: null });

function wake(fox: Fox, now: number, startled: boolean): Fox {
  return { ...fox, mode: 'waking', until: now + WAKE, startled, near: null, ear: 0 };
}

function walk(fox: Fox, dt: number): Fox {
  const step = SPEED * dt / 1000;
  const gap = fox.target - fox.x;
  return { ...fox, x: Math.abs(gap) > step ? fox.x + Math.sign(gap) * step : fox.target, dir: gap === 0 ? fox.dir : sign(gap) };
}

// One step of the fox's night. dt is in milliseconds.
export function stepFox(fox: Fox, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Fox {
  if (fox.mode === 'away') return now < fox.until ? fox : arrive(fox, scene, now, rand);
  const f = scene.floors.get(fox.floor);
  if (!f) return fox;
  switch (fox.mode) {
    case 'asleep': {
      const at = centre(fox, f);
      const close = !!cursor && dist(cursor, at) < NEAR;
      const near = close ? fox.near ?? now : null;
      const passing = !!cursor && now - cursor.at < MOVING && dist(cursor, at) < EAR_REACH && now >= fox.earRest;
      const next = passing ? { ...fox, near, ear: now + EAR, earRest: now + EAR + EAR_REST } : { ...fox, near };
      if (near !== null && now - near >= LINGER) return wake(next, now, true);
      return now >= fox.restless ? wake(next, now, false) : next;
    }
    case 'waking': {
      if (now < fox.until) return fox;
      if (fox.startled) return fits(f, scene, 'bow', fox.x, fox.x) ? { ...fox, mode: 'stretch', until: now + STRETCH } : depart(fox, scene, now, rand, cursor);
      const leap = pounce(fox, f, scene);
      return leap ? { ...fox, mode: 'crouch', until: now + CROUCH, target: leap.target, hop: leap.hop, dir: sign(leap.target - fox.x) } : depart(fox, scene, now, rand, cursor);
    }
    case 'stretch':
      return now < fox.until ? fox : depart(fox, scene, now, rand, cursor);
    case 'crouch':
      return now < fox.until ? fox : { ...fox, mode: 'leap', from: fox.x, until: now + LEAP };
    case 'leap': {
      if (now >= fox.until) return { ...fox, x: fox.target, mode: 'dig', until: now + DIG };
      const t = 1 - (fox.until - now) / LEAP;
      return { ...fox, x: fox.from + (fox.target - fox.from) * t };
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
      return now < fox.until ? fox : asleepAt(fox.floor, fox.x, now, between(rand, 40000, 90000), fox.dir);
  }
}

// Out of sight, then in at the far ledge's end if that is still somewhere to
// go; if not, it turns up asleep somewhere else.
function arrive(fox: Fox, scene: PageMap, now: number, rand: Rand): Fox {
  const trip = fox.trip;
  const g = trip && scene.floors.get(trip.floor);
  const run = g && trip && runAt(g, scene, trip.entry);
  if (trip && g && run && inView(g, scene) && ends(g, run).includes(trip.entry) && run.lo <= trip.x && trip.x <= run.hi) {
    return { ...fox, floor: trip.floor, x: trip.entry, from: trip.entry, target: trip.x, dir: sign(trip.x - trip.entry), mode: 'enter', trip: null };
  }
  return createFox(scene, now, rand) ?? { ...fox, mode: 'away', until: now + 2000 };
}
