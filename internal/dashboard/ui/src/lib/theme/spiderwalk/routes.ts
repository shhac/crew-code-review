import { BELOW, BOTTOM_MARGIN, type Context, type Dangle, type Dir, type Floor, type Floors, type Frame, INSET, JUMP_FALL, JUMP_GAP, JUMP_RISE, MIN_DROP, type Point, type Route, swayAngle, swing, type Tie, UPRIGHT, WALL_GAP, WEB, inView } from './model';

// ---------------------------------------------------------------- finding the ways

// Where a thread is tied, on screen this frame; null once its floor is gone.
export function tiePoint(tie: Tie, floors: Floors): { x: number; y: number } | null {
  if (tie.floor === null) return { x: tie.x, y: 0 };
  const f = floors.get(tie.floor);
  return f ? { x: f.left + tie.x, y: f.y } : null;
}

export const anchor = (s: Dangle, floors: Floors) => tiePoint({ floor: s.from, x: s.x }, floors);

// A hanging spider where its swing has it this moment: thread and spider turn
// together about the tie, so it lands wherever the swing sets it down, not
// always straight below where it let go.
export function hanging(s: Dangle, floors: Floors): (Point & { angle: number; tie: Point }) | null {
  const tie = anchor(s, floors);
  if (!tie) return null;
  const angle = swayAngle(s.sway ?? 0);
  return { ...swing(tie, { x: tie.x, y: tie.y + s.drop }, angle), angle, tie };
}

// The nearest floor under frame x, below y, that a spider could land on.
export function floorBelow(ctx: Context, x: number, y: number): number | null {
  const below = [...ctx.floors]
    .filter(([, f]) => f.y > y + MIN_DROP && f.y <= ctx.frame.height - BOTTOM_MARGIN)
    .filter(([, f]) => x >= f.left + INSET && x <= f.right - INSET)
    .sort(([, a], [, b]) => a.y - b.y);
  return below[0]?.[0] ?? null;
}

// A floor across a small gap, at about the same height, the way it faces.
export function jumpTarget(ctx: Context, f: Floor, dir: Dir): number | null {
  const edge = dir === 1 ? f.right : f.left;
  const near = [...ctx.floors]
    .filter(([, g]) => g !== f && inView(g, ctx.frame) && g.right - g.left >= INSET * 4)
    .map(([id, g]) => ({ id, gap: dir === 1 ? g.left - edge : edge - g.right, rise: f.y - g.y }))
    .filter((c) => c.gap >= JUMP_GAP.min && c.gap <= JUMP_GAP.max && c.rise <= JUMP_RISE && c.rise >= -JUMP_FALL)
    .sort((a, b) => a.gap - b.gap);
  return near[0]?.id ?? null;
}

// A taller card standing just beyond this floor's end, its side reaching down
// to this floor's height: an inside corner to climb.
export function wallTarget(ctx: Context, f: Floor, dir: Dir): number | null {
  const edge = dir === 1 ? f.right : f.left;
  const near = [...ctx.floors]
    .filter(([, g]) => g !== f && inView(g, ctx.frame))
    .map(([id, g]) => ({ id, g, gap: dir === 1 ? g.left - edge : edge - g.right }))
    .filter((c) => c.gap >= 0 && c.gap <= WALL_GAP && c.g.y < f.y - MIN_DROP / 2 && c.g.base >= f.y - 4)
    .sort((a, b) => a.gap - b.gap);
  return near[0]?.id ?? null;
}

// The right end of a floor inside the top-right web: home is up its strands.
export const reachesTopWeb = (ctx: Context, f: Floor, dir: Dir) => dir === 1 && f.right >= ctx.frame.width - WEB && f.y <= WEB && f.y >= 40;

// The card's own side runs to the bottom of the frame: down it and out, or
// into the bottom-right web when that is drawn and the side is in its square.
export const sideRunsOut = (ctx: Context, f: Floor) => f.base >= ctx.frame.height - 40 && f.y < ctx.frame.height - 40;

export type Path = {
  from: Point;
  to: Point;
  // The drawing's turn while on it, facing the way the climb goes.
  rotate: number;
  silk: Point | null;
  // Where it ends up: walking on a floor, home in a web, or gone.
  end: { floor: number; x: number; dir: Dir } | { web: 'top' | 'bottom' } | 'out';
};

const toward = (from: Point, to: Point, by: number): Point => {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: from.x + ((to.x - from.x) / length) * by, y: from.y + ((to.y - from.y) / length) * by };
};

// A route made concrete against where its floors are this frame. Null when a
// floor it depends on has gone.
export function resolve(route: Route, floors: Floors, frame: Frame): Path | null {
  switch (route.via) {
    case 'line': {
      // Along the thread itself, which leans wherever the drop that left it
      // swung to: from its foot to its tie, or on out of the frame when it is
      // tied to the top.
      const bottom = floors.get(route.floor);
      const top = tiePoint(route.top, floors);
      if (!bottom || !top) return null;
      const foot = { x: bottom.left + route.x, y: bottom.y };
      const rotate = (Math.atan2(top.y - foot.y, top.x - foot.x) * 180) / Math.PI;
      const from = toward(foot, top, UPRIGHT);
      if (route.top.floor === null) {
        const out = toward(foot, top, ((foot.y + BELOW) / Math.max(1, foot.y - top.y)) * Math.hypot(top.x - foot.x, top.y - foot.y));
        return { from, to: out, rotate, silk: top, end: 'out' };
      }
      return { from, to: top, rotate, silk: top, end: { floor: route.top.floor, x: route.top.x, dir: 1 } };
    }
    case 'wall': {
      const from = floors.get(route.from);
      const to = floors.get(route.to);
      if (!from || !to) return null;
      const x = route.toward === 1 ? to.left : to.right;
      const landX = route.toward === 1 ? INSET : to.right - to.left - INSET;
      return { from: { x, y: from.y - UPRIGHT }, to: { x, y: to.y }, rotate: -90 * route.toward, silk: null, end: { floor: route.to, x: landX, dir: route.toward } };
    }
    case 'side': {
      const from = floors.get(route.from);
      if (!from) return null;
      const x = route.toward === 1 ? from.right : from.left;
      const home = frame.bottomWeb && route.toward === 1 && from.right >= frame.width - WEB;
      const y1 = home ? frame.height - 40 : frame.height + BELOW;
      return { from: { x, y: from.y }, to: { x, y: y1 }, rotate: 90 * route.toward, silk: null, end: home ? { web: 'bottom' } : 'out' };
    }
    case 'web': {
      const from = floors.get(route.from);
      if (!from) return null;
      return { from: { x: from.right, y: from.y }, to: { x: from.right, y: 36 }, rotate: -90, silk: null, end: { web: 'top' } };
    }
  }
}
