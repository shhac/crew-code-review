// The bluebell art's sizes on the page and where its bells are, as
// design-docs/bluebells/export.py prints them: each bell is the middle of
// its top edge, as fractions of its picture's box, lowest first. A bee
// perches on top of a bell.

export type Bell = { x: number; y: number };
export type Art = { width: number; height: number; bells: readonly Bell[] };

const bell = (x: number, y: number): Bell => ({ x, y });

// The shelf's clump, 115.5x72 on the page. Its bees keep to one stem, the
// leftmost, whose four bells hang one above another from its tip: a bee
// lands on the lowest and works up, as it would along any spike.
export const SHELF: Art = {
  width: 115.5, height: 72,
  bells: [bell(0.183, 0.521), bell(0.148, 0.456), bell(0.115, 0.382), bell(0.08, 0.314)],
};

// The three ledge clumps, the tallest 20px, and the two plain cushions at
// the same scale.
export const CLUMPS: readonly Art[] = [
  { width: 21.5, height: 18.75, bells: [bell(0.676, 0.249), bell(0.327, 0.182), bell(0.812, 0.169), bell(0.191, 0.092)] },
  { width: 24, height: 20, bells: [bell(0.716, 0.384), bell(0.83, 0.295), bell(0.283, 0.284), bell(0.17, 0.185), bell(0.496, 0.177), bell(0.6, 0.048)] },
  { width: 16.75, height: 17.75, bells: [bell(0.516, 0.184), bell(0.695, 0.069)] },
];
export const CUSHIONS: readonly Pick<Art, 'width' | 'height'>[] = [
  { width: 16.75, height: 9 },
  { width: 23.25, height: 9 },
];
