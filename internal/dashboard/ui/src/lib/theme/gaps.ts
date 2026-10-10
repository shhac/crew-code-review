import type { Ledge, Obstacle, PageMap, Run } from './floors';

// The gaps between neighbouring ledges, where things may hang (June's
// bunting) or play (July's courts): beside each other across a gutter, or in
// the band under a heading rule. Viewport coordinates, from a PageMap alone,
// so a gap always describes the same layout as its ledges and obstacles.
// design-docs/fete/README.md has the definition and the survey behind its
// numbers.

// One end of a gap: a ledge's end, by the ledge's id and which end.
export type GapEnd = { ledge: number; side: 'left' | 'right'; x: number; y: number };
// from is the gap's left end and to its right (from.x < to.x). step is the
// height between the ends of a side gap, or an under gap's band. Anything
// hung in the gap starts at top and may reach down to bottom, before any
// obstacle a stretch has (gapDepth).
export type Gap = { id: string; kind: 'side' | 'under'; from: GapEnd; to: GapEnd; step: number; top: number; bottom: number };

// Side gaps: a gutter this wide, ends this far apart in height.
const MIN_SPAN = 8;
const MAX_SPAN = 160;
const MAX_STEP = 40;
// A third ledge this near the ends' height across the gutter splits it.
const CROSSING = 8;
// How far down a side gap's column is ever counted.
const DROP = 120;
// Under gaps: a band this tall, over a shared stretch this long.
const MIN_BAND = 12;
const MAX_BAND = 80;
const MIN_SHARED = 60;

// A ledge end's id: the ledge's id and l or r (12r, 15l).
export const endId = (e: GapEnd) => `${e.ledge}${e.side === 'left' ? 'l' : 'r'}`;

const end = (ledge: number, f: Ledge, side: GapEnd['side'], y = f.y): GapEnd => ({ ledge, side, x: side === 'left' ? f.left : f.right, y });

type Entry = readonly [number, Ledge];
type Candidate = { gap: Gap; span: number };

// What lies in the column left..right, overlapping it (touching does not).
const inColumn = (obstacles: readonly Obstacle[], left: number, right: number) => obstacles.filter((o) => o.left < right && o.right > left);

function sideCandidate([a, A]: Entry, [b, B]: Entry, ledges: readonly Entry[], obstacles: readonly Obstacle[]): Candidate | null {
  const span = B.left - A.right;
  const step = Math.abs(B.y - A.y);
  if (a === b || span < MIN_SPAN || span > MAX_SPAN || step > Math.min(MAX_STEP, span)) return null;
  const lo = Math.min(A.y, B.y) - CROSSING;
  const hi = Math.max(A.y, B.y) + CROSSING;
  if (ledges.some(([c, C]) => c !== a && c !== b && C.left < B.left && C.right > A.right && C.y >= lo && C.y <= hi)) return null;
  const top = Math.min(A.y, B.y);
  const column = inColumn(obstacles, A.right, B.left);
  // Something spanning the gutter at the ends' height: nothing hangs there.
  if (column.some((o) => o.top < top && o.bottom > top)) return null;
  const bottom = Math.min(top + DROP, ...column.filter((o) => o.top >= top).map((o) => o.top));
  const from = end(a, A, 'right');
  const to = end(b, B, 'left');
  return { span, gap: { id: `${endId(from)}-${endId(to)}`, kind: 'side', from, to, step, top, bottom } };
}

// Nearest first (smallest span, then step, then ids), each ledge end in one
// gap at most: a contested end keeps its nearest neighbour.
function sideGaps(ledges: readonly Entry[], obstacles: readonly Obstacle[]): Gap[] {
  const candidates = ledges
    .flatMap((a) => ledges.map((b) => sideCandidate(a, b, ledges, obstacles)))
    .filter((c): c is Candidate => c !== null)
    .sort((p, q) => p.span - q.span || p.gap.step - q.gap.step || p.gap.from.ledge - q.gap.from.ledge || p.gap.to.ledge - q.gap.to.ledge);
  return candidates.reduce<{ gaps: Gap[]; used: ReadonlySet<string> }>(({ gaps, used }, { gap }) => {
    const ends = [endId(gap.from), endId(gap.to)];
    if (ends.some((e) => used.has(e))) return { gaps, used };
    return { gaps: [...gaps, gap], used: new Set([...used, ...ends]) };
  }, { gaps: [], used: new Set() }).gaps;
}

// The band between a heading rule and the nearest ledge below it over their
// shared stretch. Each end is named by the ledge end that bounds it, the
// innermost of the two (the lower ledge's on a tie), at the rule's height.
function underGap([h, H]: Entry, [l, L]: Entry, ledges: readonly Entry[]): Gap | null {
  const band = L.y - H.y;
  const left = Math.max(H.left, L.left);
  const right = Math.min(H.right, L.right);
  if (l === h || band < MIN_BAND || band > MAX_BAND || right - left < MIN_SHARED) return null;
  if (ledges.some(([m, M]) => m !== h && m !== l && M.y > H.y && M.y < L.y && M.left < right && M.right > left)) return null;
  const from = L.left >= H.left ? end(l, L, 'left', H.y) : end(h, H, 'left');
  const to = L.right <= H.right ? end(l, L, 'right', H.y) : end(h, H, 'right');
  return { id: `${h}/${l}`, kind: 'under', from, to, step: band, top: H.y, bottom: L.y };
}

// Every gap on the page: side gaps first, then under gaps, each in ledge
// order. A gap's id holds while both its ledges' elements live, so whatever
// is seeded by it stays put across scrolls and resizes.
export function measureGaps(page: PageMap): Gap[] {
  const ledges = [...page.floors];
  const headings = ledges.filter(([, f]) => f.kind === 'heading');
  const under = headings.flatMap((h) => ledges.map((l) => underGap(h, l, ledges))).filter((g): g is Gap => g !== null);
  return [...sideGaps(ledges, page.obstacles), ...under];
}

// How far below g.top the stretch x0..x1 (gap-local, from g.from.x) is free
// of obstacles, up to g.bottom: clearance mirrored, for hanging things.
export function gapDepth(g: Gap, obstacles: readonly Obstacle[], x0: number, x1: number): number {
  const below = inColumn(obstacles, g.from.x + x0, g.from.x + x1).filter((o) => o.bottom > g.top);
  return Math.min(g.bottom - g.top, ...below.map((o) => Math.max(0, o.top - g.top)));
}

// The stretches of g (gap-local) where something depth deep hangs clear,
// sampled every step px and kept inset px from each end, as clearRuns does
// for ledges. A side gap is one column, so it is all one stretch or none.
export function gapRuns(g: Gap, obstacles: readonly Obstacle[], depth: number, { inset = 4, step = 4 } = {}): Run[] {
  const width = g.to.x - g.from.x;
  if (g.kind === 'side') return gapDepth(g, obstacles, 0, width) >= depth ? [{ lo: 0, hi: width }] : [];
  const count = Math.max(0, Math.floor((width - 2 * inset) / step) + 1);
  const xs = Array.from({ length: count }, (_, i) => inset + i * step).filter((x) => gapDepth(g, obstacles, x - step / 2, x + step / 2) >= depth);
  return xs.reduce<Run[]>((runs, x) => {
    const last = runs.at(-1);
    return last && last.hi === x - step ? [...runs.slice(0, -1), { lo: last.lo, hi: x }] : [...runs, { lo: x, hi: x }];
  }, []);
}

// One number for seed.ts's hash, from the gap's id (its two ledges and its
// kind), so it is the same on every measurement.
export const gapSeed = (g: Gap) => [...g.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 1_000_003, 7);

// July's courts: side gaps between two card tops level within 2px, 8 to 48px
// apart. A filter on the gaps, not a second measurement.
const COURT_SPAN = 48;
const COURT_STEP = 2;
export function courts(page: PageMap, gaps: readonly Gap[] = measureGaps(page)): Gap[] {
  const card = (e: GapEnd) => page.floors.get(e.ledge)?.kind === 'card';
  return gaps.filter((g) => g.kind === 'side' && g.step <= COURT_STEP && g.to.x - g.from.x <= COURT_SPAN && card(g.from) && card(g.to));
}
