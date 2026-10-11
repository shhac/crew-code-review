import { describe, expect, it } from 'vitest';
import type { Box } from '../floors';
import { skyOf } from './airspace';
import { board, lower, overview, side, SUBTITLE } from './fixtures';

const SKY = skyOf(overview());
const box = (left: number, right: number, top: number, bottom: number): Box => ({ left, right, top, bottom });

// The note's airspace contract, at each edge to the pixel: a bird keeps 4px
// from text and from a card's sides, may touch the top of a card and reach
// 6px into the empty bottom edge of one above, and no further.
describe("July's air at its edges", () => {
  it('lets a bird touch the top of the card it stands on, never sink into it', () => {
    expect(SKY.clear(box(400, 420, lower.y - 17, lower.y))).toBe(true);
    expect(SKY.clear(box(400, 420, lower.y - 16, lower.y + 1))).toBe(false);
  });

  it('lets a bird reach 6px into the empty bottom edge of a card above, no further', () => {
    expect(SKY.clear(box(400, 420, board.base - 6, board.base + 10))).toBe(true);
    expect(SKY.clear(box(400, 420, board.base - 7, board.base + 9))).toBe(false);
  });

  it("keeps a bird 4px from a card's sides", () => {
    expect(SKY.clear(box(board.right + 4, side.left - 4, 300, 320))).toBe(true);
    expect(SKY.clear(box(board.right + 3, side.left - 4, 300, 320))).toBe(false);
    expect(SKY.clear(box(board.right + 4, side.left - 3, 300, 320))).toBe(false);
  });

  it('keeps a bird 4px from text', () => {
    expect(SKY.clear(box(300, 320, SUBTITLE.bottom + 4, SUBTITLE.bottom + 20))).toBe(true);
    expect(SKY.clear(box(300, 320, SUBTITLE.bottom + 3, SUBTITLE.bottom + 19))).toBe(false);
  });
});
