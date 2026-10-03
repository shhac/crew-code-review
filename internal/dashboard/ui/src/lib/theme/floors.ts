import type { Floor } from './scene';

// Only actual cards have walls. A layout section (notably the KPI grid) must
// not bridge the gaps between its children with an invisible platform.
const CARD_TOPS = 'main .surface, main .queue-board, main .context section, main .terminal, main .metric-kpis > div, main .panel';
// Page headings sit on a rule; the spider walks along the rule, not the text.
const HEADING_RULES = 'main .hero, main .page-head';

export type Obstacle = { left: number; right: number; top: number; bottom: number };
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
  // Controls can paint values without DOM text nodes; retain their full bounds.
  root.querySelectorAll(`${CARD_TOPS}, main svg, main canvas, main button, main input, main textarea, main select`).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (visibleBox(r)) boxes.push(r);
  });
  return boxes;
}

const MIN_WIDTH = 120;
// A nested card that starts where its parent does is the same edge twice.
const SAME_EDGE = 8;
// A spider standing on a floor needs this much clear space above it, or the
// floor above runs through its body (a card tucked right under a heading rule).
const HEADROOM = 34;

// A floor also knows how much clear space sits on it, up to whatever is
// above: enough for a spider to pass under is not enough to stand a candle.
export type Ledge = Floor & { room: number; kind?: 'card' | 'heading' };

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
const cramped = (f: Floor, all: Floor[]) => all.some((g) => g.y < f.y && f.y - g.y < HEADROOM && spans(f, g));

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
      // Retain the card's wall geometry even if its top has no headroom.
      // Arrival and landing choose only walkable ledges.
      .map(([id, f]) => [id, { ...f, kind: kinds.get(id), walkable: !cramped(f, all), room: rooms.get(id) ?? roomAbove(f, blocks) }]),
  );
}
