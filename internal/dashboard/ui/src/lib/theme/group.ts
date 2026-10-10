// Animals that share the page are stepped and placed one after another, in a
// fixed order, each seeing the others as they now are, so the rules that keep
// them apart hold at every step and the same one always wins a contested spot.

// Each in turn steps, seeing the others as they now are; then each of the
// others may react to what it did (by default, not at all).
export function inTurn<T>(items: readonly T[], step: (item: T, others: T[]) => T, react: (before: T, after: T, other: T) => T = (_, __, other) => other): T[] {
  return items.reduce<T[]>((all, _, i) => {
    const before = all[i];
    const after = step(before, all.filter((_, j) => j !== i));
    return all.map((other, j) => (j === i ? after : react(before, after, other)));
  }, [...items]);
}

// Each placed in turn, seeing those placed before it; null leaves it out.
export function placeInTurn<T, U>(items: readonly T[], place: (item: T, placed: U[]) => U | null): U[] {
  return items.reduce<U[]>((placed, item) => {
    const next = place(item, placed);
    return next ? [...placed, next] : placed;
  }, []);
}

// A member of a troupe: one of a few animals, told apart by a small id.
export type Member = { id: number };

// One placed for each id in turn, each seeing those placed before it.
export const placeIds = <T>(ids: readonly number[], place: (others: T[], id: number) => T | null): T[] => placeInTurn<number, T>(ids, (id, placed) => place(placed, id));

// How many to keep: three where the page had room for three when they were
// placed, else two.
export const troupeSize = (placed: readonly unknown[]): 2 | 3 => (placed.length === 3 ? 3 : 2);

// Each kept where it can be, in turn, so the same one wins a crowded spot;
// keep sees those settled before it and, for one that must move, every
// other (those still to come as they were), so it lands in nobody's way.
export type Keep<T> = (item: T, settled: T[], all: T[]) => T | null;
export function keepInTurn<T extends Member>(items: readonly T[], keep: Keep<T>): T[] {
  return placeInTurn<T, T>(items, (item, settled) => keep(item, settled, [...settled, ...items.filter((o) => o.id > item.id)]));
}

// Those missing from the kept, placed afresh clear of them, up to the target
// and never beyond it, so scrolling never adds animals.
export function fillTo<T extends Member>(target: number, kept: readonly T[], place: (others: T[], id: number) => T | null): T[] {
  const missing = Array.from({ length: target }, (_, id) => id).filter((id) => !kept.some((k) => k.id === id));
  return placeIds<T>(missing, (others, id) => place([...kept, ...others], id));
}

// After a layout change: each kept where it can be, then any missing placed
// afresh; in id order.
export function regroup<T extends Member>(items: readonly T[], target: number, keep: Keep<T>, place: (others: T[], id: number) => T | null): T[] {
  const kept = keepInTurn(items, keep);
  return [...kept, ...fillTo(target, kept, place)].sort((a, b) => a.id - b.id);
}
