import { airOf, type Air } from '../air';
import { inView, type Box, type PageMap } from '../floors';
import { inTurn, placeIds, regroup, troupeSize } from '../group';
import { apart, sign } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, maxBy, type Rand } from '../seed';
import {
  airborne, call, claims, createGull, fresh, idle, middleOf, reconcileGull, restingGull, stepGull, takeOff, MOVING,
  type Airspace, type Gull,
} from './gull';
import { AIR, GROUND, LIFT } from './gull-poses';
import { berths, flightOf, planSwoop, type Plan } from './swoop';

// The gulls on the page together: how many to keep, and the group's rules
// on top of each one's own in gull.ts: only one in the air at a time; a
// cursor left still for long enough gets one swoop (by the gull with the
// shortest clear route) or, with none, one long call, and not again until
// it moves; swoops at least COOLDOWN apart; the others watch the flier; and
// a neighbour sometimes answers a call.

// A cursor this still for this long is swooped at, once for that resting
// place: it must move REST_MOVE px before another can come.
export const STILL = 5000;
const REST_MOVE = 24;
export const COOLDOWN = 30000;
// A neighbour this near answers a long call half the time, a little later.
const ANSWER_REACH = 300;
const ANSWER_ODDS = 0.5;
const ANSWER_DELAY = [400, 900] as const;

export type Gulls = {
  // How many to keep: two, or three where the page had room for three.
  target: number;
  gulls: Gull[];
  // When the last swoop began, and the resting place swooped (or called) at.
  swooped: number;
  spent: Point | null;
  // A neighbour's answer to a call: who, and when.
  answer: { id: number; at: number } | null;
  // Who is answering now (an answer is never answered).
  answering: number | null;
};

const group = (target: number, gulls: Gull[]): Gulls => ({ target, gulls, swooped: -Infinity, spent: null, answer: null, answering: null });

export function createGulls(scene: PageMap, now: number, rand: Rand): Gulls {
  const three = placeIds<Gull>([0, 1, 2], (others, id) => createGull(scene, now, rand, others, fresh(id)));
  const target = troupeSize(three);
  return group(target, three.slice(0, target));
}

// The air a route may use: main's box less the page's obstacles. Only its
// bounds are taken from airOf, on a bare page, so no hover spots are
// worked out for every point of the page: a gull never hovers.
export function airspace(page: PageMap): { room: Pick<Air, 'page' | 'room'>; view: Pick<Air, 'page' | 'room'> } {
  const bare = airOf({ ...page, obstacles: [], floors: new Map() }, { half: 0, up: 0, down: 0 });
  return { room: { page, room: bare.room }, view: { page, room: bare.view } };
}

// The boxes a route keeps clear of: every other gull where it is and where
// it is going, as big as it will be there.
function berthsOf(others: readonly Gull[], page: PageMap, now: number): Box[] {
  const ground = { half: GROUND.strut.width / 2, up: GROUND.call.height - LIFT, down: LIFT };
  return berths(others.flatMap((o) => {
    const at = middleOf(o, page, now);
    if (!at) return [];
    const f = page.floors.get(o.floor);
    const to = !o.flight && f ? { x: f.left + o.target, y: at.y } : null;
    return [{ at, to, reach: o.flight ? AIR.flight : ground }];
  }));
}

const spaceFor = (others: readonly Gull[], page: PageMap, now: number): Airspace => {
  const air = airspace(page);
  return { air: () => air, berths: berthsOf(others, page, now) };
};

// Each kept where it can be (group.ts's regroup), one that must move placed
// clear of every other gull; then any missing placed afresh.
export function reconcileGulls(g: Gulls, scene: PageMap, now: number, rand: Rand, cursor: Point | null = null): Gulls {
  const gulls = regroup(g.gulls, g.target, (gull, settled, all) => reconcileGull(gull, scene, now, rand, settled, all, spaceFor(all.filter((o) => o.id !== gull.id), scene, now), cursor), (others, id) => createGull(scene, now, rand, others, fresh(id)));
  return { ...g, gulls };
}

// Reduced motion: all standing still, each kept where it stood (or would
// land) where it still can be.
export function restingGulls(scene: PageMap, previous: Gulls | null): Gulls {
  const g = previous ?? group(createGulls(scene, 0, () => 0.5).target, []);
  const gulls = regroup(g.gulls, g.target, (gull, settled, all) => restingGull(scene, gull, settled, gull, all), (others, id) => restingGull(scene, null, others, fresh(id)));
  return { ...g, gulls, answer: null, answering: null };
}

// The swoop a gull would make at the cursor, or null.
function planFor(gull: Gull, others: readonly Gull[], scene: PageMap, now: number, cursor: Point): Plan | null {
  const f = scene.floors.get(gull.floor);
  if (!f || !inView(f, scene) || !idle(gull)) return null;
  const { view } = airspace(scene);
  return planSwoop({ air: view, gull, home: { floor: gull.floor, x: gull.x }, cursor, taken: claims(others), also: berthsOf(others, scene, now) });
}

// Off it goes along a plan, from where it stands.
function launch(gull: Gull, plan: Plan, scene: PageMap, now: number): Gull | null {
  const flight = flightOf(scene, plan, gull.floor, now);
  return flight && takeOff(gull, flight, now);
}

// A cursor left still long enough, at a new resting place, with no gull in
// the air or on its way to take off and the last swoop long enough ago:
// the gull with the shortest clear swoop (its walk to take off counted)
// goes; with none, the gull nearest the cursor gives it the long call.
function restingCursor(g: Gulls, scene: PageMap, now: number, cursor: Cursor | null): Gulls {
  if (!cursor || now - cursor.at < STILL || g.spent) return g;
  if (g.gulls.some((x) => airborne(x) || x.mode === 'ready')) return g;
  const free = g.gulls.filter((x) => idle(x) && !!scene.floors.get(x.floor) && inView(scene.floors.get(x.floor)!, scene));
  if (!free.length) return g;
  // Too soon after the last: it waits, and goes once the time is up if the
  // cursor is still resting there.
  if (now - g.swooped < COOLDOWN) return g;
  const plans = free.flatMap((x) => {
    const plan = planFor(x, g.gulls.filter((o) => o.id !== x.id), scene, now, cursor);
    return plan ? [{ x, plan, cost: plan.length + Math.abs(plan.from - x.x) }] : [];
  });
  const best = maxBy(plans, (p) => -p.cost);
  if (best) {
    const walking = best.plan.from !== best.x.x;
    const next = walking ? { ...best.x, mode: 'ready' as const, target: best.plan.from, since: now, dir: sign(best.plan.from - best.x.x), turned: now } : launch(best.x, best.plan, scene, now);
    if (next) return { ...g, gulls: g.gulls.map((x) => (x.id === next.id ? next : x)), swooped: now, spent: { x: cursor.x, y: cursor.y } };
  }
  const nearest = maxBy(free, (x) => -apart(middleOf(x, scene, now) ?? { x: Infinity, y: Infinity }, cursor))!;
  const at = middleOf(nearest, scene, now)!;
  const caller = call({ ...nearest, dir: cursor.x >= at.x ? 1 : -1, turned: now }, now);
  return { ...g, gulls: g.gulls.map((x) => (x.id === caller.id ? caller : x)), spent: { x: cursor.x, y: cursor.y } };
}

// A gull walked to its take-off spot: off, along a route planned afresh
// from there, if the cursor is still resting; else it stands down, or
// calls if no route is clear now.
function takingOff(g: Gulls, scene: PageMap, now: number, cursor: Cursor | null): Gulls {
  const ready = g.gulls.find((x) => x.mode === 'ready' && x.x === x.target);
  if (!ready) return g;
  const others = g.gulls.filter((o) => o.id !== ready.id);
  const still = cursor && now - cursor.at >= MOVING;
  const plan = still ? planSwoop({ air: airspace(scene).view, gull: ready, home: { floor: ready.floor, x: ready.x }, cursor, taken: claims(others), also: berthsOf(others, scene, now) }) : null;
  const off = plan && plan.from === ready.x ? launch(ready, plan, scene, now) : null;
  const next = off ?? (still ? call(ready, now) : { ...ready, mode: 'stand' as const, since: now, until: now });
  return { ...g, gulls: g.gulls.map((x) => (x.id === next.id ? next : x)) };
}

// A gull that has just begun a long call may be answered by a neighbour
// standing within ANSWER_REACH, half the time; only one answers, and an
// answer is not answered.
function hearing(g: Gulls, before: readonly Gull[], scene: PageMap, now: number, rand: Rand): Gulls {
  const caller = g.gulls.find((x) => x.mode === 'call' && before.find((b) => b.id === x.id)?.mode !== 'call');
  const answering = g.answering !== null && g.gulls.find((x) => x.id === g.answering)?.mode === 'call' ? g.answering : null;
  if (!caller || g.answer || caller.id === answering) return { ...g, answering };
  const at = middleOf(caller, scene, now);
  const near = at && g.gulls.filter((x) => x.id !== caller.id && idle(x)).find((x) => {
    const there = middleOf(x, scene, now);
    return there && apart(there, at) <= ANSWER_REACH;
  });
  if (!near || rand() >= ANSWER_ODDS) return { ...g, answering };
  return { ...g, answering, answer: { id: near.id, at: now + between(rand, ...ANSWER_DELAY) } };
}

// The answer, when it is due, if the neighbour is still free to give it.
function answered(g: Gulls, scene: PageMap, now: number): Gulls {
  if (!g.answer || now < g.answer.at) return g;
  const who = g.gulls.find((x) => x.id === g.answer!.id);
  if (!who || !idle(who)) return { ...g, answer: null };
  return { ...g, answer: null, answering: who.id, gulls: g.gulls.map((x) => (x.id === who.id ? call(x, now) : x)) };
}

// One step for all of them: each in turn, seeing the others as they now are
// and any gull in the air (to watch it); then the group's swoops and calls.
export function stepGulls(g: Gulls, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Gulls {
  const flier = g.gulls.find((x) => x.flight);
  const at = flier && middleOf(flier, scene, now);
  const watching = flier && at ? { id: flier.id, at } : null;
  const step = (gull: Gull, others: Gull[]) => stepGull(gull, scene, now, dt, rand, cursor, others, watching && watching.id !== gull.id ? watching : null);
  const moved = { ...g, gulls: inTurn(g.gulls, step) };
  // The resting place is spent until the cursor moves well away from it.
  const spent = g.spent && cursor && apart(cursor, g.spent) >= REST_MOVE ? null : g.spent;
  const next = restingCursor(takingOff({ ...moved, spent }, scene, now, cursor), scene, now, cursor);
  return answered(hearing(next, g.gulls, scene, now, rand), scene, now);
}
