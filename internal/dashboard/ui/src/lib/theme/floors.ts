import type { Floor } from './scene';

// Only actual cards have walls. A layout section (notably the KPI grid) must
// not bridge the gaps between its children with an invisible platform.
const CARD_TOPS = 'main .surface, main .queue-board, main .context section, main .terminal, main .metric-kpis > div, main .panel';
// Page headings sit on a rule; the spider walks along the rule, not the text.
const HEADING_RULES = 'main .hero, main .page-head';

// A block is a card's own box, empty at its edges; everything else (text,
// controls, charts) is content, never to be covered.
export type Obstacle = { left: number; right: number; top: number; bottom: number; block?: true };
const visibleBox = (r: Box) => r.width > 0 && r.height > 0 && [r.left, r.right, r.top, r.bottom].every(Number.isFinite);
// Range rectangles follow rendered text (including wrapped lines), independent
// of the element's tag. Container bounds would also block their empty space.
export function measureRenderedText(doc: Document = document): Obstacle[] {
  const main = doc.querySelector('main');
  if (!main) return [];
  const walker = doc.createTreeWalker(main, 4 /* NodeFilter.SHOW_TEXT */);
  const range = doc.createRange();
  const boxes: Obstacle[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!node.textContent?.trim() || !parent || parent.closest('script, style, template')) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === 'hidden' || style.visibility === 'collapse' || style.display === 'none') continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (visibleBox(r)) boxes.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
  }
  return boxes;
}
// Text and charts block birds even when they do not provide a ledge.
export function measureObstacles(root: Page = document, text: () => readonly Obstacle[] = measureRenderedText): Obstacle[] {
  const boxes = [...text()];
  // A DOMRect's sides are getters, so a block is copied field by field.
  root.querySelectorAll(CARD_TOPS).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (visibleBox(r)) boxes.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, block: true });
  });
  // Controls can paint values without DOM text nodes; retain their full bounds.
  root.querySelectorAll('main svg, main canvas, main button, main input, main textarea, main select').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (visibleBox(r)) boxes.push(r);
  });
  return boxes;
}

const MIN_WIDTH = 120;
// A nested card that starts where its parent does is the same edge twice.
const SAME_EDGE = 8;
// A floor also knows how much clear space sits on it, up to whatever is
// above: enough for a spider to pass under is not enough to stand a candle.
// headroom is narrower: the gap up to the nearest floor overlapping it from
// above, which is what runs through a creature standing there. Each creature
// decides for itself how much it needs.
export type Ledge = Floor & { room: number; headroom: number; kind?: 'card' | 'heading' };

// What measuring needs from the page: the document, or a fake one in tests.
type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type Measurable = { getBoundingClientRect(): Box; children?: ArrayLike<Measurable>; matches?(selector: string): boolean };
type Page = { querySelectorAll(selectors: string): { forEach(visit: (el: Measurable) => void): void } };

const ids = new WeakMap<Measurable, number>();
let nextId = 1;

function idOf(el: Measurable): number {
  const known = ids.get(el);
  if (known !== undefined) return known;
  ids.set(el, nextId);
  return nextId++;
}

const spans = (a: { left: number; right: number }, b: { left: number; right: number }) => a.left < b.right && b.left < a.right;
const overlaps = (a: Floor, b: Floor) => Math.abs(a.y - b.y) < SAME_EDGE && spans(a, b);
const headroom = (f: Floor, all: Floor[]) => Math.min(Infinity, ...all.filter((g) => g.y < f.y && spans(f, g)).map((g) => f.y - g.y));

// The clear space on a heading rule is what its own content leaves free.
function roomInside(el: Measurable, r: Box): number {
  const kids = Array.from(el.children ?? [], (k) => k.getBoundingClientRect().bottom);
  return kids.length === 0 ? r.height : r.bottom - Math.max(...kids);
}

// The clear space on a card top runs up to the nearest thing above it.
function roomAbove(f: Floor, blocks: Box[]): number {
  const above = blocks.filter((b) => b.bottom <= f.y + 1 && spans(f, b)).map((b) => b.bottom);
  // Above-screen cards still leave real clearance over the visible card.
  return above.length ? f.y - Math.max(...above) : Infinity;
}

// Every floor on the page right now, keyed by an id stable for the life of
// its element, in viewport coordinates.
export function measureFloors(root: Page = document): Map<number, Ledge> {
  const floors = new Map<number, Floor>();
  const rooms = new Map<number, number>();
  const kinds = new Map<number, Ledge['kind']>();
  const blocks: Box[] = [];
  const add = (el: Measurable, edge: 'top' | 'bottom') => {
    const r = el.getBoundingClientRect();
    if (r.width < MIN_WIDTH || r.height === 0) return;
    blocks.push(r);
    // The leaderboard's panel is a set of horizontal table rules, not a box
    // with solid side walls. Heading rules have no walls either.
    const floor = { left: r.left, right: r.right, y: r[edge], base: el.matches?.('.panel') ? r[edge] : r.bottom };
    if ([...floors.values()].some((f) => overlaps(f, floor))) return;
    floors.set(idOf(el), floor);
    kinds.set(idOf(el), edge === 'top' ? 'card' : 'heading');
    if (edge === 'bottom') rooms.set(idOf(el), roomInside(el, r));
  };
  // Document order lists a parent before its children, so the outer card
  // claims a shared edge and the inner one is skipped.
  root.querySelectorAll(CARD_TOPS).forEach((el) => add(el, 'top'));
  root.querySelectorAll(HEADING_RULES).forEach((el) => add(el, 'bottom'));
  const all = [...floors.values()];
  return new Map(
    [...floors]
      // A ledge with no headroom stays: its walls and its own decorations do
      // not depend on what can stand on it.
      .map(([id, f]) => [id, { ...f, kind: kinds.get(id), headroom: headroom(f, all), room: rooms.get(id) ?? roomAbove(f, blocks) }]),
  );
}

// How tall something can stand on f over the stretch x0..x1 (ledge-local):
// up to the next ledge above, and lower wherever text, a control, a chart or
// a card overhangs that stretch. With reach, it may also rise that far past
// the bottom edge of a card or a ledge above, into their empty edges, but
// never into content.
export function clearance(f: Ledge, obstacles: readonly Obstacle[], x0: number, x1: number, reach = 0): number {
  const over = obstacles.filter((o) => o.top < f.y - 1 && o.right > f.left + x0 && o.left < f.left + x1);
  return Math.min(f.headroom + reach, ...over.map((o) => f.y - o.bottom + (o.block ? reach : 0)));
}

// A stretch of a ledge, in ledge-local x.
export type Run = { lo: number; hi: number };

// The stretches of f where something height tall fits, sampled every step px
// and kept inset px in from each end (reach as for clearance).
export function clearRuns(f: Ledge, obstacles: readonly Obstacle[], height: number, { inset = 8, step = 4, reach = 0 } = {}): Run[] {
  if (f.headroom + reach < height) return [];
  // Only what overhangs low enough can block; the rest is skipped per sample.
  const low = obstacles.filter((o) => f.y - o.bottom < height);
  const count = Math.max(0, Math.floor((f.right - f.left - 2 * inset) / step) + 1);
  const xs = Array.from({ length: count }, (_, i) => inset + i * step);
  return xs.reduce<Run[]>((runs, x) => {
    if (clearance(f, low, x - step / 2, x + step / 2, reach) < height) return runs;
    const last = runs.at(-1);
    return last && last.hi === x - step ? [...runs.slice(0, -1), { lo: last.lo, hi: x }] : [...runs, { lo: x, hi: x }];
  }, []);
}

// One measurement of everything a scene is placed against, taken together so
// its ledges and obstacles always describe the same layout.
export type PageMap = { floors: ReadonlyMap<number, Ledge>; obstacles: readonly Obstacle[]; width: number; height: number };

// Walking every text node is the costly part, so a scene that never steers
// around text can leave the obstacles out.
export function measurePage({ obstacles = true } = {}): PageMap {
  return { floors: measureFloors(), obstacles: obstacles ? measureObstacles() : [], width: innerWidth, height: innerHeight };
}

// Where a creature may newly settle or head for: clear of the top bar and the
// window's bottom edge, and wholly inside the window's width.
const TOP_MARGIN = 70;
const BOTTOM_MARGIN = 30;
export const inView = (f: Ledge, scene: PageMap) => f.y >= TOP_MARGIN && f.y <= scene.height - BOTTOM_MARGIN && f.left >= 0 && f.right <= scene.width;

export const samePage = (a: PageMap, b: PageMap) => a.width === b.width && a.height === b.height
  && JSON.stringify([...a.floors]) === JSON.stringify([...b.floors]) && JSON.stringify(a.obstacles) === JSON.stringify(b.obstacles);
