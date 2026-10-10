import { describe, expect, it } from 'vitest';
import { rigBounds } from './test-rig';
import type { Layer, RigPose } from './rig';
import { fanOf, shimmer, wingAt, wingBlur, type BlurWing, type WingBeat } from './wing-blur';

// A wing lying straight back from its hinge at (10, 5), 8 long and 2 wide.
const picture: Layer = { kind: 'image', name: 'wing', src: 'wing.webp', x: 2, y: 4, width: 8, height: 2 };
const wing: BlurWing = { picture, hinge: { x: 10, y: 5 }, axis: 180, length: 8 };
const beat: WingBeat = { front: -40, back: -160, ghost: 0.35, fan: 0.3, colour: '#f3e7cc' };
const pose = (layers: Layer[]): RigPose => ({ width: 20, height: 20, anchor: { x: 10, y: 10 }, scale: 1, layers });
const opacities = (layers: readonly Layer[]) => layers.map((l) => (l.kind === 'group' ? l.opacity : undefined));

describe('wingBlur', () => {
  it('draws a faint fan, then the wing faintly at each end of its stroke', () => {
    const layers = wingBlur(wing, beat);
    expect(opacities(layers)).toEqual([0.3, 0.35, 0.35]);
  });

  it('turns the wing about its hinge to each end', () => {
    const front = rigBounds(pose([wingAt(wing, -40)]));
    // Pointing forward and up from the hinge, it reaches ahead of it.
    expect(front.right).toBeGreaterThan(10 + 8 * Math.cos((40 * Math.PI) / 180) - 1);
    expect(front.top).toBeLessThan(5 - 8 * Math.sin((40 * Math.PI) / 180) + 1);
    // Back at the angle it was drawn, it lies where it was drawn.
    const back = rigBounds(pose([wingAt(wing, 180)]));
    expect([back.left, back.right, back.top, back.bottom].map((n) => Math.round(n * 1000) / 1000)).toEqual([2, 10, 4, 6]);
  });

  it('sweeps the fan through the stroke, inside the wing\'s reach', () => {
    const points = fanOf(wing.hinge, -40, -160, 7);
    expect(points[0]).toEqual(wing.hinge);
    const angles = points.slice(1).map((p) => (Math.atan2(p.y - 5, p.x - 10) * 180) / Math.PI);
    expect(angles[0]).toBeCloseTo(-40);
    expect(angles.at(-1)).toBeCloseTo(-160);
    // Straight up from the hinge lies inside the sweep.
    expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(-2, 0);
  });

  it('holds still from frame to frame unless a shimmer is asked for', () => {
    expect(wingBlur(wing, beat)).toEqual(wingBlur(wing, beat));
    const shimmering = (now: number) => wingBlur(wing, { ...beat, mid: { at: shimmer(3, now), opacity: 0.55 } });
    expect(shimmering(0).length).toBe(4);
    expect(shimmering(0)).not.toEqual(shimmering(1000 / 60));
  });

  it('fades in with its amount, and is gone at none', () => {
    expect(opacities(wingBlur(wing, beat, 0.5))).toEqual([0.15, 0.175, 0.175]);
    expect(wingBlur(wing, beat, 0)).toEqual([]);
  });
});

describe('shimmer', () => {
  it('lands anywhere in the stroke, one place a frame', () => {
    const frames = Array.from({ length: 600 }, (_, i) => shimmer(1, (i * 1000) / 60));
    expect(Math.min(...frames)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...frames)).toBeLessThan(1);
    expect(Math.max(...frames) - Math.min(...frames)).toBeGreaterThan(0.9);
    expect(shimmer(1, 5)).toBe(shimmer(1, 10));
  });
});
