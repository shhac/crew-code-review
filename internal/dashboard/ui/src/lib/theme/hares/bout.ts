import type { PageMap } from '../floors';
import { bodyOf, clampTo, roomOver, runAt } from '../ledges';
import { sign } from '../math';
import { between, type Rand } from '../seed';
import { BOX_GAP, BOX_SPAN, CHASE_GAP, CHASE_SPEED, HALF, HARE, SPACING, TALL, type Hare, type Mode } from './hare';
import type { Hares } from './hares';
import { claimsBut, fileRun, planning, update } from './runs';
import { plan } from './trail';

// A courtship: a jack comes up to the jill, they box where there is room to
// rear, she bolts and he chases her (a second jack on his heels), and where
// the chase ends they box again or face each other down.

// Followers on a trail keep at least this far behind the one ahead.
const CHASE_LAG = SPACING;
// How long a chase runs, and over how many ledges.
const CHASE = { budget: 900, ledges: 3 };

// The jill, the jack coming to her, and whether this is their first box or
// the one where a chase ended.
export type Bout = { jill: number; jack: number; round: 1 | 2 };

// A hare taking part in a bout: coming up to box, boxing, or done boxing.
export const COURTING: readonly Mode[] = ['approach', 'arrived', 'box', 'boxed'];

// The bout's two hares, as they now are.
function boutPair(group: Hares, bout: Bout): { jill: Hare; jack: Hare } | null {
  const jill = group.hares.find((h) => h.id === bout.jill);
  const jack = group.hares.find((h) => h.id === bout.jack);
  return jill && jack ? { jill, jack } : null;
}

// A bout broken off: those in it sit up a moment where they are.
export const breakBout = (hares: readonly Hare[], now: number): Hare[] => hares.map((h) => (COURTING.includes(h.mode) ? { ...h, mode: 'sit', until: now + 1500 } : h));

// Whether two hares at a and b on ledge floor could rear up and box there.
export function boxRoom(scene: PageMap, floor: number, a: number, b: number): boolean {
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

// A jack comes up to the jill: to box with her where there is room, else
// to chase her. One on another ledge first makes a trip to hers.
export function startBout(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
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
  const pair = boutPair(group, bout);
  if (!pair) return group;
  const { jill, jack } = pair;
  const side = sign(jill.x - jack.x);
  const second = group.hares.filter((h) => h.id !== jill.id && h.id !== jack.id && h.floor === jill.floor && sign(jack.x - h.x) === side && sameRun(scene, jack, h, group.hares));
  const followers = [jack, ...second.slice(0, 1)];
  const rear = followers[followers.length - 1];
  const ids = [jill.id, ...followers.map((h) => h.id)];
  const trail = plan({ floor: rear.floor, x: rear.x }, side, scene, planning(claimsBut(group, scene, ids), CHASE, rand));
  const run = fileRun('chase', [jill, ...followers], trail, CHASE_SPEED, CHASE_LAG);
  if (trail.length - run.at < 20) return standoff(group, now, rand, jill, jack);
  return { ...group, runs: [...group.runs, run], bout };
}

function standoff(group: Hares, now: number, rand: Rand, a: Hare, b: Hare): Hares {
  const until = now + between(rand, 1500, 2500);
  return { ...update(group, { ...facing(a, b), mode: 'standoff', until }, { ...facing(b, a), mode: 'standoff', until }), bout: null };
}

// Where a chase ended: a second box where there is room, the jack coming
// up to her again; else a stand-off. There is never a third round.
export function endChase(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
  const bout = group.bout;
  const pair = bout && boutPair(group, bout);
  if (!bout || !pair) return group;
  const { jill, jack } = pair;
  const side = sign(jill.x - jack.x);
  const target = jill.x - side * BOX_GAP;
  if (bout.round === 2 || jill.floor !== jack.floor || !boxRoom(scene, jill.floor, jill.x, target)) return standoff(group, now, rand, jill, jack);
  return { ...update(group, { ...facing(jill, jack), mode: 'sit', until: Infinity }, { ...jack, mode: 'approach', target, dir: side }), bout: { ...bout, round: 2 } };
}

// The bout moves on as its hares get where they were going.
export function advanceBout(group: Hares, scene: PageMap, now: number, rand: Rand): Hares {
  const bout = group.bout;
  const pair = bout && boutPair(group, bout);
  if (!bout || !pair) return group;
  const { jill, jack } = pair;
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
