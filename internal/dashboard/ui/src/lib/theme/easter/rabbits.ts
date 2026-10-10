import type { PageMap } from '../floors';
import { inTurn, placeIds, regroup, troupeSize } from '../group';
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

export function createRabbits(scene: PageMap, now: number, rand: Rand): Rabbits {
  const three = placeIds<Rabbit>([0, 1, 2], (others, id) => createRabbit(scene, now, rand, others, fresh(id)));
  const target = troupeSize(three);
  return { target, rabbits: three.slice(0, target) };
}

// Each kept where it can be (group.ts's regroup), one that must move placed
// clear of every other; then any missing placed afresh.
export function reconcileRabbits(group: Rabbits, scene: PageMap, now: number, rand: Rand): Rabbits {
  const rabbits = regroup(group.rabbits, group.target, (r, settled, all) => reconcileRabbit(r, scene, now, rand, settled, all), (others, id) => createRabbit(scene, now, rand, others, fresh(id)));
  return { ...group, rabbits };
}

// Reduced motion: all sitting, each kept where it sat where it still can be.
export function restingRabbits(scene: PageMap, previous: Rabbits | null): Rabbits {
  const group = previous ?? { target: createRabbits(scene, 0, () => 0.5).target, rabbits: [] };
  const rabbits = regroup(group.rabbits, group.target, (r, settled, all) => restingRabbit(scene, r, settled, r, all), (others, id) => restingRabbit(scene, null, others, fresh(id)));
  return { ...group, rabbits };
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
