import { describe, expect, it } from 'vitest';
import { measureFloors } from './floors';

// measureFloors only needs querySelectorAll and rects, so a fake page stands
// in for the document.
type Box = { left: number; right: number; top: number; bottom: number };
const el = (r: Box) => ({ getBoundingClientRect: () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top }) });
const page = (cards: Box[], rules: Box[] = []) => ({
  querySelectorAll: (sel: string) => (sel.includes('.hero') ? rules : cards).map(el),
});
const ys = (root: ReturnType<typeof page>) => [...measureFloors(root).values()].map((f) => f.y).sort((a, b) => a - b);

describe('measureFloors', () => {
  it('walks card tops and heading rules', () => {
    expect(ys(page([{ left: 0, right: 600, top: 300, bottom: 500 }], [{ left: 0, right: 600, top: 40, bottom: 160 }]))).toEqual([160, 300]);
  });

  it('counts a nested card that shares its parent top edge once', () => {
    const outer = { left: 0, right: 600, top: 200, bottom: 600 };
    const inner = { left: 0, right: 598, top: 202, bottom: 260 };
    expect(ys(page([outer, inner]))).toEqual([200]);
  });

  it('drops a card tucked so close under a rule that a spider would not fit', () => {
    expect(ys(page([{ left: 0, right: 600, top: 184, bottom: 500 }], [{ left: 0, right: 600, top: 40, bottom: 160 }]))).toEqual([160]);
  });

  it('ignores slivers too narrow to walk', () => {
    expect(ys(page([{ left: 0, right: 80, top: 300, bottom: 400 }]))).toEqual([]);
  });
});
