import { describe, expect, it } from 'vitest';
import { firstShut, imagesOf, legsOf, lidsOf, rigBounds } from '../rig/test-rig';
import { LEAP, POSES, poseOf, type Mode } from './fox';
import { foxRig, type FoxLook, type RigFox } from './fox-rig';

const fox = (mode: Mode, over: Partial<RigFox> = {}): RigFox => ({ mode, walked: 0, seed: 1, until: LEAP, ear: 0, look: 0, ...over });
const look = (over: Partial<FoxLook> = {}): FoxLook => ({ now: 0, still: false, ...over });
const OPEN = 3900;
// Long enough for a whole leap and a whole sway of the tail.
const MOMENTS = Array.from({ length: 230 }, (_, i) => i * 20);

describe('fox rig', () => {
  // Placement and clearance work from POSES, so the drawing must never
  // reach past them, whatever the moment in its stride, leap or sway.
  const modes: Mode[] = ['trot', 'exit', 'enter', 'settle', 'stretch', 'crouch', 'leap', 'dig', 'asleep'];
  for (const mode of modes) {
    it(`stays inside its footprint while it does ${mode}`, () => {
      for (const now of MOMENTS) {
        for (let walked = 0; walked < 10; walked += 0.5) {
          const f = fox(mode, { walked });
          const { width, height } = POSES[poseOf(f, now)];
          const rig = foxRig(f, look({ now }));
          const b = rigBounds(rig);
          // The footprint is on the page; the drawing in drawing units.
          expect((rig.anchor.x - b.left) * rig.scale).toBeLessThanOrEqual(width / 2);
          expect((b.right - rig.anchor.x) * rig.scale).toBeLessThanOrEqual(width / 2);
          expect((rig.anchor.y - b.top) * rig.scale).toBeLessThanOrEqual(height);
        }
      }
    });
  }

  it('trots on four legs, diagonal pairs together', () => {
    const at = (walked: number) => legsOf(foxRig(fox('trot', { walked }), look({ now: OPEN })));
    expect(at(1)).not.toEqual(at(0));
    // Far hind with near fore, and far fore with near hind.
    const [farHind, farFore, nearHind, nearFore] = at(2.5);
    expect(farHind.foot.y).toBeCloseTo(nearFore.foot.y);
    expect(farFore.foot.y).toBeCloseTo(nearHind.foot.y);
  });

  it('is one picture curled up, looking up from there when alert', () => {
    expect(legsOf(foxRig(fox('asleep'), look()))).toHaveLength(0);
    expect(imagesOf(foxRig(fox('asleep'), look()))).toHaveLength(1);
    expect(imagesOf(foxRig(fox('asleep', { look: Infinity }), look()))).not.toEqual(imagesOf(foxRig(fox('asleep'), look())));
  });

  it('blinks while awake, and never under reduced motion', () => {
    const shut = firstShut((now) => foxRig(fox('settle'), look({ now })));
    expect(shut).toBeDefined();
    expect(lidsOf(foxRig(fox('settle'), look({ now: OPEN })))).toHaveLength(0);
    expect(lidsOf(foxRig(fox('settle'), look({ now: shut, still: true })))).toHaveLength(0);
  });

  it('stands square under reduced motion, whatever it was doing', () => {
    const standing = legsOf(foxRig(fox('settle'), look({ still: true })));
    expect(legsOf(foxRig(fox('trot', { walked: 3.3 }), look({ now: 777, still: true })))).toEqual(standing);
  });

  it('noses down and scrabbles while digging', () => {
    const paws = (now: number) => legsOf(foxRig(fox('dig'), look({ now }))).map((l) => l.foot);
    expect(paws(100)).not.toEqual(paws(160));
  });
});
