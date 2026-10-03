import { afterEach, expect, it, vi } from 'vitest';
import { measureObstacles, measureRenderedText } from './floors';
import { safeRoute, type Scene } from './christmas/robin';
afterEach(() => vi.unstubAllGlobals());
const box = { left: 180, right: 220, top: 160, bottom: 175, width: 40, height: 15 };
it('reads card/chart/control bounds using a selector-sensitive fixture', () => {
  const fixtures = [
    { selector: 'main canvas', bounds: box },
    { selector: 'main input', bounds: { ...box, left: 300, right: 340 } },
    { selector: 'main canvas', bounds: { ...box, left: NaN } },
    { selector: 'main canvas', bounds: { ...box, width: 0, height: 0 } },
    { selector: 'main div', bounds: { ...box, left: 400, right: 440 } },
  ];
  const root = { querySelectorAll(s: string) {
    const selectors = s.split(',').map((part) => part.trim());
    return fixtures.filter((f) => selectors.includes(f.selector)).map((f) => ({ getBoundingClientRect: () => f.bounds }));
  } };
  expect(measureObstacles(root, () => [])).toEqual([box, fixtures[1].bounds]);
});

function textDocument(tag: string) {
  const parent = (visibility = 'visible', excluded = false) => ({ tagName: tag, visibility, closest: () => excluded ? {} : null });
  const nodes = [
    { textContent: 'standalone text', parentElement: parent(), rects: [box] },
    { textContent: 'wrapped line', parentElement: parent(), rects: [{ ...box, top: 180, bottom: 195 }] },
    { textContent: '   ', parentElement: parent(), rects: [box] },
    { textContent: 'hidden', parentElement: parent('hidden'), rects: [box] },
    { textContent: 'script', parentElement: parent('visible', true), rects: [box] },
    { textContent: 'display none', parentElement: parent(), rects: [] },
    { textContent: 'malformed', parentElement: parent(), rects: [{ ...box, right: NaN }] },
  ];
  let index = 0, selected = nodes[0];
  const doc = {
    querySelector: (s: string) => s === 'main' ? {} : null,
    querySelectorAll: () => [], // Text is outside any measured card/chart.
    createTreeWalker: (_root: unknown, kind: number) => {
      expect(kind).toBe(4);
      return { nextNode: () => nodes[index++] ?? null };
    },
    createRange: () => ({ selectNodeContents: (node: typeof selected) => { selected = node; }, getClientRects: () => selected.rects }),
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('getComputedStyle', (el: ReturnType<typeof parent>) => ({ visibility: el.visibility, display: 'block' }));
}

it.each(['DIV', 'STRONG', 'SMALL', 'DT', 'DD', 'SUMMARY', 'CUSTOM-TEXT'])('blocks swept routes through rendered %s text outside cards', (tag) => {
  const scene: Scene = { floors: new Map(), obstacles: [], width: 500, height: 400 };
  const from = { x: 100, y: 200 }, to = { x: 300, y: 200 };
  expect(safeRoute(from, from, 0, scene)).toBe(true);
  expect(safeRoute(to, to, 0, scene)).toBe(true);
  expect(safeRoute(from, to, 8, scene)).toBe(true);
  textDocument(tag);
  const obstacles = measureObstacles();
  expect(obstacles).toEqual([
    { left: 180, right: 220, top: 160, bottom: 175 },
    { left: 180, right: 220, top: 180, bottom: 195 },
  ]);
  expect(safeRoute(from, from, 0, { ...scene, obstacles })).toBe(true);
  expect(safeRoute(to, to, 0, { ...scene, obstacles })).toBe(true);
  expect(safeRoute(from, to, 8, { ...scene, obstacles })).toBe(false);
});
it('handles missing main geometry without text reads', () => {
  vi.stubGlobal('document', { querySelector: () => null });
  expect(measureRenderedText()).toEqual([]);
});
