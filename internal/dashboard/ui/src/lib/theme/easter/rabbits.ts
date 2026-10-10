import type { PageMap } from '../floors';
import { inTurn, placeInTurn } from '../group';
import { apart } from '../math';
import type { Cursor, Point } from '../pointer';
import type { Rand } from '../seed';
import type { End } from './hunt';
import { createRabbit, fresh, reconcileRabbit, restingRabbit, rouse, stepRabbit, type CanLay, type Rabbit } from './rabbit';

// The rabbits on the page together: how many to keep, and the rules that
// keep them apart, on top of each one's own in rabbit.ts.

// One thumping makes the others sitting within this far on the page sit up
// on alert, as a warren does.
const WARN_REACH = 260;

// How many to keep (two, or three where the page had room for three when
// they were placed), and each one.
export type Rabbits = { target: number; rabbits: Rabbit[] };

const placeAll = (ids: readonly number[], place: (others: Rabbit[], id: number) => Rabbit | null) => placeInTurn<number, Rabbit>(ids, (id, placed) => place(placed, id));

export function createRabbits(scene: PageMap, now: number, rand: Rand): Rabbits {
  const three = placeAll([0, 1, 2], (others, id) => createRabbit(scene, now, rand, others, fresh(id)));
  const target = three.length === 3 ? 3 : 2;
  return { target, rabbits: three.slice(0, target) };
}

// Each kept where it can be, in id order so the same one wins a crowded
// spot; one that must move is placed clear of every other; then any
// missing placed afresh, up to the target and never beyond it, so scrolling
// never adds rabbits.
type Keep = (r: Rabbit, settled: Rabbit[], all: Rabbit[]) => Rabbit | null;
function regroup(group: Rabbits, keep: Keep, place: (others: Rabbit[], id: number) => Rabbit | null): Rabbits {
  const kept = placeInTurn<Rabbit, Rabbit>(group.rabbits, (r, settled) => keep(r, settled, [...settled, ...group.rabbits.filter((o) => o.id > r.id)]));
  const missing = Array.from({ length: group.target }, (_, id) => id).filter((id) => !kept.some((r) => r.id === id));
  const added = placeAll(missing, (others, id) => place([...kept, ...others], id));
  return { ...group, rabbits: [...kept, ...added].sort((a, b) => a.id - b.id) };
}

export function reconcileRabbits(group: Rabbits, scene: PageMap, now: number, rand: Rand): Rabbits {
  return regroup(group, (r, settled, all) => reconcileRabbit(r, scene, now, rand, settled, all), (others, id) => createRabbit(scene, now, rand, others, fresh(id)));
}

// Reduced motion: all sitting, each kept where it sat where it still can be.
export function restingRabbits(scene: PageMap, previous: Rabbits | null): Rabbits {
  const group = previous ?? { target: createRabbits(scene, 0, () => 0.5).target, rabbits: [] };
  return regroup(group, (r, settled, all) => restingRabbit(scene, r, settled, r, all), (others, id) => restingRabbit(scene, null, others, fresh(id)));
}

const pointOf = (r: Rabbit, scene: PageMap): Point | null => {
  const f = scene.floors.get(r.floor);
  return f && r.mode !== 'away' ? { x: f.left + r.x, y: f.y } : null;
};

// One step for all of them, each in turn seeing the others as they now are.
// One starting to thump makes the others within WARN_REACH sit up.
export function stepRabbits(group: Rabbits, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null, canLay: CanLay): Rabbits {
  const step = (r: Rabbit, others: Rabbit[]) => stepRabbit(r, scene, now, dt, rand, cursor, others, canLay);
  const warn = (before: Rabbit, after: Rabbit, other: Rabbit) => {
    const at = before.mode !== 'thump' && after.mode === 'thump' ? pointOf(after, scene) : null;
    const there = at && pointOf(other, scene);
    return at && there && apart(at, there) <= WARN_REACH ? rouse(other, scene, now, rand) : other;
  };
  return { ...group, rabbits: inTurn(group.rabbits, step, warn) };
}

// The eggs the rabbits have just left, for the hunt, and the rabbits with
// them taken.
export function takeEggs(group: Rabbits): { group: Rabbits; eggs: { floor: number; end: End; seed: number }[] } {
  const eggs = group.rabbits.flatMap((r) => (r.left ? [{ ...r.left, seed: r.seed + Math.round(r.walked) }] : []));
  if (!eggs.length) return { group, eggs };
  return { group: { ...group, rabbits: group.rabbits.map((r) => (r.left ? { ...r, left: null } : r)) }, eggs };
}
