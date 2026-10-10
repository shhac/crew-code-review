import { describe, expect, it } from 'vitest';
import { apart } from '../math';
import { firstShut, flatLayers, guideAt, legsOf, lidsOf, pageReach, rigBounds, solesOf } from '../rig/test-rig';
import type { Layer, RigPose } from '../rig/rig';
import { escape, flying, lengthOfTrack, reachAt, routeIn, trackOf } from './flight';
import { board, overview, side, testSky } from './fixtures';
import { ENVELOPES, flyIn, fresh, rigPigeon, standing, takeOff, viewOf } from './pigeon';
import { FOOTPRINTS, pigeonRig, SCALE, WALK, type PigeonPose, type RigPigeon } from './pigeon-rig';

const pigeon = (pose: PigeonPose, over: Partial<RigPigeon> = {}): RigPigeon => ({ pose, walked: 0, seed: 1, beat: 0, t: 0, ...over });
const POSES: PigeonPose[] = ['stand', 'walk', 'peck', 'alert', 'takeoff', 'fly', 'land', 'settle'];
const OPEN = 3900;

// Every moment of a pose: two strides, four wingbeats (a take-off from its
// wings opening), the whole of a peck, a landing and a settle.
function moments(pose: PigeonPose): RigPose[] {
  return Array.from({ length: 240 }, (_, i) => pigeonRig(pigeon(pose, { walked: i * 0.6, beat: pose === 'takeoff' ? -0.5 + i / 50 : i / 60, t: i / 239 }), { now: i * 37, still: false }));
}
const most = (rigs: readonly RigPose[], of: (r: RigPose) => number) => Math.max(...rigs.map(of));
const below = (r: RigPose) => (rigBounds(r).bottom - r.anchor.y) * r.scale;
const seen = (pose: RigPose, name: string) => flatLayers(pose.layers).some((l: Layer) => l.kind === 'image' && l.name === name && !l.hidden);
const at = (pose: RigPose, name: string) => guideAt(pose, name) ?? { x: NaN, y: NaN };

describe('pigeon rig', () => {
  // Placement, clearance and the airspace work from FOOTPRINTS (and the
  // model's envelopes from them), so the drawing must never reach past
  // them, whatever the moment.
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

  it('does everything it does on a ledge in the 27px every ledge animal has, the alert stretched tallest', () => {
    for (const pose of ['stand', 'walk', 'peck', 'alert', 'settle'] as const) expect(FOOTPRINTS[pose].height).toBeLessThanOrEqual(27);
    expect(FOOTPRINTS.alert.height).toBe(Math.max(...(['stand', 'walk', 'peck', 'alert'] as const).map((p) => FOOTPRINTS[p].height)));
  });

  it('stands both feet flat on the ledge, and never sinks them below it, whatever it does there', () => {
    const stood = pigeonRig(pigeon('stand'), { now: OPEN, still: true });
    for (const sole of solesOf(stood)) expect(sole).toBeCloseTo(stood.anchor.y, 1);
    for (const pose of ['stand', 'walk', 'peck', 'alert', 'settle'] as const) {
      const rigs = moments(pose);
      expect(most(rigs, (r) => Math.max(...solesOf(r)) - r.anchor.y), pose).toBeLessThanOrEqual(1e-6);
    }
  });

  it('walks with a foot always down and both down at each change of feet', () => {
    const rigs = moments('walk');
    const ground = rigs[0].anchor.y;
    const downs = rigs.map((r) => solesOf(r).filter((y) => y > ground - 1e-3).length);
    expect(Math.min(...downs)).toBeGreaterThanOrEqual(1);
    expect(downs.filter((n) => n === 2).length).toBeGreaterThan(0);
  });

  it('keeps every bone of its legs its length, the femur hidden, the ankle bending back', () => {
    for (const pose of POSES) {
      for (const [i, rig] of moments(pose).entries()) {
        for (const leg of legsOf(rig)) {
          expect(apart(leg.hip, leg.knee), `${pose} at ${i}`).toBeCloseTo(2, 2);
          expect(apart(leg.knee, leg.ankle), `${pose} at ${i}`).toBeCloseTo(1, 2);
          expect(apart(leg.ankle, leg.foot), `${pose} at ${i}`).toBeCloseTo(1.25, 2);
        }
      }
    }
    for (const leg of legsOf(pigeonRig(pigeon('stand'), { now: 0, still: true }))) {
      expect(leg.knee.x).toBeGreaterThan(leg.ankle.x);
      expect(leg.foot.x).toBeGreaterThan(leg.ankle.x);
    }
  });

  it('bobs its head as it walks: a quick thrust each step, then held still over the ground', () => {
    const steps = Array.from({ length: 200 }, (_, i) => {
      const walked = i * 0.25;
      const eye = at(pigeonRig(pigeon('walk', { walked }), { now: 0, still: false }), 'eye');
      // Against the ground: the body walks on, so add how far it has gone.
      return eye.x + walked / SCALE;
    });
    const moves = steps.slice(1).map((x, i) => x - steps[i]);
    // Held: barely moving against the ground for much of each step.
    const held = moves.filter((d) => Math.abs(d) < 0.02).length;
    expect(held).toBeGreaterThan(moves.length * 0.3);
    // Thrust: well ahead of the body's own pace in between.
    expect(Math.max(...moves)).toBeGreaterThan((2 * 0.25) / SCALE);
    // Never sliding back against the ground.
    expect(Math.min(...moves)).toBeGreaterThan(-0.02);
    expect(WALK.beats).toEqual([0, 0.5]);
  });

  it('pecks with its bill down to the ledge and back', () => {
    const down = pigeonRig(pigeon('peck', { t: 0.55 }), { now: 0, still: false });
    const up = pigeonRig(pigeon('peck', { t: 0 }), { now: 0, still: false });
    expect(at(down, 'eye').y - at(up, 'eye').y).toBeGreaterThan(6);
    expect(below(down)).toBeLessThanOrEqual(0);
    expect(below(down)).toBeGreaterThan(-3);
  });

  it('blinks, but not under reduced motion, where it stands as drawn', () => {
    expect(firstShut((now) => pigeonRig(pigeon('stand'), { now, still: false }))).toBeDefined();
    for (const pose of POSES) {
      const still = pigeonRig(pigeon(pose, { beat: 0.3, t: 0.5, walked: 7 }), { now: 1234, still: true });
      expect(lidsOf(still)).toEqual([]);
      expect(seen(still, 'folded wing')).toBe(true);
      for (const sole of solesOf(still)) expect(sole).toBeCloseTo(still.anchor.y, 1);
    }
  });

  it('flies on spread wings, its folded wing put away, the hand flexing back on the upstroke', () => {
    const top = pigeonRig(pigeon('fly', { beat: 0 }), { now: 0, still: false });
    expect(seen(top, 'folded wing')).toBe(false);
    const bottom = pigeonRig(pigeon('fly', { beat: 0.55 }), { now: 0, still: false });
    expect(at(top, 'wingtip').y).toBeLessThan(at(top, 'shoulder').y - 8);
    expect(at(bottom, 'wingtip').y).toBeGreaterThan(at(bottom, 'shoulder').y + 5);
    const up = pigeonRig(pigeon('fly', { beat: 0.78 }), { now: 0, still: false });
    expect(at(up, 'wingtip').x).toBeLessThan(at(top, 'wingtip').x);
  });

  it('claps its wings overhead as its feet leave, and lands reaching for the ledge, tail fanned', () => {
    const ground = moments('stand')[0].anchor.y;
    const clap = pigeonRig(pigeon('takeoff', { beat: 0 }), { now: 0, still: false });
    for (const sole of solesOf(clap)) expect(sole).toBeCloseTo(ground, 1);
    expect(at(clap, 'wingtip').y).toBeLessThan(at(clap, 'shoulder').y - 12);
    const reaching = pigeonRig(pigeon('land', { t: 0.9 }), { now: 0, still: false });
    for (const leg of legsOf(reaching)) expect(leg.foot.x).toBeGreaterThan(leg.hip.x);
    expect(seen(reaching, 'tail, fanned')).toBe(true);
  });
});

// The model plans and clears flights with its envelopes; here the rig's
// drawing, at every moment of a real take-off and landing, is checked to
// stay inside the envelope the model had for that moment, and never below
// the ledge.
describe('pigeon rig in flight', () => {
  const PAGE = overview();
  const SKY = testSky(PAGE);
  const inside = (pose: RigPose, env: { half: number; up: number; down: number }, what: string) => {
    const r = pageReach(pose);
    expect(r.left, what).toBeLessThanOrEqual(env.half + 1e-6);
    expect(r.right, what).toBeLessThanOrEqual(env.half + 1e-6);
    expect(r.top, what).toBeLessThanOrEqual(env.up + 1e-6);
    // Within a hundredth of a pixel: where its wingtips sweep down past the
    // feet as it touches down, the two are sampled at different moments.
    expect(below(pose), what).toBeLessThanOrEqual(env.down + 0.01);
  };

  it('stays inside its envelope through a take-off, its feet down until they leave', () => {
    const route = escape(2, board, 300, 'right', ENVELOPES, SKY)!;
    const p = takeOff(standing(fresh(0), 2, 300, 1, 0, () => 0.5), route, 0);
    const track = trackOf(route);
    for (const ms of Array.from({ length: 60 }, (_, i) => i * 10)) {
      const view = viewOf(p, PAGE, ms)!;
      const where = flying(track, ms, false);
      const pose = pigeonRig(rigPigeon(view, ms), { now: ms, still: false });
      inside(pose, reachAt(ENVELOPES, where.at, where.s, lengthOfTrack(track), false), `${ms}ms`);
    }
  });

  it('stays inside its envelope through a landing, and touches down on the ledge', () => {
    const route = routeIn(3, side, 120, 'right', ENVELOPES, SKY)!;
    const p = flyIn(standing(fresh(0), 2, 300, 1, 0, () => 0.5), route, 0);
    const track = trackOf(route);
    const total = lengthOfTrack(track);
    const end = Array.from({ length: 2000 }, (_, i) => i * 5).find((ms) => flying(track, ms, true).done)!;
    for (const ms of Array.from({ length: 80 }, (_, i) => end - 400 + i * 5)) {
      const view = viewOf(p, PAGE, ms)!;
      const where = flying(track, ms, true);
      const pose = pigeonRig(rigPigeon(view, ms), { now: ms, still: false });
      inside(pose, reachAt(ENVELOPES, where.at, where.s, total, true), `${ms}ms`);
    }
  });
});
