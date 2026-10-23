import { describe, expect, it } from 'vitest';
import { legendOf, skeletonFromPosed } from '../../../../lab/skeleton';
import type { Limb } from '../gait';
import { legsOf, solesOf } from '../test-rig';
import { BODY, fixtureRig, legacyFixture, MODES, type Moment } from './fixture';
import { LAWS, type Seen } from './laws';
import { planDiff, planOf } from './plan';

// Its modes over a few seconds, moving and held still, as the lab plays them.
const MOMENTS: Moment[] = MODES.flatMap((mode) => [false, true].flatMap((still) => Array.from({ length: 120 }, (_, i) => ({ mode, now: i * 40, walked: i * 0.5, still }))));
// What it draws, guides aside: the composed one marks every joint.
const drawn = (at: Moment) => ({ ...planOf(fixtureRig(at)), guides: [] });
const hrefsSeen = (at: Moment) => drawn(at).draws.flatMap((d) => (d.kind === 'image' && d.visible && d.opacity > 0 ? [d.href] : []));

describe('the test animal built on a skeleton', () => {
  it('uses every kind of attachment, a piece with variants, and a z override', () => {
    const kinds = BODY.pieces.map((p) => (p.at.kind === 'joint' && p.at.local ? 'joint, local' : p.at.kind));
    expect([...new Set(kinds)].sort()).toEqual(['bar', 'bone', 'joint', 'joint, local', 'span']);
    const seen = new Set(MOMENTS.flatMap(hrefsSeen));
    for (const src of ['fixture-head.webp', 'fixture-head-shut.webp', 'fixture-foot.webp', 'fixture-curled.webp']) expect(seen).toContain(src);
    const order = (mode: Moment['mode']) => fixtureRig({ mode, now: 0, walked: 0, still: false }).layers.map((l) => (l.kind === 'piece' ? l.name : l.kind));
    expect(order('walk')[0]).toBe('tail');
    expect(order('curl').at(-1)).toBe('tail');
  });

  it('draws exactly what the same animal drawn as rigs are today draws, in every moment', () => {
    for (const at of MOMENTS) expect(planDiff(drawn(at), { ...planOf(legacyFixture(at)), guides: [] }), `${at.mode} at ${at.now}${at.still ? ', still' : ''}`).toEqual([]);
  });

  it('has its legs where the solver puts them, read from its skeleton', () => {
    for (const at of MOMENTS.filter((_, i) => i % 7 === 0)) {
      const [skeleton, legacy] = [fixtureRig(at), legacyFixture(at)];
      // The hips found through matrices, not turned(), so to rounding.
      const numbers = (l: Limb) => [l.hip, l.knee, l.ankle, l.foot].flatMap((p) => [p.x, p.y]).concat(l.paw);
      expect(legsOf(skeleton).map(numbers)).toEqual(legsOf(legacy).map((l) => numbers(l).map((n) => expect.closeTo(n, 9))));
      solesOf(skeleton).forEach((sole, i) => expect(sole).toBeCloseTo(solesOf(legacy)[i], 9));
    }
  });

  it('keeps every law', () => {
    const seen = (at: Moment): Seen => {
      const pose = fixtureRig(at);
      return { ...at, walking: at.mode === 'walk', pose, plan: planOf(pose), box: { width: 46, height: 28 } };
    };
    const watched = { moving: MOMENTS.filter((m) => !m.still).map(seen), still: MOMENTS.filter((m) => m.still).map((m) => seen({ ...m, walked: 0 })) };
    expect(Object.entries(LAWS).flatMap(([name, law]) => law(watched).slice(0, 3).map((broken) => `${name}: ${broken}`))).toEqual([]);
  });

  it('shows the lab its skeleton coded by role, a limb\'s own joints marked derived', () => {
    const pose = fixtureRig({ mode: 'stand', now: 0, walked: 0, still: false });
    if (!pose.skeleton) throw new Error('no skeleton');
    const skeleton = skeletonFromPosed(pose.skeleton);
    expect(skeleton.groups.map((g) => [g.code, g.title])).toEqual([['L0', 'near foreleg'], ['L2', 'near hind leg'], ['S', 'spine'], ['H', 'head']]);
    expect(skeleton.joints.filter((j) => j.code.startsWith('L2')).map((j) => [j.code, j.name, !!j.derived])).toEqual([
      ['L2J0', 'hip', false], ['L2J1', 'stifle', true], ['L2J2', 'hock', true], ['L2J3', 'toes', true], ['L2J4', 'toe tip', true],
    ]);
    expect(skeleton.bones.filter((b) => b.code.startsWith('L2')).map((b) => [b.code, b.from, b.to])).toEqual([['L2B0', 'L2J0', 'L2J1'], ['L2B1', 'L2J1', 'L2J2'], ['L2B2', 'L2J2', 'L2J3'], ['L2B3', 'L2J3', 'L2J4']]);
    expect(legendOf(skeleton).find((g) => g.group.code === 'S')?.rows.map((r) => r.code)).toEqual(['SJ0', 'SJ2', 'SJ3', 'SJ4', 'SB0']);
  });
});
