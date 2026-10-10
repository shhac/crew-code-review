import { describe, expect, it } from 'vitest';
import { apart } from '../math';
import { flatLayers, firstShut, guideAt, legsOf, lidsOf, pageReach, rigBounds, solesOf } from '../rig/test-rig';
import type { Layer, RigPose } from '../rig/rig';
import { FOOTPRINTS, gullRig, SCALE, type GullPose, type RigGull } from './gull-rig';

const gull = (pose: GullPose, over: Partial<RigGull> = {}): RigGull => ({ pose, walked: 0, seed: 1, beat: 0, t: 0, ...over });
const POSES: GullPose[] = ['stand', 'strut', 'forage', 'takeoff', 'flap', 'glide', 'stoop', 'flare', 'settle'];
const OPEN = 3900;

// Every moment of a pose: two strides, four wingbeats (a take-off from its
// wings opening to its settled flap), the whole of a flare and a settle.
function moments(pose: GullPose): RigPose[] {
  return Array.from({ length: 240 }, (_, i) => gullRig(gull(pose, { walked: i * 0.6, beat: pose === 'takeoff' ? -0.5 + i / 50 : i / 60, t: i / 239 }), { now: i * 37, still: false }));
}
const most = (rigs: readonly RigPose[], of: (r: RigPose) => number) => Math.max(...rigs.map(of));
const below = (r: RigPose) => (rigBounds(r).bottom - r.anchor.y) * r.scale;
const seen = (pose: RigPose, name: string) =>
  flatLayers(pose.layers).some((l: Layer) => l.kind === 'image' && l.name === name && !l.hidden);
const at = (pose: RigPose, name: string) => guideAt(pose, name) ?? { x: NaN, y: NaN };

describe('gull rig', () => {
  // Placement, clearance and the airspace work from FOOTPRINTS, so the
  // drawing must never reach past them, whatever the moment.
  for (const pose of POSES) {
    it(`stays inside its footprint while it does ${pose}`, () => {
      const rigs = moments(pose);
      const { width, height, down = 0 } = FOOTPRINTS[pose];
      expect(most(rigs, (r) => pageReach(r).left)).toBeLessThanOrEqual(width / 2);
      expect(most(rigs, (r) => pageReach(r).right)).toBeLessThanOrEqual(width / 2);
      expect(most(rigs, (r) => pageReach(r).top)).toBeLessThanOrEqual(height);
      expect(most(rigs, below)).toBeLessThanOrEqual(down + 1e-9);
    });
  }

  it('stands, struts and forages in the 27px every ledge animal has', () => {
    for (const pose of ['stand', 'strut', 'forage'] as const) expect(FOOTPRINTS[pose].height).toBeLessThanOrEqual(27);
    // The reference is drawn 25.5px tall, as the seaside note sets it.
    expect(17.33 * SCALE).toBeCloseTo(26, 0);
  });

  it('stands both feet flat on the ledge', () => {
    const stood = gullRig(gull('stand'), { now: OPEN, still: true });
    for (const sole of solesOf(stood)) expect(sole).toBeCloseTo(stood.anchor.y, 1);
  });

  it('struts with a foot always down, both down at each change, its toes never below the ledge', () => {
    const rigs = moments('strut');
    const ground = rigs[0].anchor.y;
    const downs = rigs.map((r) => solesOf(r).filter((y) => y > ground - 1e-3).length);
    expect(Math.min(...downs)).toBeGreaterThanOrEqual(1);
    expect(downs.filter((n) => n === 2).length).toBeGreaterThan(0);
    expect(most(rigs, (r) => Math.max(...solesOf(r)) - ground)).toBeLessThanOrEqual(1e-6);
  });

  it('keeps every bone of its legs its length, the thigh hidden in the body, the ankle bending back', () => {
    for (const pose of POSES) {
      for (const [i, rig] of moments(pose).entries()) {
        for (const leg of legsOf(rig)) {
          const what = `${pose} at ${i}`;
          expect(apart(leg.hip, leg.knee), what).toBeCloseTo(1.7, 2);
          expect(apart(leg.knee, leg.ankle), what).toBeCloseTo(1.42, 2);
          expect(apart(leg.ankle, leg.foot), what).toBeCloseTo(2.43, 2);
        }
      }
    }
    const stood = legsOf(gullRig(gull('stand'), { now: 0, still: true }));
    for (const leg of stood) {
      expect(leg.knee.x).toBeGreaterThan(leg.ankle.x);
      expect(leg.foot.x).toBeGreaterThan(leg.ankle.x);
    }
  });

  it('keeps its head steady over the ground as it struts, and bobs it as it forages', () => {
    const eyes = (pose: GullPose) => moments(pose).slice(0, 120).map((r, i) => ({ ...at(r, 'eye'), walked: (i * 0.6) / SCALE }));
    const strut = eyes('strut');
    expect(Math.max(...strut.map((e) => e.y)) - Math.min(...strut.map((e) => e.y))).toBeLessThan(0.01);
    const forage = eyes('forage');
    const ahead = forage.map((e) => e.x - forage[0].x);
    expect(Math.max(...ahead) - Math.min(...ahead)).toBeGreaterThan(1);
  });

  it('blinks, but not under reduced motion, where it stands as drawn', () => {
    expect(firstShut((now) => gullRig(gull('stand'), { now, still: false }))).toBeDefined();
    for (const pose of POSES) {
      const still = gullRig(gull(pose, { beat: 0.3, t: 0.5, walked: 7 }), { now: 1234, still: true });
      expect(lidsOf(still)).toEqual([]);
      expect(seen(still, 'body')).toBe(true);
      for (const sole of solesOf(still)) expect(sole).toBeCloseTo(still.anchor.y, 1);
    }
  });

  it('flies on spread wings, its folded wing and its legs put away', () => {
    const top = gullRig(gull('flap', { beat: 0 }), { now: 0, still: false });
    expect(seen(top, 'body in flight')).toBe(true);
    expect(seen(top, 'body')).toBe(false);
    // Raised, the near wing shows its underside; lowered, its upper side.
    expect(seen(top, 'wing arm, underside')).toBe(true);
    const bottom = gullRig(gull('flap', { beat: 0.55 }), { now: 0, still: false });
    expect(seen(bottom, 'wing arm')).toBe(true);
    expect(at(top, 'wingtip').y).toBeLessThan(at(top, 'shoulder').y - 10);
    expect(at(bottom, 'wingtip').y).toBeGreaterThan(at(bottom, 'shoulder').y + 5);
    // The hand folds back on the upstroke.
    const up = gullRig(gull('flap', { beat: 0.78 }), { now: 0, still: false });
    expect(at(up, 'wingtip').x).toBeLessThan(at(top, 'wingtip').x);
  });

  it('takes off with its feet down until halfway through the first downstroke, and lands reaching for the ledge', () => {
    const ground = moments('stand')[0].anchor.y;
    const early = gullRig(gull('takeoff', { beat: 0.1 }), { now: 0, still: false });
    for (const sole of solesOf(early)) expect(sole).toBeCloseTo(ground, 1);
    // Off the ground, its legs stretch down and back as they push off.
    const late = legsOf(gullRig(gull('takeoff', { beat: 0.4 }), { now: 0, still: false }));
    legsOf(early).forEach((leg, i) => expect(late[i].foot.x).toBeLessThan(leg.foot.x - 0.5));
    const reaching = gullRig(gull('flare', { t: 0.9 }), { now: 0, still: false });
    for (const leg of legsOf(reaching)) expect(leg.foot.x).toBeGreaterThan(leg.hip.x + 1);
    expect(seen(reaching, 'tail, fanned')).toBe(true);
  });
});
