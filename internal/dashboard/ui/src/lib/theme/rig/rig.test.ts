import { describe, expect, it } from 'vitest';
import { transformOf, turnAbout, turned, type RigPose } from './rig';
import { rigBounds } from './test-rig';

describe('turned', () => {
  // SVG's rotate turns clockwise on screen (y down): (1, 0) goes to (0, 1).
  it('turns a point the way SVG rotate draws it, then moves it', () => {
    const p = turned(turnAbout(90, { x: 0, y: 0 }, 5, -2), { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(-1);
    expect(transformOf(turnAbout(90, { x: 0, y: 0 }, 5, -2))).toBe('translate(5 -2) rotate(90 0 0)');
  });

  it('turns about its pivot', () => {
    const p = turned(turnAbout(180, { x: 10, y: 10 }), { x: 12, y: 10 });
    expect(p.x).toBeCloseTo(8);
    expect(p.y).toBeCloseTo(10);
  });
});

describe('rigBounds', () => {
  it('bounds an image turned inside a group', () => {
    const pose: RigPose = {
      width: 20, height: 20, anchor: { x: 10, y: 20 },
      layers: [{ kind: 'group', turn: turnAbout(90, { x: 0, y: 0 }), layers: [{ kind: 'image', src: '', x: 0, y: 0, width: 4, height: 2 }] }],
    };
    const b = rigBounds(pose);
    expect([b.left, b.right, b.top, b.bottom].map((n) => Math.round(n * 1000) / 1000)).toEqual([-2, 0, 0, 4]);
  });
});
