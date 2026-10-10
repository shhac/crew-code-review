import { inView, type PageMap } from '../floors';
import { fillTo, inTurn, keepInTurn, placeIds, placeInTurn, troupeSize } from '../group';
import { bodyOf, clampTo, runAt, runsOf } from '../ledges';
import { clamp } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import { alarm, bolt } from './alarm';
import { advanceBout, boxRoom, COURTING, endChase, startBout, type Bout } from './bout';
import { CHASE_GAP, fresh, HALF, HARE, holds, placeHare, sittingAt, sitUp, stepHare, TALL, type Hare, type Mode } from './hare';
import type { HarePose } from './hare-rig';
import { advanceRuns, memberOf, pagePoint, placeOf, runOf, sAt, trailHolds, update, type Run } from './runs';
import { claimsOf, placeOn } from './trail';

// The hares on the page together: two, or three where the page has room,
// hare 0 the jill and the others jacks. They graze apart (hare.ts); now and
// then a jack comes up to her, they box where there is room to rear, and she
// bolts, he chasing her along one planned trail (trail.ts, runs.ts), a second
// jack on his heels (bout.ts); a cursor coming near freezes them, then they
// bolt (alarm.ts). They are stepped in turn (lib/theme/group.ts), each seeing
// the others as they now are, so no two ever overlap: apart by SPACING
// grazing, by a lag at least as long on a trail, and by BOX_GAP only face to
// face boxing.

export type { Bout } from './bout';
export type { Member, Run } from './runs';
export type Hares = { target: number; hares: Hare[]; runs: Run[]; bout: Bout | null; nextBout: number };

const calm = (h: Hare) => h.mode === 'graze' || h.mode === 'sit' || h.mode === 'lope';

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
  const rest = placeIds<Hare>(pair.length ? [2] : [0, 1, 2], (others, id) => placeHare(scene, now, rand, [...pair, ...others], fresh(id)));
  const hares = [...pair, ...rest];
  const target = troupeSize(hares);
  return { target, hares: hares.slice(0, target), runs: [], bout: null, nextBout: now + (pair.length ? between(rand, 1500, 3000) : between(rand, 8000, 15000)) };
}

// A finished trail leaves its hares sitting up (or, a chase, where the bout
// goes on).
function finish(group: Hares, run: Run, scene: PageMap, now: number, rand: Rand): Hares {
  const ids = run.members.map((m) => m.id);
  const sat = group.hares.filter((h) => ids.includes(h.id)).map((h) => sitUp(h, scene, now, rand));
  const settled = update(group, ...sat);
  return run.kind === 'chase' ? endChase(settled, scene, now, rand) : settled;
}

// --- The step --------------------------------------------------------------

// One step for all of them. dt is in ms.
export function stepHares(group: Hares, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Hares {
  const moved = advanceRuns(group, dt);
  const ran = moved.finished.reduce((g, r) => finish(g, r, scene, now, rand), moved.group);
  const alarmed = alarm(ran, scene, now, rand, cursor);
  const onTrail = (h: Hare) => !!runOf(alarmed, h.id);
  const trails = alarmed.runs.flatMap((r) => claimsOf(r.trail));
  const stepped = inTurn(alarmed.hares, (h, others) => (onTrail(h) ? h : stepHare(h, scene, now, dt, rand, others, trails)));
  const bolted = bolt({ ...alarmed, hares: stepped }, scene, now, rand, cursor);
  const bouted = advanceBout(bolted, scene, now, rand);
  const quiet = !bouted.bout && !bouted.runs.length && bouted.hares.every(calm);
  return quiet && now >= bouted.nextBout ? startBout(bouted, scene, now, rand) : bouted;
}

// --- Layout changes and reduced motion ----------------------------------

// After a layout change. A trail whose rest still holds goes on. A hare on
// one that does not is put down where it is (in the air, on its landing or
// take-off spot), or placed afresh if it cannot be. Any other hare keeps
// its ledge while the clear run under it still holds it, pulled inside the
// run if it shrank, else is placed sitting at a new spot; a box with no tall
// room left is a stand-off. In id order, so the same hare keeps a contested
// spot; never more than the target.
export function reconcileHares(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
  const runs = splitRuns(group.runs, scene);
  const kept = keepInTurn(group.hares, (h, settled) => reseat(h, settled, group, runs, scene, now, rand));
  const added = fillTo(group.target, kept, (others, id) => placeHare(scene, now, rand, others, group.hares.find((h) => h.id === id) ?? fresh(id)));
  const boxing = fixBoxing([...kept, ...added].sort((a, b) => a.id - b.id), scene, now);
  const bout = keepBout(group.bout, runs.dropped.length > 0 || added.length > 0, boxing, scene, now, rand);
  return { ...group, ...bout, runs: runs.holding };
}

// The runs whose rest still holds, and those dropped.
type Split = { holding: Run[]; dropped: Run[] };
function splitRuns(runs: readonly Run[], scene: PageMap): Split {
  const holding = runs.filter((r) => trailHolds(r, scene));
  return { holding, dropped: runs.filter((r) => !holding.includes(r)) };
}

const onRun = (runs: readonly Run[], h: Hare) => runs.some((r) => r.members.some((m) => m.id === h.id));

// Where a hare can be put down: where it is, or, its trail dropped, where it
// is on that (in the air, its landing spot or else its take-off; away,
// nowhere).
function putDown(h: Hare, dropped: readonly Run[]): Hare[] {
  const run = dropped.find((r) => r.members.some((m) => m.id === h.id));
  if (!run) return [h];
  const place = placeOn(run.trail, sAt(run, memberOf(run, h.id)));
  if (place.kind === 'run') return [{ ...h, floor: place.floor, x: place.x, target: place.x }];
  if (place.kind === 'leap') return [place.segment.to, place.segment.from].map((s) => ({ ...h, floor: s.floor, x: s.x, target: s.x }));
  return [];
}

// A hare kept where it can be, seeing those settled before it: on with a
// trail that holds; else put down on the first spot that still holds it,
// pulled inside the run there, sitting up if its trail was dropped; else
// null, to be placed afresh.
function reseat(h: Hare, settled: Hare[], group: Hares, runs: Split, scene: PageMap, now: number, rand: Rand): Hare | null {
  if (onRun(runs.holding, h)) return h;
  const fits = putDown(h, runs.dropped).map((c) => clamped(c, scene)).find((c) => c && holds(c, scene, settled, partnerOf(group, h)));
  if (!fits) return null;
  return onRun(runs.dropped, h) ? sitUp(fits, scene, now, rand) : fits;
}

// A box with no tall room left (or only one hare of it left) is a
// stand-off; stoodDown says whether one was.
function fixBoxing(hares: Hare[], scene: PageMap, now: number): { hares: Hare[]; stoodDown: boolean } {
  const boxing = hares.filter((h) => h.mode === 'box');
  const boxOk = boxing.length === 2 && boxing[0].floor === boxing[1].floor && boxRoom(scene, boxing[0].floor, boxing[0].x, boxing[1].x);
  if (!boxing.length || boxOk) return { hares, stoodDown: false };
  return { hares: hares.map((h) => (h.mode === 'box' ? { ...h, mode: 'standoff', until: now + 1500 } : h)), stoodDown: true };
}

// With its bout dropped, a hare coming up to box or done boxing has nothing
// left to go on to, so it sits up. A pair still boxing has kept its room
// (any without it is already a stand-off) and is left to box.
const LEFT_WAITING: readonly Mode[] = COURTING.filter((m) => m !== 'box');

// The bout goes on only while nothing it relies on changed (no trail
// dropped, no hare placed afresh); it ends with a box stood down.
function keepBout(bout: Bout | null, changed: boolean, boxing: { hares: Hare[]; stoodDown: boolean }, scene: PageMap, now: number, rand: Rand): Pick<Hares, 'hares' | 'bout'> {
  const kept = changed ? null : bout;
  if (!kept) return { hares: boxing.hares.map((h) => (LEFT_WAITING.includes(h.mode) ? sitUp(h, scene, now, rand) : h)), bout: null };
  return { hares: boxing.hares, bout: boxing.stoodDown ? null : kept };
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
