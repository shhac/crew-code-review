import type { Ledge } from '../floors';

export type Perch = { floor: number; x: number; dir: 1 | -1 };
export type Sample = { x: number; depth: number };

function eligible(f: Ledge, width: number, height: number, x: number): boolean {
  const px = f.left + x;
  return [f.left, f.right, f.y, width, height, x].every(Number.isFinite)
    && f.walkable !== false && f.room >= 42 && f.y >= 42 && f.y <= height - 12
    && x >= 24 && x <= f.right - f.left - 24 && px >= 24 && px <= width - 24;
}

// Retain a local offset while safe. Layout changes relocate without a journey.
export function choosePerch(floors: ReadonlyMap<number, Ledge>, width: number, height: number, previous: Perch | null = null): Perch | null {
  const held = previous && floors.get(previous.floor);
  if (previous && held && eligible(held, width, height, previous.x)) return previous;
  for (const [id, f] of floors) {
    for (const dir of [1, -1] as const) {
      const x = dir === 1 ? Math.max(24, 24 - f.left) : Math.min(f.right - f.left - 24, width - 24 - f.left);
      if (eligible(f, width, height, x)) return { floor: id, x, dir };
    }
  }
  return null;
}

// Local sampling keeps the seeded shape fixed when a ledge scrolls or resizes.
export function snowProfile(id: number, floor: Ledge, foot?: number): Sample[] {
  if (![floor.left, floor.right, floor.y].every(Number.isFinite) || Number.isNaN(floor.room)) return [];
  const end = floor.right - floor.left - 8;
  const cap = Math.min(floor.kind === 'heading' ? 3 : 7, 9, floor.room - 4);
  if (end <= 8 || cap < 1) return [];
  const xs: number[] = [];
  for (let x = 8; x < end; x += 2) xs.push(x);
  xs.push(end);
  return xs.map((x) => {
    const phase = id * 1.71;
    const wave = Math.sin(x / 39 + phase) + .35 * Math.sin(x / 17 + phase);
    const gap = Math.max(0, Math.min(1, (wave + .45) * 3));
    const taper = Math.min(1, (x - 8) / 12, (end - x) / 12);
    const patch = foot === undefined ? 1 : Math.max(0, Math.min(1, (Math.abs(x - foot) - 10) / 4));
    const depth = Math.min(cap, 3 + 4 * (.5 + .5 * Math.sin(x / 27 + phase))) * gap * taper * patch;
    return { x, depth };
  });
}

export function snowPath(samples: readonly Sample[]): string {
  if (!samples.length) return '';
  return 'M' + samples.map((s) => `${s.x} ${-s.depth}`).join(' L') + ` L${samples[samples.length - 1].x} 0 L${samples[0].x} 0 Z`;
}

export const ROBIN = { width: 128 * .35, height: 112 * .35, anchorX: 64 * .35, anchorY: 100 * .35 };
