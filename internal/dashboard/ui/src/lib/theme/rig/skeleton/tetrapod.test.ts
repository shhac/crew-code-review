import { describe, expect, it } from 'vitest';
import { legsTo, type Step } from '../gait';
import { legsAround, turnAbout, turned, type ArtLeg, type Foot, type Frame, type LimbArt, type RigPose } from '../rig';
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
});
