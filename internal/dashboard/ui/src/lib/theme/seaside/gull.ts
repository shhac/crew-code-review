import type { Air } from '../air';
import { anchor, placed, type Anchored } from '../anchored';
import type { Box, Ledge, PageMap, Run } from '../floors';
import {
  bodyOf, clampTo, lengthOf, pageAt, pointClaim, roomiest, runUnder, staysPut, towardTarget,
  type Claim,
} from '../ledges';
import { apart, clamp01, mix, sign, smooth } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import { GULL, LIFT, type Pose } from './gull-poses';
import { flightOf, inFlight, replan, RUN_OUT, stillClear, type Flight, type FlightMode } from './swoop';

// One herring gull: standing and strutting along the ledges, eyeing the
// cursor and following it while it moves, a swoop flown along its planned
// route (when and who is gulls.ts's), the touchdown and the long call after
// it. On a ledge everything is in ledge-local x, so a gull rides with its
// card as the page scrolls; in flight, its route is held by the ledge it
// lands on. design-docs/seaside/README.md has the state table.

export type Mode = 'stand' | 'strut' | 'eye' | 'ready' | FlightMode | 'touchdown' | 'call' | 'away';
export type Gull = {
  id: number;
  // Its own blinks and breaths, so no two keep time.
  seed: number;
  // Distance strutted, which drives its steps, and wingbeats so far.
  walked: number;
  beat: number;
  floor: number;
  x: number;
  dir: 1 | -1;
  // Where a strut (or a walk to take off) ends; in touchdown, where its
  // run-out ends, from `from`.
  target: number;
  from: number;
  mode: Mode;
  // When the current mode began, and when a timed one ends (standing, when
  // it next wanders).
  since: number;
  until: number;
  // When it last turned round: at most once every TURN_REST.
  turned: number;
  flight: Flight | null;
  // Where it faded out, while away.
  gone: Anchored | null;
  // The flying gull it watches.
  watch: number | null;
  // Looking about after a wander: which way, and since when.
  glance: { side: 1 | -1; at: number } | null;
};

export const STRUT = 26;
// A cursor moved within this long ago is moving; otherwise it is still.
export const MOVING = 1000;
// It eyes a cursor this near, and follows one moving this near its ledge,
// stopping this short of the point under it.
const EYE_REACH = 360;
const FOLLOW = { across: 360, up: 240, short: 36 };
// A cursor this close makes it strut this far away.
const TOO_CLOSE = 40;
const STEP_AWAY = 48;
const IDLE = [4000, 10000] as const;
const WANDER = [30, 120] as const;
// Turning round: at most once this often, a quick mirror this long.
const TURN_REST = 1200;
export const TURN = 200;
const TOUCHDOWN = 700;
// The run-out's two steps are taken in this much of the touchdown.
const RUN_OUT_TIME = 400;
export const CALL = 1600;
export const FADE = 150;
const AWAY = [1200, 2500] as const;
const GLANCE = 900;
// Wingbeats a second: 2.8 cruising and climbing, 4 in the quick flaps of
// take-off, pull-up and flare; none in the dive's glide.
const BEATS: Record<FlightMode, number> = { run: 4, climb: 2.8, dive: 0, pullup: 4, cruise: 2.8, flare: 4 };
const MIN_SPOT = 2 * GULL.half + 4;

const FLYING = new Set<Mode>(['run', 'climb', 'dive', 'pullup', 'cruise', 'flare']);
export const airborne = (g: Pick<Gull, 'mode'>) => FLYING.has(g.mode);
// On a ledge and free to do as it likes: what a swoop or a call is chosen from.
export const idle = (g: Pick<Gull, 'mode'>) => g.mode === 'stand' || g.mode === 'strut' || g.mode === 'eye';

// Who a gull is, kept across every change of place.
type Self = Pick<Gull, 'id' | 'seed' | 'walked' | 'beat'>;
export const fresh = (id: number): Self => ({ id, seed: id * 5 + 2, walked: 0, beat: 0 });

export function standingAt(self: Self, floor: number, x: number, now: number, until: number, dir: 1 | -1 = 1): Gull {
  return { ...self, floor, x, dir, target: x, from: x, mode: 'stand', since: now, until, turned: -Infinity, flight: null, gone: null, watch: null, glance: null };
}

// Where the other gulls are, or are going: on their ledge and where a strut
// takes them, or where a flight lands.
export const claims = (others: readonly Gull[]): Claim[] => others.flatMap((o) => {
  if (o.mode === 'away') return [];
  if (o.flight) return [pointClaim(o.flight.land.floor, o.flight.land.x)];
  return [pointClaim(o.floor, o.x), pointClaim(o.floor, o.target)];
});

// The body's middle on the page now, on a ledge or in flight; null out of
// sight or with its ledge gone.
export function middleOf(g: Gull, page: PageMap, now: number): Point | null {
  if (g.mode === 'away') return null;
  if (g.flight) return inFlight(page, g.flight, now)?.at ?? null;
  const f = page.floors.get(g.floor);
  return f ? pageAt(f, g.x, LIFT) : null;
}

export function createGull(scene: PageMap, now: number, rand: Rand, others: readonly Gull[] = [], self: Self = fresh(0)): Gull | null {
  const spot = roomiest(scene, claims(others), GULL, MIN_SPOT);
  if (!spot) return null;
  return standingAt(self, spot.floor, between(rand, spot.room.lo, spot.room.hi), now, now + between(rand, ...IDLE), rand() < 0.5 ? -1 : 1);
}

// Reduced motion: standing still where it stood, while that spot stays
// clear, so a scroll never moves it; a gull in flight stands at its
// landing spot if it can; else in the middle of the best free stretch.
export function restingGull(scene: PageMap, previous: Gull | null, others: readonly Gull[] = [], self: Self = previous ?? fresh(0), avoid: readonly Gull[] = others): Gull | null {
  const taken = claims(others);
  const at = previous && (previous.flight ? previous.flight.land : previous.mode === 'away' ? null : previous);
  if (previous && at && staysPut(at, scene, GULL, taken)) return standingAt(self, at.floor, at.x, 0, Infinity, previous.dir);
  const spot = roomiest(scene, claims(avoid), GULL, MIN_SPOT);
  return spot ? standingAt(self, spot.floor, (spot.room.lo + spot.room.hi) / 2, 0, Infinity) : null;
}

// What a flight keeps clear of: the other gulls (gulls.ts works it out).
export type Airspace = { air: () => { room: Pick<Air, 'page' | 'room'>; view: Pick<Air, 'page' | 'room'> }; berths: readonly Box[] };

// After a layout change. In flight, it flies on while the rest of its route
// is clear and its landing still there; else it re-plans from where it is to
// the nearest landing it can reach; with none, it fades out where it is and
// turns up standing somewhere else a little later. On a ledge, it keeps its
// ledge and mode while the run under it holds it and no other gull is too
// close, pulled back inside the run if that shrank; if not, it is placed
// standing somewhere new, clear of `avoid`, without animation.
export function reconcileGull(g: Gull, scene: PageMap, now: number, rand: Rand, others: readonly Gull[], avoid: readonly Gull[], space: Airspace, cursor: Point | null = null): Gull | null {
  if (g.mode === 'away') return g;
  const taken = claims(others);
  if (g.flight) {
    const { room, view } = space.air();
    if (stillClear(room, g.flight, now, taken, space.berths)) return g;
    const at = inFlight(scene, g.flight, now);
    const plan = at && replan(view, at.at, at.heading, taken, space.berths, cursor);
    const flight = plan && flightOf(scene, plan, plan.land.floor, now);
    if (flight) return { ...g, flight, mode: 'cruise', since: now };
    return fadeOut(g, scene, now, rand, at?.at ?? null);
  }
  const f = scene.floors.get(g.floor);
  const run = f && runUnder(f, scene, GULL, g.x);
  if (!f || !run || lengthOf(run) < 2 * GULL.half || tooClose(g, taken)) return createGull(scene, now, rand, avoid, g);
  const room = bodyOf(run, GULL.half);
  return { ...g, x: clampTo(room, g.x), target: clampTo(room, g.target), from: clampTo(room, g.from) };
}

const tooClose = (g: Gull, taken: readonly Claim[]) => taken.some((c) => c.floor === g.floor && Math.abs(c.lo - g.x) < GULL.spacing);

// Out of sight: it fades where it was over FADE, then is away a while.
function fadeOut(g: Gull, scene: PageMap, now: number, rand: Rand, here: Point | null): Gull {
  return { ...g, mode: 'away', flight: null, since: now, until: now + between(rand, ...AWAY), gone: here && anchor(scene, here) };
}

// The part of its ledge's clear run it may stand on, short of the others.
function lane(g: Gull, f: Ledge, scene: PageMap, taken: readonly Claim[]): Run | null {
  const run = runUnder(f, scene, GULL, g.x);
  if (!run) return null;
  const room = bodyOf(run, GULL.half);
  const xs = taken.filter((c) => c.floor === g.floor).map((c) => c.lo);
  return {
    lo: Math.max(room.lo, ...xs.filter((x) => x <= g.x).map((x) => x + GULL.spacing)),
    hi: Math.min(room.hi, ...xs.filter((x) => x > g.x).map((x) => x - GULL.spacing)),
  };
}

const moving = (cursor: Cursor | null, now: number): cursor is Cursor => !!cursor && now - cursor.at < MOVING;
const eyeing = (cursor: Cursor | null, at: Point): cursor is Cursor => !!cursor && apart(cursor, at) < EYE_REACH;

// Turned to face `want`, unless it turned round too recently.
function face(g: Gull, want: 1 | -1, now: number): Gull {
  if (want === g.dir || now - g.turned < TURN_REST) return g;
  return { ...g, dir: want, turned: now };
}

// Off to `to`, turning round only if it may.
function strutTo(g: Gull, to: number, now: number, mode: 'strut' | 'ready' = 'strut'): Gull {
  const turning = sign(to - g.x) !== g.dir;
  if (turning && now - g.turned < TURN_REST) return g;
  return { ...g, mode, target: to, since: g.mode === mode ? g.since : now, dir: sign(to - g.x), turned: turning ? now : g.turned, glance: null };
}

const stand = (g: Gull, now: number, rand: Rand, glance = false): Gull =>
  ({ ...g, mode: 'stand', since: now, until: now + between(rand, ...IDLE), watch: null, glance: glance ? { side: rand() < 0.5 ? -1 : 1, at: now } : null });

export const call = (g: Gull, now: number): Gull => ({ ...g, mode: 'call', since: now, until: now + CALL, target: g.x, watch: null, glance: null });

// Where a moving cursor would have it strut to: under the cursor, 36px
// short of it on its side, within its lane; null when the cursor is not
// near enough its ledge.
function following(g: Gull, f: Ledge, cursor: Cursor, room: Run): number | null {
  const x = f.left + g.x;
  if (Math.abs(cursor.x - x) > FOLLOW.across || Math.abs(cursor.y - f.y) > FOLLOW.up) return null;
  const under = cursor.x - f.left;
  const stop = under - sign(under - g.x) * FOLLOW.short;
  return Math.abs(under - g.x) <= FOLLOW.short ? g.x : clampTo(room, stop);
}

// What a gull on a ledge does next, given the cursor: strut away from one
// too close, follow one moving near, eye one still near, or wander when
// none is about.
function onLedge(g: Gull, f: Ledge, scene: PageMap, now: number, rand: Rand, cursor: Cursor | null, taken: readonly Claim[]): Gull {
  const here = pageAt(f, g.x, LIFT);
  const room = lane(g, f, scene, taken) ?? { lo: g.x, hi: g.x };
  if (cursor && apart(cursor, here) < TOO_CLOSE) {
    const away = clampTo(room, g.x + sign(here.x - cursor.x) * STEP_AWAY);
    return Math.abs(away - g.x) >= 12 ? strutTo(g, away, now) : face(g, sign(cursor.x - here.x), now);
  }
  if (moving(cursor, now)) {
    const to = following(g, f, cursor, room);
    if (to !== null && Math.abs(to - g.x) > 6) return strutTo(g, to, now);
  }
  if (eyeing(cursor, here)) {
    const faced = face(g, sign(cursor.x - here.x), now);
    return moving(cursor, now) || g.mode === 'eye' ? faced : { ...faced, mode: 'eye', since: now, glance: null };
  }
  if (now < g.until) return g;
  const first: 1 | -1 = rand() < 0.5 ? -1 : 1;
  const reach = (d: -1 | 1) => (d < 0 ? g.x - room.lo : room.hi - g.x);
  const way = [first, sign(-first)].find((d) => reach(d) >= WANDER[0]);
  if (!way) return stand(g, now, rand);
  return strutTo(g, g.x + way * between(rand, WANDER[0], Math.min(WANDER[1], reach(way))), now);
}

// One step of a gull's own, given the other gulls and where a flying one is
// (to watch it). dt in milliseconds.
export function stepGull(g: Gull, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null, others: readonly Gull[] = [], flyer: { id: number; at: Point } | null = null): Gull {
  if (g.mode === 'away') return now < g.until ? g : arrive(g, scene, now, rand, others);
  if (g.flight) return fly(g, g.flight, scene, now, dt);
  const f = scene.floors.get(g.floor);
  if (!f) return g;
  const taken = claims(others);
  if (flyer && (idle(g) || g.mode === 'ready')) {
    const here = pageAt(f, g.x, LIFT);
    const watching = g.mode === 'eye' && g.watch === flyer.id ? g : { ...g, mode: 'eye' as const, since: now, target: g.x, watch: flyer.id, glance: null };
    return face(watching, sign(flyer.at.x - here.x), now);
  }
  switch (g.mode) {
    case 'touchdown': {
      const t = smooth((now - g.since) / RUN_OUT_TIME);
      const x = mix(g.from, g.target, t);
      const moved = { ...g, x, walked: g.walked + Math.abs(x - g.x) };
      return now < g.until ? moved : call(moved, now);
    }
    case 'call':
      return now < g.until ? g : stand(g, now, rand);
    case 'ready':
      return towardTarget({ ...g, watch: null }, (STRUT * dt) / 1000);
    case 'strut': {
      const room = lane(g, f, scene, taken);
      const retarget = moving(cursor, now) && room ? following(g, f, cursor, room) : null;
      const heading = retarget !== null && Math.abs(retarget - g.target) > 6 ? strutTo(g, retarget, now) : g;
      const moved = towardTarget(heading, (STRUT * dt) / 1000);
      if (moved.x !== moved.target) return { ...moved, turned: moved.dir !== g.dir ? now : moved.turned };
      return eyeing(cursor, pageAt(f, moved.x, LIFT)) && !moving(cursor, now) ? { ...moved, mode: 'eye', since: now } : stand(moved, now, rand, !cursor);
    }
    case 'eye':
      // Done watching, or nothing left to eye.
      if (g.watch !== null || !eyeing(cursor, pageAt(f, g.x, LIFT))) return stand(g, now, rand);
      return onLedge(g, f, scene, now, rand, cursor, taken);
    default:
      return onLedge(g, f, scene, now, rand, cursor, taken);
  }
}

// On along its route: its mode is the leg it is on, its facing the way it
// heads, its wings beating at that leg's rate; at the end, touchdown.
function fly(g: Gull, flight: Flight, scene: PageMap, now: number, dt: number): Gull {
  const at = inFlight(scene, flight, now);
  const beat = g.beat + (BEATS[at?.leg.mode ?? 'flare'] * dt) / 1000;
  if (at) {
    const dir = Math.abs(at.heading.x) > 0.2 ? sign(at.heading.x) : g.dir;
    return { ...g, beat, mode: at.leg.mode, since: at.leg.mode === g.mode ? g.since : now, dir };
  }
  const { land } = flight;
  const touch = land.x - land.dir * RUN_OUT;
  return { ...g, beat, flight: null, floor: land.floor, x: touch, from: touch, target: land.x, dir: land.dir, mode: 'touchdown', since: now, until: now + TOUCHDOWN };
}

// Back from away: standing somewhere clear, or away a little longer.
function arrive(g: Gull, scene: PageMap, now: number, rand: Rand, others: readonly Gull[]): Gull {
  return createGull(scene, now, rand, others, g) ?? { ...g, until: now + 2000 };
}

// Off on a swoop now, from where it stands.
export function takeOff(g: Gull, flight: Flight, now: number): Gull {
  return { ...g, flight, mode: 'run', since: now, watch: null, glance: null };
}

// What the drawing needs: the body's middle on the page, the pose, the way
// it faces and how far through a turn round (0 to 1), the way it is heading
// in flight, wingbeats, how far through its timed mode (the call's posture
// keeps time with this), how visible, and what it eyes.
export type GullView = Point & {
  pose: Pose; dir: 1 | -1; turn: number; heading: Point; beat: number; walked: number;
  mode: Mode; since: number; opacity: number; glance: number;
};

export function gullView(g: Gull, page: PageMap, now: number): GullView | null {
  const base = { dir: g.dir, turn: clamp01((now - g.turned) / TURN), heading: { x: g.dir, y: 0 }, beat: g.beat, walked: g.walked, mode: g.mode, since: g.since, opacity: 1, glance: 0 };
  if (g.mode === 'away') {
    const at = g.gone && placed(page, g.gone);
    const opacity = 1 - (now - g.since) / FADE;
    return at && opacity > 0 ? { ...base, ...at, pose: 'flight', opacity } : null;
  }
  if (g.flight) {
    const at = inFlight(page, g.flight, now);
    return at && { ...base, ...at.at, pose: at.leg.pose, heading: at.heading, turn: 1 };
  }
  const f = page.floors.get(g.floor);
  if (!f) return null;
  const glancing = g.glance && now - g.glance.at < GLANCE ? g.glance.side : 0;
  return { ...base, ...pageAt(f, g.x, LIFT), pose: groundPose(g, now), glance: glancing };
}

function groundPose(g: Gull, now: number): Pose {
  switch (g.mode) {
    case 'strut': case 'ready': return 'strut';
    case 'eye': return 'eye';
    case 'call': return 'call';
    // Flare to stand: wings held up a moment, then folded.
    case 'touchdown': return now - g.since < TOUCHDOWN / 2 ? 'flare' : 'stand';
    default: return 'stand';
  }
}
