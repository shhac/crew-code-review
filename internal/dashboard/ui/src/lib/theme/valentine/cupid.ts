import { around, fits, inAir, linesOf, sweeps, type Air } from '../air';
import { anchor, fromLedge, placed, progress, toLedge, type Anchored } from '../anchored';
import { cubic, lengthOf, samples, shift, type Curve } from '../curves';
import type { PageMap } from '../floors';
import { apart, clamp, degrees, smooth } from '../math';
import { distance, type Point } from '../pointer';
import { GAZE_EASE } from '../rig/gaze';
import { easeTo } from '../rig/life';
import { between, type Rand } from '../seed';
import type { CupidPose } from './cupid-rig';
import { FOOTPRINTS, SPOT, type Footprint } from './footprints';

// One cupid: where it hovers, how it flits from spot to spot and dodges a
// cursor whipping past, and what it is doing with its bow (the shot itself,
// which the group decides, is in cupids.ts). Every place is anchored to a
// ledge (anchored.ts), so a cupid rides with the page on scroll; a flight
// is held relative to the ledge it set off from.
// design-docs/valentine/README.md has the state table and the airspace
// contract.

export type Mode = 'hover' | 'flit' | 'dodge' | 'enter' | 'turn' | 'draw' | 'aim' | 'loose';
export type Flight = { floor: number; curve: Curve; start: number; duration: number };
// Where a cupid is shooting: the landing point on a ledge, and the angle it
// aims at, below straight ahead.
export type Target = { floor: number; x: number; aim: number };
export type Cupid = {
  id: number;
  // Its own blinks, bob and timings, so no two keep time.
  seed: number;
  // Where it hovers, or is flying to.
  spot: Anchored;
  flight: Flight | null;
  mode: Mode;
  // When the current timed mode ends.
  until: number;
  dir: 1 | -1;
  // Wingbeats so far, which the wings and the body's lift keep time with.
  beat: number;
  // When it next flits of its own accord, and when it may next dodge.
  restless: number;
  calm: number;
  // Fluttering in place, startled with nowhere to go, until then.
  flutter: number;
  target: Target | null;
  // When it appeared, for fading in.
  since: number;
  // The head's turn toward the cursor, eased.
  gaze: number;
};

// Wingbeats a second, by pose: a clearly seen flutter, not a hummingbird's
// blur (see the note).
export const BEATS: Record<CupidPose, number> = { hover: 5.5, flight: 4.5, draw: 5.5, aim: 5.5, loose: 5.5, dodge: 8 };
const FLUTTER = 8;
export const poseFootprint = (pose: CupidPose): Footprint => {
  if (pose === 'hover' || pose === 'flight' || pose === 'dodge') return pose;
  return 'shoot';
};

// Centres at least this far apart, at every moment.
export const SPACING = 64;
const FLIT_SPEED = 150;
const DODGE_SPEED = 320;
const MIN_FLIGHT = 600;
const FLIT_NEAR = 60;
const FLIT_FAR = 360;
// Restless after 6 to 14s hovering; the first flit sooner.
const RESTLESS = [6000, 14000] as const;
const FIRST = [3000, 8000] as const;
const ENTER = 300;
export const TURN = 250;
export const DRAW = 600;
export const AIM = 450;
export const LOOSE = 450;
const CALM = 1200;
const GAZE_REACH = 160;

// A flight's curve on the page now, or null with its ledge gone.
export const flightCurve = (page: PageMap, f: Flight): Curve | null => fromLedge(page, f.floor, f.curve);

// Where a cupid is now, on the page, or null with its ledge gone.
export function where(c: Pick<Cupid, 'spot' | 'flight'>, page: PageMap, now: number): Point | null {
  if (!c.flight) return placed(page, c.spot);
  const curve = flightCurve(page, c.flight);
  return curve && cubic(curve, smooth(progress(c.flight, now)));
}

// What the drawing needs: its pose, how far through a draw or a loose,
// its speed ahead and how that is changing (eased in and out along the
// curve), and how visible it is.
export type CupidView = Point & { dir: 1 | -1; pose: CupidPose; progress: number; speed: number; accel: number; opacity: number };
export function cupidView(c: Cupid, page: PageMap, now: number): CupidView | null {
  const at = where(c, page, now);
  if (!at) return null;
  const opacity = c.mode === 'enter' ? Math.min(1, (now - c.since) / ENTER) : 1;
  const base = { ...at, dir: c.dir, progress: 0, speed: 0, accel: 0, opacity };
  if (c.flight) {
    const curve = flightCurve(page, c.flight);
    const t = progress(c.flight, now), length = curve ? lengthOf((u) => cubic(curve, u)) : 0;
    const seconds = c.flight.duration / 1000;
    const speed = (length * 6 * t * (1 - t)) / seconds, accel = (length * 6 * (1 - 2 * t)) / (seconds * seconds);
    return { ...base, pose: c.mode === 'dodge' && t < 0.35 ? 'dodge' : 'flight', speed, accel };
  }
  switch (c.mode) {
    case 'draw': return { ...base, pose: 'draw', progress: 1 - (c.until - now) / DRAW };
    case 'aim': return { ...base, pose: 'aim', progress: 1 };
    case 'loose': return { ...base, pose: 'loose', progress: 1 - (c.until - now) / LOOSE };
    default: return { ...base, pose: 'hover' };
  }
}

// The poses a cupid can be in at once matter for its footprint: what box
// it takes up now.
export const footprintOf = (view: Pick<CupidView, 'pose'>) => FOOTPRINTS[poseFootprint(view.pose)];

// Who a cupid is, kept across every change of place.
type Self = Pick<Cupid, 'id' | 'seed' | 'beat' | 'gaze'>;
export const fresh = (id: number): Self => ({ id, seed: id * 7 + 3, beat: id * 0.37, gaze: 0 });

export function hoverAt(self: Self, spot: Anchored, now: number, restless: number, mode: 'hover' | 'enter' = 'hover', dir: 1 | -1 = 1): Cupid {
  return { ...self, spot, flight: null, mode, until: now + ENTER, dir, restless, calm: now, flutter: 0, target: null, since: now };
}

// Where the others are, or will be: each one's place now and its spot, and
// every point of the way still to go on a flight.
export function claims(others: readonly Cupid[], page: PageMap, now: number): Point[] {
  const ahead = (o: Cupid): Point[] => {
    const f = o.flight;
    const curve = f && flightCurve(page, f);
    if (!f || !curve) return [];
    const done = progress(f, now);
    return samples((u) => cubic(curve, smooth(done + u * (1 - done))), 8).map((s) => s.p);
  };
  return others.flatMap((o) => {
    const here = where(o, page, now);
    const spot = placed(page, o.spot);
    return [...(here ? [here] : []), ...(spot ? [spot] : []), ...ahead(o)];
  });
}
const spaced = (p: Point, taken: readonly Point[], by = SPACING) => taken.every((q) => apart(p, q) >= by);

// Whether a cupid can hover at p: its whole footprint, whatever it does
// there, in the air, and no other cupid too close.
export const canHover = (air: Pick<Air, 'page' | 'room'>, p: Point, taken: readonly Point[]) => fits(air, around(p, SPOT), linesOf(air.page)) && spaced(p, taken);

// The curves tried for a flight from a to b: arched over, dipped under,
// straight, and arched higher; each leaves and arrives along its bow.
export function routes(a: Point, b: Point): Curve[] {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const length = Math.hypot(d.x, d.y) || 1;
  // A unit normal pointing up the page, so a positive bow arches over.
  const n = d.x >= 0 ? { x: d.y / length, y: -d.x / length } : { x: -d.y / length, y: d.x / length };
  return [0.22, -0.22, 0, 0.45].map((k) => {
    const bow = { x: n.x * k * length, y: n.y * k * length };
    return { from: a, c1: shift({ x: a.x + d.x / 3, y: a.y + d.y / 3 }, bow), c2: shift({ x: a.x + (2 * d.x) / 3, y: a.y + (2 * d.y) / 3 }, bow), to: b };
  });
}

// Whether a flight along this curve is clear: its footprint swept along it
// stays in air, and it keeps SPACING from every claim.
export function clearRoute(air: Pick<Air, 'page' | 'room'>, curve: Curve, taken: readonly Point[], reach = FOOTPRINTS.flight): boolean {
  const points = samples((t) => cubic(curve, t)).map((s) => s.p);
  return points.every((p) => spaced(p, taken)) && sweeps(air, points.map((p) => around(p, reach)));
}

// A flight from where it is to a spot, held relative to the spot's ledge.
function flightTo(page: PageMap, from: Point, to: Point, curve: Curve, now: number, speed: number): { spot: Anchored; flight: Flight } | null {
  const spot = anchor(page, to);
  const held = spot && toLedge(page, spot.floor, curve);
  if (!spot || !held) return null;
  const length = lengthOf((t) => cubic(curve, t));
  return { spot, flight: { floor: spot.floor, curve: held, start: now, duration: Math.max(MIN_FLIGHT, (length / speed) * 1000) } };
}

// The first clear flight to any of these spots, tried in order.
export function flyTo(air: Air, from: Point, spots: readonly Point[], taken: readonly Point[], now: number, speed: number): { spot: Anchored; flight: Flight } | null {
  for (const to of spots) {
    if (!canHover(air, to, taken)) continue;
    const curve = routes(from, to).find((r) => clearRoute(air, r, taken));
    const flight = curve && flightTo(air.page, from, to, curve, now, speed);
    if (flight) return flight;
  }
  return null;
}

// Which way it faces setting off on a flight: toward where it is going.
const facing = (curve: Curve): 1 | -1 => (curve.to.x >= curve.from.x ? 1 : -1);
// Settling afresh: toward the middle of the view.
const towardMiddle = (air: Air, p: Point): 1 | -1 => (p.x < (air.view.left + air.view.right) / 2 ? 1 : -1);
// On a flight: the way it is heading just ahead, keeping the way it faced
// while that is nearly straight up or down.
function facingAlong(flight: Flight, page: PageMap, here: Point | null, now: number, dir: 1 | -1): 1 | -1 {
  const curve = flightCurve(page, flight);
  const ahead = curve && cubic(curve, Math.min(1, smooth(progress(flight, now)) + 0.02));
  return ahead && here && Math.abs(ahead.x - here.x) > 0.3 ? (ahead.x > here.x ? 1 : -1) : dir;
}

// How far its head turns toward a cursor near and ahead of it: half the
// angle up or down to it, at most 12 degrees either way.
function gazeToward(here: Point | null, cursor: Point | null, dir: 1 | -1): number {
  if (!here || !cursor || apart(here, cursor) >= GAZE_REACH || (cursor.x - here.x) * dir <= 0) return 0;
  return clamp(degrees(Math.atan2(cursor.y - here.y, Math.abs(cursor.x - here.x))) * 0.5, -12, 12);
}

// Off for a flit of its own accord: to a spot in view 60 to 360px away,
// tried in a random order, a dozen at most.
function flit(c: Cupid, air: Air, here: Point, now: number, rand: Rand, taken: readonly Point[]): Cupid {
  const near = air.spots.filter((p) => {
    const d = apart(p, here);
    return d >= FLIT_NEAR && d <= FLIT_FAR;
  });
  const order = near.map((p) => ({ p, k: rand() })).sort((a, b) => a.k - b.k).slice(0, 12).map((x) => x.p);
  const way = flyTo(air, here, order, taken, now, FLIT_SPEED);
  if (!way) return { ...c, restless: now + between(rand, 2000, 4000) };
  return { ...c, ...way, mode: 'flit', dir: facing(way.flight.curve), target: null };
}

// Whether its bow is up, turning to a target, drawn or aimed: a bow a
// moving cursor lowers again. Shooting counts the loose after it too.
export const bowRaised = (c: Pick<Cupid, 'mode'>) => c.mode === 'turn' || c.mode === 'draw' || c.mode === 'aim';
export const shooting = (c: Pick<Cupid, 'mode'>) => bowRaised(c) || c.mode === 'loose';
export const flying = (c: Pick<Cupid, 'flight'>) => c.flight !== null;

// One step of a cupid's own: its wings, a flight flown on, a flit when it is
// restless (unless another is flying or shooting), the timed shooting modes
// run on (the group decides when they start and whether the arrow leaves),
// and its head toward the cursor. dt in milliseconds.
export function stepCupid(c: Cupid, air: Air, now: number, dt: number, rand: Rand, cursor: Point | null, others: readonly Cupid[] = []): Cupid {
  const view = cupidView(c, air.page, now);
  const rate = now < c.flutter ? FLUTTER : view ? BEATS[view.pose] : BEATS.hover;
  const here = view && { x: view.x, y: view.y };
  const lived = { ...c, beat: c.beat + (rate * dt) / 1000, gaze: easeTo(c.gaze, gazeToward(here, cursor, c.dir), dt, GAZE_EASE) };
  if (c.flight) {
    if (now < c.flight.start + c.flight.duration) return { ...lived, dir: facingAlong(c.flight, air.page, here, now, c.dir) };
    return { ...lived, flight: null, mode: 'hover', restless: now + between(rand, ...RESTLESS) };
  }
  switch (c.mode) {
    case 'enter': return now < c.until ? lived : { ...lived, mode: 'hover' };
    case 'turn': return now < c.until ? lived : { ...lived, mode: 'draw', until: now + DRAW };
    case 'draw': return now < c.until ? lived : { ...lived, mode: 'aim', until: now + AIM };
    case 'loose': return now < c.until ? lived : { ...lived, mode: 'hover', target: null, restless: Math.max(c.restless, now + 2000) };
    case 'aim': return lived;
    default: {
      const busy = others.some((o) => flying(o) || shooting(o));
      if (now < c.restless || busy || !here || !inAir(air.view, here)) return lived;
      return flit(lived, air, here, now, rand, claims(others, air.page, now));
    }
  }
}

// A cursor moving fast and passing close makes it dodge: a quick dart to the
// nearest clear spot 60px or more farther from the cursor's path than it is
// now, reachable without passing another cupid; with none, it flutters in
// place. A drawn bow is lowered either way.
export const DASH = 900;
export const DASH_REACH = 70;
export function dodge(c: Cupid, air: Air, now: number, from: Point, to: Point, others: readonly Cupid[]): Cupid {
  const here = where(c, air.page, now);
  if (!here || now < c.calm) return c;
  const line = (p: Point) => distance(p, from, to);
  if (line(here) > DASH_REACH) return c;
  const calmed = { ...c, calm: now + CALM, target: null, mode: c.flight ? c.mode : 'hover' as const };
  const away = air.spots.filter((p) => line(p) >= line(here) + 60 && apart(p, here) <= FLIT_FAR).sort((a, b) => apart(a, here) - apart(b, here)).slice(0, 24);
  const way = flyTo(air, here, away, claims(others, air.page, now), now, DODGE_SPEED);
  if (!way) return { ...calmed, flutter: now + 400 };
  return { ...calmed, ...way, mode: 'dodge', dir: facing(way.flight.curve) };
}

// Where cupids may first hover, or settle afresh: the best spot in view
// clear of the others, spread out (the farthest from them, up to 300px),
// and near a ledge below, where its arrows can land.
export function bestSpot(air: Air, taken: readonly Point[], rand: Rand, spacing = SPACING): Point | null {
  const ledgeGap = (p: Point) => Math.min(400, ...[...air.page.floors.values()].filter((f) => f.left <= p.x && p.x <= f.right && f.y > p.y).map((f) => f.y - p.y));
  const score = (p: Point) => Math.min(300, ...taken.map((q) => apart(p, q))) - 0.5 * Math.abs(ledgeGap(p) - 50) + 20 * rand();
  return air.spots.filter((p) => spaced(p, taken, spacing) && canHover(air, p, taken)).reduce<Point | null>((best, p) => (best && score(best) >= score(p) ? best : p), null);
}

export function createCupid(air: Air, now: number, rand: Rand, others: readonly Cupid[], self: Self, spacing = SPACING, mode: 'hover' | 'enter' = 'hover'): Cupid | null {
  const p = bestSpot(air, claims(others, air.page, now), rand, spacing);
  const spot = p && anchor(air.page, p);
  return spot && hoverAt(self, spot, now, now + between(rand, ...FIRST), mode, towardMiddle(air, p));
}

// After a layout change. Flying, it flies on while the way still to go is
// clear and its spot still holds it; hovering, it stays while its spot
// does. Otherwise it flies from where it is now to the nearest clear spot;
// with no clear way, it hovers where it is if it can; failing that it is
// placed afresh, fading in, or not at all.
export function reconcileCupid(c: Cupid, air: Air, now: number, rand: Rand, others: readonly Cupid[] = []): Cupid | null {
  const taken = claims(others, air.page, now);
  const here = where(c, air.page, now);
  const spot = placed(air.page, c.spot);
  if (!here || !spot) return createCupid(air, now, rand, others, c, SPACING, 'enter');
  if (c.flight) {
    const curve = flightCurve(air.page, c.flight);
    const left = curve && { from: here, c1: cubic(curve, 0.5 + progress(c.flight, now) / 2), c2: cubic(curve, 0.75 + progress(c.flight, now) / 4), to: curve.to };
    if (left && clearRoute(air, left, taken) && canHover(air, spot, taken)) return c;
  } else if (canHover(air, spot, taken)) {
    return c;
  }
  const nearest = [...air.spots].sort((a, b) => apart(a, here) - apart(b, here)).slice(0, 8);
  const way = fits(air, around(here, FOOTPRINTS.flight)) ? flyTo(air, here, nearest, taken, now, FLIT_SPEED) : null;
  if (way) return { ...c, ...way, mode: 'flit', target: null };
  const stay = canHover(air, here, taken) && anchor(air.page, here);
  if (stay) return { ...c, spot: stay, flight: null, mode: 'hover', target: null };
  return createCupid(air, now, rand, others, c, SPACING, 'enter');
}

// Reduced motion: hovering still, kept where it was while that spot holds
// it, so a scroll never moves it; otherwise at the best spot.
export function restingCupid(air: Air, previous: Cupid | null, others: readonly Cupid[], self: Self, spacing = SPACING): Cupid | null {
  const taken = claims(others, air.page, 0);
  const kept = previous && placed(air.page, previous.spot);
  if (previous && kept && canHover(air, kept, taken)) return hoverAt(self, previous.spot, 0, Infinity, 'hover', previous.dir);
  const p = bestSpot(air, taken, () => 0.5, spacing);
  const spot = p && anchor(air.page, p);
  return spot && hoverAt(self, spot, 0, Infinity, 'hover', towardMiddle(air, p));
}
