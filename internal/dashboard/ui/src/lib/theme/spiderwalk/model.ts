// The spiders' world: its shapes, its tuning, and the small helpers every
// part of their behaviour shares.
//
// A floor is a horizontal line on the page a spider can stand on: the top edge
// of a card, the rule under a page heading. Floors are re-measured every frame
// in viewport coordinates, so a spider remembers WHICH floor it is on and how
// far along it, never where on screen: scrolling then carries it with its card
// instead of leaving it floating where the card used to be. Everything else a
// spider holds (a climb, a jump, a thread) is kept the same way, by floor id.
//
// Every change of action passes through walking: a spider lands and walks
// before it climbs, walks before it jumps, walks before it lets itself down.
// Each change plays a short tween, so the drawing never jumps.

// base is where the floor's element ends below it: a card's bottom edge, or
// for a heading rule the rule itself. Walls are found from it.
export type Floor = { left: number; right: number; y: number; base: number; walkable?: boolean };
export type Floors = ReadonlyMap<number, Floor>;
// The area the spiders live in. bottomWeb says whether the bottom-right corner
// web is drawn (it is hidden on narrow screens), so a spider can go home to it.
export type Frame = { width: number; height: number; bottomWeb: boolean };
export type Rand = () => number;
export type Dir = 1 | -1;

// Where a thread is tied: along a floor, or (floor null) at the top of the
// frame, x then being a frame x.
export type Tie = { floor: number | null; x: number };
// A dragline: the safety thread a spider leaves behind when it drops onto a
// floor, which it (or another spider) can climb back up later.
// Claimed silk is unavailable to other spiders; released counts seconds
// since its climber stepped off, so the used thread can settle and fade.
export type Line = { id: number; top: Tie; bottom: { floor: number; x: number }; age: number; claimed?: boolean; released?: number };

// The ways off a floor, named so the lab can ask for one.
export type Choice = 'drop' | 'jump' | 'wall' | 'web' | 'side' | 'leave' | 'line' | 'turn';

// pointer is where the pointer is while it is moving; a still one is absent,
// so a cursor resting on the page startles nothing.
export type Context = { floors: Floors; frame: Frame; dt: number; rand: Rand; prefer?: Choice; pointer?: { x: number; y: number } };

type Away = { kind: 'away'; left: number };
// hurry is how much longer a startled spider keeps up its dash.
export type Walk = { kind: 'walk'; floor: number; x: number; dir: Dir; left: number; goal: number | null; hurry?: number };
export type Rest = { kind: 'rest'; floor: number; x: number; dir: Dir; left: number };
// Hanging from a silk thread. `from` is the floor it let itself down from, or
// null for the top of the frame (how a spider arrives). x is along `from`, or
// a frame x when arriving from the top. `out` lowers it right out of the frame
// to leave, rather than to a floor or back up.
export type Dangle = {
  kind: 'dangle';
  from: number | null;
  x: number;
  dir: Dir;
  drop: number;
  to: number | null;
  reach: number;
  out: boolean;
  phase: 'down' | 'hang' | 'up';
  left: number;
  hurry?: number;
  // Seconds it has hung, which set where it is in its gentle swing.
  sway?: number;
};
// A vertical way up or down, kept as floor ids and rebuilt every frame:
//   line: up a dragline, from the floor it hangs to, to wherever it is tied;
//   wall: up the side of `to`, a taller card standing just beyond `from`;
//   side: over the end of `from` and down its own side, out of the frame or
//         into the bottom-right web;
//   web:  from the right end of `from` up the strands of the top-right web.
export type Route =
  | { via: 'line'; top: Tie; floor: number; x: number; lineId?: number }
  | { via: 'wall'; from: number; to: number; toward: Dir }
  | { via: 'side'; from: number; toward: Dir }
  | { via: 'web'; from: number };
// sway, as on a hanging spider: seconds on a dragline, setting its swing.
export type Climb = { kind: 'climb'; route: Route; along: number; dir: Dir; hurry?: number; sway?: number };
// A short animated change between two of the states above. It is measured
// back from wherever `next` is now, so it follows the page if it scrolls
// mid-way. `web` is a tween into nothing (into a corner web, then away): it
// holds an absolute start, as there is no next pose to measure from.
export type Tween = {
  name: 'grab' | 'settle' | 'pull-over' | 'turn-up' | 'turn-over' | 'leap' | 'into-web';
  dur: number;
  ease: 'out' | 'overshoot' | 'linear';
  dx: number;
  dy: number;
  rotate: number;
  drawing: 'walk' | 'hang';
  jump?: boolean;
  web?: { hold: Pose };
};
export type Act = { kind: 'act'; tween: Tween; t: number; next: Spider };
export type Spider = Away | Walk | Rest | Dangle | Climb | Act;

export type Pose = {
  drawing: 'walk' | 'hang';
  // The feet when walking, the tie point at the top of the body when hanging.
  x: number;
  y: number;
  dir: Dir;
  // Degrees about (x, y).
  rotate: number;
  moving: boolean;
  crouch: number;
  tuck: number;
  fade: number;
  // A thread drawn from here to (x, y), if the spider is on one.
  silk: { x: number; y: number } | null;
  // The complete dragline remains behind the spider as it climbs.
  dragline?: number;
};

// What a step did besides moving the spider: a dragline left behind, or one
// taken up.
export type Outcome = { spider: Spider; leave?: Omit<Line, 'id' | 'age'>; take?: number };

export const WALK_SPEED = 26;
// A pointer moving within this distance of a spider startles it: it dashes
// off at this many times its pace for about this long. Hanging, it reels
// itself back up instead; climbing, it hurries on.
export const STARTLE = 90;
const DASH = 2.4;
export const HURRY = 1.1;
export const DROP_SPEED = 90;
export const REEL_SPEED = 32;
export const CLIMB_SPEED = 24;
// A hanging spider's swing: degrees either side, and seconds per full swing.
export const SWAY = { degrees: 3.2, period: 6.8 };

export type Point = { x: number; y: number };

// Where a thread's swing has carried it, so many seconds in.
export const swayAngle = (seconds: number) => SWAY.degrees * Math.sin((2 * Math.PI * seconds) / SWAY.period);

// A point turned about a pivot, as a thread swinging from its tie carries
// whatever hangs on it.
export function swing(pivot: Point, point: Point, degrees: number): Point {
  const turn = (degrees * Math.PI) / 180;
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return { x: pivot.x + dx * Math.cos(turn) - dy * Math.sin(turn), y: pivot.y + dx * Math.sin(turn) + dy * Math.cos(turn) };
}
// How far from a floor's ends a spider turns or lets itself down, so it never
// stands on a card's rounded corner.
export const INSET = 14;
export const MIN_DROP = 60;
// A hanging spider hangs head-down below its thread, so it touches a floor
// this far before the end of its thread does.
export const BODY = 50;
export const MAX_HANG = 160;
// The band a floor must sit in to be worth arriving on or staying on.
const TOP_MARGIN = 70;
export const BOTTOM_MARGIN = 24;
const OFFSCREEN = 40;
// Across a gap no wider than this a spider can reach the side of the next card.
export const WALL_GAP = 26;
export const JUMP_GAP = { min: 6, max: 70 };
export const JUMP_RISE = 60;
export const JUMP_FALL = 40;
export const JUMP_ARC = 24;
// Turned upright on a wall or a thread, the drawing reaches this far below its
// feet; a climb up starts this high so none of it hangs below the floor.
export const UPRIGHT = 26;
// The corner webs' squares, as the layer draws them.
export const WEB = 170;
export const BOTTOM_WEB = 120;
export const topWebSize = (frame: Frame) => frame.width <= 760 ? WEB * 0.7 : WEB;
// Below the bottom of the frame, far enough that nothing of the spider shows.
export const BELOW = 70;
export const LINE_LIFE = 60;
export const LINE_FADE = 15;
export const MAX_LINES = 3;
export const USED_LINE_FADE = 6;

// How likely each way off a floor's end is, when it is there to be taken.
// Seeking a dragline is decided while walking, not at an end.
export const WEIGHTS: Record<Choice, number> = {
  drop: 0.3,
  jump: 0.25,
  wall: 0.3,
  web: 0.2,
  side: 0.12,
  leave: 0.06,
  line: 0,
  turn: 0.35,
};

export const between = (rand: Rand, lo: number, hi: number) => lo + rand() * (hi - lo);
export const coin = (rand: Rand): Dir => (rand() < 0.5 ? 1 : -1);
export const flip = (d: Dir): Dir => (d === 1 ? -1 : 1);
export const still = (spider: Spider): Outcome => ({ spider });
export const pace = (s: { hurry?: number }) => ((s.hurry ?? 0) > 0 ? DASH : 1);

export const away = (rand: Rand, lo = 3, hi = 9): Away => ({ kind: 'away', left: between(rand, lo, hi) });

// Arrival is choosy, so a spider lands somewhere it will be seen; staying is
// not, so scrolling a card off screen takes its spider with it rather than
// making it vanish mid-page.
export const welcoming = (f: Floor, frame: Frame) => f.walkable !== false && f.y >= TOP_MARGIN && f.y <= frame.height - BOTTOM_MARGIN;
export const inView = (f: Floor, frame: Frame) => f.y >= -OFFSCREEN && f.y <= frame.height + OFFSCREEN;

export const EASES = {
  linear: (p: number) => p,
  out: (p: number) => 1 - (1 - p) ** 3,
  // Past the end and back, so a landing has a little bounce to it.
  overshoot: (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2,
};
