// The spiders' behaviour, kept free of the DOM so it can be stepped in tests.
//
// A floor is a horizontal line on the page a spider can stand on: the top edge
// of a card, the rule under a page heading. Floors are re-measured every frame
// in viewport coordinates, so a spider remembers WHICH floor it is on and how
// far along it, never where on screen: scrolling then carries it with its card
// instead of leaving it floating where the card used to be.

export type Floor = { left: number; right: number; y: number };
export type Floors = ReadonlyMap<number, Floor>;
export type Viewport = { width: number; height: number };
export type Rand = () => number;
export type Dir = 1 | -1;

type Away = { kind: 'away'; left: number };
type Walk = { kind: 'walk'; floor: number; x: number; dir: Dir; left: number };
type Rest = { kind: 'rest'; floor: number; x: number; dir: Dir; left: number };
// Hanging from a silk thread. `from` is the floor it let itself down from, or
// null for the top of the screen (how a spider arrives). x is along `from`, or
// a viewport x when arriving from the top.
type Dangle = {
  kind: 'dangle';
  from: number | null;
  x: number;
  dir: Dir;
  drop: number;
  to: number | null;
  reach: number;
  phase: 'down' | 'hang' | 'up';
  left: number;
};
export type Spider = Away | Walk | Rest | Dangle;

export type Pose = {
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  hanging: boolean;
  // Where the thread is tied, when it is hanging from one.
  anchorY: number | null;
};

const WALK_SPEED = 26;
const DROP_SPEED = 90;
const CLIMB_SPEED = 32;
// How far from a floor's ends a spider turns or lets itself down, so it never
// stands on a card's rounded corner.
const INSET = 14;
const MIN_DROP = 60;
// A hanging spider hangs head-down below its thread, so it touches a floor
// this far before the end of its thread does.
const BODY = 50;
const MAX_HANG = 160;
// The band a floor must sit in to be worth arriving on or staying on.
const TOP_MARGIN = 70;
const BOTTOM_MARGIN = 24;
const OFFSCREEN = 40;

const between = (rand: Rand, lo: number, hi: number) => lo + rand() * (hi - lo);
const coin = (rand: Rand): Dir => (rand() < 0.5 ? 1 : -1);
const flip = (d: Dir): Dir => (d === 1 ? -1 : 1);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const away = (rand: Rand, lo = 3, hi = 9): Away => ({ kind: 'away', left: between(rand, lo, hi) });

// Arrival is choosy, so a spider lands somewhere it will be seen; staying is
// not, so scrolling a card off screen takes its spider with it rather than
// making it vanish mid-page.
const welcoming = (f: Floor, vp: Viewport) => f.y >= TOP_MARGIN && f.y <= vp.height - BOTTOM_MARGIN;
const inView = (f: Floor, vp: Viewport) => f.y >= -OFFSCREEN && f.y <= vp.height + OFFSCREEN;

// The nearest floor under viewport x, below y, that a spider could land on.
function floorBelow(floors: Floors, vp: Viewport, x: number, y: number): number | null {
  const below = [...floors]
    .filter(([, f]) => f.y > y + MIN_DROP && f.y <= vp.height - BOTTOM_MARGIN)
    .filter(([, f]) => x >= f.left + INSET && x <= f.right - INSET)
    .sort(([, a], [, b]) => a.y - b.y);
  return below[0]?.[0] ?? null;
}

// Let down a thread from where the spider stands. With no floor below to land
// on, it lowers a way, hangs, and climbs back; with no room for even that, it
// stays put.
function letDown(floors: Floors, vp: Viewport, s: Walk, f: Floor): Dangle | null {
  const ax = f.left + s.x;
  const to = floorBelow(floors, vp, ax, f.y);
  const reach = to === null ? Math.min(MAX_HANG, vp.height - BOTTOM_MARGIN - f.y) : Infinity;
  if (reach < MIN_DROP) return null;
  return { kind: 'dangle', from: s.floor, x: s.x, dir: s.dir, drop: 0, to, reach, phase: 'down', left: 0 };
}

function arrive(floors: Floors, vp: Viewport, rand: Rand): Spider {
  const candidates = [...floors].filter(([, f]) => welcoming(f, vp) && f.right - f.left >= INSET * 6);
  if (candidates.length === 0) return away(rand, 2, 4);
  const [id, f] = candidates[Math.floor(rand() * candidates.length)];
  const x = between(rand, f.left + INSET * 2, f.right - INSET * 2);
  return { kind: 'dangle', from: null, x, dir: coin(rand), drop: 0, to: id, reach: Infinity, phase: 'down', left: 0 };
}

function walk(s: Walk, floors: Floors, vp: Viewport, dt: number, rand: Rand): Spider {
  const f = floors.get(s.floor);
  if (!f || !inView(f, vp)) return away(rand);
  const width = f.right - f.left;
  const x = s.x + s.dir * WALK_SPEED * dt;
  const atEnd = x <= INSET || x >= width - INSET;
  const here: Walk = { ...s, x: clamp(x, INSET, width - INSET), left: s.left - dt };
  if (atEnd) {
    const down = rand() < 0.45 ? letDown(floors, vp, here, f) : null;
    return down ?? { kind: 'rest', floor: s.floor, x: here.x, dir: flip(s.dir), left: between(rand, 0.4, 1.6) };
  }
  if (here.left > 0) return here;
  const down = rand() < 0.2 ? letDown(floors, vp, here, f) : null;
  return down ?? { kind: 'rest', floor: s.floor, x: here.x, dir: s.dir, left: between(rand, 0.6, 2.8) };
}

// Mostly carry on the way it was facing; never straight back into the end of
// the floor it just turned around at.
function setOff(s: Rest, f: Floor, rand: Rand): Dir {
  if (s.x <= INSET + 1) return 1;
  if (s.x >= f.right - f.left - INSET - 1) return -1;
  if (rand() < 0.7) return s.dir;
  return flip(s.dir);
}

function rest(s: Rest, floors: Floors, vp: Viewport, dt: number, rand: Rand): Spider {
  const f = floors.get(s.floor);
  if (!f || !inView(f, vp)) return away(rand);
  if (s.left - dt > 0) return { ...s, left: s.left - dt };
  return { kind: 'walk', floor: s.floor, x: s.x, dir: setOff(s, f, rand), left: between(rand, 1.5, 6) };
}

function anchor(s: Dangle, floors: Floors): { x: number; y: number } | null {
  if (s.from === null) return { x: s.x, y: 0 };
  const f = floors.get(s.from);
  return f ? { x: f.left + s.x, y: f.y } : null;
}

function land(id: number, f: Floor, x: number, rand: Rand): Walk {
  return { kind: 'walk', floor: id, x: clamp(x - f.left, INSET, f.right - f.left - INSET), dir: coin(rand), left: between(rand, 1, 4) };
}

function dangle(s: Dangle, floors: Floors, vp: Viewport, dt: number, rand: Rand): Spider {
  const a = anchor(s, floors);
  if (!a) return away(rand);
  switch (s.phase) {
    case 'down': {
      const drop = s.drop + DROP_SPEED * dt;
      if (s.to !== null) {
        const target = floors.get(s.to);
        if (!target) return { ...s, drop, phase: 'up' };
        if (a.y + drop + BODY >= target.y) return land(s.to, target, a.x, rand);
      }
      if (drop >= s.reach || a.y + drop > vp.height) return { ...s, drop, phase: 'hang', left: between(rand, 1.5, 4.5) };
      return { ...s, drop };
    }
    case 'hang':
      return s.left - dt > 0 ? { ...s, left: s.left - dt } : { ...s, phase: 'up' };
    case 'up': {
      const drop = s.drop - CLIMB_SPEED * dt;
      if (drop > 0) return { ...s, drop };
      if (s.from === null) return away(rand);
      return { kind: 'rest', floor: s.from, x: s.x, dir: flip(s.dir), left: between(rand, 0.5, 1.5) };
    }
  }
}

export function step(s: Spider, floors: Floors, vp: Viewport, dt: number, rand: Rand): Spider {
  switch (s.kind) {
    case 'away':
      return s.left - dt > 0 ? { ...s, left: s.left - dt } : arrive(floors, vp, rand);
    case 'walk':
      return walk(s, floors, vp, dt, rand);
    case 'rest':
      return rest(s, floors, vp, dt, rand);
    case 'dangle':
      return dangle(s, floors, vp, dt, rand);
  }
}

export function pose(s: Spider, floors: Floors): Pose | null {
  if (s.kind === 'away') return null;
  if (s.kind === 'dangle') {
    const a = anchor(s, floors);
    if (!a) return null;
    return { x: a.x, y: a.y + s.drop, dir: s.dir, moving: s.phase !== 'hang', hanging: true, anchorY: a.y };
  }
  const f = floors.get(s.floor);
  if (!f) return null;
  return { x: f.left + s.x, y: f.y, dir: s.dir, moving: s.kind === 'walk', hanging: false, anchorY: null };
}
