import { describe, expect, it } from 'vitest';
import { turnAbout, type Layer, type RigPose } from '../rig';
import { planDiff, planOf } from './plan';

const pose = (layers: readonly Layer[]): RigPose => ({ width: 10, height: 10, anchor: { x: 5, y: 10 }, scale: 2, layers });
const picture = { kind: 'image', name: 'body', src: 'body.webp', x: 2, y: 3, width: 4, height: 2 } as const;

describe('planOf', () => {
  it('places a picture by where it lands, however its box and its groups share the move', () => {
    const grouped = pose([{ kind: 'group', turn: turnAbout(90, { x: 0, y: 0 }, 1, 1), layers: [picture] }]);
    const moved = pose([{ kind: 'group', turn: turnAbout(90, { x: 0, y: 0 }, 1, 1), layers: [{ kind: 'group', turn: turnAbout(0, { x: 0, y: 0 }, 2, 3), layers: [{ ...picture, x: 0, y: 0 }] }] }]);
    expect(planDiff(planOf(grouped), planOf(moved))).toEqual([]);
    const [drawn] = planOf(grouped).draws;
    expect(drawn.kind === 'image' && drawn.place.map((n) => Math.round(n * 1e9) / 1e9)).toEqual([0, 4, -2, 0, -2, 3]);
    expect(planDiff(planOf(grouped), planOf(pose([picture]))).length).toBeGreaterThan(0);
  });

  it('carries what its groups do to how it is seen: see-through, unseen, shaded far', () => {
    const plan = planOf(pose([{ kind: 'group', turn: turnAbout(0, { x: 0, y: 0 }), opacity: 0.5, layers: [{ ...picture, far: true }, { ...picture, hidden: true }] }]));
    expect(plan.draws.map((d) => [d.opacity, d.visible, d.far])).toEqual([[0.5, true, 1], [0.5, false, 0]]);
    expect(plan.frame).toEqual({ width: 10, height: 10, anchor: { x: 5, y: 10 }, scale: 2 });
  });

  it('reads a leg piece stretched to its box, a foot keeping its shape, and every guide', () => {
    const foot = { src: 'foot.webp', fur: 'foot-fur.webp', width: 3, height: 2, heel: { x: 1, y: 0.5 } };
    const leg = { limb: { hip: { x: 0, y: 0 }, knee: { x: 0, y: 2 }, ankle: { x: 0, y: 4 }, foot: { x: 0, y: 4 }, paw: 0 }, art: { bone: 'bone.webp', boneFur: 'bone-fur.webp', knee: false, foot }, width: 2, haunch: 2, fore: true, taper: false };
    const plan = planOf({ ...pose([{ kind: 'legs', name: 'near legs', legs: [leg], far: false, fur: false }]), guides: [{ name: 'hip', at: { x: 1, y: 2 } }] });
    expect(plan.draws.map((d) => (d.kind === 'image' ? [d.href, d.aspect, d.ratio] : d.kind))).toEqual([['bone.webp', 'none', null], ['foot.webp', 'default', 1.5]]);
    expect(plan.guides).toEqual([{ name: 'hip', at: { x: 1, y: 2 } }]);
  });

  it('reads strokes and eyelids as their points where they land, and a squash that makes a circle oval', () => {
    const lid: Layer = { kind: 'lid', at: { x: 1, y: 1 }, r: 1, fur: { fill: '#fff', outline: '#000' } };
    const stroke: Layer = { kind: 'stroke', name: 'string', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }], width: 0.5, colour: '#123', fill: '#456' };
    const plan = planOf(pose([{ kind: 'group', turn: turnAbout(0, { x: 0, y: 0 }, 1, 0), scaleY: 0.5, layers: [lid, stroke] }]));
    const [circle, line, path] = plan.draws;
    expect(circle).toMatchObject({ kind: 'circle', centre: { x: 2, y: 0.5 }, data: { 'data-lid': '' }, fill: '#fff', linear: [1, 0, 0, 0.5, 0, 0] });
    expect(line).toMatchObject({ kind: 'path', points: [{ x: 1, y: 0.5 }, { x: 3, y: 0.5 }], stroke: '#000', closed: false });
    expect(path).toMatchObject({ kind: 'path', points: [{ x: 1, y: 0 }, { x: 3, y: 0 }], closed: true, fill: '#456', join: 'round', data: { 'data-stroke': 'string' } });
  });
});
