import { describe, expect, it } from 'vitest';
import { svgMatrix } from '../../christmas/parts-affine';
import type { Point } from '../../pointer';
import { hareRig } from '../../hares/hare-rig';
import { transformOf, turnAbout, turned, type Layer } from '../rig';
import { birdWing, foreshortening, wingLayer, type WingArt } from '../wings';
import { applied, product, type Affine } from './affine';
import { forward, local } from './forward';
import type { JointSpec, PoseSpec, Skeleton } from './types';

// The same small numbers every run.
const randoms = (seed: number) => Array.from({ length: 400 }, (_, i) => {
  const x = Math.sin(seed * 9301 + i * 49297) * 233280;
  return x - Math.floor(x);
});
// What a missing frame compares as: never close to anything.
const NONE: Affine = [NaN, NaN, NaN, NaN, NaN, NaN];
const close = (a: Affine, b: Affine) => a.forEach((n, i) => expect(n).toBeCloseTo(b[i], 9));

// A group's matrix as Layers.svelte writes its transform.
type Group = Extract<Layer, { kind: 'group' }>;
const groupMatrix = (g: Group) => svgMatrix(transformOf(g.turn, (g.scaleY ?? 1) * (g.foreshorten ?? 1)));
// Each picture's matrix through the groups it is drawn in, by its name.
const placed = (layers: readonly Layer[], outer: Affine = [1, 0, 0, 1, 0, 0]): Map<string, Affine> => new Map(layers.flatMap((l) => {
  if (l.kind === 'group') return [...placed(l.layers, product(outer, groupMatrix(l)))];
  return l.kind === 'image' ? [[l.name, outer] as const] : [];
}));

const joint = (id: string, parent: string | null, at: Point, more: Partial<JointSpec> = {}): JointSpec =>
  ({ id, parent, at, role: { part: 'other', index: 0 }, name: id, ...more });
const still = (root = turnAbout(0, { x: 0, y: 0 })): PoseSpec => ({ root, joints: {}, limbs: {}, show: {}, z: {} });

describe('local', () => {
  it('is transformOf exactly: the squash in the joint\'s own axes, then its turn, then its shift', () => {
    const r = randoms(1);
    Array.from({ length: 50 }, (_, i) => r.slice(i * 6, i * 6 + 6)).forEach(([a, x, y, dx, dy, s]) => {
      const turn = turnAbout(360 * a - 180, { x: 30 * x, y: 30 * y }, 10 * dx - 5, 10 * dy - 5);
      const squash = 0.5 + s;
      close(local(joint('j', null, turn.pivot), { angle: turn.angle, shift: { x: turn.dx, y: turn.dy }, squash: { by: squash } }), svgMatrix(transformOf(turn, squash)));
    });
  });

  it('foreshortens in the parent\'s axes, outside the turn, as a bird\'s wing is placed then swept', () => {
    const art: WingArt = { name: 'wing', shoulder: { x: 3, y: 9 }, wrist: { x: 4, y: 5 }, arm: { upper: 'a', under: 'b', x: 0, y: 4, width: 6, height: 6 }, hand: { upper: 'c', under: 'd', x: 1, y: 0, width: 6, height: 6 } };
    const root = { x: 14, y: 8 };
    for (const pose of [{ lift: 40, sweep: 20, fold: 30 }, { lift: -60, sweep: -10, fold: 120 }, { lift: 3, sweep: 50, fold: 150 }]) {
      const groups = placed([birdWing(art, pose, root)]);
      const skeleton: Skeleton = { joints: [joint('shoulder', null, art.shoulder), joint('wrist', 'shoulder', art.wrist)], bones: [], limbs: [] };
      const frames = forward(skeleton, {
        ...still(),
        joints: { shoulder: { angle: -pose.sweep, foreshorten: foreshortening(pose.lift), shift: { x: root.x - art.shoulder.x, y: root.y - art.shoulder.y } }, wrist: { angle: -pose.fold } },
      });
      close(frames.get('shoulder') ?? NONE, groups.get('wing arm') ?? NONE);
      close(frames.get('wrist') ?? NONE, groups.get('wing hand') ?? NONE);
    }
  });

  it('squashes across an axis as a beating wing is squashed across its length', () => {
    const r = randoms(2);
    Array.from({ length: 20 }, (_, i) => r.slice(i * 5, i * 5 + 5)).forEach(([a, axis, s, lift, x]) => {
      const root = { x: 20 * x, y: 7 };
      const stroke = { angle: 120 * a - 60, squash: 0.55 + 0.45 * s, lift: lift - 0.5 };
      const picture: Layer = { kind: 'image', name: 'wing', src: '', x: 0, y: 0, width: 1, height: 1 };
      const groups = placed([wingLayer(picture, root, 360 * axis, stroke)]);
      const at = local(joint('hinge', null, root), { angle: stroke.angle, shift: { x: 0, y: stroke.lift }, squash: { by: stroke.squash, axis: 360 * axis } });
      close(at, groups.get('wing') ?? NONE);
    });
  });
});

describe('forward', () => {
  it('composes the hare\'s sitting body, turned and breathing, and its head and ears inside it, as its groups do', () => {
    const pose = hareRig({ pose: 'sit', walked: 0, seed: 1 }, { now: 1700, gaze: 6, still: false });
    const body = pose.layers.find((l): l is Group => l.kind === 'group');
    const head = body?.layers.find((l): l is Group => l.kind === 'group');
    const ears = head?.layers.find((l): l is Group => l.kind === 'group');
    if (!body || !head || !ears) throw new Error('the hare is drawn another way now');
    expect(body.scaleY).not.toBe(1);
    expect(body.turn.angle).not.toBe(0);
    const hip = { x: 6, y: 13 };
    const skeleton: Skeleton = {
      joints: [joint('pelvis', null, body.turn.pivot), joint('skull', 'pelvis', head.turn.pivot), joint('ears', 'skull', ears.turn.pivot), joint('hip', 'pelvis', hip)],
      bones: [],
      limbs: [{ id: 'leg', pair: 1, side: 'near', joints: { root: 'hip', middle: 'knee', lower: 'hock', end: 'toes' }, ground: 17, solve: 'quad', leg: { reach: 0, thigh: 2, shin: 2, bend: 1 } }],
    };
    const frames = forward(skeleton, {
      ...still(body.turn),
      joints: { pelvis: { squash: { by: body.scaleY ?? 1 } }, skull: { angle: head.turn.angle, shift: { x: head.turn.dx, y: head.turn.dy } }, ears: { angle: ears.turn.angle } },
    });
    const groups = placed(pose.layers);
    close(frames.get('pelvis') ?? NONE, groups.get('body') ?? NONE);
    close(frames.get('skull') ?? NONE, groups.get('head') ?? NONE);
    close(frames.get('ears') ?? NONE, groups.get('ears') ?? NONE);
    // The hip takes the body's turn, not its breath.
    const drawn = applied(frames.get('hip') ?? NONE, hip);
    const want = turned(body.turn, hip);
    expect([drawn.x, drawn.y]).toEqual([expect.closeTo(want.x, 9), expect.closeTo(want.y, 9)]);
  });

  it('composes a chain of turns, squashes, foreshortenings and shifts as nested groups do', () => {
    const r = randoms(3);
    const points = [{ x: 5, y: 5 }, { x: 9, y: 3 }, { x: 12, y: 7 }];
    const skeleton: Skeleton = { joints: points.map((at, i) => joint(`j${i}`, i ? `j${i - 1}` : null, at)), bones: [], limbs: [] };
    Array.from({ length: 20 }, (_, n) => r.slice(n * 15, n * 15 + 15)).forEach((v) => {
      const poses = points.map((_, i) => ({ angle: 200 * v[i * 5] - 100, squash: { by: 0.6 + 0.8 * v[i * 5 + 1] }, foreshorten: 1.6 * v[i * 5 + 2] - 0.8, shift: { x: v[i * 5 + 3] - 0.5, y: v[i * 5 + 4] - 0.5 } }));
      const root = turnAbout(30 * v[0], { x: 2, y: 2 }, 1, -1);
      // A joint is two groups: moved and foreshortened about it, then turned
      // and squashed about it.
      const nest = (i: number): Layer[] => {
        if (i === points.length) return [];
        const p = poses[i];
        const inner: Layer = { kind: 'group', turn: turnAbout(p.angle, points[i]), scaleY: p.squash.by, layers: [{ kind: 'image', name: `j${i}`, src: '', x: 0, y: 0, width: 1, height: 1 }, ...nest(i + 1)] };
        return [{ kind: 'group', turn: turnAbout(0, points[i], p.shift.x, p.shift.y), foreshorten: p.foreshorten, layers: [inner] }];
      };
      const groups = placed([{ kind: 'group', turn: root, layers: nest(0) }]);
      const frames = forward(skeleton, { ...still(root), joints: Object.fromEntries(poses.map((p, i) => [`j${i}`, p])) });
      points.forEach((_, i) => close(frames.get(`j${i}`) ?? NONE, groups.get(`j${i}`) ?? NONE));
    });
  });

  it('places no derived joint, and refuses a joint listed before its parent', () => {
    const skeleton: Skeleton = { joints: [joint('hip', null, { x: 0, y: 0 }), joint('knee', 'hip', { x: 0, y: 2 }, { derived: true })], bones: [], limbs: [] };
    expect([...forward(skeleton, still()).keys()]).toEqual(['hip']);
    expect(() => forward({ ...skeleton, joints: [joint('ear', 'skull', { x: 0, y: 0 }), joint('skull', null, { x: 0, y: 0 })] }, still())).toThrow(/before its parent/);
  });
});
