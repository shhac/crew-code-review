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

  it('counts a foreshortened group, flipped or not, and leaves out a picture drawn unseen', () => {
    const box = { kind: 'image', name: 'wing', src: '', x: 0, y: -10, width: 2, height: 10 } as const;
    const flipped = (foreshorten: number): RigPose => ({
      width: 20, height: 20, anchor: { x: 10, y: 20 }, scale: 1,
      layers: [{ kind: 'group', turn: turnAbout(0, { x: 0, y: 0 }, 5, 5), foreshorten, layers: [box, { ...box, x: 50, hidden: true }] }],
    });
    const b = rigBounds(flipped(-0.5));
    expect([b.left, b.right, b.top, b.bottom]).toEqual([5, 7, 5, 10]);
    expect(rigBounds(flipped(0.5)).top).toBe(0);
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

  it('draws a bird\'s leg from the knee, its thigh in the body, with both feet and only the one in use seen', () => {
    const bird: LimbArt = { ...art, knee: true, inBody: true, thigh: { src: 'drumstick.webp', fur: 'drumstick-fur.webp' }, curled: { ...foot, src: 'curled.webp', fur: 'curled-fur.webp' } };
    const limb = { hip: { x: 0, y: 0 }, knee: { x: 1, y: 1 }, ankle: { x: 0, y: 2 }, foot: { x: 0.5, y: 4 }, paw: 0 };
    const drawn = (curled: boolean) => legImages({ ...leg, art: bird, limb: { ...limb, curled } }, false);
    expect(drawn(false).map((i) => i.href)).toEqual(['drumstick.webp', 'bone.webp', 'foot.webp', 'curled.webp']);
    expect(drawn(false).map((i) => i.opacity)).toEqual([undefined, undefined, 1, 0]);
    expect(drawn(true).map((i) => i.opacity)).toEqual([undefined, undefined, 0, 1]);
    expect(drawn(true)[0].transform).toContain('translate(1 1)');
    expect(hrefs({ ...art, knee: true }, false)).not.toContain('curled.webp');
  });

  it('stretches the bones but not the foot, the fur pass running its first piece flush from the hip', () => {
    const [bone, drawnFoot] = legImages(leg, false);
    expect([bone.stretch, drawnFoot.stretch]).toEqual([true, false]);
    expect(bone.x).toBe(-1);
    expect(legImages(leg, true)[0].x).toBeCloseTo(0);
  });

  it('places a registered thigh\'s rounded centre at the hip and its tip at the knee in both passes', () => {
    const registered: LimbArt = { ...art, knee: true, thigh: { src: 'thigh.webp', fur: 'thigh-fur.webp', anchors: { start: 0.25, end: 0.92 } } };
    const drawn: DrawnLeg = { ...leg, art: registered, haunch: 3.8, limb: { ...leg.limb, hip: { x: 7, y: 9 }, knee: { x: 7, y: 13.2 } } };
    const [outline, fur] = [legImages(drawn, false)[0], legImages(drawn, true)[0]];
    for (const image of [outline, fur]) {
      expect(image.x + 0.25 * image.width).toBeCloseTo(0, 6);
      expect(image.x + 0.92 * image.width).toBeCloseTo(4.2, 6);
      expect(image.y + image.height / 2).toBe(0);
      expect(image.transform).toBe('translate(7 9) rotate(90)');
    }
    expect({ ...fur, href: outline.href }).toEqual(outline);
    // The narrow tip overlaps the knee only slightly, rather than extending
    // another half-haunch (1.9 units) past it.
    expect(outline.x + outline.width - 4.2).toBeLessThan(0.6);
  });

  it('counts a registered cap extending behind the hip in the footprint', () => {
    const registered: LimbArt = { ...art, knee: true, thigh: { src: 'thigh.webp', fur: 'thigh-fur.webp', anchors: { start: 0.5, end: 1 } } };
    const drawn: DrawnLeg = { ...leg, art: registered, limb: { ...leg.limb, hip: { x: 0, y: 0 }, knee: { x: 4, y: 0 }, ankle: { x: 6, y: 0 }, foot: { x: 8, y: 0 } } };
    const pose: RigPose = { width: 20, height: 20, anchor: { x: 10, y: 20 }, scale: 1, layers: [{ kind: 'legs', name: 'legs', legs: [drawn], far: false, fur: false }] };
    expect(rigBounds(pose).left).toBe(-4);
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
