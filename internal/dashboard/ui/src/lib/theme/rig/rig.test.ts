import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Rig from './Rig.svelte';
import { legImages, transformOf, turnAbout, turned, type DrawnLeg, type LimbArt, type RigPose } from './rig';
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
      width: 20, height: 20, anchor: { x: 10, y: 20 }, scale: 1,
      layers: [{ kind: 'group', turn: turnAbout(90, { x: 0, y: 0 }), layers: [{ kind: 'image', name: 'box', src: '', x: 0, y: 0, width: 4, height: 2 }] }],
    };
    const b = rigBounds(pose);
    expect([b.left, b.right, b.top, b.bottom].map((n) => Math.round(n * 1000) / 1000)).toEqual([-2, 0, 0, 4]);
  });
});

describe('legImages', () => {
  const foot = { src: 'foot.webp', fur: 'foot-fur.webp', width: 3, height: 2, heel: { x: 1, y: 0.5 } };
  const art: LimbArt = { bone: 'bone.webp', boneFur: 'bone-fur.webp', knee: false, foot };
  const leg: DrawnLeg = { limb: { hip: { x: 0, y: 0 }, knee: { x: 0, y: 2 }, ankle: { x: 0, y: 4 }, foot: { x: 0, y: 4 }, paw: 0 }, art, width: 2, haunch: 2, fore: true, taper: false };
  const hrefs = (a: LimbArt, fur: boolean) => legImages({ ...leg, art: a }, fur).map((i) => i.href);

  it('draws the foot over the leg\'s end, or under it for a sole walker', () => {
    expect(hrefs(art, false)).toEqual(['bone.webp', 'foot.webp']);
    expect(hrefs({ ...art, overFoot: true }, false)).toEqual(['foot.webp', 'bone.webp']);
    expect(hrefs({ ...art, overFoot: true }, true)).toEqual(['foot-fur.webp', 'bone-fur.webp']);
  });

  it('stretches the bones but not the foot, the fur pass running its first piece flush from the hip', () => {
    const [bone, drawnFoot] = legImages(leg, false);
    expect([bone.stretch, drawnFoot.stretch]).toEqual([true, false]);
    expect(bone.x).toBe(-1);
    expect(legImages(leg, true)[0].x).toBeCloseTo(0);
  });
});

describe('a group drawn see-through', () => {
  const pose = (opacity?: number): RigPose => ({
    width: 4, height: 4, anchor: { x: 2, y: 4 }, scale: 1,
    layers: [{ kind: 'group', turn: turnAbout(0, { x: 0, y: 0 }), opacity, layers: [{ kind: 'image', name: 'wing', src: 'wing.webp', x: 0, y: 0, width: 4, height: 2 }] }],
  });
  const drawn = (p: RigPose) => render(Rig, { props: { pose: p, x: 0, y: 0 } }).body;

  it('carries its opacity, and a group without one draws as it always has', () => {
    expect(drawn(pose(0.3))).toMatch(/<g transform="[^"]*" opacity="0.3">/);
    expect(drawn(pose())).not.toContain('opacity="');
  });
});
