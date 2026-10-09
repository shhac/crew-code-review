import { describe, expect, it } from 'vitest';
import { rigBounds, type Layer, type RigPose } from '../rig/rig';
import { POSES, type Fox, type FoxView, type Mode, type Pose } from './fox';
import { foxRig, type FoxLook } from './fox-rig';

const fox = (mode: Mode, over: Partial<Fox> = {}): Fox => ({
  id: 0, seed: 1, walked: 0, look: 0, floor: 1, x: 0, dir: 1, mode, until: 600, target: 0, from: 0, hop: 0, trip: null, ear: 0, earRest: 0, near: null, startled: false, ...over,
});
const view = (pose: Pose): FoxView => ({ x: 0, y: 0, pose, dir: 1, opacity: 1 });
const look = (over: Partial<FoxLook> = {}): FoxLook => ({ now: 0, still: false, ...over });

const flat = (layers: readonly Layer[]): Layer[] => layers.flatMap((l) => (l.kind === 'group' ? [l, ...flat(l.layers)] : [l]));
const legs = (pose: RigPose) => flat(pose.layers).flatMap((l) => (l.kind === 'legs' ? l.legs : []));
const lids = (pose: RigPose) => flat(pose.layers).filter((l) => l.kind === 'lid');
const OPEN = 3900;

describe('fox rig', () => {
  // Placement and clearance work from POSES, so the drawing must never
  // reach past them, whatever the moment in its stride or leap.
  const poses: [Mode, Pose][] = [['trot', 'trot'], ['exit', 'trot'], ['settle', 'trot'], ['stretch', 'bow'], ['crouch', 'bow'], ['leap', 'pounce'], ['dig', 'pounce']];
  for (const [mode, pose] of poses) {
    it(`stays inside its ${pose} footprint while it does ${mode}`, () => {
      const { width, height } = POSES[pose];
      for (let now = 0; now <= 600; now += 20) {
        for (let walked = 0; walked < 10; walked += 0.5) {
          const rig = foxRig(fox(mode, { walked }), view(pose), look({ now }));
          const b = rigBounds(rig);
          expect(b.left).toBeGreaterThanOrEqual(rig.anchor.x - width / 2);
          expect(b.right).toBeLessThanOrEqual(rig.anchor.x + width / 2);
          expect(rig.anchor.y - b.top).toBeLessThanOrEqual(height);
        }
      }
    });
  }

  it('trots on four legs, diagonal pairs together', () => {
    const at = (walked: number) => legs(foxRig(fox('trot', { walked }), view('trot'), look({ now: OPEN })));
    expect(at(1)).not.toEqual(at(0));
    // Far hind with near fore, and far fore with near hind.
    const [farHind, farFore, nearHind, nearFore] = at(2.5);
    expect(farHind.foot.y).toBeCloseTo(nearFore.foot.y);
    expect(farFore.foot.y).toBeCloseTo(nearHind.foot.y);
  });

  it('is one picture curled up, looking up from there when alert', () => {
    expect(legs(foxRig(fox('asleep'), view('curled'), look()))).toHaveLength(0);
    const images = (pose: Pose) => flat(foxRig(fox('asleep'), view(pose), look()).layers).flatMap((l) => (l.kind === 'image' ? [l.src] : []));
    expect(images('curled')).toHaveLength(1);
    expect(images('alert')).not.toEqual(images('curled'));
  });

  it('blinks while awake, and never under reduced motion', () => {
    const shut = Array.from({ length: 4000 }, (_, t) => t).find((t) => lids(foxRig(fox('settle'), view('trot'), look({ now: t }))).length > 0);
    expect(shut).toBeDefined();
    expect(lids(foxRig(fox('settle'), view('trot'), look({ now: OPEN })))).toHaveLength(0);
    expect(lids(foxRig(fox('settle'), view('trot'), look({ now: shut, still: true })))).toHaveLength(0);
  });

  it('stands square under reduced motion, whatever it was doing', () => {
    const standing = legs(foxRig(fox('settle'), view('trot'), look({ still: true })));
    expect(legs(foxRig(fox('trot', { walked: 3.3 }), view('trot'), look({ now: 777, still: true })))).toEqual(standing);
  });

  it('noses down and scrabbles while digging', () => {
    const paws = (now: number) => legs(foxRig(fox('dig'), view('pounce'), look({ now }))).map((l) => l.foot);
    expect(paws(100)).not.toEqual(paws(160));
  });
});
