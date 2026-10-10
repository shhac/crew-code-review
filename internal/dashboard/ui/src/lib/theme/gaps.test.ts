import { describe, expect, it } from 'vitest';
import type { Box, Ledge, Obstacle, PageMap } from './floors';
import { courts, gapDepth, gapRuns, gapSeed, measureGaps, type Gap } from './gaps';

// Pages as the survey measured them on the running dashboard (rounded px):
// the heading's box (its rule is its bottom), then each card's box, numbered
// from 1 in that order.
type Rect = readonly [left: number, right: number, top: number, bottom: number];
const box = ([left, right, top, bottom]: Rect): Box => ({ left, right, top, bottom });
const heading = ([left, right, , bottom]: Rect): Ledge => ({ left, right, y: bottom, base: bottom, room: 20, headroom: Infinity, kind: 'heading' });
const card = ([left, right, top, bottom]: Rect): Ledge => ({ left, right, y: top, base: bottom, room: 22, headroom: 22, kind: 'card' });
function surveyed(head: Rect, cards: readonly Rect[], content: readonly Obstacle[] = []): PageMap {
  const floors = new Map<number, Ledge>([[1, heading(head)], ...cards.map((c, i) => [i + 2, card(c)] as const)]);
  const blocks = cards.map((c) => ({ ...box(c), block: true }));
  return { floors, obstacles: [...blocks, ...content], width: 1440, height: 900 };
}

const OVERVIEW_1440 = surveyed([290, 1386, 30, 160], [[290, 994, 182, 500], [1016, 1386, 182, 446], [1016, 1386, 462, 764], [1016, 1386, 780, 1019]]);
const OVERVIEW_1024 = surveyed([277, 983, 30, 198], [[277, 983, 220, 538], [277, 622, 560, 877], [638, 983, 560, 877], [277, 622, 893, 1132]]);
const METRICS_1440 = surveyed([290, 1386, 30, 160], [
  [290, 646, 182, 277], [660, 1016, 182, 277], [1030, 1386, 182, 277],
  [290, 646, 291, 386], [660, 1016, 291, 386], [1030, 1386, 291, 386],
  [290, 1023, 404, 751], [1041, 1386, 404, 751], [290, 1386, 769, 1229], [290, 1386, 1247, 1404],
]);
const METRICS_1024 = surveyed([277, 983, 30, 166], [
  [277, 503, 188, 283], [517, 743, 188, 283], [757, 983, 188, 283],
  [277, 503, 297, 392], [517, 743, 297, 392], [757, 983, 297, 392],
  [277, 705, 410, 757], [723, 983, 410, 757], [277, 983, 775, 1235], [277, 983, 1253, 1410],
]);
// The config page's tab bar sits in the band under its heading.
const TABS: Obstacle[] = [box([290, 427, 178, 214]), box([429, 515, 178, 214]), box([517, 630, 178, 214])];
const CONFIG_1440 = surveyed([290, 1190, 30, 178], [[290, 1386, 237, 350], [290, 1386, 368, 597]], TABS);

const summary = (gaps: readonly Gap[]) => gaps.map((g) => [g.id, g.to.x - g.from.x, g.step, g.bottom - g.top]);

describe('measureGaps on the surveyed pages', () => {
  it('finds the overview gutter and the bands under its heading', () => {
    expect(summary(measureGaps(OVERVIEW_1440))).toEqual([['2r-3l', 22, 0, 120], ['1/2', 704, 22, 22], ['1/3', 370, 22, 22]]);
    expect(summary(measureGaps(OVERVIEW_1024))).toEqual([['3r-4l', 16, 0, 120], ['1/2', 706, 22, 22]]);
  });

  it('finds every KPI gutter and the charts', () => {
    expect(summary(measureGaps(METRICS_1440))).toEqual([
      ['2r-3l', 14, 0, 120], ['3r-4l', 14, 0, 120], ['5r-6l', 14, 0, 113], ['6r-7l', 14, 0, 113], ['8r-9l', 18, 0, 120],
      ['1/2', 356, 22, 22], ['1/3', 356, 22, 22], ['1/4', 356, 22, 22],
    ]);
    expect(measureGaps(METRICS_1024).map((g) => g.id)).toEqual(['2r-3l', '3r-4l', '5r-6l', '6r-7l', '8r-9l', '1/2', '1/3', '1/4']);
  });

  it('names each end by the ledge end that bounds it, at the right height', () => {
    const [side, ...under] = measureGaps(OVERVIEW_1440);
    expect(side).toMatchObject({ kind: 'side', from: { ledge: 2, side: 'right', x: 994, y: 182 }, to: { ledge: 3, side: 'left', x: 1016, y: 182 }, top: 182, bottom: 302 });
    // A tie goes to the lower ledge; the heading names an end only where it
    // is the inner one.
    expect(under[0]).toMatchObject({ kind: 'under', from: { ledge: 2, side: 'left', x: 290, y: 160 }, to: { ledge: 2, side: 'right', x: 994, y: 160 }, top: 160, bottom: 182 });
    const narrow = surveyed([400, 900, 30, 160], [[290, 1000, 182, 500]]);
    expect(measureGaps(narrow)[0]).toMatchObject({ from: { ledge: 1, side: 'left', x: 400 }, to: { ledge: 1, side: 'right', x: 900 } });
  });

  it('gives the same ids to the same elements, measured again or scrolled', () => {
    const scrolled = surveyed([290, 1386, -70, 60], [[290, 994, 82, 400], [1016, 1386, 82, 346], [1016, 1386, 362, 664], [1016, 1386, 680, 919]]);
    expect(measureGaps(OVERVIEW_1440)).toEqual(measureGaps(OVERVIEW_1440));
    expect(measureGaps(scrolled).map((g) => g.id)).toEqual(measureGaps(OVERVIEW_1440).map((g) => g.id));
  });
});

describe('side gaps', () => {
  const page = (cards: readonly Rect[], content: readonly Obstacle[] = []) => surveyed([0, 2000, -400, -300], cards, content);
  const ids = (p: PageMap) => measureGaps(p).filter((g) => g.kind === 'side').map((g) => g.id);

  it('take a step up to the span or 40px, whichever is less', () => {
    expect(ids(page([[100, 400, 200, 400], [420, 700, 215, 400]]))).toEqual(['2r-3l']);
    expect(measureGaps(page([[100, 400, 200, 400], [420, 700, 215, 400]]))[0]).toMatchObject({ step: 15, top: 200 });
    expect(ids(page([[100, 400, 200, 400], [420, 700, 230, 400]]))).toEqual([]);
    expect(ids(page([[100, 400, 200, 400], [500, 800, 241, 400]]))).toEqual([]);
    expect(ids(page([[100, 400, 200, 400], [500, 800, 240, 400]]))).toEqual(['2r-3l']);
  });

  it('span 8 to 160px', () => {
    expect(ids(page([[100, 400, 200, 400], [407, 700, 200, 400]]))).toEqual([]);
    expect(ids(page([[100, 400, 200, 400], [560, 800, 200, 400]]))).toEqual(['2r-3l']);
    expect(ids(page([[100, 400, 200, 400], [561, 800, 200, 400]]))).toEqual([]);
  });

  it('are split by a third ledge across the gutter near the ends, not one farther down', () => {
    expect(ids(page([[100, 400, 200, 400], [420, 700, 200, 400], [350, 450, 206, 300]]))).toEqual([]);
    expect(ids(page([[100, 400, 200, 400], [420, 700, 200, 400], [350, 450, 215, 300]]))).toEqual(['2r-3l']);
  });

  it('give a contested end to the nearer neighbour', () => {
    expect(ids(page([[100, 400, 200, 400], [100, 390, 220, 400], [420, 700, 210, 400]]))).toEqual(['2r-4l']);
  });

  it('are left out when something spans the gutter at their height, and stop at what is below', () => {
    const cards: Rect[] = [[100, 400, 200, 400], [420, 700, 200, 400]];
    expect(ids(page(cards, [box([380, 440, 195, 205])]))).toEqual([]);
    expect(measureGaps(page(cards, [box([380, 440, 250, 260])]))[0]).toMatchObject({ top: 200, bottom: 250 });
  });
});

describe('under gaps', () => {
  it('need a band of 12 to 80px over a shared stretch of 60px, under the nearest ledge', () => {
    const under = (head: Rect, cards: readonly Rect[]) => measureGaps(surveyed(head, cards)).filter((g) => g.kind === 'under').map((g) => g.id);
    expect(under([0, 1000, 0, 100], [[0, 1000, 111, 400]])).toEqual([]);
    expect(under([0, 1000, 0, 100], [[0, 1000, 112, 400]])).toEqual(['1/2']);
    expect(under([0, 1000, 0, 100], [[0, 1000, 180, 400]])).toEqual(['1/2']);
    expect(under([0, 1000, 0, 100], [[0, 1000, 181, 400]])).toEqual([]);
    expect(under([0, 1000, 0, 100], [[941, 1200, 120, 400]])).toEqual([]);
    expect(under([0, 1000, 0, 100], [[940, 1200, 120, 400]])).toEqual(['1/2']);
    expect(under([0, 1000, 0, 100], [[0, 1000, 150, 400], [100, 500, 130, 140]])).toEqual(['1/3']);
  });

  it('come only under heading rules', () => {
    expect(measureGaps(surveyed([0, 0, 0, 0], [[0, 1000, 100, 120], [0, 1000, 140, 400]])).filter((g) => g.kind === 'under')).toEqual([]);
  });
});

describe('gapDepth and gapRuns', () => {
  const under = measureGaps(CONFIG_1440)[0];

  it('find the tab bar cutting the config band', () => {
    expect(under).toMatchObject({ id: '1/2', step: 59, top: 178, bottom: 237 });
    expect(gapDepth(under, CONFIG_1440.obstacles, 0, 100)).toBe(0);
    expect(gapDepth(under, CONFIG_1440.obstacles, 400, 500)).toBe(59);
    expect(gapRuns(under, CONFIG_1440.obstacles, 14)).toEqual([{ lo: 344, hi: 896 }]);
    expect(gapRuns(under, [], 14)).toEqual([{ lo: 4, hi: 896 }]);
    expect(gapRuns(under, [], 60)).toEqual([]);
  });

  it('measure down from the top to whatever is below, mirrored from clearance', () => {
    const g = measureGaps(OVERVIEW_1440)[0];
    expect(gapDepth(g, [box([990, 1020, 230, 240])], 0, 22)).toBe(48);
    // Above the gap, or ending at its top, is not in it.
    expect(gapDepth(g, [box([990, 1020, 100, 182])], 0, 22)).toBe(120);
  });

  it('take a side gap whole or not at all', () => {
    const g = measureGaps(OVERVIEW_1440)[0];
    expect(gapRuns(g, OVERVIEW_1440.obstacles, 120)).toEqual([{ lo: 0, hi: 22 }]);
    expect(gapRuns(g, [box([1000, 1004, 250, 260])], 60)).toEqual([{ lo: 0, hi: 22 }]);
    expect(gapRuns(g, [box([1000, 1004, 250, 260])], 80)).toEqual([]);
  });
});

describe('gapSeed', () => {
  it('is the same for the same gap and differs between gaps', () => {
    const [a, b, c] = measureGaps(OVERVIEW_1440);
    expect(gapSeed(a)).toBe(gapSeed(measureGaps(OVERVIEW_1440)[0]));
    expect(new Set([gapSeed(a), gapSeed(b), gapSeed(c)]).size).toBe(3);
  });
});

describe('courts', () => {
  it('are the level gutters 8 to 48px between two card tops', () => {
    expect(courts(METRICS_1440).map((g) => g.id)).toEqual(['2r-3l', '3r-4l', '5r-6l', '6r-7l', '8r-9l']);
    expect(courts(OVERVIEW_1440).map((g) => g.id)).toEqual(['2r-3l']);
    expect(courts(CONFIG_1440)).toEqual([]);
  });

  it('leave out a step over 2px, a wide gutter and a heading', () => {
    const page = (cards: readonly Rect[]) => surveyed([0, 2000, -400, -300], cards);
    expect(courts(page([[100, 400, 200, 400], [420, 700, 202, 400]]))).toHaveLength(1);
    expect(courts(page([[100, 400, 200, 400], [420, 700, 203, 400]]))).toEqual([]);
    expect(courts(page([[100, 400, 200, 400], [448, 700, 200, 400]]))).toHaveLength(1);
    expect(courts(page([[100, 400, 200, 400], [449, 700, 200, 400]]))).toEqual([]);
    const beside = surveyed([0, 400, 100, 200], [[420, 700, 200, 400]]);
    expect(measureGaps(beside).filter((g) => g.kind === 'side')).toHaveLength(1);
    expect(courts(beside)).toEqual([]);
  });
});
