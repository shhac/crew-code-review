import { inView, reachOf, type PageMap } from '../floors';
import { inTurn, placeInTurn } from '../group';
import { bodyOf, clampTo, pageAt, roomOver, runAt, runsOf } from '../ledges';
import { apart, clamp, sign } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import {
  BOLT_SPEED, BOX_GAP, BOX_SPAN, CHASE_GAP, CHASE_SPEED, claimsOfHares, fresh, HALF, HARE, holds, placeHare, POSES, SPACING, sittingAt,
  stepHare, TALL, tallAt, type Hare, type Mode,
} from './hare';
import type { HarePose } from './hare-rig';
import { arcPoint, claimsOf, placeOn, plan, sweptClear, type Claim, type Place, type Trail } from './trail';

// The hares on the page together: two, or three where the page has room,
// hare 0 the jill and the others jacks. They graze apart (hare.ts); now and
// then a jack comes up to her, they box where there is room to rear, and she
// bolts, he chasing her along one planned trail (trail.ts), a second jack on
// his heels; a cursor coming near freezes them, then they bolt. They are
// stepped in turn (lib/theme/group.ts), each seeing the others as they now
// are, so no two ever overlap: apart by SPACING grazing, by a lag at least
// as long on a trail, and by BOX_GAP only face to face boxing.

// Followers on a trail keep at least this far behind the one ahead.
const CHASE_LAG = SPACING;
// How long a chase or a bolt runs, and over how many ledges.
const CHASE = { budget: 900, ledges: 3 };
const BOLT = { budget: 600, ledges: 2 };
// A cursor that moved this recently, this close to a hare's middle, freezes
// it and every hare within FREEZE_REACH of it; after freezing, one still
// within BOLT_REACH bolts.
const MOVING = 150;
const NEAR = 100;
const FREEZE_REACH = 240;
const BOLT_REACH = 200;

// A hare on a trail: how far behind the leader it keeps, and where along the
// trail it started (it waits there until the leader is lag ahead).
export type Member = { id: number; lag: number; start: number };
export type Run = { kind: 'chase' | 'bolt' | 'trip'; trail: Trail; at: number; speed: number; members: Member[] };
// A courtship: the jill, the jack coming to her, and whether this is their
// first box or the one where a chase ended.
export type Bout = { jill: number; jack: number; round: 1 | 2 };
export type Hares = { target: number; hares: Hare[]; runs: Run[]; bout: Bout | null; nextBout: number };

const sAt = (run: Run, m: Member) => Math.max(m.start, run.at - m.lag);
const runOf = (group: Hares, id: number) => group.runs.find((r) => r.members.some((m) => m.id === id)) ?? null;
const memberOf = (run: Run, id: number) => run.members.find((m) => m.id === id)!;
// On its way along a trail, rather than still waiting to set off.
const moving = (run: Run, m: Member) => sAt(run, m) > m.start;
const calm = (h: Hare) => h.mode === 'graze' || h.mode === 'sit' || h.mode === 'lope';

// Where a hare is on the page: its spot on its ledge, or on its trail.
export function placeOf(group: Hares, hare: Hare): Place {
  const run = runOf(group, hare.id);
  const m = run && memberOf(run, hare.id);
  if (run && m && moving(run, m)) return placeOn(run.trail, sAt(run, m));
  return { kind: 'run', floor: hare.floor, x: hare.x, dir: hare.dir, fade: 1 };
}

function pagePoint(place: Place, scene: PageMap): Point | null {
  if (place.kind === 'away') return null;
  if (place.kind === 'leap') return arcPoint(place.segment, scene, place.t);
  const f = scene.floors.get(place.floor);
  return f ? pageAt(f, place.x) : null;
}

// Whether a hare is standing on a ledge (not in the air or away).
const grounded = (group: Hares, hare: Hare) => placeOf(group, hare).kind === 'run';

// The stretches every hare not in `but` is on or heading along, and every
// other trail, with their boxes on the page for a leap to fly clear of.
function claimsBut(group: Hares, scene: PageMap, but: readonly number[], runs: readonly Run[] = group.runs): Claim[] {
  const others = group.hares.filter((h) => !but.includes(h.id) && !runOf(group, h.id));
  const boxed = claimsOfHares(others).map((c, i) => {
    const at = pagePoint(placeOf(group, others[i]), scene);
    const box = POSES.sit;
    return at ? { ...c, box: { left: at.x - box.width / 2, right: at.x + box.width / 2, top: at.y - box.height, bottom: at.y } } : c;
  });
  return [...boxed, ...runs.filter((r) => !r.members.some((m) => but.includes(m.id))).flatMap((r) => claimsOf(r.trail))];
}

// Running a trail, a hare takes up a bound's room on a ledge and a leap's in
// the air.
const BOUND = reachOf(POSES.bound);
const LEAP = reachOf(POSES.leap);
const planning = (claims: Claim[], extra: { budget: number; ledges: number; from?: Point | null; toward?: number }, rand: Rand) =>
  ({ clear: HARE.clear, body: BOUND, air: LEAP, claims, spacing: SPACING, rand, ...extra });

// --- Placing -----------------------------------------------------------

// Where two can box: a stretch with tall room over a pair facing each
// other, in view.
function boxSpots(scene: PageMap): { floor: number; mid: number; length: number }[] {
  return [...scene.floors].flatMap(([floor, f]) => {
    if (!inView(f, scene)) return [];
    return runsOf(f, scene, { ...HARE, clear: TALL }).map((r) => bodyOf(r, HALF)).filter((b) => b.hi - b.lo >= CHASE_GAP).map((b) => ({ floor, mid: (b.lo + b.hi) / 2, length: b.hi - b.lo }));
  });
}

// Newly placed: where the page has room to box, the jill and a jack face
// each other there, the first bout soon after; else each sits on the
// roomiest free stretch. Three where three fit, else two.
export function createHares(scene: PageMap, now: number, rand: Rand): Hares {
  const spot = boxSpots(scene).sort((a, b) => b.length - a.length)[0];
  const f = spot && scene.floors.get(spot.floor);
  const pair = spot && f ? [
    { ...sittingAt(fresh(0), f, spot.floor, spot.mid + CHASE_GAP / 2, scene, now, rand, -1), mode: 'sit' as const, until: Infinity },
    { ...sittingAt(fresh(1), f, spot.floor, spot.mid - CHASE_GAP / 2, scene, now, rand, 1), mode: 'sit' as const, until: Infinity },
  ] : [];
  const rest = placeInTurn<number, Hare>(pair.length ? [2] : [0, 1, 2], (id, placed) => placeHare(scene, now, rand, [...pair, ...placed], fresh(id)));
  const hares = [...pair, ...rest];
  const target = hares.length === 3 ? 3 : 2;
  return { target, hares: hares.slice(0, target), runs: [], bout: null, nextBout: now + (pair.length ? between(rand, 1500, 3000) : between(rand, 8000, 15000)) };
}

// --- Bouts ---------------------------------------------------------------

// Whether two hares at a and b on ledge floor could rear up and box there.
function boxRoom(scene: PageMap, floor: number, a: number, b: number): boolean {
  const f = scene.floors.get(floor);
  const mid = (a + b) / 2;
  return !!f && roomOver(f, scene, HARE, mid - BOX_SPAN / 2, mid + BOX_SPAN / 2) >= TALL;
}

// Whether nothing (no other hare) stands between two on one clear run.
function sameRun(scene: PageMap, a: Hare, b: Hare, all: readonly Hare[]): boolean {
  const f = a.floor === b.floor ? scene.floors.get(a.floor) : undefined;
  const run = f && runAt(f, scene, HARE, a.x);
  if (!run || b.x < run.lo || b.x > run.hi) return false;
  const [lo, hi] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  return !all.some((h) => h.id !== a.id && h.id !== b.id && h.floor === a.floor && h.x > lo && h.x < hi);
}

const facing = (h: Hare, other: Hare): Hare => ({ ...h, dir: sign(other.x - h.x) });
const update = (group: Hares, ...changed: Hare[]): Hares => ({ ...group, hares: group.hares.map((h) => changed.find((c) => c.id === h.id) ?? h) });

// A jack comes up to the jill: to box with her where there is room, else
// to chase her. One on another ledge first makes a trip to hers.
function startBout(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
  const jill = group.hares[0];
  const jacks = group.hares.slice(1).filter((j) => sameRun(scene, jill, j, group.hares)).sort((a, b) => Math.abs(a.x - jill.x) - Math.abs(b.x - jill.x));
  const later = { ...group, nextBout: now + between(rand, 15000, 35000) };
  const jack = jacks[0];
  if (!jack) return trip(later, scene, now, rand);
  const side = sign(jill.x - jack.x);
  const gap = boxRoom(scene, jill.floor, jill.x, jill.x - side * BOX_GAP) ? BOX_GAP : CHASE_GAP;
  const target = jill.x - side * gap;
  const coming: Hare = Math.abs(jack.x - jill.x) <= gap ? { ...jack, mode: 'arrived', dir: side } : { ...jack, mode: 'approach', target, dir: side };
  return { ...update(later, { ...jill, mode: 'sit', until: Infinity, dir: sign(-side) }, coming), bout: { jill: jill.id, jack: jack.id, round: 1 } };
}

// The nearest jack makes its way to the jill's ledge, stopping clear of her.
function trip(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
  const jill = group.hares[0];
  const jack = group.hares.slice(1).filter((h) => h.floor !== jill.floor)[0];
  if (!jack) return group;
  const claims = claimsBut(group, scene, [jack.id]);
  const trails = ([-1, 1] as const).map((d) => plan({ floor: jack.floor, x: jack.x }, d, scene, planning(claims, { budget: 1200, ledges: 3, toward: jill.floor }, rand)));
  const there = trails.find((t) => t.segments.some((s) => (s.kind === 'run' ? s.floor : s.to.floor) === jill.floor));
  if (!there) return group;
  return { ...group, runs: [...group.runs, { kind: 'trip', trail: there, at: 0, speed: CHASE_SPEED, members: [{ id: jack.id, lag: 0, start: 0 }] }], nextBout: now + between(rand, 4000, 7000) };
}

// She bolts away from him along a trail, he follows, and a second jack
// behind him on the ledge follows him. Cornered, it is a stand-off instead.
function startChase(group: Hares, scene: PageMap, now: number, rand: Rand, bout: Bout): Hares {
  const jill = group.hares.find((h) => h.id === bout.jill)!;
  const jack = group.hares.find((h) => h.id === bout.jack)!;
  const side = sign(jill.x - jack.x);
  const second = group.hares.filter((h) => h.id !== jill.id && h.id !== jack.id && h.floor === jill.floor && sign(jack.x - h.x) === side && sameRun(scene, jack, h, group.hares));
  const followers = [jack, ...second.slice(0, 1)];
  const rear = followers[followers.length - 1];
  const ids = [jill.id, ...followers.map((h) => h.id)];
  const trail = plan({ floor: rear.floor, x: rear.x }, side, scene, planning(claimsBut(group, scene, ids), CHASE, rand));
  const lead = Math.abs(jill.x - rear.x);
  if (trail.length - lead < 20) return standoff(group, now, rand, jill, jack);
  const lags = followers.reduce<Member[]>((all, h) => {
    const behind = all.length ? all[all.length - 1].lag + CHASE_LAG : CHASE_LAG;
    return [...all, { id: h.id, lag: Math.max(behind, Math.abs(jill.x - h.x)), start: Math.abs(h.x - rear.x) }];
  }, []);
  const run: Run = { kind: 'chase', trail, at: lead, speed: CHASE_SPEED, members: [{ id: jill.id, lag: 0, start: lead }, ...lags] };
  return { ...group, runs: [...group.runs, run], bout };
}

function standoff(group: Hares, now: number, rand: Rand, a: Hare, b: Hare): Hares {
  const until = now + between(rand, 1500, 2500);
  return { ...update(group, { ...facing(a, b), mode: 'standoff', until }, { ...facing(b, a), mode: 'standoff', until }), bout: null };
}

// Where a chase ended: a second box where there is room, the jack coming
// up to her again; else a stand-off. There is never a third round.
function endChase(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
  const bout = group.bout;
  if (!bout) return group;
  const jill = group.hares.find((h) => h.id === bout.jill)!;
  const jack = group.hares.find((h) => h.id === bout.jack)!;
  const side = sign(jill.x - jack.x);
  const target = jill.x - side * BOX_GAP;
  if (bout.round === 2 || jill.floor !== jack.floor || !boxRoom(scene, jill.floor, jill.x, target)) return standoff(group, now, rand, jill, jack);
  return { ...update(group, { ...facing(jill, jack), mode: 'sit', until: Infinity }, { ...jack, mode: 'approach', target, dir: side }), bout: { ...bout, round: 2 } };
}

// The bout moves on as its hares get where they were going.
function advanceBout(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
  const bout = group.bout;
  if (!bout) return group;
  const jill = group.hares.find((h) => h.id === bout.jill)!;
  const jack = group.hares.find((h) => h.id === bout.jack)!;
  if (jack.mode === 'arrived') {
    if (Math.abs(jack.x - jill.x) > BOX_GAP + 1e-6 || !boxRoom(scene, jill.floor, jill.x, jack.x)) {
      return bout.round === 2 ? standoff(group, now, rand, jill, jack) : startChase(update(group, { ...jack, mode: 'sit', until: Infinity }), scene, now, rand, bout);
    }
    const until = now + between(rand, 2500, 4000);
    return update(group, { ...facing(jill, jack), mode: 'box', until }, { ...facing(jack, jill), mode: 'box', until });
  }
  if (jill.mode !== 'boxed') return group;
  if (bout.round === 1) return startChase(update(group, { ...jill, mode: 'sit' }, { ...jack, until: Infinity }), scene, now, rand, bout);
  // Fended off again: he lopes away from her, she sitting up watching him
  // go, and they graze.
  const away = sign(jack.x - jill.x);
  const f = scene.floors.get(jack.floor);
  const run = f && runAt(f, scene, HARE, jack.x);
  const room = run ? bodyOf(run, HALF) : { lo: jack.x, hi: jack.x };
  const target = clampTo(room, jill.x + away * (SPACING + between(rand, 2, 40)));
  return { ...update(group, { ...jill, mode: 'sit', until: now + between(rand, 2500, 4000) }, { ...jack, mode: 'lope', target, dir: away }), bout: null };
}

// --- Freezing and bolting -------------------------------------------------

// A hare's middle on the page, where the cursor is measured from.
function middleOf(group: Hares, hare: Hare, scene: PageMap): Point | null {
  const at = pagePoint(placeOf(group, hare), scene);
  return at && { x: at.x, y: at.y - 12 };
}
const near = (a: Point | null, b: Point, reach: number) => !!a && apart(a, b) < reach;
const freeze = (hare: Hare, now: number, rand: Rand): Hare => ({ ...hare, mode: 'freeze', until: now + between(rand, 700, 1100) });

// A moving cursor coming near freezes them: every hare on a ledge within
// reach, and every hare on a trail once all on it are on a ledge (so none
// lands on a frozen one). Their trails, and any bout, end.
function alarm(group: Hares, scene: PageMap, now: number, rand: Rand, cursor: Cursor | null): Hares {
  if (!cursor || now - cursor.at >= MOVING) return group;
  const triggered = group.hares.some((h) => grounded(group, h) && near(middleOf(group, h, scene), cursor, NEAR));
  if (!triggered) return group;
  const stopped = group.runs.filter((r) => r.members.every((m) => grounded(group, group.hares.find((h) => h.id === m.id)!)));
  const onRuns = new Set(stopped.flatMap((r) => r.members.map((m) => m.id)));
  const busy = new Set(group.runs.filter((r) => !stopped.includes(r)).flatMap((r) => r.members.map((m) => m.id)));
  const hares = group.hares.map((h) => {
    if (busy.has(h.id) || h.mode === 'freeze') return h;
    const settled = onRuns.has(h.id) ? settle(group, h) : h;
    return onRuns.has(h.id) || near(middleOf(group, h, scene), cursor, FREEZE_REACH) ? freeze(settled, now, rand) : h;
  });
  const boutBroken = group.bout && hares.some((h) => (h.id === group.bout!.jill || h.id === group.bout!.jack) && h.mode === 'freeze');
  const calmed = boutBroken ? hares.map((h) => (h.mode === 'approach' || h.mode === 'arrived' || h.mode === 'box' || h.mode === 'boxed' ? { ...h, mode: 'sit' as const, until: now + 1500 } : h)) : hares;
  return { ...group, hares: calmed, runs: group.runs.filter((r) => !stopped.includes(r)), bout: boutBroken ? null : group.bout };
}

// A hare taken off its trail where it is on it.
function settle(group: Hares, hare: Hare): Hare {
  const place = placeOf(group, hare);
  return place.kind === 'run' ? { ...hare, floor: place.floor, x: place.x, target: place.x, dir: place.dir } : hare;
}

// The frozen hares whose time is up: those the cursor is still near bolt,
// in file with the others on their ledge on the same side of it; the rest
// sit up and look about.
function bolt(group: Hares, scene: PageMap, now: number, rand: Rand, cursor: Cursor | null): Hares {
  const done = group.hares.filter((h) => h.mode === 'freeze' && now >= h.until);
  if (!done.length) return group;
  const scared = cursor ? done.filter((h) => near(middleOf(group, h, scene), cursor, BOLT_REACH)) : [];
  const relaxed = done.filter((h) => !scared.includes(h)).map((h) => sitUp(h, scene, now, rand));
  const way = (h: Hare) => (cursor ? sign((middleOf(group, h, scene)?.x ?? 0) - cursor.x) : h.dir);
  const files = [...new Set(scared.map((h) => `${h.floor}:${way(h)}`))].map((key) => scared.filter((h) => `${h.floor}:${way(h)}` === key));
  const runs = files.reduce<Run[]>((all, file) => {
    const d = way(file[0]);
    const ordered = [...file].sort((a, b) => (b.x - a.x) * d);
    const [leader, rear] = [ordered[0], ordered[ordered.length - 1]];
    const claims = claimsBut(group, scene, file.map((h) => h.id), [...group.runs, ...all]);
    const trail = plan({ floor: rear.floor, x: rear.x }, d, scene, planning(claims, { ...BOLT, from: cursor }, rand));
    const lead = Math.abs(leader.x - rear.x);
    if (trail.length - lead < 1) return all;
    const members = ordered.map((h) => ({ id: h.id, lag: Math.abs(leader.x - h.x), start: Math.abs(h.x - rear.x) }));
    return [...all, { kind: 'bolt', trail, at: lead, speed: BOLT_SPEED, members }];
  }, []);
  const fled = new Set(runs.flatMap((r) => r.members.map((m) => m.id)));
  const cornered = scared.filter((h) => !fled.has(h.id)).map((h) => sitUp(h, scene, now, rand));
  return { ...update(group, ...relaxed, ...cornered, ...scared.filter((h) => fled.has(h.id)).map((h) => ({ ...h, mode: 'bolt' as const }))), runs: [...group.runs, ...runs] };
}

function sitUp(hare: Hare, scene: PageMap, now: number, rand: Rand): Hare {
  const f = scene.floors.get(hare.floor);
  return { ...hare, mode: 'sit', until: now + between(rand, 1500, 3000), tall: !!f && tallAt(f, scene, hare.x, POSES.sit.width) };
}

// --- Trails ----------------------------------------------------------------

// Every trail moves on; each hare on one is put where it now is on it, its
// steps driven by how far it moved. A finished trail leaves its hares
// sitting up (or, a chase, where the bout goes on).
function advanceRuns(group: Hares, scene: PageMap, now: number, dt: number, rand: Rand): Hares {
  const moved = group.runs.map((r) => ({ ...r, at: Math.min(r.trail.length, r.at + (r.speed * dt) / 1000) }));
  const hares = group.hares.map((h) => {
    const before = runOf(group, h.id);
    const after = moved.find((r) => r.members.some((m) => m.id === h.id));
    if (!before || !after) return h;
    const m = memberOf(after, h.id);
    if (!moving(after, m)) return h;
    const step = sAt(after, m) - sAt(before, memberOf(before, h.id));
    const place = placeOn(after.trail, sAt(after, m));
    const at = place.kind === 'run' ? { floor: place.floor, x: place.x, target: place.x, dir: place.dir } : {};
    return { ...h, ...at, mode: 'run' as Mode, walked: h.walked + step };
  });
  const finished = moved.filter((r) => r.at >= r.trail.length);
  const next = { ...group, hares, runs: moved.filter((r) => r.at < r.trail.length) };
  return finished.reduce((g, r) => finish(g, r, scene, now, rand), next);
}

function finish(group: Hares, run: Run, scene: PageMap, now: number, rand: Rand): Hares {
  const ids = run.members.map((m) => m.id);
  const sat = group.hares.filter((h) => ids.includes(h.id)).map((h) => sitUp(h, scene, now, rand));
  const settled = update(group, ...sat);
  return run.kind === 'chase' ? endChase(settled, scene, now, rand) : settled;
}

// --- The step --------------------------------------------------------------

// One step for all of them. dt is in ms.
export function stepHares(group: Hares, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Hares {
  const ran = advanceRuns(group, scene, now, dt, rand);
  const alarmed = alarm(ran, scene, now, rand, cursor);
  const onTrail = (h: Hare) => !!runOf(alarmed, h.id);
  const trails = alarmed.runs.flatMap((r) => claimsOf(r.trail));
  const stepped = inTurn(alarmed.hares, (h, others) => (onTrail(h) ? h : stepHare(h, scene, now, dt, rand, others, trails)), (_, __, other) => other);
  const bolted = bolt({ ...alarmed, hares: stepped }, scene, now, rand, cursor);
  const bouted = advanceBout(bolted, scene, now, rand);
  const quiet = !bouted.bout && !bouted.runs.length && bouted.hares.every(calm);
  return quiet && now >= bouted.nextBout ? startBout(bouted, scene, now, rand) : bouted;
}

// --- Layout changes and reduced motion ----------------------------------

// Whether the rest of a trail still holds: every ledge still there, every
// run still on a clear run, every leap still clear.
function trailHolds(run: Run, scene: PageMap): boolean {
  const from = Math.min(...run.members.map((m) => sAt(run, m)));
  const ahead = run.trail.segments.filter((_, i) => run.trail.segments.slice(0, i + 1).reduce((sum, s) => sum + (s.kind === 'run' ? Math.abs(s.to - s.from) : s.length), 0) >= from);
  return ahead.every((s) => {
    if (s.kind === 'away') return scene.floors.has(s.from.floor) && scene.floors.has(s.to.floor);
    if (s.kind === 'run') {
      const f = scene.floors.get(s.floor);
      const r = f && runAt(f, scene, HARE, s.from);
      return !!r && Math.min(s.from, s.to) >= r.lo && Math.max(s.from, s.to) <= r.hi;
    }
    const a = scene.floors.get(s.from.floor), b = scene.floors.get(s.to.floor);
    return !!a && !!b && sweptClear(pageAt(a, s.from.x), pageAt(b, s.to.x), s.hop, LEAP, scene);
  });
}

// After a layout change. A trail whose rest still holds goes on. A hare on
// one that does not is put down where it is (in the air, on its landing or
// take-off spot), or placed afresh if it cannot be. Any other hare keeps
// its ledge while the clear run under it still holds it, pulled inside the
// run if it shrank, else is placed sitting at a new spot; a box with no tall
// room left is a stand-off. In id order, so the same hare keeps a contested
// spot; never more than the target.
export function reconcileHares(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
  const runs = group.runs.filter((r) => trailHolds(r, scene));
  const dropped = group.runs.filter((r) => !runs.includes(r));
  const candidates = (h: Hare): Hare[] => {
    const run = dropped.find((r) => r.members.some((m) => m.id === h.id));
    if (!run) return [h];
    const place = placeOn(run.trail, sAt(run, memberOf(run, h.id)));
    if (place.kind === 'run') return [{ ...h, floor: place.floor, x: place.x, target: place.x }];
    if (place.kind === 'leap') return [place.segment.to, place.segment.from].map((s) => ({ ...h, floor: s.floor, x: s.x, target: s.x }));
    return [];
  };
  const kept = placeInTurn<Hare, Hare>(group.hares, (h, placed) => {
    if (runs.some((r) => r.members.some((m) => m.id === h.id))) return h;
    const fits = candidates(h).map((c) => clamped(c, scene)).find((c) => c && holds(c, scene, placed, partnerOf(group, h)));
    if (!fits) return null;
    const wasRun = dropped.some((r) => r.members.some((m) => m.id === h.id));
    return wasRun ? sitUp(fits, scene, now, rand) : fits;
  });
  const missing = Array.from({ length: group.target }, (_, id) => id).filter((id) => !kept.some((h) => h.id === id));
  const added = placeInTurn<number, Hare>(missing, (id, placed) => placeHare(scene, now, rand, [...kept, ...placed], group.hares.find((h) => h.id === id) ?? fresh(id)));
  const hares = [...kept, ...added].sort((a, b) => a.id - b.id);
  const boxing = hares.filter((h) => h.mode === 'box');
  const boxOk = boxing.length === 2 && boxing[0].floor === boxing[1].floor && boxRoom(scene, boxing[0].floor, boxing[0].x, boxing[1].x);
  const fixed = boxing.length && !boxOk ? hares.map((h) => (h.mode === 'box' ? { ...h, mode: 'standoff' as const, until: now + 1500 } : h)) : hares;
  const boutKept = group.bout && !dropped.length && added.length === 0 ? group.bout : null;
  const settled = boutKept ? fixed : fixed.map((h) => (h.mode === 'approach' || h.mode === 'arrived' || h.mode === 'boxed' ? sitUp(h, scene, now, rand) : h));
  return { ...group, hares: settled, runs, bout: boutKept && boxing.length && !boxOk ? null : boutKept };
}

const partnerOf = (group: Hares, h: Hare) => (group.bout ? (h.id === group.bout.jill ? group.bout.jack : group.bout.jill) : null);

// A hare pulled back onto the run under it, if there still is one.
function clamped(h: Hare, scene: PageMap): Hare | null {
  const f = scene.floors.get(h.floor);
  const run = f && runAt(f, scene, HARE, clamp(h.x, 0, f.right - f.left));
  if (!f || !run) return null;
  const room = bodyOf(run, HALF);
  if (room.hi < room.lo) return null;
  return { ...h, x: clampTo(room, h.x), target: clampTo(room, h.target) };
}

// Reduced motion: every hare sat up, still, kept where it sat while that
// spot stays clear, so a scroll never moves it; else in the middle of a
// free stretch.
export function restingHares(scene: PageMap, previous: Hares | null): Hares {
  const target = previous?.target ?? createHares(scene, 0, () => 0.5).target;
  const ids = Array.from({ length: target }, (_, id) => id);
  const hares = placeInTurn<number, Hare>(ids, (id, placed) => {
    const before = previous?.hares.find((h) => h.id === id);
    const kept = before && clamped(before, scene);
    const here = kept && kept.x === before.x && holds(kept, scene, placed) ? kept : placeHare(scene, 0, () => 0.5, placed, fresh(id), true);
    return here && sitUp({ ...here, mode: 'sit' }, scene, 0, () => 0.5);
  }).map((h) => ({ ...h, until: Infinity }));
  return { target, hares, runs: [], bout: null, nextBout: Infinity };
}

// --- Drawing -------------------------------------------------------------

// What each mode looks like; sitting up tall only where there is room.
function poseOf(hare: Hare): HarePose {
  switch (hare.mode) {
    case 'graze': return 'graze';
    case 'sit': case 'standoff': return hare.tall ? 'sit' : 'alert';
    case 'lope': case 'approach': return 'lope';
    case 'box': case 'boxed': return 'box';
    default: return 'alert';
  }
}

// Where each hare is drawn, and as what; one away is not drawn.
export type HareView = Point & { hare: Hare; pose: HarePose; dir: 1 | -1; opacity: number; leapt?: number };
export function hareViews(group: Hares, scene: PageMap): HareView[] {
  return group.hares.flatMap((hare) => {
    const place = placeOf(group, hare);
    const at = pagePoint(place, scene);
    if (!at || place.kind === 'away') return [];
    if (place.kind === 'leap') return [{ ...at, hare, pose: 'leap' as const, dir: place.dir, opacity: 1, leapt: place.t }];
    const onTrail = hare.mode === 'run';
    return [{ ...at, hare, pose: onTrail ? 'bound' as const : poseOf(hare), dir: place.dir, opacity: onTrail ? place.fade : 1 }];
  });
}
