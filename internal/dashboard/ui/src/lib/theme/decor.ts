// What every ledge decoration (frost, grass, embers, petals) does when the
// page is measured again: keep what it remembers where it is still there,
// and share a capped number out across the ledges.

// A decoration seeded from its ledge and spot: the same key at the same x is
// the same one, measured again.
type Keyed = { key: string; x: number };

// The fresh ones, each kept as it was where the same one is still in the
// same place (by default whole, else through carry), so a glint mid-glint or
// a blade mid-sway carries on rather than restarting.
export function keepByKey<T extends Keyed>(old: readonly T[] | undefined, fresh: readonly T[], carry: (before: T, now: T) => T = (before) => before): T[] {
  const held = new Map(old?.map((d) => [d.key, d]));
  return fresh.map((d) => {
    const before = held.get(d.key);
    return before && before.x === d.x ? carry(before, d) : d;
  });
}

// One of each ledge's in turn, up to the cap, so a long page keeps some on
// every ledge rather than all of them on the first few cards.
export function shareOut<T>(all: readonly (readonly T[])[], cap: number): Set<T> {
  const rounds = Math.max(0, ...all.map((p) => p.length));
  return new Set(Array.from({ length: rounds }, (_, i) => all.flatMap((p) => p.slice(i, i + 1))).flat().slice(0, cap));
}
