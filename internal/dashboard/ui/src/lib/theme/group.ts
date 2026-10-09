// Animals that share the page are stepped and placed one after another, in a
// fixed order, each seeing the others as they now are, so the rules that keep
// them apart hold at every step and the same one always wins a contested spot.

// Each in turn steps, seeing the others as they now are; then each of the
// others may react to what it did.
export function inTurn<T>(items: readonly T[], step: (item: T, others: T[]) => T, react: (before: T, after: T, other: T) => T): T[] {
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
