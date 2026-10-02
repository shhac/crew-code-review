import type { Floor } from './spiderwalk';

// The page has no one "card" class: most pages use .surface, the queue board
// is a bare section, logs are .terminal. Listing them here keeps the pages
// free of decoration hooks; a new kind of card only needs adding here to
// become somewhere a spider can walk.
const CARD_TOPS = 'main .surface, main .panel, main section, main .terminal';
// Page headings sit on a rule; the spider walks along the rule, not the text.
const HEADING_RULES = 'main .hero, main .page-head';

const MIN_WIDTH = 120;
// A nested card that starts where its parent does is the same edge twice.
const SAME_EDGE = 8;
// A spider standing on a floor needs this much clear space above it, or the
// floor above runs through its body (a card tucked right under a heading rule).
const HEADROOM = 34;

// A floor also knows how much clear space sits on it, up to whatever is
// above: enough for a spider to pass under is not enough to stand a candle.
export type Ledge = Floor & { room: number };

// What measuring needs from the page: the document, or a fake one in tests.
type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type Measurable = { getBoundingClientRect(): Box; children?: ArrayLike<Measurable> };
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
  return f.y - Math.max(0, ...above);
}

// Every floor on the page right now, keyed by an id stable for the life of
// its element, in viewport coordinates.
export function measureFloors(root: Page = document): Map<number, Ledge> {
  const floors = new Map<number, Floor>();
  const rooms = new Map<number, number>();
  const blocks: Box[] = [];
  const add = (el: Measurable, edge: 'top' | 'bottom') => {
    const r = el.getBoundingClientRect();
    if (r.width < MIN_WIDTH || r.height === 0) return;
    blocks.push(r);
    const floor = { left: r.left, right: r.right, y: r[edge], base: r.bottom };
    if ([...floors.values()].some((f) => overlaps(f, floor))) return;
    floors.set(idOf(el), floor);
    if (edge === 'bottom') rooms.set(idOf(el), roomInside(el, r));
  };
  // Document order lists a parent before its children, so the outer card
  // claims a shared edge and the inner one is skipped.
  root.querySelectorAll(CARD_TOPS).forEach((el) => add(el, 'top'));
  root.querySelectorAll(HEADING_RULES).forEach((el) => add(el, 'bottom'));
  const all = [...floors.values()];
  return new Map(
    [...floors]
      .filter(([, f]) => !cramped(f, all))
      .map(([id, f]) => [id, { ...f, room: rooms.get(id) ?? roomAbove(f, blocks) }]),
  );
}
