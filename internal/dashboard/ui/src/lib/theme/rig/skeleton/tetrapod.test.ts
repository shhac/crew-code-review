import { describe, expect, it } from 'vitest';
import { legsTo, type Step } from '../gait';
import { legsAround, turnAbout, turned, type ArtLeg, type Foot, type Frame, type LimbArt, type RigPose } from '../rig';
import { legsOf, solesOf } from '../test-rig';
import { compose } from './compose';
import { planDiff, planOf } from './plan';
import { MAMMAL, picture, spine, tetrapod } from './tetrapod';

const FRAME: Frame = { width: 30, height: 20, anchor: { x: 15, y: 18 }, scale: 1.5 };
const TOES: Foot = { src: 'toes.webp', fur: 'toes-fur.webp', width: 2.5, height: 1.2, heel: { x: 0.4, y: 0.5 } };
const GROUND = 18 - (TOES.height - TOES.heel.y);
const BODY = { x: 3, y: 4, width: 20, height: 10 };
const PIVOT = { x: 12, y: 10 };
// Every way rig.ts lays leg art: one piece; a thigh and a tapering shank
// drawn with the thigh's art; registered anchors on the thigh and a shank of
// its own; toes up from the ground, or none.
const art = (over: Partial<LimbArt>): LimbArt => ({ bone: 'bone.webp', boneFur: 'bone-fur.webp', knee: true, foot: TOES, ...over });
const ARTS: Record<string, { art: LimbArt; taper?: boolean; toes: boolean }> = {
  'one piece': { art: art({ knee: false, overFoot: true }), toes: false },
  tapering: { art: art({ thigh: { src: 'thigh.webp', fur: 'thigh-fur.webp' } }), taper: true, toes: true },
  registered: { art: art({ thigh: { src: 'thigh.webp', fur: 'thigh-fur.webp', anchors: { start: 0.25, end: 0.88 } }, shank: { src: 'shank.webp', fur: 'shank-fur.webp', anchors: { start: 0.1, end: 0.9 } } }), toes: true },
};

describe('a tetrapod from a preset and its measured legs', () => {
  for (const [name, { art: drawn, taper, toes }] of Object.entries(ARTS)) {
    it(`lays ${name} legs exactly as legsAround draws them`, () => {
      const leg = (fore: boolean, far: boolean, x: number): ArtLeg => ({
        hip: { x, y: 12 }, reach: fore ? 0.4 : -0.5, thigh: 2.4, shin: 2.6, bend: fore ? -1 : 1, fore, far, art: drawn, width: 1.3, haunch: 2.2, taper: taper && !fore,
        walksOn: toes ? { kind: 'toes', length: 1.2, lean: 20, fold: 60 } : { kind: 'sole', toes: { x: TOES.width - TOES.heel.x, y: 0.7 }, peel: 30 },
      });
      const legs = [leg(false, true, 8), leg(true, true, 17), leg(false, false, 7), leg(true, false, 16)];
      const animal = tetrapod(MAMMAL, {
        frame: FRAME, root: 'body', joints: [{ id: 'body', parent: null, role: spine(2), at: PIVOT, name: 'body' }],
        legs, ground: () => GROUND, order: [picture('body', 'body', 'body.webp', BODY)], guides: () => [],
      });
      for (const t of [0, 0.3, 0.7]) {
        const root = turnAbout(6 * Math.sin(5 * t), PIVOT, 0, -0.3 * t);
        const steps: Step[] = legs.map((_, i) => (i % 2 ? { down: true, t } : { down: false, t }));
        const feet = legs.map((l) => ({ x: turned(root, l.hip).x + l.reach, y: GROUND - (t > 0.2 ? 0.4 : 0) }));
        const composed = compose(animal.body, () => ({ root, joints: {}, limbs: animal.limbs(feet.map((at, i) => ({ kind: 'plant', at, step: steps[i] }))), show: {}, z: {} }), 0);
        const old: RigPose = { ...FRAME, layers: legsAround(legs, legsTo(legs, legs.map((l) => turned(root, l.hip)), feet, steps), { kind: 'group', turn: root, layers: [{ kind: 'image', name: 'body', src: 'body.webp', ...BODY }] }) };
        expect(planDiff({ ...planOf(composed), guides: [] }, planOf(old)), `${name} at ${t}`).toEqual([]);
      }
    });
  }

  it('stands an animal on no legs at all, as a hawk that only flies is drawn', () => {
    const flier = tetrapod(MAMMAL, {
      frame: FRAME, root: 'body', joints: [{ id: 'body', parent: null, role: spine(2), at: PIVOT, name: 'body' }],
      legs: [], ground: () => 0, order: [picture('body', 'body', 'body.webp', BODY)], guides: () => [], stands: 'belly line',
    });
    const root = turnAbout(5, PIVOT);
    const pose = compose(flier.body, () => ({ root, joints: {}, limbs: flier.limbs([]), show: {}, z: {} }), 0);
    expect([flier.body.skeleton.limbs, flier.codes, flier.hips({ root, joints: {} }), legsOf(pose), solesOf(pose)]).toEqual([[], [], [], [], []]);
    expect(pose.guides).toEqual([{ name: 'belly line', at: FRAME.anchor }]);
    const old: RigPose = { ...FRAME, layers: [{ kind: 'group', turn: root, layers: [{ kind: 'image', name: 'body', src: 'body.webp', ...BODY }] }] };
    expect(planDiff({ ...planOf(pose), guides: [] }, planOf(old))).toEqual([]);
  });
});

describe('a one-piece leg on a hidden knee', () => {
  it('holds its piece rigid on the shin, ending at the heel, as long as it shows whatever the leg does', () => {
    const leg = (x: number) => ({
      hip: { x, y: 9 }, reach: 0, thigh: 2.3, shin: 2.3, bend: 1, jointLimits: { min: 30, max: 178 }, fore: false, far: false, width: 1.3,
      art: art({ knee: false, overFoot: true, shown: 2 }), walksOn: { kind: 'sole', toes: { x: TOES.width - TOES.heel.x, y: 0.7 }, peel: 30 }, paw: { limits: { min: -90, max: 90 } },
    } as const);
    const legs = [leg(8), { ...leg(16), fore: true, bend: -1 } as const];
    const { body, limbs } = tetrapod(MAMMAL, { frame: FRAME, root: 'body', joints: [{ id: 'body', parent: null, role: spine(1), at: PIVOT, name: 'body' }], legs, ground: () => GROUND, order: [picture('body', 'body', 'body.webp', BODY)], guides: () => [] });
    const piece = body.pieces.find((p) => p.id === 'L2B1');
    expect(piece?.at).toMatchObject({ kind: 'bar', from: 'L2J1', to: 'L2J3', held: { length: 2 } });
    const corners = (to: { x: number; y: number }) => {
      const pose = compose(body, () => ({ root: turnAbout(0, PIVOT), joints: {}, limbs: limbs([{ kind: 'plant', at: to }, { kind: 'plant', at: { x: 16, y: GROUND } }]), show: {}, z: {} }), 0);
      const drawn = pose.layers.find((l) => l.kind === 'piece' && l.id === 'L2B1');
      if (drawn?.kind !== 'piece') throw new Error('no leg piece');
      const heel = pose.skeleton!.joints.find((j) => j.code === 'L2J3')!.at;
      // The middle of its top end, along the piece from its origin at the heel.
      const top = { x: drawn.matrix[0] * drawn.box.x + drawn.matrix[4], y: drawn.matrix[1] * drawn.box.x + drawn.matrix[5] };
      return { width: drawn.box.width, top: Math.hypot(top.x - heel.x, top.y - heel.y) };
    };
    // Stood, and stepped far ahead: never stretched.
    for (const at of [{ x: 8, y: GROUND }, { x: 10.5, y: GROUND - 0.8 }]) {
      expect(corners(at).width).toBeCloseTo(2 + 1.3 / 2, 9);
      expect(corners(at).top).toBeCloseTo(2, 9);
    }
  });
});
