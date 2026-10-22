import type { Box, PageMap } from '../floors';
import { keepInTurn, placeInTurn, troupeSize } from '../group';
import { apart } from '../math';
import type { Cursor } from '../pointer';
import { maxBy, type Rand } from '../seed';
import { clear, type BeeAir } from './beeair';
import { AT_FLOWER, awayBee, beeView, boxOf, ON_BELL, perchOn, placedBee, stepBee, where, type Bee, type Context, type Cue, type Flowers } from './bee';
import type { WallSide } from './bonks';
import { fitsAt, frameAt, hoverSpot, onPage, perchSpot, roomAt, SHELF_KEY, visitable, type Flower } from './flowers';
import { grow } from './footprints';
import { flyReach, originOf, placeRoute, routeFrom, samplesOf, stillClear } from './route';

// The bees on the page together: how many to keep, the rules that keep them
// apart, and what the group allows (one dodging at a time, a bonk at most
// every 30s). design-docs/bluebells/README.md has the contract.

// What the bees are placed and stepped against, measured with the page.
export type Meadow = { air: BeeAir; flowers: Flowers; bonks: readonly WallSide[]; cue?: Cue };

export type Bees = {
  // How many to keep: two, or three where the page had room when they were
  // placed. A layout change never grows it; a bee that had to leave comes
  // back up to it.
  target: number;
  bees: Bee[];
  lastBonk: number;
  // Since when each bee has been held by another.
  held: ReadonlyMap<number, number>;
};

// Two bees' footprints never come within this of each other.
export const SPACE = 8;
// Three where three flowers this far apart are in view.
const ROOMY = 120;
const BONK_EVERY = 30000;
const HOLD = 500;
// Restless 1 to 6s after first placement, staggered.
const FIRST = 1000;
const STAGGER = 1700;

export const meadowOf = (air: BeeAir, flowers: readonly Flower[], bonks: readonly WallSide[] = [], cue: Cue = null): Meadow => ({ air, flowers: new Map(flowers.map((f) => [f.key, f])), bonks, cue });

const hoverAt = (m: Meadow, f: Flower) => onPage(m.air.page, hoverSpot(f, 0));
// Cued to visit the shelf, no bee is put on it, so the first bee's visit
// is flown.
const placeable = (m: Meadow, f: Flower) => !(m.cue === 'shelf' && f.key === SHELF_KEY);
const facingMiddle = (m: Meadow, f: Flower): 1 | -1 => {
  const p = hoverAt(m, f);
  const main = m.air.page.main;
  return p && main && p.x > (main.left + main.right) / 2 ? -1 : 1;
};

// The flowers bees may first settle on, most room first, each at least
// `apart` from the others' flowers.
function bestFlower(m: Meadow, taken: readonly Flower[], spacing: number, also: readonly Box[] = []): Flower | null {
  const spaced = (f: Flower) => taken.every((t) => {
    const a = hoverAt(m, f), b = hoverAt(m, t);
    return a && b && apart(a, b) >= spacing;
  });
  const open = [...m.flowers.values()].filter((f) => placeable(m, f) && !taken.some((t) => t.key === f.key) && spaced(f) && visitable(m.air, f, also));
  return maxBy(open, (f) => roomAt(m.air, f)) ?? null;
}

// Placed one after another on the flowers with the most room, apart.
export function createBees(m: Meadow, now: number, rand: Rand): Bees {
  const three = placeInTurn<number, Flower>([0, 1, 2], (_, taken) => bestFlower(m, taken, ROOMY));
  const target = troupeSize(three);
  const flowers = target === 3 ? three : placeInTurn<number, Flower>([0, 1], (_, taken) => bestFlower(m, taken, ROOMY));
  const bees = Array.from({ length: target }, (_, id) => {
    const f = flowers[id];
    const rest = FIRST + id * STAGGER + rand() * (STAGGER - 400);
    return f ? placedBee(id, f, now, rest, facingMiddle(m, f)) : { ...awayBee({ id, seed: id * 7 + 3 }, now, rand), unplaced: true };
  });
  return { target, bees, lastBonk: -Infinity, held: new Map() };
}

// The others as a bee must keep clear of them: each one's box now, grown by
// the spacing, and, for planning, the rest of its way.
function shields(others: readonly Bee[], page: PageMap, now: number, ahead: boolean): Box[] {
  return others.flatMap((o) => {
    const here = boxOf(o, page, now);
    const mine = here ? [grow(here, SPACE)] : [];
    const f = o.flight;
    const origin = f && originOf(page, f.frame);
    if (!ahead || !f || !origin) return mine;
    const way = samplesOf(f.route).filter((q) => q.s >= f.s - 12).map((q) => grow(flyReach({ x: q.p.x + origin.x, y: q.p.y + origin.y }), SPACE));
    return [...mine, ...way];
  });
}

// The narrowest gap between a box and the others'.
function gapTo(box: Box | null, others: readonly Box[]): number {
  if (!box) return Infinity;
  return Math.min(Infinity, ...others.map((o) => Math.max(o.left - box.right, box.left - o.right, o.top - box.bottom, box.top - o.bottom)));
}

// Held in place for a step: a timed move waits, a flight neither flies on
// nor bumbles.
function holdStill(b: Bee, dt: number): Bee {
  const f = b.flight;
  return { ...b, since: b.since + dt, until: b.until + dt, flight: f && { ...f, v: 0, start: f.start + dt } };
}

// One step for all of them, each in turn seeing the others as they now are,
// so a later bee sees an earlier one's bonk, and its hold, this same step.
export function stepBees(group: Bees, m: Meadow, now: number, dt: number, rand: Rand, cursor: Cursor | null): Bees {
  return group.bees.reduce<Bees>((g, b, i) => {
    const others = g.bees.filter((_, j) => j !== i);
    const next = stepBee(b, contextFor(b, others, m, g.lastBonk, now, cursor), now, dt, rand);
    const held = giveWay(b, next, others, m.air, now, dt, g.held.get(b.id));
    const bees = g.bees.map((o, j) => (j === i ? held?.bee ?? next : o));
    return { ...g, bees, lastBonk: next.bonk && !b.bonk ? now : g.lastBonk, held: heldAs(g.held, b.id, held?.since) };
  }, group);
}

// What a bee may know and do this step: the others' flowers and boxes, and
// what the group allows it.
function contextFor(b: Bee, others: readonly Bee[], m: Meadow, lastBonk: number, now: number, cursor: Cursor | null): Context {
  // The others' ways are worked out only if this bee looks at them.
  const memo: { boxes?: Box[] } = {};
  return {
    air: m.air, flowers: m.flowers, cursor, bonks: m.bonks,
    claimed: new Set(others.flatMap((o) => (o.flower ? [o.flower] : []))),
    get others() { memo.boxes = memo.boxes ?? shields(others, m.air.page, now, true); return memo.boxes; },
    // A cued bonk comes at once, once.
    mayBonk: (m.cue === 'bonk' && lastBonk === -Infinity && b.id === 0) || (now - lastBonk >= BONK_EVERY && !others.some((o) => o.bonk)),
    // A cued bonk is the first bee's; a cued visit to the shelf is anyone's,
    // since one bee on the clump nearest the rail can close the way there
    // for the others.
    cue: m.cue === 'shelf' || (b.id === 0 && !(m.cue === 'bonk' && lastBonk > -Infinity)) ? m.cue : null,
    mayDodge: !others.some((o) => o.mode === 'dodge'),
  };
}

// A step that would bring it within SPACE of another, and closer than it
// was, is not taken: it is held, and since when. Held HOLD ms on a flight
// with an earlier bee in its way (the later of two gives way), it stops to
// choose again. null: the step stands.
function giveWay(b: Bee, next: Bee, others: readonly Bee[], air: BeeAir, now: number, dt: number, heldSince: number | undefined): { bee: Bee; since: number } | null {
  const page = air.page;
  const near = shields(others, page, now, false).map((s) => grow(s, -SPACE));
  const nextBox = boxOf(next, page, now);
  const before = gapTo(boxOf(b, page, now - dt), near), after = gapTo(nextBox, near);
  if (after >= SPACE || after >= before || !nextBox) return null;
  const since = heldSince ?? now;
  const yields = others.some((o) => o.id < b.id && gapTo(boxOf(o, page, now), [nextBox]) < SPACE);
  if (now - since >= HOLD && yields && b.flight) return { bee: replan(b, air, now), since };
  return { bee: holdStill(b, dt), since };
}

// Who is held since when, after one bee's step.
function heldAs(held: ReadonlyMap<number, number>, id: number, since: number | undefined): ReadonlyMap<number, number> {
  const next = new Map(held);
  if (since === undefined) next.delete(id);
  else next.set(id, since);
  return next;
}

// Held too long on a flight: it stops and hovers where it is, to choose
// again from there.
function replan(b: Bee, air: BeeAir, now: number): Bee {
  const here = where(b, air.page, now);
  const spot = here && frameAt(air, here);
  if (!spot) return b;
  return { ...b, mode: 'hover', since: now, until: now, at: spot, to: null, flight: null, flower: null };
}

// After a layout change, each in turn: a flying bee flies on while its way
// is still clear, hovers to choose again where it is still in air, and is
// otherwise put on the nearest flower at once; a bee on a flower stays
// while it is still there in air. None to go to: it is away until there is.
export function reconcileBees(group: Bees, m: Meadow, now: number, rand: Rand): Bees {
  const page = m.air.page;
  const settled = keepInTurn(group.bees, (b, _, all) => {
    const others = shields(all, page, now, false);
    return keep(b, m, now, rand, others) ?? onNearest(b, m, now, rand, others) ?? awayBee(b, now, rand);
  });
  return { ...group, bees: settled, held: new Map() };
}

function keep(b: Bee, m: Meadow, now: number, rand: Rand, others: readonly Box[]): Bee | null {
  if (b.mode === 'away') return b.unplaced ? onNearest(b, m, now, rand, others) ?? b : b;
  const page = m.air.page;
  const box = boxOf(b, page, now);
  if (!box || !clear(m.air, box, { also: others })) return null;
  const flower = b.flower ? m.flowers.get(b.flower) : undefined;
  if (AT_FLOWER.has(b.mode)) return flower ? b : hoverFree(b, m, now);
  const f = b.flight;
  const origin = f && originOf(page, f.frame);
  if (!f || !origin) return b;
  const ahead = routeFrom(placeRoute(f.route, origin), f.s);
  if (stillClear(m.air, ahead, { also: others }) && (!b.flower || flower)) return b;
  return hoverFree(b, m, now);
}

// Hovering where it is, free of any flower, to choose again.
function hoverFree(b: Bee, m: Meadow, now: number): Bee | null {
  const here = where(b, m.air.page, now);
  const spot = here && frameAt(m.air, here);
  if (!spot) return null;
  return { ...b, mode: 'hover', since: now, until: now, at: spot, to: null, flight: null, flower: null, bonk: null, stuck: Number.isFinite(b.stuck) ? b.stuck : now };
}

// Put at once on the nearest visitable flower to where it was, perched.
function onNearest(b: Bee, m: Meadow, now: number, rand: Rand, others: readonly Box[]): Bee | null {
  const page = m.air.page;
  const was = where(b, page, now);
  const open = [...m.flowers.values()].filter((f) => placeable(m, f) && visitable(m.air, f, others));
  const nearest = maxBy(open, (f) => -apart(hoverAt(m, f) ?? { x: Infinity, y: Infinity }, was ?? { x: 0, y: 0 }));
  if (!nearest) return null;
  return perchOn({ ...b, flight: null, bonk: null, startled: null, fled: null, fade: null, unplaced: false }, nearest, 0, now, 3000 + 5000 * rand(), b.dir);
}

// Reduced motion: each perched still on a flower, keeping its own while it
// is visitable, else on the one with the most room. No flowers, no bees.
export function restingBees(m: Meadow, previous: Bees | null): Bees {
  const group = previous ?? createBees(m, 0, () => 0.5);
  const bees = placeInTurn<Bee, Bee>(group.bees, (b, before) => {
    const others = shields(before, m.air.page, 0, false);
    const taken = new Set(before.flatMap((o) => (o.flower ? [o.flower] : [])));
    const own = b.flower ? m.flowers.get(b.flower) : undefined;
    const keepOwn = own && !taken.has(own.key) && visitable(m.air, own, others);
    const bell = keepOwn && ON_BELL.has(b.mode) && fitsAt(m.air, perchSpot(own, b.bell), 'perch', b.dir, true, others) ? b.bell : 0;
    const f = keepOwn ? own : maxBy([...m.flowers.values()].filter((x) => !taken.has(x.key) && visitable(m.air, x, others)), (x) => roomAt(m.air, x));
    if (!f) return null;
    return perchOn({ id: b.id, seed: b.seed }, f, bell, 0, Infinity, keepOwn ? b.dir : facingMiddle(m, f));
  });
  return { target: group.target, bees, lastBonk: -Infinity, held: new Map() };
}

// What is drawn for each bee, in id order.
export const beeViews = (group: Bees, page: PageMap, now: number) => group.bees.flatMap((b) => {
  const view = beeView(b, page, now);
  return view ? [{ b, view }] : [];
});

// Every bee's box now, for tests and the debug overlay.
export const boxesOf = (group: Bees, page: PageMap, now: number): Box[] => group.bees.flatMap((b) => {
  const box = boxOf(b, page, now);
  return box ? [box] : [];
});
