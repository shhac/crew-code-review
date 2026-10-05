import manifest from './robin-parts/manifest.json';
import { describe, expect, it } from 'vitest';
import { partsPose, partsLayers, partsTransforms, partsModes } from './parts-pose';
import { svgMatrix, transformPoint } from './parts-affine';

describe('layered robin timing', () => {
  it('returns smoothly to the beginning of every loop', () => {
    for (const mode of partsModes) {
      const start = partsPose(0, mode), end = partsPose(11999.999, mode);
      expect(end.breathing).toBeCloseTo(start.breathing, 5);
      expect(end.headBreath).toBeCloseTo(start.headBreath, 5);
      expect(end.headAngle).toBeCloseTo(start.headAngle, 4);
      expect(end.tailAngle).toBeCloseTo(start.tailAngle, 4);
      expect(end.closed).toBe(start.closed);
      for (const key of ['lift', 'crouch', 'lean', 'tuck', 'bob'] as const) expect(end[key]).toBeCloseTo(start[key], 4);
      expect(end.flying).toBe(start.flying);
      expect(end.nearWing.angle).toBeCloseTo(start.nearWing.angle, 3);
      expect(end.farWing.angle).toBeCloseTo(start.farWing.angle, 3);
    }
  });
  it('holds the same still pose through a blink and head movement under reduced motion', () => {
    const neutral = partsPose(0, 'still');
    for (const mode of partsModes) {
      for (const time of [1250, 1500, 3100, 4350, 6000, 9800]) expect(partsPose(time, mode, true)).toEqual(neutral);
    }
  });
  it('isolates articulation modes for visual review', () => {
    expect(partsPose(3100, 'tilt').tailAngle).toBe(0);
    expect(partsPose(3100, 'tilt').breathing).toBe(0);
    expect(partsPose(1570, 'blink').closed).toBe(true);
    expect(partsPose(1570, 'blink').headAngle).toBe(0);
    expect(partsPose(1570, 'blink').tailAngle).toBe(0);
  });
  it('plants both feet through a peck and brings the beak down to their ground plane', () => {
    for (const time of [0, 850, 1120, 1350, 1580, 2000, 2500]) {
      const layers = partsLayers(partsPose(time, 'peck'));
      for (const [id, x, y] of [['leg-near', 64, 102.1], ['leg-far', 78, 101]] as const) {
        const layer = layers.find(layer => layer.id === id)!;
        const foot = transformPoint(layer.transform, x, y);
        expect(foot[0]).toBeCloseTo(x, 5);
        expect(foot[1]).toBeCloseTo(y, 5);
      }
    }
    const head = partsLayers(partsPose(1120, 'peck')).find(layer => layer.id === 'head')!;
    const tip = transformPoint(head.transform, 115, 24.7);
    expect(tip[1]).toBeGreaterThan(98);
    expect(tip[1]).toBeLessThan(103);
  });
  it('crouches before hopping, lifts both feet, then recovers to the starting pose', () => {
    expect(partsPose(940, 'hop').crouch).toBeGreaterThan(4);
    expect(partsPose(940, 'hop').lift).toBe(0);
    const airborne = partsLayers(partsPose(1250, 'hop'));
    for (const [id, x, y] of [['leg-near', 64, 102.1], ['leg-far', 78, 101]] as const) {
      const foot = transformPoint(airborne.find(layer => layer.id === id)!.transform, x, y);
      expect(foot[1]).toBeLessThan(80);
    }
    expect(partsPose(2000, 'hop')).toEqual(partsPose(0, 'hop'));
  });
  it('keeps wing roots fixed through both stroke changes and draws the far wing behind the body', () => {
    for (const time of [0, 149, 150, 151, 300, 449, 450, 451]) {
      const pose = partsPose(time, 'flight'), t = partsTransforms(pose);
      for (const [transform, x, y] of [[t.wing, 79, 43], [t.farWing, 90, 42]] as const) {
        const root = transformPoint(transform, x, y);
        expect(root[0]).toBeCloseTo(x, 5);
        expect(root[1]).toBeCloseTo(y, 5);
      }
      const layers = partsLayers(pose).map(layer => layer.id);
      expect(layers[0]).toMatch(/^wing-far-/);
      expect(layers).not.toContain('leg-near');
      expect(layers).not.toContain('leg-far');
      expect(layers.indexOf('body')).toBeGreaterThan(0);
      expect(layers.at(-1)).toBe('wing-shoulder');
      expect(layers.at(-2)).toMatch(/^wing-/);
      expect(layers).not.toContain('wing');
      expect(layers.indexOf('leg-near-tucked')).toBeGreaterThan(layers.indexOf('body'));
      expect(layers.indexOf('leg-near-tucked')).toBeLessThan(layers.length - 1);
    }
  });
  it('articulates the shoulder with the wing through every drawing handoff', () => {
    let previousTip: number[] | undefined;
    for (let time = 0; time <= 600; time += 5) {
      const pose = partsPose(time, 'flight'), t = partsTransforms(pose);
      const layers = partsLayers(pose);
      const cover = layers.find(layer => layer.id === 'wing-shoulder')!;
      const wing = layers.find(layer => layer.id === 'wing-' + pose.nearWing.state)!;
      const root = transformPoint(cover.transform, 79, 43);
      const wingRoot = transformPoint(wing.transform, 79, 43);
      expect(root[0]).toBeCloseTo(wingRoot[0], 5);
      expect(root[1]).toBeCloseTo(wingRoot[1], 5);
      const radians = Math.PI * 150 / 180;
      const tip = transformPoint(t.shoulder, 79 + 20 * Math.cos(radians), 43 + 20 * Math.sin(radians));
      const direction = Math.PI * (pose.nearWing.angle - pose.lean) / 180;
      expect(tip[0]).toBeCloseTo(79 + 20 * Math.cos(direction), 5);
      expect(tip[1]).toBeCloseTo(43 + 20 * Math.sin(direction), 5);
      if (previousTip) expect(Math.hypot(tip[0] - previousTip[0], tip[1] - previousTip[1])).toBeLessThan(1.5);
      previousTip = tip;
    }
    expect(partsTransforms(partsPose(0, 'flight')).shoulder)
      .not.toEqual(partsTransforms(partsPose(300, 'flight')).shoulder);
  });
  it('uses eight drawn wing profiles without collapsing their volume', () => {
    expect([0, 75, 150, 225, 300, 375, 450, 525].map(time => partsPose(time, 'flight').nearWing.state))
      .toEqual(['up', 'high-fall', 'forward', 'low-fall', 'down', 'low-rise', 'recovery', 'high-rise']);
    expect(partsPose(50, 'flight').nearWing.blend).toBeGreaterThan(0);
    expect(partsPose(50, 'flight').nearWing.blend).toBeLessThan(1);
    expect(partsPose(150, 'flight').nearWing.blend).toBe(0);
    for (let time = 0; time < 600; time += 5) {
      const transforms = partsTransforms(partsPose(time, 'flight'));
      for (const transform of [transforms.wing, transforms.farWing]) {
        const [a, b, c, d] = svgMatrix(transform);
        expect(a * d - b * c).toBeGreaterThan(.6);
        expect(a * d - b * c).toBeLessThan(1.6);
        expect(Math.hypot(a, b)).toBeCloseTo(Math.hypot(c, d), 6);
      }
    }
  });

  it('registers every drawn shoulder at its shared joint and measures span from the primary tip', () => {
    for (const [id, p] of Object.entries(manifest.parts)) {
      if (!('rootSource' in p)) continue;
      const [left, top, width, height] = p.sourceBounds;
      const root = [p.x + (p.rootSource[0] - left) * p.width / width,
        p.y + (p.rootSource[1] - top) * p.height / height];
      expect(root[0], id).toBeCloseTo(p.pivot[0], 6);
      expect(root[1], id).toBeCloseTo(p.pivot[1], 6);
      const tip = [p.x + (p.tipSource[0] - left) * p.width / width,
        p.y + (p.tipSource[1] - top) * p.height / height];
      expect(Math.hypot(tip[0] - root[0], tip[1] - root[1]), id).toBeCloseTo(p.projectedSpan, 6);
    }
  });

  it('aligns both blended drawings at the same moving shoulder and primary tip', () => {
    for (let time = 0; time < 600; time += 5) {
      for (const layer of partsLayers(partsPose(time, 'flight'))) {
        if (!layer.nextId || !layer.nextAdjustment) continue;
        const a = manifest.parts[layer.id], b = manifest.parts[layer.nextId];
        if (!('rootSource' in a) || !('rootSource' in b)) throw new Error('Missing flight calibration');
        const points = (p: typeof a, transform: string) => [p.rootSource, p.tipSource].map(([x, y]) =>
          transformPoint(transform, p.x + (x - p.sourceBounds[0]) * p.width / p.sourceBounds[2],
            p.y + (y - p.sourceBounds[1]) * p.height / p.sourceBounds[3]));
        const from = points(a, layer.transform), to = points(b, layer.transform + ' ' + layer.nextAdjustment);
        for (let index = 0; index < 2; index++) {
          expect(from[index][0]).toBeCloseTo(to[index][0], 5);
          expect(from[index][1]).toBeCloseTo(to[index][1], 5);
        }
      }
    }
  });

});
