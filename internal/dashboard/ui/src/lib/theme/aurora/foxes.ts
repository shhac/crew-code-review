import type { PageMap } from '../floors';
import { inTurn, placeInTurn } from '../group';
import { apart } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import { createFox, fresh, reconcileFox, restingFox, stepFox, type Fox } from './fox';

// The foxes on the page together: how many to keep, and the rules that keep
// them apart, on top of each one's night in fox.ts.

// One startled awake rouses those asleep within this far on the page enough
// to look up.
const LOOK_REACH = 220;

// How many to keep (two, or three where the page had room for three when
// they were placed), and each one.
export type Foxes = { target: number; foxes: Fox[] };

// Placed one after another, each away from those before it.
const placeAll = (ids: readonly number[], place: (others: Fox[], id: number) => Fox | null) => placeInTurn<number, Fox>(ids, (id, placed) => place(placed, id));

export function createFoxes(scene: PageMap, now: number, rand: Rand): Foxes {
  const three = placeAll([0, 1, 2], (others, id) => createFox(scene, now, rand, others, fresh(id)));
  const target = three.length === 3 ? 3 : 2;
  return { target, foxes: three.slice(0, target) };
}

// Each kept where it can be, in id order so the same fox wins a crowded
// spot every time; one that must move is placed clear of every other fox,
// those still to come as they were, so it lands in nobody's way. Then any
// missing placed afresh, up to the target and never beyond it, so scrolling
// never adds foxes.
type Keep = (fox: Fox, settled: Fox[], all: Fox[]) => Fox | null;
function regroup(group: Foxes, keep: Keep, place: (others: Fox[], id: number) => Fox | null): Foxes {
  const kept = placeInTurn<Fox, Fox>(group.foxes, (fox, settled) => keep(fox, settled, [...settled, ...group.foxes.filter((o) => o.id > fox.id)]));
  const missing = Array.from({ length: group.target }, (_, id) => id).filter((id) => !kept.some((f) => f.id === id));
  const added = placeAll(missing, (others, id) => place([...kept, ...others], id));
  return { ...group, foxes: [...kept, ...added].sort((a, b) => a.id - b.id) };
}

export function reconcileFoxes(group: Foxes, scene: PageMap, now: number, rand: Rand): Foxes {
  return regroup(group, (fox, settled, all) => reconcileFox(fox, scene, now, rand, settled, all), (others, id) => createFox(scene, now, rand, others, fresh(id)));
}

// Reduced motion: all asleep, each kept where it lay where it still can be.
export function restingFoxes(scene: PageMap, previous: Foxes | null): Foxes {
  const group = previous ?? { target: createFoxes(scene, 0, () => 0.5).target, foxes: [] };
  return regroup(group, (fox, settled, all) => restingFox(scene, fox, settled, fox, all), (others, id) => restingFox(scene, null, others, fresh(id)));
}

const foxPoint = (fox: Fox, scene: PageMap): Point | null => {
  const f = scene.floors.get(fox.floor);
  return f ? { x: f.left + fox.x, y: f.y } : null;
};

// One step for all of them, each in turn seeing the others as they now are.
// One startled awake makes the others asleep within LOOK_REACH look up.
export function stepFoxes(group: Foxes, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Foxes {
  const step = (fox: Fox, others: Fox[]) => stepFox(fox, scene, now, dt, rand, cursor, others);
  const lookUp = (before: Fox, after: Fox, other: Fox) => {
    const roused = before.mode === 'asleep' && after.mode === 'waking' && after.startled;
    const at = roused ? foxPoint(after, scene) : null;
    const there = at && other.mode === 'asleep' ? foxPoint(other, scene) : null;
    return at && there && apart(at, there) <= LOOK_REACH ? { ...other, look: now + between(rand, 1200, 2000) } : other;
  };
  return { ...group, foxes: inTurn(group.foxes, step, lookUp) };
}
