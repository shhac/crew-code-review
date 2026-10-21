import type { Ledge, PageMap, Run } from '../floors';
import { arriving, ledgeEnds, lengthOf, noticing, pageAt, pointClaim, roomiest, RUNS, runAt, runUnder, staysPut, widthOf, within, type Claim } from '../ledges';
import { clamp01 } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import { alertAt, become, body, clear, HALF, hopToward, POSES, RABBIT, RESTLESS, settle, spareFor, type CanLay, type Rabbit } from './rabbit-basics';
import { along, leave, moveOn, way } from './rabbit-moves';
import { HOP_LENGTH, REST, type Pose } from './rabbit-rig';

// European rabbits on the ledges: sitting with their noses twitching,
// grooming, and hopping along in single hops with a pause between. A cursor
// passing near makes one sit up on alert; one that lingers makes it thump
// and bolt for cover, its scut showing, out at its ledge's end and in again
// at another's later. Now and then one hops to a free ledge end, nudges an
// egg into it and hops away. Everything is in ledge-local x, so a rabbit
// rides along with its card as the page scrolls.
// design-docs/easter/README.md has the full state table.

// Hopping along, and bolting for cover, in page pixels a second.
export const SPEED = 50;
export const BOLT = 90;

// The least room a rabbit is placed in.
const MIN_SPOT = 2 * HALF + 4;
// Where the walked distance stands at rest between hops: a whole number of
// hops on from this, where its cycle has all four feet down.
export const AT_REST = REST * HOP_LENGTH;

const PASSING = 90;
const MOVING = 120;
const NEAR = 60;
const LINGER = 1000;
const GROOM = 2400;
export const NUDGE = 900;
export const THUMP = 500;
const AWAY = { lo: 1500, hi: 3000 };
const PAUSE = { lo: 100, hi: 350 };
const FADE = 14;

// Who a rabbit is, kept across every change of place.
type Self = Pick<Rabbit, 'id' | 'seed' | 'walked'>;
export const fresh = (id: number): Self => ({ id, seed: id + 1, walked: AT_REST });

function sitAt(self: Self, floor: number, x: number, now: number, restless: number, dir: 1 | -1 = 1): Rabbit {
  return {
    ...self, floor, x, dir, mode: 'sit', since: now, until: now + restless, hops: 0, hop: null, pause: 0,
    from: x, egg: null, trip: null, near: null, scare: null, tall: false, was: 'sit', left: null,
  };
}

// Where a rabbit's hops will bring it.
const targetOf = (r: Pick<Rabbit, 'x' | 'hops' | 'hop' | 'dir'>) => (r.hop ? r.hop.x + r.dir * (r.hops + 1) * HOP_LENGTH : r.x + r.dir * r.hops * HOP_LENGTH);

// Where the others are, or are going.
const claims = (others: readonly Rabbit[]): Claim[] => others.flatMap((o) => [
  ...(o.mode === 'away' ? [] : [pointClaim(o.floor, o.x), pointClaim(o.floor, targetOf(o))]),
  ...(o.trip ? [pointClaim(o.trip.floor, o.trip.entry), pointClaim(o.trip.floor, o.trip.x)] : []),
]);

// Where a rabbit could sit: the longest clear run in view, away from the
// others, on a ledge with no rabbit where there is one.
const roomiestSpot = (scene: PageMap, others: readonly Rabbit[]) => roomiest(scene, claims(others), RABBIT, MIN_SPOT);

export function createRabbit(scene: PageMap, now: number, rand: Rand, others: readonly Rabbit[] = [], self: Self = fresh(0)): Rabbit | null {
  const spot = roomiestSpot(scene, others);
  if (!spot) return null;
  return sitAt(self, spot.floor, between(rand, spot.room.lo, spot.room.hi), now, between(rand, 2000, 6000), rand() < 0.5 ? -1 : 1);
}

// Reduced motion: sitting, kept where it sat while that spot stays clear;
// otherwise in the middle of a free stretch, clear of `avoid`.
export function restingRabbit(scene: PageMap, previous: Rabbit | null, others: readonly Rabbit[] = [], self: Self = previous ?? fresh(0), avoid: readonly Rabbit[] = others): Rabbit | null {
  const still = (r: Rabbit): Rabbit => ({ ...r, walked: AT_REST, until: Infinity });
  if (previous && sitsStill(previous, scene, others)) return still(sitAt(self, previous.floor, previous.x, 0, Infinity, previous.dir));
  const spot = roomiestSpot(scene, avoid);
  return spot ? still(sitAt(self, spot.floor, (spot.room.lo + spot.room.hi) / 2, 0, Infinity)) : null;
}

const sitsStill = (r: Rabbit, scene: PageMap, others: readonly Rabbit[]) => r.mode !== 'away' && staysPut(r, scene, RABBIT, claims(others));

const leaving = (r: Rabbit) => r.mode === 'exit' || (r.mode === 'bolt' && r.trip !== null);

// Whether a rabbit can stay on the run under it through a layout change:
// the run still wide enough for it, nobody too close to it or to where its
// hops take it, and all of it on the run, unless it is coming or going at
// its ledge's end.
function canStay(r: Rabbit, run: Run, others: readonly Rabbit[]): boolean {
  const coming = r.mode === 'enter' || leaving(r);
  return lengthOf(run) >= 2 * HALF && clear(claims(others), r.floor, r.x, targetOf(r)) && (coming || within(body(run), r.x));
}

// After a layout change. One out of sight keeps its trip. Otherwise it stays
// on its ledge, whatever it is doing, while the stretch under it is still
// clear and nobody is too close, its hops cut short where the run shrank;
// one leaving whose ledge end is now covered settles where it is. Failing
// that, it is placed sitting somewhere new, clear of `avoid`.
export function reconcileRabbit(r: Rabbit, scene: PageMap, now: number, rand: Rand, others: readonly Rabbit[] = [], avoid: readonly Rabbit[] = others): Rabbit | null {
  if (r.mode === 'away') return r;
  const f = scene.floors.get(r.floor);
  const run = f && runUnder(f, scene, RABBIT, r.x);
  if (!f || !run || !canStay(r, run, others)) return createRabbit(scene, now, rand, avoid, r);
  if (leaving(r)) return ledgeEnds(f, run).some((e) => Math.abs(e - targetOf(r)) <= HOP_LENGTH) ? r : settle(r, now);
  if (r.mode === 'enter') return r;
  const room = body(run);
  const hops = Array.from({ length: r.hops + 1 }, (_, n) => r.hops - n).find((n) => within(room, targetOf({ ...r, hops: n }))) ?? 0;
  const egg = hops === r.hops ? r.egg : null;
  return { ...r, hops, egg };
}

// Where the rabbit is drawn, or null while it is out of sight.
type RabbitView = Point & { pose: Pose; dir: 1 | -1; opacity: number };

// Faded out over FADE px before its ledge's end as it leaves, gone past
// it; faded in over FADE px from the other's as it comes in.
function fade(r: Rabbit, f: Ledge): number {
  if (leaving(r)) {
    const end = r.dir === 1 ? widthOf(f) - RUNS.inset : RUNS.inset;
    return clamp01(((end - r.x) * r.dir) / FADE);
  }
  if (r.mode === 'enter') return Math.min(1, Math.abs(r.x - r.from) / FADE);
  return 1;
}

export function poseOf(r: Pick<Rabbit, 'mode' | 'tall'>): Pose {
  switch (r.mode) {
    case 'alert': return r.tall ? 'alert' : 'sit';
    case 'groom': return 'groom';
    case 'nudge': return 'nudge';
    case 'thump': return 'thump';
    case 'hop': case 'bolt': case 'exit': case 'enter': return 'hop';
    default: return 'sit';
  }
}

export function rabbitView(r: Rabbit, scene: PageMap): RabbitView | null {
  const f = scene.floors.get(r.floor);
  if (!f || r.mode === 'away') return null;
  return { ...pageAt(f, r.x), pose: poseOf(r), dir: r.dir, opacity: fade(r, f) };
}

const centre = (r: Rabbit, f: Ledge): Point => pageAt(f, r.x, POSES.sit.height / 2);

// One step of a run of hops: each exactly HOP_LENGTH, so its feet land where
// its cycle puts them, with a pause between (none when bolting). Returns it
// moved, and whether its hops are done.
function hopping(r: Rabbit, now: number, dt: number, speed: number, rand: Rand): { r: Rabbit; done: boolean } {
  if (!r.hop) {
    if (r.hops === 0) return { r, done: true };
    if (now < r.pause) return { r, done: false };
    return hopping({ ...r, hops: r.hops - 1, hop: { x: r.x, walked: r.walked } }, now, dt, speed, rand);
  }
  const end = r.hop.walked + HOP_LENGTH;
  const walked = Math.min(end, r.walked + (speed * dt) / 1000);
  if (walked < end) return { r: { ...r, walked, x: r.hop.x + r.dir * (walked - r.hop.walked) }, done: false };
  const gap = speed === BOLT ? 0 : between(rand, PAUSE.lo, PAUSE.hi);
  const landed = { ...r, walked: end, x: r.hop.x + r.dir * HOP_LENGTH, hop: null, pause: now + gap };
  return { r: landed, done: landed.hops === 0 };
}

// How long a cursor has been close, and whether it is passing near enough
// to make it sit up, or has lingered long enough to make it thump.
function notice(r: Rabbit, f: Ledge, now: number, cursor: Cursor | null): { r: Rabbit; passing: boolean; lingered: boolean } {
  const { near, passing } = noticing(cursor, centre(r, f), now, r.near, { near: NEAR, reach: PASSING, moving: MOVING });
  return { r: { ...r, near }, passing, lingered: near !== null && now - near >= LINGER };
}

// Whether a rabbit is up to something big: only one is at a time.
export const busy = (r: Rabbit) => ['thump', 'bolt', 'nudge', 'exit', 'away', 'enter'].includes(r.mode) || r.egg !== null;

export const rouse = (r: Rabbit, scene: PageMap, now: number, rand: Rand): Rabbit => {
  if (!scene.floors.has(r.floor) || (r.mode !== 'sit' && r.mode !== 'groom' && r.mode !== 'alert')) return r;
  return alertAt(r, scene, now, rand);
};

// One step of a rabbit, given the others. dt is in milliseconds. canLay
// says where the hunt would take an egg.
export function stepRabbit(start: Rabbit, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null, others: readonly Rabbit[] = [], canLay: CanLay = () => false): Rabbit {
  const r = start.left ? { ...start, left: null } : start;
  const taken = claims(others);
  if (r.mode === 'away') return now < r.until ? r : arrive(r, scene, now, rand, others);
  const f = scene.floors.get(r.floor);
  if (!f) return r;
  const othersBusy = others.some(busy);
  switch (r.mode) {
    case 'sit':
    case 'alert':
    case 'groom': {
      const seen = notice(r, f, now, cursor);
      if (seen.lingered && !othersBusy) return become(seen.r, 'thump', now, { until: now + THUMP, near: null, scare: cursor && { x: cursor.x, y: cursor.y } });
      if (seen.passing || seen.lingered) return alertAt(seen.r, scene, now, rand);
      if (now < r.until) return seen.r;
      if (r.mode !== 'sit') return settle(seen.r, now, between(rand, RESTLESS.lo, RESTLESS.hi));
      if (rand() < 0.25 && spareFor(f, scene, 'groom', r.x) >= 0) return become(seen.r, 'groom', now, { until: now + GROOM });
      return moveOn(seen.r, scene, now, rand, taken, othersBusy, canLay);
    }
    case 'thump': {
      if (now < r.until) return r;
      const run = runAt(f, scene, RABBIT, r.x);
      if (!run) return settle(r, now);
      const from = r.scare ?? cursor ?? pageAt(f, r.x - r.dir * 40);
      const out = way(r, f, run, scene, rand, taken, from);
      return out ? leave(r, 'bolt', now, out) : along(r, f, run, scene, now, rand, taken, { away: from, bolt: true });
    }
    case 'nudge': {
      if (now < r.until || !r.egg) return r;
      const run = runAt(f, scene, RABBIT, r.x);
      const after = { ...r, egg: null, left: { floor: r.floor, end: r.egg } };
      return run ? along(after, f, run, scene, now, rand, taken, { away: pageAt(f, r.egg === 'left' ? 0 : widthOf(f)), bolt: false }) : settle(after, now);
    }
    default: {
      const { r: moved, done } = hopping(r, now, dt, r.mode === 'bolt' ? BOLT : SPEED, rand);
      if (!done) return moved;
      if (leaving(moved)) return become(moved, 'away', now, { until: now + between(rand, AWAY.lo, AWAY.hi) });
      if (moved.egg) return become(moved, 'nudge', now, { until: now + NUDGE, dir: moved.egg === 'left' ? -1 : 1 });
      if (moved.mode === 'bolt') return alertAt(settle(moved, now), scene, now, rand);
      return settle(moved, now, between(rand, RESTLESS.lo, RESTLESS.hi));
    }
  }
}

// Out of sight, then in at the far ledge's end if that is still somewhere to
// go; if not, it turns up sitting somewhere else.
function arrive(r: Rabbit, scene: PageMap, now: number, rand: Rand, others: readonly Rabbit[]): Rabbit {
  const t = arriving(r.trip, scene, RABBIT, claims(others), 'body');
  if (t) {
    return hopToward({ ...r, floor: t.floor, x: t.entry, from: t.entry, trip: null }, 'enter', now, t.x);
  }
  return createRabbit(scene, now, rand, others, r) ?? { ...r, until: now + 2000 };
}

