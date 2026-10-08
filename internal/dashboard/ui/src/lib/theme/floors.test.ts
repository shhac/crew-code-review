import { describe, expect, it } from 'vitest';
import { clearance, clearRuns, measureFloors, samePage } from './floors';
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
});
