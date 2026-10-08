import { clamp } from '../spidergait';
import { type Act, BELOW, BODY, BOTTOM_MARGIN, CLIMB_SPEED, type Choice, type Climb, type Context, DROP_SPEED, type Dangle, type Dir, type Floor, HURRY, INSET, type Line, MAX_HANG, MIN_DROP, type Outcome, type Pose, REEL_SPEED, type Rand, type Rest, type Route, STARTLE, type Spider, type Tween, UPRIGHT, WALK_SPEED, WEIGHTS, type Walk, away, between, coin, fits, flip, inView, pace, still, welcoming } from './model';
import { pose } from './pose';
import { anchor, floorBelow, hanging, jumpTarget, reachesTopWeb, resolve, sideRunsOut, wallTarget } from './routes';

// ---------------------------------------------------------------- arriving

function hangFrom(from: number | null, x: number, dir: Dir, rest: Pick<Dangle, 'to' | 'reach' | 'out'>): Dangle {
  return { kind: 'dangle', from, x, dir, drop: 0, phase: 'down', left: 0, ...rest };
}

function arrive(ctx: Context): Spider {
  const candidates = [...ctx.floors].filter(([, f]) => welcoming(f, ctx.frame) && f.right - f.left >= INSET * 6);
  if (candidates.length === 0) return away(ctx.rand, 2, 4);
  const [id, f] = candidates[Math.floor(ctx.rand() * candidates.length)];
  const x = between(ctx.rand, f.left + INSET * 2, f.right - INSET * 2);
  return hangFrom(null, x, coin(ctx.rand), { to: id, reach: Infinity, out: false });
}

// ---------------------------------------------------------------- the ways off a floor

// Let down a thread from where the spider stands: to the floor below, or with
// none a way down and back up again; or, leaving, right out of the frame.
function letDown(ctx: Context, s: Walk, f: Floor, leaving: boolean): Dangle | null {
  if (leaving) return hangFrom(s.floor, s.x, s.dir, { to: null, reach: Infinity, out: true });
  const to = floorBelow(ctx, f.left + s.x, f.y);
  const reach = to === null ? Math.min(MAX_HANG, ctx.frame.height - BOTTOM_MARGIN - f.y) : Infinity;
  if (reach < MIN_DROP) return null;
  return hangFrom(s.floor, s.x, s.dir, { to, reach, out: false });
}

function turnBack(ctx: Context, s: Walk): Outcome {
  return still({ kind: 'rest', floor: s.floor, x: s.x, dir: flip(s.dir), left: between(ctx.rand, 0.4, 1.6) });
}

function endChoices(ctx: Context, s: Walk, f: Floor): Map<Choice, () => Outcome | null> {
  const choices = new Map<Choice, () => Outcome | null>();
  choices.set('drop', () => grab(s, letDown(ctx, s, f, false)));
  const jumpTo = jumpTarget(ctx, f, s.dir);
  if (jumpTo !== null) choices.set('jump', () => leap(ctx, s, jumpTo));
  const wallTo = wallTarget(ctx, f, s.dir);
  if (wallTo !== null) choices.set('wall', () => turnUp(ctx, s, { via: 'wall', from: s.floor, to: wallTo, toward: s.dir }));
  if (reachesTopWeb(ctx, f, s.dir)) choices.set('web', () => turnUp(ctx, s, { via: 'web', from: s.floor }));
  if (sideRunsOut(ctx, f)) choices.set('side', () => turnUp(ctx, s, { via: 'side', from: s.floor, toward: s.dir }));
  if (f.y < ctx.frame.height - BOTTOM_MARGIN) choices.set('leave', () => grab(s, letDown(ctx, s, f, true)));
  choices.set('turn', () => turnBack(ctx, s));
  return choices;
}

// A weighted pick among the ways that are there; the lab's preference wins
// whenever it can be taken. A way that turns out not to fit (a drop with no
// room to hang) falls back to turning round.
// A spider with no way up from here (no jump, no wall, no web, no dragline
// waiting on its floor) would otherwise wander the lowest card for ages, so
// its ways out become much likelier: it goes, and comes back from the top.
const UP: Choice[] = ['jump', 'wall', 'web'];
const STRANDED: Partial<Record<Choice, number>> = { leave: 5, side: 3 };

function pick(ctx: Context, s: Walk, choices: Map<Choice, () => Outcome | null>, lines: readonly Line[]): Outcome {
  const preferred = ctx.prefer ? choices.get(ctx.prefer)?.() : null;
  if (preferred) return preferred;
  const stranded = !UP.some((c) => choices.has(c)) && !lines.some((l) => l.bottom.floor === s.floor);
  const weigh = (c: Choice) => WEIGHTS[c] * (stranded ? (STRANDED[c] ?? 1) : 1);
  // Cornered while fleeing, it does not turn back toward what startled it:
  // it takes a way off the end instead (a drop, if nothing better).
  const fleeing = (s.hurry ?? 0) > 0;
  const options = [...choices].filter(([c]) => !(fleeing && c === 'turn')).map(([c, item]) => ({ item, weight: weigh(c) }));
  return weighted(options, ctx.rand())?.() ?? turnBack(ctx, s);
}

// One of the options, each taking its weight's share of a roll in [0, 1).
export function weighted<T>(options: readonly { item: T; weight: number }[], roll: number): T | undefined {
  const target = roll * options.reduce((sum, o) => sum + o.weight, 0);
  const found = options.reduce<{ at: number; item: T | undefined }>(
    (acc, o) => (acc.item !== undefined ? acc : { at: acc.at + o.weight, item: o.weight > 0 && target < acc.at + o.weight ? o.item : undefined }),
    { at: 0, item: undefined },
  );
  return found.item;
}

// ---------------------------------------------------------------- tweens into each state

const tweenTo = (next: Spider, tween: Tween): Act => ({ kind: 'act', t: 0, next, tween });
// How far the start of a tween sits from its end.
const shift = (from: Pose, to: Pose) => ({ dx: from.x - to.x, dy: from.y - to.y });

// Letting go of a floor to hang from it: from upright to head-down about the
// tie.
function grab(s: Walk, dangle: Dangle | null): Outcome | null {
  if (!dangle) return null;
  return still(tweenTo(dangle, { name: 'grab', dur: 0.38, ease: 'out', dx: 0, dy: 0, rotate: -75 * s.dir, drawing: 'hang' }));
}

// Standing on a floor after hanging over it: from head-down to upright, with
// a little bounce.
function settle(walk: Walk): Act {
  return tweenTo(walk, { name: 'settle', dur: 0.42, ease: 'overshoot', dx: 0, dy: -10, rotate: 80 * walk.dir, drawing: 'walk' });
}

// Back up onto the floor it hung from: swung up from below the edge.
function pullOver(rest: Rest): Act {
  return tweenTo(rest, { name: 'pull-over', dur: 0.45, ease: 'overshoot', dx: 0, dy: 22, rotate: 90 * rest.dir, drawing: 'walk' });
}

// From walking to climbing: the drawing turns about its feet as they move from
// where it stood to the foot of the climb.
function turnUp(ctx: Context, s: Walk, route: Route): Outcome | null {
  const climb: Climb = { kind: 'climb', route, along: 0, dir: s.dir };
  const from = pose(s, ctx.floors, ctx.frame);
  const to = pose(climb, ctx.floors, ctx.frame);
  if (!from || !to) return null;
  return still(tweenTo(climb, { name: 'turn-up', dur: 0.32, ease: 'out', ...shift(from, to), rotate: -to.rotate, drawing: 'walk' }));
}

// From climbing back to walking at the top: the same turn, the other way.
function turnOver(ctx: Context, c: Climb, walk: Walk): Spider {
  const from = pose(c, ctx.floors, ctx.frame);
  const to = pose(walk, ctx.floors, ctx.frame);
  if (!from || !to) return walk;
  return tweenTo(walk, { name: 'turn-over', dur: 0.32, ease: 'out', ...shift(from, to), rotate: from.rotate, drawing: 'walk' });
}

// A crouch, a hop across the gap, and a landing.
function leap(ctx: Context, s: Walk, target: number): Outcome | null {
  const g = ctx.floors.get(target);
  const from = pose(s, ctx.floors, ctx.frame);
  if (!g || !from) return null;
  const x = s.dir === 1 ? INSET : g.right - g.left - INSET;
  const walk: Walk = { kind: 'walk', floor: target, x, dir: s.dir, left: between(ctx.rand, 1.5, 4), goal: null };
  const to = pose(walk, ctx.floors, ctx.frame);
  if (!to) return null;
  return still(tweenTo(walk, { name: 'leap', dur: 0.72, ease: 'linear', ...shift(from, to), rotate: 0, drawing: 'walk', jump: true }));
}

// Into a corner web: shrinking and fading toward its corner, then away.
function intoWeb(ctx: Context, hold: Pose, corner: 'top' | 'bottom'): Act {
  const cx = ctx.frame.width - 14;
  const cy = corner === 'top' ? 14 : ctx.frame.height - 14;
  return tweenTo(away(ctx.rand, 6, 14), { name: 'into-web', dur: 0.6, ease: 'out', dx: cx - hold.x, dy: cy - hold.y, rotate: 0, drawing: 'walk', web: { hold } });
}

// ---------------------------------------------------------------- walking and resting

function startLineClimb(ctx: Context, s: Walk, line: Line): Outcome | null {
  const route: Route = { via: 'line', top: line.top, floor: s.floor, x: line.bottom.x, lineId: line.id };
  const path = resolve(route, ctx.floors, ctx.frame);
  if (!path || path.from.y - path.to.y < MIN_DROP - UPRIGHT) return null;
  const turned = turnUp(ctx, { ...s, x: line.bottom.x }, route);
  return turned ? { ...turned, take: line.id } : null;
}

// Heading for the foot of a dragline, and starting up it on arrival. Another
// spider may have taken it meanwhile; then this one simply walks on.
function seek(s: Walk, ctx: Context, line: Line): Outcome {
  const gap = line.bottom.x - s.x;
  const stepBy = WALK_SPEED * ctx.dt;
  if (Math.abs(gap) <= stepBy) return startLineClimb(ctx, s, line) ?? still({ ...s, goal: null });
  const dir: Dir = gap > 0 ? 1 : -1;
  return still({ ...s, dir, x: s.x + dir * stepBy });
}

const DIRS: readonly Dir[] = [1, -1];
// The routes worth steering toward: the ones only some ends offer.
const STEERABLE: readonly Choice[] = ['jump', 'wall', 'web', 'side'];

// The lab only: send the spider to whichever end of its floor offers the
// route the lab wants to watch. What an end offers is asked of endChoices
// itself, so the steering can never disagree with what a spider can take.
function labSteer(ctx: Context, s: Walk, f: Floor): Walk | null {
  const { prefer } = ctx;
  if (prefer === undefined || !STEERABLE.includes(prefer)) return null;
  const toward = DIRS.find((dir) => endChoices(ctx, { ...s, dir }, f).has(prefer));
  if (toward === undefined || (s.dir === toward && s.left === Infinity)) return null;
  return { ...s, dir: toward, left: Infinity };
}

// At the end of a stretch, perhaps head for a dragline waiting on this floor.
// When the lab asks for some other route, no wandering off up a thread.
function seekLine(ctx: Context, s: Walk, lines: readonly Line[]): Walk | null {
  if (ctx.prefer !== undefined && ctx.prefer !== 'line') return null;
  const waiting = lines.filter((l) => l.bottom.floor === s.floor);
  if (waiting.length === 0) return null;
  if (ctx.prefer !== 'line' && (s.left > 0 || ctx.rand() >= 0.35)) return null;
  return { ...s, goal: waiting[Math.floor(ctx.rand() * waiting.length)].id };
}

function walk(s: Walk, ctx: Context, lines: readonly Line[]): Outcome {
  const f = ctx.floors.get(s.floor);
  if (!f || !fits(f) || !inView(f, ctx.frame)) return still(away(ctx.rand));
  if (s.goal !== null) {
    const line = lines.find((l) => l.id === s.goal && l.bottom.floor === s.floor);
    return line ? seek(s, ctx, line) : still({ ...s, goal: null });
  }
  const steered = labSteer(ctx, s, f);
  if (steered) return still(steered);
  const width = f.right - f.left;
  const x = s.x + s.dir * WALK_SPEED * pace(s) * ctx.dt;
  const here: Walk = { ...s, x: clamp(x, INSET, width - INSET), left: s.left - ctx.dt };
  if (x <= INSET || x >= width - INSET) return pick(ctx, here, endChoices(ctx, here, f), lines);
  const toLine = seekLine(ctx, here, lines);
  if (toLine) return still(toLine);
  if (here.left > 0) return still(here);
  return pause(ctx, here, f);
}

// The end of a stretch of walking. The ways up and out are at the floor's
// ends, which short wanders seldom reach, so sometimes it sets off for one
// with a purpose (walking on until it gets there); sometimes it lets itself
// down from where it stands, or rarely leaves altogether; otherwise it rests.
// How a stretch of walking ends, as shares of one roll.
const PAUSE = { drop: 0.2, leave: 0.25, setOff: 0.6 };

function pause(ctx: Context, s: Walk, f: Floor): Outcome {
  const roll = ctx.rand();
  // A drop with no room to hang is not taken; it simply rests instead,
  // rather than the same roll counting again as setting off for an end.
  if (roll < PAUSE.drop) return grab(s, letDown(ctx, s, f, false)) ?? restHere(ctx, s);
  if (roll < PAUSE.leave) return grab(s, letDown(ctx, s, f, true)) ?? restHere(ctx, s);
  if (roll < PAUSE.setOff) return still({ ...s, dir: coin(ctx.rand), left: Infinity });
  return restHere(ctx, s);
}

function restHere(ctx: Context, s: Walk): Outcome {
  return still({ kind: 'rest', floor: s.floor, x: s.x, dir: s.dir, left: between(ctx.rand, 0.6, 2.8) });
}

// Mostly carry on the way it was facing; never straight back into the end of
// the floor it just turned around at.
function setOff(s: Rest, f: Floor, rand: Rand): Dir {
  if (s.x <= INSET + 1) return 1;
  if (s.x >= f.right - f.left - INSET - 1) return -1;
  if (rand() < 0.7) return s.dir;
  return flip(s.dir);
}

function rest(s: Rest, ctx: Context): Outcome {
  const f = ctx.floors.get(s.floor);
  if (!f || !fits(f) || !inView(f, ctx.frame)) return still(away(ctx.rand));
  if (s.left - ctx.dt > 0) return still({ ...s, left: s.left - ctx.dt });
  return still({ kind: 'walk', floor: s.floor, x: s.x, dir: setOff(s, f, ctx.rand), left: between(ctx.rand, 1.5, 6), goal: null });
}

// ---------------------------------------------------------------- hanging

// Touching down on a floor, leaving the thread it came down on behind it.
function landOn(ctx: Context, s: Dangle, id: number, f: Floor, ax: number): Outcome {
  const x = clamp(ax - f.left, INSET, f.right - f.left - INSET);
  const walk: Walk = { kind: 'walk', floor: id, x, dir: coin(ctx.rand), left: between(ctx.rand, 1, 4), goal: null };
  return { spider: settle(walk), leave: { top: { floor: s.from, x: s.x }, bottom: { floor: id, x } } };
}

function dangle(s: Dangle, ctx: Context): Outcome {
  const a = anchor(s, ctx.floors);
  if (!a) return still(away(ctx.rand));
  switch (s.phase) {
    case 'down': {
      const drop = s.drop + DROP_SPEED * ctx.dt;
      if (s.out) return still(a.y + drop > ctx.frame.height + BELOW ? away(ctx.rand) : { ...s, drop });
      if (s.to !== null) {
        const target = ctx.floors.get(s.to);
        if (!target || !fits(target)) return still({ ...s, drop, phase: 'up' });
        // It touches down wherever its swing has carried it, which is where
        // the dragline it leaves is tied below.
        const swungTo = hanging({ ...s, drop }, ctx.floors)?.x ?? a.x;
        if (a.y + drop + BODY >= target.y) return landOn(ctx, s, s.to, target, swungTo);
      }
      if (drop >= s.reach || a.y + drop > ctx.frame.height) return still({ ...s, drop, phase: 'hang', left: between(ctx.rand, 1.5, 4.5) });
      return still({ ...s, drop });
    }
    case 'hang':
      return still(s.left - ctx.dt > 0 ? { ...s, left: s.left - ctx.dt } : { ...s, phase: 'up' });
    case 'up': {
      const drop = s.drop - REEL_SPEED * pace(s) * ctx.dt;
      if (drop > 0) return still({ ...s, drop });
      if (s.from === null) return still(away(ctx.rand));
      return still(pullOver({ kind: 'rest', floor: s.from, x: s.x, dir: flip(s.dir), left: between(ctx.rand, 0.5, 1.5) }));
    }
  }
}

// ---------------------------------------------------------------- climbing

function climb(s: Climb, ctx: Context): Outcome {
  const path = resolve(s.route, ctx.floors, ctx.frame);
  if (!path) return still(away(ctx.rand));
  const length = Math.hypot(path.to.x - path.from.x, path.to.y - path.from.y);
  const along = s.along + CLIMB_SPEED * pace(s) * ctx.dt;
  if (along < length) return still({ ...s, along });
  const done: Climb = { ...s, along: length };
  if (path.end === 'out') return still(away(ctx.rand));
  if ('web' in path.end) {
    const hold = pose(done, ctx.floors, ctx.frame);
    return still(hold ? intoWeb(ctx, hold, path.end.web) : away(ctx.rand));
  }
  // Up a dragline it carries on the way it was facing; off a wall, inward.
  const dir = s.route.via === 'line' ? s.dir : path.end.dir;
  const walk: Walk = { kind: 'walk', floor: path.end.floor, x: path.end.x, dir, left: between(ctx.rand, 1.5, 5), goal: null };
  return still(turnOver(ctx, done, walk));
}

// ---------------------------------------------------------------- tweens

function act(s: Act, ctx: Context): Outcome {
  const t = s.t + ctx.dt;
  if (t < s.tween.dur) return still({ ...s, t });
  // A tween whose floor has gone ends in nothing rather than in mid-air.
  if (s.next.kind !== 'away' && !pose(s.next, ctx.floors, ctx.frame)) return still(away(ctx.rand));
  return still(s.next);
}

// ---------------------------------------------------------------- being startled

// Where the spider's body is, which is what a pointer comes near: above the
// feet when standing, below the tie when hanging.
function middle(p: Pose): { x: number; y: number } {
  return p.drawing === 'hang' ? { x: p.x, y: p.y + 25 } : { x: p.x, y: p.y - 16 };
}

// A moving pointer close by sends a spider away from it, by the means its
// state allows. Mid-tween it is too busy to notice; lowering itself out of
// the frame it is leaving anyway.
function startle(s: Spider, ctx: Context): Spider {
  if (!ctx.pointer || (s.kind !== 'walk' && s.kind !== 'rest' && s.kind !== 'dangle' && s.kind !== 'climb')) return s;
  const p = pose(s, ctx.floors, ctx.frame);
  if (!p) return s;
  const body = middle(p);
  if (Math.hypot(body.x - ctx.pointer.x, body.y - ctx.pointer.y) > STARTLE) return s;
  const away: Dir = body.x >= ctx.pointer.x ? 1 : -1;
  switch (s.kind) {
    case 'walk':
    case 'rest':
      return { kind: 'walk', floor: s.floor, x: s.x, dir: away, left: HURRY + 0.5, goal: null, hurry: HURRY };
    case 'dangle':
      return s.out ? s : { ...s, phase: 'up', hurry: HURRY };
    case 'climb':
      return { ...s, hurry: HURRY };
  }
}

// Time passing on a spider: a dash runs down, and one hanging swings on.
function elapse(s: Spider, dt: number): Spider {
  const swings = s.kind === 'dangle' || (s.kind === 'climb' && s.route.via === 'line');
  const swung = swings ? { ...s, sway: (s.sway ?? 0) + dt } : s;
  if (!('hurry' in swung) || !swung.hurry) return swung;
  return { ...swung, hurry: Math.max(0, swung.hurry - dt) };
}

export function step(raw: Spider, ctx: Context, lines: readonly Line[]): Outcome {
  const s = elapse(startle(raw, ctx), ctx.dt);
  switch (s.kind) {
    case 'away':
      return still(s.left - ctx.dt > 0 ? { ...s, left: s.left - ctx.dt } : arrive(ctx));
    case 'walk':
      return walk(s, ctx, lines);
    case 'rest':
      return rest(s, ctx);
    case 'dangle':
      return dangle(s, ctx);
    case 'climb':
      return climb(s, ctx);
    case 'act':
      return act(s, ctx);
  }
}
