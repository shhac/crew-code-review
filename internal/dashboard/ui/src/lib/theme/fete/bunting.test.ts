import { describe, expect, it } from 'vitest';
import type { Segment } from '../pointer';
import {
  BREEZE, COLOURS, DEEP, MAX_PENNANTS, MAX_STRINGS, SPARE, SWING_CAP, TAPE_CAP,
  brush, catenary, drawSwag, gust, hangAll, keepSwings, reach, type Depth, type Hanging, type Swag, type Swing,
} from './bunting';

// Gaps as the survey measured them (design-docs/fete/README.md): the band
// under the overview's hero rule at 1440 (22px down to the first cards) and
// the gutters between cards side by side, 14px (the metrics KPIs), 18px
// (its charts) and 22px (the queue board and the Now card).
const under = (id: string, left: number, right: number, top = 120): Hanging => ({ id, kind: 'under', from: { x: left, y: top }, to: { x: right, y: top }, top });
const side = (id: string, left: number, span: number, y = 300, step = 0): Hanging => ({
  id, kind: 'side', from: { x: left, y }, to: { x: left + span, y: y + step }, top: Math.min(y, y + step),
});
const free = (depth: number): Depth => () => depth;
const HERO = under('5/12', 268, 1408);
const GUTTERS = [side('12r-15l', 700, 14), side('15r-18l', 900, 18), side('18r-21l', 1100, 22)];

const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, at: number): Segment => ({ from, to, at });

// Every point a string draws, over a run of brushes at random speeds and
// directions: the swept footprint the gap must hold.
function sweep(swags: readonly Swag[], seed: number, run = 4000) {
  const state = { n: seed };
  const rand = () => { state.n = (state.n * 1664525 + 1013904223) % 4294967296; return state.n / 4294967296; };
  const points: { id: string; x: number; y: number }[] = [];
  const steps = Array.from({ length: run / 16 }, (_, i) => i * 16);
  steps.reduce<Map<string, Swing>>((swings, now) => {
    const s = swags[Math.floor(rand() * swags.length)];
    const brushed = rand() < 0.2 ? brush(swags, swings, stroke({ x: s.a.x + rand() * (s.b.x - s.a.x), y: s.a.y - 6 }, { x: s.a.x + rand() * (s.b.x - s.a.x), y: s.a.y + 8 }, now), 200 + rand() * 2000, now) : swings;
    swags.forEach((sw) => {
      const d = drawSwag(sw, brushed.get(sw.id), now, false);
      d.tape.forEach((p) => points.push({ id: sw.id, ...p }));
      d.pennants.forEach((pn) => pn.points.forEach((p) => points.push({ id: sw.id, ...p })));
    });
    return brushed;
  }, new Map());
  return points;
}

describe('the catenary', () => {
  it('passes through both ends and sags as asked at the middle', () => {
    const a = { x: 10, y: 50 }, b = { x: 74, y: 50 };
    const y = catenary(a, b, 4);
    expect(y(10)).toBeCloseTo(50, 6);
    expect(y(74)).toBeCloseTo(50, 6);
    expect(y(42)).toBeCloseTo(54, 3);
  });

  it('between ends at different heights keeps its lowest point toward the lower end', () => {
    const a = { x: 0, y: 0 }, b = { x: 22, y: 3 };
    const y = catenary(a, b, 5.5);
    expect(y(0)).toBeCloseTo(0, 6);
    expect(y(22)).toBeCloseTo(3, 6);
    const xs = Array.from({ length: 221 }, (_, i) => i / 10);
    const lowest = xs.reduce((best, x) => (y(x) > y(best) ? x : best), 0);
    expect(lowest).toBeGreaterThan(11);
  });

  it('is within a quarter pixel of a parabola at the festoon sags, so either would do', () => {
    const a = { x: 0, y: 0 }, b = { x: 64, y: 0 };
    const y = catenary(a, b, 4);
    const parabola = (x: number) => 4 * 4 * (x / 64) * (1 - x / 64);
    for (let x = 0; x <= 64; x += 2) expect(Math.abs(y(x) - parabola(x))).toBeLessThan(0.25);
  });
});

describe('where bunting hangs', () => {
  it('festoons a heading band in even swags pinned under the rule, numbered from the left', () => {
    const swags = hangAll([{ gap: HERO, depth: free(22) }]);
    expect(swags.map((s) => s.id)).toEqual(Array.from({ length: 18 }, (_, i) => `5/12#${i}`));
    for (const s of swags) {
      expect(s.a.y).toBe(121);
      expect(s.b.x - s.a.x).toBeGreaterThanOrEqual(48);
      expect(s.b.x - s.a.x).toBeLessThanOrEqual(96);
      expect(s.sag).toBe(4);
      // Every 7px, clear of both pins.
      s.pennants.slice(1).forEach((p, i) => expect(p.x - s.pennants[i].x).toBeCloseTo(7));
      expect(s.pennants[0].x - 2.5 - s.a.x).toBeGreaterThanOrEqual(4);
      expect(s.b.x - s.pennants.at(-1)!.x - 2.5).toBeGreaterThanOrEqual(4);
    }
    expect(swags[0].a.x).toBe(272);
    expect(swags.at(-1)!.b.x).toBeCloseTo(1404);
  });

  it('leaves out a swag where the band is blocked, and keeps its neighbours and their numbers', () => {
    // The config page's tab bar: something 8px under the rule from 500 to 560.
    const depth: Depth = (x0, x1) => (x1 > 500 && x0 < 560 ? 8 : 22);
    const ids = hangAll([{ gap: HERO, depth }]).map((s) => s.id);
    const all = hangAll([{ gap: HERO, depth: free(22) }]);
    const blocked = all.filter((s) => s.b.x > 500 && s.a.x < 560).map((s) => s.id);
    expect(blocked.length).toBeGreaterThan(0);
    expect(ids).toEqual(all.map((s) => s.id).filter((id) => !blocked.includes(id)));
  });

  it('needs 16px under a heading rule for a festoon', () => {
    expect(hangAll([{ gap: HERO, depth: free(16) }]).length).toBeGreaterThan(0);
    expect(hangAll([{ gap: HERO, depth: free(14) }])).toEqual([]);
  });

  it('ties one swag across each gutter, sagging a quarter of its span, with one, two or three pennants', () => {
    const swags = hangAll(GUTTERS.map((gap) => ({ gap, depth: free(113) })));
    expect(swags.map((s) => s.id)).toEqual(['12r-15l#0', '15r-18l#0', '18r-21l#0']);
    expect(swags.map((s) => s.pennants.length)).toEqual([1, 2, 3]);
    expect(swags.map((s) => s.sag)).toEqual([3.5, 4.5, 5.5]);
    swags.forEach((s, i) => {
      expect(s.a).toEqual(GUTTERS[i].from);
      expect(s.b).toEqual(GUTTERS[i].to);
    });
  });

  it('hangs a side swag only where its whole reach fits the free depth', () => {
    const g = side('1r-2l', 0, 22);
    const needed = reach(hangAll([{ gap: g, depth: free(100) }])[0]).bottom + SPARE - g.top;
    expect(needed).toBeGreaterThan(5.5 + 2 + DEEP);
    expect(hangAll([{ gap: g, depth: free(needed) }])).toHaveLength(1);
    expect(hangAll([{ gap: g, depth: free(needed - 0.5) }])).toEqual([]);
    // Too narrow for a pennant.
    expect(hangAll([{ gap: side('3r-4l', 0, 8), depth: free(100) }])).toEqual([]);
  });

  it('tilts across a step, lowest toward the lower end', () => {
    const [s] = hangAll([{ gap: side('1r-2l', 0, 22, 300, 6), depth: free(100) }]);
    const tape = drawSwag(s, undefined, 0, true).tape;
    const lowest = tape.reduce((a, b) => (b.y > a.y ? b : a));
    expect(lowest.x).toBeGreaterThan(11);
  });

  it('starts each string at a seeded colour and steps on, so neighbours never match and a string keeps its colours', () => {
    const swags = hangAll([{ gap: HERO, depth: free(22) }, ...GUTTERS.map((gap) => ({ gap, depth: free(113) }))]);
    for (const s of swags) s.pennants.slice(1).forEach((p, i) => expect(p.colour).not.toBe(s.pennants[i].colour));
    expect(new Set(swags.map((s) => s.pennants[0].colour)).size).toBeGreaterThan(2);
    expect(hangAll([{ gap: HERO, depth: free(22) }])).toEqual(swags.filter((s) => s.gap === '5/12'));
    expect(swags.every((s) => s.pennants.every((p) => p.colour >= 0 && p.colour < COLOURS.length))).toBe(true);
  });

  it('keeps to the page caps, taken in gap order', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ gap: side(`${i}r-${i + 1}l`, i * 40, 22), depth: free(100) }));
    const swags = hangAll(many);
    expect(swags).toHaveLength(MAX_STRINGS);
    expect(swags.map((s) => s.gap)).toEqual(many.slice(0, MAX_STRINGS).map((g) => g.gap.id));
    const wide = Array.from({ length: 10 }, (_, i) => ({ gap: under(`${i}/${i + 50}`, 0, 1200, 100 + 40 * i), depth: free(22) }));
    expect(hangAll(wide).reduce((n, s) => n + s.pennants.length, 0)).toBeLessThanOrEqual(MAX_PENNANTS);
  });
});

describe('how bunting moves', () => {
  const hero = hangAll([{ gap: HERO, depth: free(16) }]);
  const gutters = hangAll(GUTTERS.map((gap) => ({ gap, depth: free(17) })));

  it('never leaves its gap, at any swing, with the least depth it hangs in', () => {
    for (const [swags, gaps] of [[hero, [HERO]], [gutters, GUTTERS]] as const) {
      const depth = swags === hero ? 16 : 17;
      const points = sweep(swags, 11);
      expect(points.length).toBeGreaterThan(1000);
      const outside = points.filter((p) => {
        const g = gaps.find((x) => p.id.startsWith(`${x.id}#`))!;
        return p.x < g.from.x || p.x > g.to.x || p.y < g.top || p.y > g.top + depth - SPARE;
      });
      expect(outside).toEqual([]);
    }
  });

  it('stays inside the reach each swag is hung by', () => {
    const swags = [...hero.slice(0, 4), ...gutters];
    const reaches = new Map(swags.map((s) => [s.id, reach(s)]));
    const outside = sweep(swags, 5).filter((p) => {
      const r = reaches.get(p.id)!;
      return p.x < r.left - 1e-6 || p.x > r.right + 1e-6 || p.y < r.top - 1e-6 || p.y > r.bottom + 1e-6;
    });
    expect(outside).toEqual([]);
  });

  it('hangs at rest with every pennant plumb under reduced motion, brushed or not', () => {
    const s = gutters[2];
    const swings = brush(gutters, new Map(), stroke({ x: s.a.x - 5, y: s.a.y + 4 }, { x: s.b.x + 5, y: s.a.y + 4 }, 100), 900);
    const rest = drawSwag(s, undefined, 0, true);
    for (const now of [0, 150, 900, 5000]) {
      const d = drawSwag(s, swings.get(s.id), now, true);
      expect(d).toEqual(rest);
      d.pennants.forEach(({ points }) => expect(points[2].x).toBeCloseTo((points[0].x + points[1].x) / 2, 6));
    }
  });

  it('flutters in the breeze within its few degrees, never in step', () => {
    const s = hero[0];
    const angles = Array.from({ length: 200 }, (_, i) => drawSwag(s, undefined, i * 97, false).pennants.map(({ points }) => {
      const mid = (points[0].x + points[1].x) / 2;
      const top = (points[0].y + points[1].y) / 2;
      return (Math.atan2(points[2].x - mid, points[2].y - top) * 180) / Math.PI;
    }));
    const flat = angles.flat();
    expect(Math.max(...flat.map(Math.abs))).toBeLessThanOrEqual(BREEZE + 1e-6);
    expect(Math.max(...flat)).toBeGreaterThan(1);
    // Two pennants on one string do not swing together.
    expect(angles.some((a) => Math.sign(a[0]) !== Math.sign(a[1]) && Math.abs(a[0]) > 0.5 && Math.abs(a[1]) > 0.5)).toBe(true);
  });

  it('gusts rise and fall over about ten seconds', () => {
    const g = Array.from({ length: 600 }, (_, i) => gust(i * 100));
    expect(Math.min(...g)).toBeLessThan(0.05);
    expect(Math.max(...g)).toBeGreaterThan(0.95);
    // Never a jump from one tenth of a second to the next.
    g.slice(1).forEach((v, i) => expect(Math.abs(v - g[i])).toBeLessThan(0.08));
  });

  it('swings where a cursor brushes it, and passes some of a kick to the swags either side', () => {
    const s = hero[5];
    const across = stroke({ x: (s.a.x + s.b.x) / 2 - 2, y: s.a.y - 10 }, { x: (s.a.x + s.b.x) / 2 + 2, y: s.a.y + 20 }, 1000);
    const swings = brush(hero, new Map(), across, 900);
    expect([...swings.keys()].sort()).toEqual([hero[4].id, hero[5].id, hero[6].id].sort());
    const moved = (sw: Swag) => Math.max(...Array.from({ length: 30 }, (_, i) => {
      const at = 1000 + i * 20;
      const d = drawSwag(sw, swings.get(sw.id), at, false).tape;
      const rest = drawSwag(sw, undefined, at, true).tape;
      return Math.max(...d.map((p, k) => Math.abs(p.y - rest[k].y)));
    }));
    expect(moved(s)).toBeGreaterThan(0.6);
    expect(moved(s)).toBeLessThanOrEqual(TAPE_CAP.festoon + 1e-6);
    expect(moved(hero[4])).toBeGreaterThan(0.1);
    expect(moved(hero[4])).toBeLessThan(moved(s));
  });

  it('misses a stroke that passes it by, and a side swag is its own string', () => {
    const s = gutters[1];
    const away = stroke({ x: s.a.x, y: s.a.y - 20 }, { x: s.b.x, y: s.a.y - 20 }, 0);
    expect(brush(gutters, new Map(), away, 900).size).toBe(0);
    const through = stroke({ x: s.a.x + 2, y: s.a.y + 3 }, { x: s.b.x - 2, y: s.a.y + 5 }, 0);
    expect([...brush(gutters, new Map(), through, 900).keys()]).toEqual([s.id]);
  });

  it('settles: the swing halves about every 0.6 seconds and its pennants keep to their cap', () => {
    const s = gutters[2];
    const swings = brush(gutters, new Map(), stroke({ x: s.a.x, y: s.a.y + 3 }, { x: s.b.x, y: s.a.y + 4 }, 0), 5000);
    const swing = (from: number) => Math.max(...Array.from({ length: 40 }, (_, i) => {
      const d = drawSwag(s, swings.get(s.id), from + i * 10, false);
      return Math.max(...d.pennants.map(({ points }) => Math.abs(points[2].x - (points[0].x + points[1].x) / 2)));
    }));
    const limit = DEEP * Math.sin((SWING_CAP.side * Math.PI) / 180);
    expect(swing(0)).toBeLessThanOrEqual(limit + 1e-6);
    // The breeze's own flutter stays; the kick dies away.
    const breeze = DEEP * Math.sin((BREEZE * Math.PI) / 180);
    expect(swing(3000) - breeze).toBeLessThan((swing(0) - breeze) / 8);
  });

  it('keeps a swing by string id across a remeasure, and drops a string that has gone', () => {
    const s = hero[2];
    const swings = brush(hero, new Map(), stroke({ x: (s.a.x + s.b.x) / 2, y: s.a.y - 5 }, { x: (s.a.x + s.b.x) / 2 + 1, y: s.a.y + 10 }, 0), 900);
    const scrolled = hero.map((h) => ({ ...h, a: { ...h.a, y: h.a.y - 50 }, b: { ...h.b, y: h.b.y - 50 } }));
    const kept = keepSwings(scrolled, swings);
    expect(kept.get(s.id)).toBe(swings.get(s.id));
    expect(keepSwings(scrolled.filter((h) => h.id !== s.id), swings).has(s.id)).toBe(false);
    const fewer = scrolled.map((h) => (h.id === s.id ? { ...h, pennants: h.pennants.slice(1) } : h));
    expect(keepSwings(fewer, swings).get(s.id)!.pennants.every((p) => p.x === 0 && p.v === 0)).toBe(true);
  });
});
