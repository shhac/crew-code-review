import { describe, expect, it } from 'vitest';
import { anchor, fromLedge, placed, progress, toLedge } from './anchored';
import { page } from './valentine/fixtures';

const scrolled = (by: number) => {
  const p = page();
  return page(p.obstacles, [...p.floors].map(([id, f]) => [id, { ...f, y: f.y - by }]));
};

describe('held by a ledge', () => {
  it('holds a point against its nearest ledge, so it rides with the page', () => {
    const a = anchor(page(), { x: 700, y: 120 })!;
    expect(a.floor).toBe(1);
    expect(placed(scrolled(50), a)).toEqual({ x: 700, y: 70 });
  });

  it('holds a path the same way, and gives it back moved with its ledge', () => {
    const arc = { from: { x: 400, y: 100 }, via: { x: 450, y: 60 }, to: { x: 500, y: 160 } };
    const held = toLedge(page(), 1, arc)!;
    expect(held.to).toEqual({ x: 500 - 290, y: 0 });
    expect(fromLedge(page(), 1, held)).toEqual(arc);
    expect(fromLedge(scrolled(50), 1, held)!.via).toEqual({ x: 450, y: 10 });
    expect(fromLedge(page(page().obstacles, []), 1, held)).toBeNull();
  });

  it('counts progress from 0 to 1, held at either end', () => {
    const f = { start: 100, duration: 200 };
    expect(progress(f, 50)).toBe(0);
    expect(progress(f, 200)).toBe(0.5);
    expect(progress(f, 400)).toBe(1);
  });
});
