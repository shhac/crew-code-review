import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { chalkLines, CENTRE_RUN, LINE, linesOn, linesPath, livePuffs, MARK, marksOf, markNear, MAX_BASELINES, MAX_SCUFFS, MIN_RUN, PUFF, PUFF_RISE, puffAt, specksOf, wornOf, wornPath } from './lines';

const card: Ledge = { left: 100, right: 700, y: 300, base: 500, room: 40, headroom: Infinity, kind: 'card' };
const heading: Ledge = { left: 100, right: 900, y: 120, base: 120, room: 30, headroom: Infinity, kind: 'heading' };

describe('court lines', () => {
  it('chalks one baseline along each clear stretch, with five marks on a long one', () => {
    const [line, ...rest] = linesOn(1, card, []);
    expect(rest).toEqual([]);
    // Kept inside the card's rounded corners.
    expect([line.lo, line.hi]).toEqual([12, 588]);
    expect(line.marks).toHaveLength(5);
    // Corners at the very ends, tramlines at most 18px in, the centre mark
    // halfway.
    expect(line.marks[0]).toBeCloseTo(12 + LINE / 2);
    expect(line.marks[1]).toBeCloseTo(12 + 18);
    expect(line.marks[2]).toBeCloseTo(300);
    expect(line.marks[4]).toBeCloseTo(588 - LINE / 2);
  });

  it('puts the tramline an eighth of a short court in, and no centre mark under 120px', () => {
    expect(marksOf(0, 80)).toEqual([LINE / 2, 80 * (1.37 / 10.97), 80 - 80 * (1.37 / 10.97), 80 - LINE / 2]);
    expect(marksOf(0, CENTRE_RUN)).toHaveLength(5);
    expect(marksOf(0, CENTRE_RUN - 1)).toHaveLength(4);
  });

  it('never chalks under text, nor a stretch too short for a court', () => {
    // Text coming down to 2px above the ledge leaves room only either side.
    const text = { left: 300, right: 400, top: 280, bottom: 298 };
    const lines = linesOn(1, card, [text]);
    for (const l of lines) {
      expect(l.hi - l.lo).toBeGreaterThanOrEqual(MIN_RUN);
      expect(l.hi + card.left <= 300 || l.lo + card.left >= 400).toBe(true);
      for (const m of l.marks) expect(m + card.left <= 300 || m + card.left >= 400).toBe(true);
    }
    // Leaving a stretch under 60px on one side: no line there.
    const near = { left: 150, right: 690, top: 280, bottom: 298 };
    expect(linesOn(1, card, [near])).toEqual([]);
    // A heading's rule under its own text gets nothing either.
    const title = { left: 100, right: 900, top: 100, bottom: 119 };
    expect(linesOn(2, heading, [title])).toEqual([]);
  });

  it('draws nothing taller than its marks, and nothing below the ledge', () => {
    const d = linesPath(linesOn(1, card, []));
    const ys = [...d.matchAll(/[ V](-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBe(-MARK);
    expect(Math.max(...ys)).toBeLessThanOrEqual(0);
    // Stroked LINE wide, the baseline's centre half of that up: flush on the ledge.
    expect(d.startsWith(`M12 ${-LINE / 2}H`)).toBe(true);
  });

  it('breaks the baseline where it is worn, and covers the rest of it exactly once', () => {
    const lines = linesOn(1, card, []);
    const worn = wornOf(lines);
    expect(worn.length).toBeGreaterThan(0);
    const spans = (d: string) => [...d.matchAll(/M([\d.]+) -0.75H([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const drawn = [...spans(linesPath(lines)), ...worn.flatMap((s) => spans(wornPath(s)))].sort((a, b) => a[0] - b[0]);
    expect(drawn[0][0]).toBe(12);
    expect(drawn.at(-1)![1]).toBe(588);
    drawn.slice(1).forEach(([lo], i) => expect(lo).toBeCloseTo(drawn[i][1]));
  });

  it('scuffs the line here and there, seeded by ledge, clear of the marks', () => {
    const a = linesOn(1, card, []);
    expect(a).toEqual(linesOn(1, card, []));
    expect(linesOn(2, card, [])[0].scuffs).not.toEqual(a[0].scuffs);
    const scuffs = a.flatMap((l) => l.scuffs);
    expect(scuffs.length).toBeGreaterThan(0);
    for (const s of scuffs) {
      expect(s.x).toBeGreaterThanOrEqual(a[0].lo);
      expect(s.x + s.width).toBeLessThanOrEqual(a[0].hi);
      for (const m of a[0].marks) expect(m <= s.x - 2 || m >= s.x + s.width + 2).toBe(true);
    }
  });

  it('caps the baselines and scuffs on a page, sharing them across the ledges', () => {
    const floors = new Map(Array.from({ length: 60 }, (_, i) => [i + 1, { ...card, y: 100 + i * 40 }] as const));
    const lines = chalkLines(floors, []);
    const all = [...lines.values()].flat();
    expect(all).toHaveLength(MAX_BASELINES);
    expect(all.flatMap((l) => l.scuffs).length).toBeLessThanOrEqual(MAX_SCUFFS);
    // Shared a ledge at a time: the first forty ledges each keep their line.
    expect([...lines.values()].slice(0, MAX_BASELINES).every((l) => l.length === 1)).toBe(true);
    // Under the caps, every ledge keeps everything.
    const few = new Map([[1, card], [2, heading]]);
    expect(chalkLines(few, []).get(1)).toEqual(linesOn(1, card, []));
  });

  it('finds the mark a bounce lands on, within 3px', () => {
    const lines = linesOn(1, card, []);
    expect(markNear(lines, 302)).toBeCloseTo(300);
    expect(markNear(lines, 304)).toBeUndefined();
    expect(markNear(lines, 100)).toBeUndefined();
  });

  it('puffs four or five specks of chalk that rise a few px and fade over 0.4s', () => {
    const puff = puffAt('a', 300, 1000);
    expect([4, 5]).toContain(puff.count);
    expect(specksOf(puff, 999)).toEqual([]);
    expect(specksOf(puff, 1000 + PUFF)).toEqual([]);
    const frames = Array.from({ length: 24 }, (_, i) => specksOf(puff, 1000 + i * (PUFF / 24)));
    for (const specks of frames) {
      for (const s of specks) {
        expect(s.y + s.r).toBeLessThanOrEqual(0);
        expect(-(s.y - s.r)).toBeLessThanOrEqual(PUFF_RISE + 1);
        expect(Math.abs(s.x - 300)).toBeLessThanOrEqual(6);
      }
    }
    expect(frames.at(-1)![0].opacity).toBeLessThan(frames[1][0].opacity);
    expect(livePuffs([puff, puffAt('b', 10, 0)], 1100)).toEqual([puff]);
  });
});
