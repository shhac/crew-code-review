import { describe, expect, it } from 'vitest';
import type { RigPose } from '../lib/theme/rig/rig';
import { drawingFor, drawingsOf, overlay } from './drawings';

describe('drawingFor', () => {
  it("switches to the mode's own drawing", () => {
    expect(drawingFor('hedgehog', 'flee', 'standing')).toBe('hurry');
    expect(drawingFor('fox', 'stand', 'dig')).toBe('standing');
  });

  it('keeps the drawing shown when the mode has none', () => {
    expect(drawingFor('hedgehog', 'curled', 'walk pass')).toBe('walk pass');
    expect(drawingFor('spider', 'walk', 'standing')).toBe('standing');
  });

  it('shows none when none was shown', () => {
    expect(drawingFor('hedgehog', 'sniff', '')).toBe('');
  });

  it('finds at most one drawing for each mode', () => {
    for (const animal of ['hedgehog', 'fox']) {
      const modes = Object.values(drawingsOf(animal)).flatMap((d) => (d.mode ? [d.mode] : []));
      expect(new Set(modes).size).toBe(modes.length);
    }
  });
});

describe('overlay', () => {
  const pose: RigPose = { width: 40, height: 30, anchor: { x: 20, y: 28 }, scale: 1, layers: [] };

  it('puts a drawing with a place there', () => {
    expect(overlay(pose, { src: 'a.webp', width: 10, height: 6, at: { x: 1, y: 2 } }).layers)
      .toEqual([{ kind: 'image', name: 'reference', src: 'a.webp', x: 1, y: 2, width: 10, height: 6 }]);
  });

  it('stands one without a place on the anchor, centred', () => {
    expect(overlay(pose, { src: 'a.webp', width: 10, height: 6 }).layers)
      .toEqual([{ kind: 'image', name: 'reference', src: 'a.webp', x: 15, y: 22, width: 10, height: 6 }]);
  });
});
