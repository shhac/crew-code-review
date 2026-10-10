import { describe, expect, it } from 'vitest';
import { apart } from '../math';
import { flatLayers, firstShut, guideAt, legsOf, lidsOf, pageReach, rigBounds, solesOf } from '../rig/test-rig';
import type { Layer, RigPose } from '../rig/rig';
import { BILL } from './crow';
import { crowRig, FOOTPRINTS, SCALE, type CrowPose, type RigCrow } from './crow-rig';

const crow = (pose: CrowPose, over: Partial<RigCrow> = {}): RigCrow => ({ pose, walked: 0, seed: 1, beat: 0, t: 0, ...over });
const POSES: CrowPose[] = ['stand', 'walk', 'sidle', 'peck', 'alert', 'takeoff', 'flap', 'skim', 'glide', 'flare', 'settle'];
const STILL = { now: 0, still: true, gaze: 0 };
const look = (now = 0, gaze = 0) => ({ now, still: false, gaze });

// Every moment of a pose: two strides, four wingbeats (a take-off from its
// wings opening to its settled flap), the whole of a peck, a flare and a
// settle, the head turned either way past as far as it goes.
function moments(pose: CrowPose): RigPose[] {
  const gaze = (i: number) => [-30, 30, 0][i % 3];
  return Array.from({ length: 240 }, (_, i) => crowRig(crow(pose, { walked: i * 0.6, beat: pose === 'takeoff' ? -0.5 + i / 50 : i / 60, t: (i % 120) / 119 }), look(i * 37, gaze(i))));
}
const most = (rigs: readonly RigPose[], of: (r: RigPose) => number) => Math.max(...rigs.map(of));
const below = (r: RigPose) => (rigBounds(r).bottom - r.anchor.y) * r.scale;
const seen = (pose: RigPose, name: string) => flatLayers(pose.layers).some((l: Layer) => l.kind === 'image' && l.name === name && !l.hidden);
const at = (pose: RigPose, name: string) => guideAt(pose, name) ?? { x: NaN, y: NaN };

describe('crow rig', () => {
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

  it('stands, walks and pecks in the room every ledge animal has, at the note’s size', () => {
    for (const pose of ['stand', 'walk', 'sidle', 'peck'] as const) expect(FOOTPRINTS[pose].height).toBeLessThanOrEqual(27.5);
    // The reference stands 26.5px tall from its crown to the ledge.
    expect((27.75 - 1.19) * SCALE).toBeCloseTo(26.5, 0);
    // Flying, its whole flap stays inside the note's flight envelope.
    const flap = FOOTPRINTS.flap;
    expect(flap.width).toBeLessThanOrEqual(46);
    expect(flap.height + (flap.down ?? 0)).toBeLessThanOrEqual(58);
    // Skimming, inside the skim envelope: 28px above its line, 6 below.
    expect(FOOTPRINTS.skim.height).toBeLessThanOrEqual(28);
    expect(FOOTPRINTS.skim.down ?? 0).toBeLessThanOrEqual(6);
  });

  it('stands both feet flat on the ledge', () => {
    const stood = crowRig(crow('stand'), STILL);
    for (const sole of solesOf(stood)) expect(sole).toBeCloseTo(stood.anchor.y, 1);
  });

  it('walks with a foot always down, both down at each change, its toes never below the ledge', () => {
    for (const pose of ['walk', 'sidle'] as const) {
      const rigs = moments(pose);
      const ground = rigs[0].anchor.y;
      const downs = rigs.map((r) => solesOf(r).filter((y) => y > ground - 1e-3).length);
      expect(Math.min(...downs)).toBeGreaterThanOrEqual(1);
      expect(downs.filter((n) => n === 2).length).toBeGreaterThan(0);
      expect(most(rigs, (r) => Math.max(...solesOf(r)) - ground)).toBeLessThanOrEqual(1e-6);
    }
  });

  it('keeps every bone of its legs its length, the femur hidden, the intertarsal joint bending back', () => {
    for (const pose of POSES) {
      for (const [i, rig] of moments(pose).entries()) {
        for (const leg of legsOf(rig)) {
          const what = `${pose} at ${i}`;
          expect(apart(leg.hip, leg.knee), what).toBeCloseTo(2.5, 2);
          expect(apart(leg.knee, leg.ankle), what).toBeCloseTo(2.4, 2);
          expect(apart(leg.ankle, leg.foot), what).toBeCloseTo(3.9, 2);
        }
      }
    }
    for (const leg of legsOf(crowRig(crow('stand'), STILL))) {
      expect(leg.knee.x).toBeGreaterThan(leg.ankle.x);
      expect(leg.foot.x).toBeGreaterThan(leg.ankle.x);
    }
    const names = (crowRig(crow('stand'), STILL).guides ?? []).map((g) => g.name);
    for (const joint of ['hip', 'knee', 'intertarsal joint (ankle)', 'toes (metatarsophalangeal joint)']) expect(names).toContain(joint);
  });

  it('bobs its head as it walks: thrust forward, then held still over the ground', () => {
    const eyes = moments('walk').slice(0, 120).map((r, i) => ({ ...at(r, 'eye'), walked: (i * 0.6) / SCALE }));
    // Against the ground the eye holds, then jumps ahead: some frames it
    // barely moves, others it moves more than the body does.
    const moves = eyes.slice(1).map((e, i) => e.x + e.walked - (eyes[i].x + eyes[i].walked));
    expect(Math.min(...moves.map(Math.abs))).toBeLessThan(0.1);
    expect(Math.max(...moves)).toBeGreaterThan(0.6 * 1.5);
  });

  it('strikes the ledge with its bill at the peck’s lowest, BILL ahead of its feet', () => {
    const strike = crowRig(crow('peck', { t: 0.6 }), look());
    const bill = at(strike, 'bill');
    expect(strike.anchor.y - bill.y).toBeLessThan(1);
    expect(bill.x - strike.anchor.x).toBeCloseTo(BILL, 0);
    // Between pecks the head is up again.
    expect(at(crowRig(crow('peck', { t: 0.95 }), look()), 'bill').y).toBeLessThan(bill.y - 2);
  });

  it('turns its head toward a cursor, down further than up', () => {
    const level = at(crowRig(crow('stand'), look(0, 0)), 'bill');
    expect(at(crowRig(crow('stand'), look(0, 14)), 'bill').y).toBeGreaterThan(level.y + 1);
    expect(at(crowRig(crow('stand'), look(0, -14)), 'bill').y).toBeGreaterThan(level.y - 1);
  });

  it('blinks its third eyelid, but not under reduced motion, where it stands as drawn', () => {
    expect(firstShut((now) => crowRig(crow('stand'), look(now)))).toBeDefined();
    for (const pose of POSES) {
      const still = crowRig(crow(pose, { beat: 0.3, t: 0.5, walked: 7 }), { now: 1234, still: true, gaze: 10 });
      expect(lidsOf(still)).toEqual([]);
      expect(seen(still, 'folded wing')).toBe(true);
      for (const sole of solesOf(still)) expect(sole).toBeCloseTo(still.anchor.y, 1);
    }
  });

  it('flies on spread wings, its folded wing put away', () => {
    const top = crowRig(crow('flap', { beat: 0 }), look());
    expect(seen(top, 'folded wing')).toBe(false);
    expect(seen(top, 'wing arm, underside')).toBe(true);
    const bottom = crowRig(crow('flap', { beat: 0.55 }), look());
    expect(seen(bottom, 'wing arm')).toBe(true);
    expect(at(top, 'wingtip').y).toBeLessThan(at(top, 'shoulder').y - 15);
    expect(at(bottom, 'wingtip').y).toBeGreaterThan(at(bottom, 'shoulder').y + 10);
    // The hand folds back on the upstroke.
    const up = crowRig(crow('flap', { beat: 0.78 }), look());
    expect(at(up, 'wingtip').x).toBeLessThan(at(top, 'wingtip').x);
    // Skimming, the strokes stay shallow.
    const skims = Array.from({ length: 20 }, (_, i) => crowRig(crow('skim', { beat: i / 20 }), look()));
    for (const s of skims) expect(Math.abs(at(s, 'wingtip').y - at(s, 'shoulder').y)).toBeLessThan(11);
  });

  it('takes off with its feet down until halfway through the first downstroke, and lands reaching for the ledge', () => {
    const ground = crowRig(crow('stand'), STILL).anchor.y;
    const early = crowRig(crow('takeoff', { beat: 0.1 }), look());
    for (const sole of solesOf(early)) expect(sole).toBeCloseTo(ground, 1);
    const late = legsOf(crowRig(crow('takeoff', { beat: 0.4 }), look()));
    legsOf(early).forEach((leg, i) => expect(late[i].foot.x).toBeLessThan(leg.foot.x - 0.5));
    const reaching = crowRig(crow('flare', { t: 0.9 }), look());
    for (const leg of legsOf(reaching)) expect(leg.foot.x).toBeGreaterThan(leg.hip.x + 1);
  });

  it('runs from the ground into the air and back without a jump', () => {
    const eye = (r: RigPose) => at(r, 'eye');
    const pairs: [RigPose, RigPose][] = [
      [crowRig(crow('stand'), look()), crowRig(crow('takeoff', { beat: -0.5 }), look())],
      [crowRig(crow('takeoff', { beat: 3.5 }), look()), crowRig(crow('flap', { beat: 3.5 }), look())],
      [crowRig(crow('flap', { beat: 2 }), look()), crowRig(crow('flare', { beat: 2, t: 0 }), look())],
      [crowRig(crow('flare', { t: 1 }), look()), crowRig(crow('settle', { t: 0 }), look())],
      [crowRig(crow('settle', { t: 1 }), look()), crowRig(crow('stand'), look())],
    ];
    for (const [a, b] of pairs) expect(apart(eye(a), eye(b))).toBeLessThan(0.6);
  });
});
