import { describe, expect, it } from 'vitest';
import { clearance, clearRuns, measureFloors, reachOf, samePage, wallRuns, walls, type Ledge, type PageMap } from './floors';
import { dashboardPage } from './test-scene';
import { fits } from './spiderwalk/model';

// measureFloors only needs querySelectorAll and rects, so a fake page stands
// in for the document.
type Box = { left: number; right: number; top: number; bottom: number };
const el = (r: Box) => ({ getBoundingClientRect: () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top }) });
const page = (cards: Box[], rules: Box[] = []) => ({
  querySelectorAll: (sel: string) => (sel.includes('.hero') ? rules : cards).map(el),
});
const ys = (root: ReturnType<typeof page>) => [...measureFloors(root).values()].filter(fits).map((f) => f.y).sort((a, b) => a - b);

describe('measureFloors', () => {
  it('retains element IDs through scroll and classifies heading content clearance', () => {
    let scroll = 0;
    const card = { getBoundingClientRect: () => ({ left: 0, right: 200, top: 200 - scroll, bottom: 400 - scroll, width: 200, height: 200 }) };
    const heading = { ...el({ left: 0, right: 200, top: 40, bottom: 100 }), children: [el({ left: 0, right: 180, top: 40, bottom: 98 })] };
    const root = { querySelectorAll: (sel: string) => sel.includes('.hero') ? [heading] : [card] };
    const before = measureFloors(root);
    const id = [...before].find(([, f]) => f.kind === 'card')![0];
    expect([...before.values()].find((f) => f.kind === 'heading')?.room).toBe(2);
    scroll = 20;
    expect(measureFloors(root).get(id)).toMatchObject({ y: 180, kind: 'card', base: 380 });
  });

  it('walks card tops and heading rules', () => {
    expect(ys(page([{ left: 0, right: 600, top: 300, bottom: 500 }], [{ left: 0, right: 600, top: 40, bottom: 160 }]))).toEqual([160, 300]);
  });

  it('counts a nested card that shares its parent top edge once', () => {
    const outer = { left: 0, right: 600, top: 200, bottom: 600 };
    const inner = { left: 0, right: 598, top: 202, bottom: 260 };
    expect(ys(page([outer, inner]))).toEqual([200]);
  });

  it('keeps the walls of a cramped card without offering its top as a landing', () => {
    const root = page([{ left: 0, right: 600, top: 184, bottom: 500 }], [{ left: 0, right: 600, top: 40, bottom: 160 }]);
    expect(ys(root)).toEqual([160]);
    expect([...measureFloors(root).values()]).toContainEqual(expect.objectContaining({ y: 184, base: 500, headroom: 24 }));
  });

  it('measures headroom to the nearest overlapping floor above, or none', () => {
    const root = page([
      { left: 0, right: 300, top: 194, bottom: 500 },
      { left: 400, right: 700, top: 100, bottom: 500 },
    ], [{ left: 0, right: 700, top: 40, bottom: 160 }]);
    const byY = new Map([...measureFloors(root).values()].map((f) => [f.y, f.headroom]));
    expect(byY).toEqual(new Map([[160, 60], [194, 34], [100, Infinity]]));
  });

  it('lets a spider stand at exactly its headroom and not a hair under', () => {
    const ledge = { left: 0, right: 600, y: 200, base: 400 };
    expect(fits({ ...ledge, headroom: 34 })).toBe(true);
    expect(fits({ ...ledge, headroom: 33.9 })).toBe(false);
    expect(fits(ledge)).toBe(true);
  });

  it('measures physical cards rather than the layout section between them', () => {
    let selected = '';
    measureFloors({ querySelectorAll: (sel) => { if (!sel.includes('.hero')) selected = sel; return []; } });
    expect(selected).toContain('.metric-kpis > div');
    expect(selected).not.toMatch(/main section(?:,|$)/);
  });

  it('does not invent side walls for a borderless table panel', () => {
    const panel = { ...el({ left: 0, right: 600, top: 200, bottom: 700 }), matches: () => true };
    const root = { querySelectorAll: (sel: string) => sel.includes('.hero') ? [] : [panel] };
    expect([...measureFloors(root).values()][0]).toMatchObject({ y: 200, base: 200 });
  });

  it('preserves clearance when the preceding card scrolls above the viewport', () => {
    const root = page([{ left: 0, right: 600, top: -200, bottom: -40 }, { left: 0, right: 600, top: 10, bottom: 300 }]);
    expect([...measureFloors(root).values()].find((f) => f.y === 10)?.room).toBe(50);
  });

  it('ignores slivers too narrow to walk', () => {
    expect(ys(page([{ left: 0, right: 80, top: 300, bottom: 400 }]))).toEqual([]);
  });
});

describe('samePage', () => {
  const ledge = { left: 0, right: 600, y: 200, base: 400, room: 50, headroom: Infinity, kind: 'card' as const };
  const map = (y = 200, obstacles = [{ left: 0, right: 10, top: 0, bottom: 10 }], width = 1000) =>
    ({ floors: new Map([[1, { ...ledge, y }]]), obstacles, width, height: 800 });

  it('treats separately measured but identical pages as the same, open headroom included', () => {
    expect(samePage(map(), map())).toBe(true);
  });

  it('sees a scroll, a moved obstacle or a resize as a change', () => {
    expect(samePage(map(), map(180))).toBe(false);
    expect(samePage(map(), map(200, [{ left: 0, right: 12, top: 0, bottom: 10 }]))).toBe(false);
    expect(samePage(map(), map(200, undefined, 900))).toBe(false);
  });

  it('sees main moving on its own as a change, so the air in it is measured again', () => {
    const main = { left: 240, right: 1000, top: 0, bottom: 1600 };
    expect(samePage({ ...map(), main }, { ...map(), main: { ...main } })).toBe(true);
    expect(samePage({ ...map(), main }, { ...map(), main: { ...main, bottom: 1200 } })).toBe(false);
    expect(samePage({ ...map(), main }, map())).toBe(false);
  });
});

describe('clearance', () => {
  const f = { left: 100, right: 500, y: 300, base: 400, room: 50, headroom: 40, kind: 'card' as const };
  const text = { left: 200, right: 260, top: 270, bottom: 284 };

  it('is the headroom, lowered by whatever overhangs the stretch', () => {
    expect(clearance(f, [text], 0, 50)).toBe(40);
    expect(clearance(f, [text], 90, 110)).toBe(16);
    // Something below the ledge, or starting at it, is not overhead.
    expect(clearance(f, [{ left: 100, right: 500, top: 300, bottom: 400 }], 0, 400)).toBe(40);
  });

  it('splits the ledge into the runs where something that tall fits', () => {
    expect(clearRuns(f, [text], 20)).toEqual([{ lo: 8, hi: 96 }, { lo: 164, hi: 392 }]);
    expect(clearRuns(f, [text], 16)).toEqual([{ lo: 8, hi: 392 }]);
    expect(clearRuns(f, [], 41)).toEqual([]);
  });

  it('with reach, rises into the empty edge of a card or ledge above, never into content', () => {
    const card = { left: 100, right: 500, top: 200, bottom: 284, block: true as const };
    expect(clearance(f, [card], 0, 50)).toBe(16);
    expect(clearance(f, [card], 0, 50, 6)).toBe(22);
    expect(clearance(f, [text], 90, 110, 6)).toBe(16);
    expect(clearance(f, [], 0, 50, 6)).toBe(46);
    expect(clearRuns(f, [card], 20)).toEqual([]);
    expect(clearRuns(f, [card], 20, { reach: 6 })).toEqual([{ lo: 8, hi: 392 }]);
    expect(clearRuns(f, [card, text], 20, { reach: 6 })).toEqual([{ lo: 8, hi: 96 }, { lo: 164, hi: 392 }]);
  });
});

describe('reachOf', () => {
  it('stands a walker on its anchor, half its width either way and its height up', () => {
    expect(reachOf({ width: 30, height: 24 })).toEqual({ half: 15, up: 24, down: 0 });
  });
});

describe('walls', () => {
  // The dashboard fixture's cards (2, 3, 4) under its heading rule (1), with
  // main beside a 236px rail.
  const MAIN = { left: 236, right: 1440, top: 0, bottom: 1600 };
  const withMain = (p: PageMap): PageMap => ({ ...p, main: MAIN });
  const plus = (p: PageMap, id: number, f: Ledge): PageMap => ({
    ...p, floors: new Map([...p.floors, [id, f]]),
    obstacles: [...p.obstacles, ...(f.base > f.y ? [{ left: f.left, right: f.right, top: f.y, bottom: f.base, block: true }] : [])],
  });
  const card = (left: number, right: number, y: number, base: number): Ledge => ({ left, right, y, base, room: 22, headroom: 22, kind: 'card' });

  it('gives each card its two sides, and headings, panels and short cards none', () => {
    const page = plus(plus(dashboardPage(), 5, card(300, 900, 500, 500)), 6, card(300, 900, 600, 620));
    expect(walls(page).map((w) => w.id)).toEqual(['2:l', '2:r', '3:l', '3:r', '4:l', '4:r']);
    expect(walls(page)[0]).toEqual({ id: '2:l', floor: 2, side: -1, x: 300, top: 182, bottom: 400 });
    expect(walls(page)[1]).toMatchObject({ side: 1, x: 646 });
  });

  it('are exactly the sides the spiders and the overlay already used', () => {
    const page = dashboardPage();
    const implicit = [...page.floors.values()].filter((f) => f.base > f.y).flatMap((f) => [f.left, f.right].map((x) => ({ x, top: f.y, bottom: f.base })));
    expect(walls(page).map(({ x, top, bottom }) => ({ x, top, bottom }))).toEqual(implicit);
  });

  it('leaves out a nested card side facing into its parent, but keeps one only partly covered', () => {
    const nested = plus(dashboardPage(), 5, card(1030, 1290, 250, 350));
    expect(walls(nested).filter((w) => w.floor === 5)).toEqual([]);
    const partly = plus(dashboardPage(), 5, card(1290, 1400, 300, 500));
    expect(walls(partly).filter((w) => w.floor === 5).map((w) => w.id)).toEqual(['5:l', '5:r']);
  });

  it('keeps its ids across a scroll and a card growing', () => {
    const page = dashboardPage();
    const scrolled: PageMap = {
      ...page,
      floors: new Map([...page.floors].map(([id, f]) => [id, { ...f, y: f.y - 100, base: f.base - 100 }])),
      obstacles: page.obstacles.map((o) => ({ ...o, top: o.top - 100, bottom: o.bottom - 100 })),
    };
    expect(walls(scrolled).map((w) => [w.id, w.top])).toEqual(walls(page).map((w) => [w.id, w.top - 100]));
    const grown = dashboardPage([], [card(300, 646, 182, 600), card(660, 1006, 182, 400), card(1020, 1300, 182, 400)]);
    expect(walls(grown).map((w) => w.id)).toEqual(walls(page).map((w) => w.id));
    expect(walls(grown)[0].bottom).toBe(600);
  });
});

describe('wallRuns', () => {
  const MAIN = { left: 236, right: 1440, top: 0, bottom: 1600 };
  const page = (extra: PageMap['obstacles'] = []): PageMap => ({ ...dashboardPage(extra), main: MAIN });
  const wall = (p: PageMap, id: string) => walls(p).find((w) => w.id === id)!;

  it('runs the length of the wall, inset at each end, where nothing stands in front', () => {
    expect(wallRuns(wall(page(), '2:l'), page(), 34)).toEqual([{ lo: 8, hi: 208 }]);
    expect(wallRuns(wall(page(), '4:r'), page(), 34, { inset: 4, step: 2 })).toEqual([{ lo: 4, hi: 214 }]);
  });

  it('stops at text beside the wall, and at content just inside it', () => {
    const beside = page([{ left: 280, right: 296, top: 250, bottom: 266 }]);
    expect(wallRuns(wall(beside, '2:l'), beside, 34)).toEqual([{ lo: 8, hi: 64 }, { lo: 88, hi: 208 }]);
    const inside = page([{ left: 301, right: 340, top: 300, bottom: 316 }]);
    expect(wallRuns(wall(inside, '2:l'), inside, 34)).toEqual([{ lo: 8, hi: 116 }, { lo: 136, hi: 208 }]);
  });

  it('stops at a neighbouring card closer than the depth, and at the edge of main', () => {
    expect(wallRuns(wall(page(), '2:r'), page(), 34)).toEqual([]);
    expect(wallRuns(wall(page(), '2:r'), page(), 12)).toEqual([{ lo: 8, hi: 208 }]);
    expect(wallRuns(wall(page(), '2:l'), page(), 70)).toEqual([]);
    expect(wallRuns(wall(page(), '2:l'), page(), 64)).toEqual([{ lo: 8, hi: 208 }]);
  });

  it('stops at the window, and needs main measured', () => {
    const short = { ...page(), height: 300 };
    expect(wallRuns(wall(short, '2:l'), short, 34)).toEqual([{ lo: 8, hi: 116 }]);
    expect(wallRuns(wall(page(), '2:l'), dashboardPage(), 34)).toEqual([]);
  });
});
