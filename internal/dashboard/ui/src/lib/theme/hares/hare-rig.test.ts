import { describe, expect, it } from 'vitest';
import { cycleLength } from '../spidergait';
import type { RigPose } from '../rig/rig';
import { firstShut, guideAt, legsOf, lidsOf, pageReach, rigBounds, solesOf } from '../rig/test-rig';
import { BOX_GAP, CLEAR, POSES, REACHES, TALL } from './hare';
import { BOUND, gazeAt, hareRig, LOPE, SCALE, type HareLook, type HarePose, type RigHare } from './hare-rig';

const hare = (pose: HarePose, over: Partial<RigHare> = {}): RigHare => ({ pose, walked: 0, seed: 1, ...over });
const look = (over: Partial<HareLook> = {}): HareLook => ({ now: 0, gaze: 0, still: false, ...over });
const POSE_NAMES: HarePose[] = ['stand', 'graze', 'sit', 'alert', 'lope', 'bound', 'leap', 'box'];
// Legs are listed (legsOf, solesOf) far hind, far fore, near hind, near fore.
const [FAR_HIND, FAR_FORE, NEAR_HIND, NEAR_FORE] = [0, 1, 2, 3];
const OPEN = 3900;

// Every moment of a pose: through two strides, a leap, the boxing, the
// grazing jaw and ear, and every way the head might turn.
function moments(pose: HarePose): RigPose[] {
  return Array.from({ length: 240 }, (_, i) => hareRig(hare(pose, { walked: i * 0.9, leapt: (i % 60) / 59 }), look({ now: i * 37, gaze: ((i % 5) - 2) * 7 })));
}
const most = (rigs: readonly RigPose[], of: (r: RigPose) => number) => Math.max(...rigs.map(of));

describe('hare rig', () => {
  // Placement, clearance and the leap's airspace work from POSES, so the
  // drawing must never reach past them, whatever the moment.
  for (const pose of POSE_NAMES) {
    it(`stays inside its footprint while it does ${pose}`, () => {
      const rigs = moments(pose);
      const { width, height } = POSES[pose];
      expect(most(rigs, (r) => pageReach(r).left)).toBeLessThanOrEqual(REACHES[pose].back);
      expect(most(rigs, (r) => pageReach(r).right)).toBeLessThanOrEqual(REACHES[pose].front);
      expect(Math.max(REACHES[pose].back, REACHES[pose].front)).toBeLessThanOrEqual(width / 2);
      expect(most(rigs, (r) => pageReach(r).top)).toBeLessThanOrEqual(height);
      // Nothing of it ever reaches below the ledge (in a leap, below the
      // arc), not even a turned piece's box: what sits just under a ledge
      // (a tab, a button) is never touched.
      expect(most(rigs, (r) => Math.max(...solesOf(r)) - r.anchor.y)).toBeLessThanOrEqual(0);
      expect(most(rigs, (r) => rigBounds(r).bottom - r.anchor.y)).toBeLessThanOrEqual(0);
    });
  }

  it('fits 27px day to day, and needs the tall room only to sit up tall or box', () => {
    for (const pose of ['graze', 'alert', 'lope', 'bound', 'leap'] as const) expect(POSES[pose].height).toBeLessThanOrEqual(CLEAR);
    expect(POSES.sit.height).toBeLessThanOrEqual(TALL);
    expect(POSES.box.height).toBeLessThanOrEqual(TALL);
  });

  it('reaches little ahead reared up or sitting, so two boxing, one coming up to box and one bolting from it never overlap', () => {
    expect(REACHES.box.front + REACHES.box.front).toBeLessThanOrEqual(BOX_GAP);
    expect(REACHES.box.front + REACHES.bound.back).toBeLessThanOrEqual(BOX_GAP);
    expect(REACHES.lope.front + REACHES.sit.front).toBeLessThanOrEqual(BOX_GAP);
    expect(REACHES.lope.front + REACHES.alert.front).toBeLessThanOrEqual(BOX_GAP);
  });

  // Whether each foot is down (as low as a standing foot), at many moments
  // through a stride of the gait.
  const SOLE = Math.min(...solesOf(hareRig(hare('stand'), look())));
  const downs = (pose: 'bound' | 'lope', cycle: number, count = 600) => Array.from({ length: count }, (_, i) => {
    const pose_ = hareRig(hare(pose, { walked: (i * cycle * SCALE) / count }), look({ now: OPEN }));
    return solesOf(pose_).map((y) => y >= SOLE - 1e-3);
  });
  const landingsOf = (frames: boolean[][]) => frames.slice(1).flatMap((now, i) => now.flatMap((down, leg) => (down && !frames[i][leg] ? [{ leg, at: i + 1 }] : [])));

  it('half-bounds: forefeet one after the other, then the hind pair together, then a flight', () => {
    // Two strides, so the foot down at the start is seen landing.
    const frames = downs('bound', 2 * cycleLength(BOUND.stride, BOUND.stance), 1200);
    // Landings in the second stride, the near forefoot's first.
    const order = landingsOf(frames).filter((l) => l.at >= 600);
    const first = (leg: number) => order.find((l) => l.leg === leg)!.at;
    expect(first(NEAR_FORE)).toBeLessThan(first(FAR_FORE));
    expect(Math.abs(first(NEAR_HIND) - first(FAR_HIND))).toBeLessThanOrEqual(1);
    expect(first(FAR_FORE)).toBeLessThan(first(NEAR_HIND));
    // Some moments with no foot down at all: the flight.
    expect(frames.some((f) => f.every((down) => !down))).toBe(true);
  });

  it('lands its hind feet ahead of where its forefeet were set', () => {
    const cycle = 2 * cycleLength(BOUND.stride, BOUND.stance);
    const count = 1200;
    // Where each foot touches the ledge, in the ledge's own x (the hare
    // moving on as it walks).
    const prints = landingsOf(downs('bound', cycle, count)).map(({ leg, at }) => {
      const walked = (at * cycle * SCALE) / count;
      const pose = hareRig(hare('bound', { walked }), look({ now: OPEN }));
      return { leg, at, x: walked / SCALE + legsOf(pose)[leg].foot.x };
    });
    const second = prints.filter((p) => p.at >= count / 2);
    const fore = second.filter((p) => p.leg === NEAR_FORE || p.leg === FAR_FORE).slice(0, 2);
    const hind = second.filter((p) => p.leg === NEAR_HIND || p.leg === FAR_HIND).slice(0, 2);
    expect(Math.min(...hind.map((p) => p.x))).toBeGreaterThan(Math.max(...fore.map((p) => p.x)));
  });

  it('slow-hops with no flight, the hind pair together', () => {
    const frames = downs('lope', 2 * cycleLength(LOPE.stride, LOPE.stance), 1200);
    expect(frames.every((f) => f.some(Boolean))).toBe(true);
    const order = landingsOf(frames).filter((l) => l.at >= 600);
    const first = (leg: number) => order.find((l) => l.leg === leg)!.at;
    expect(Math.abs(first(NEAR_HIND) - first(FAR_HIND))).toBeLessThanOrEqual(1);
  });

  it('sits and boxes on the whole long hind foot, and runs on its toes', () => {
    const hock = (pose: RigPose, leg: number) => legsOf(pose)[leg];
    for (const pose of ['sit', 'graze', 'alert', 'box'] as const) {
      const leg = hock(hareRig(hare(pose), look()), NEAR_HIND);
      expect(leg.ankle.y, pose).toBeCloseTo(leg.foot.y, 5);
      expect(leg.ankle.x, pose).toBeLessThan(leg.foot.x);
    }
    // Test a planted hind foot, not the gathered airborne tuck: the long
    // foot need not stay upright throughout its entire swing.
    const walked = 0.55 * cycleLength(BOUND.stride, BOUND.stance) * SCALE;
    const running = hock(hareRig(hare('bound', { walked }), look()), NEAR_HIND);
    expect(running.ankle.y).toBeLessThan(running.foot.y - 2);
  });

  it('keeps all three bones the same length through every pose', () => {
    for (const pose of POSE_NAMES) {
      for (const rig of moments(pose)) {
        for (const [i, limb] of legsOf(rig).entries()) {
          const points = [limb.hip, limb.knee, limb.ankle, limb.foot];
          const lengths = i % 2 ? [4.4, 4, 1] : [4.2, 4.7, 3.5];
          lengths.forEach((length, bone) => expect(Math.hypot(points[bone + 1].x - points[bone].x, points[bone + 1].y - points[bone].y), `${pose}, leg ${i}, bone ${bone}`).toBeCloseTo(length, 6));
        }
      }
    }
  });

  it('keeps knees and hocks continuous through the whole stride, including a tight tuck', () => {
    for (const [pose, gait] of [['lope', LOPE], ['bound', BOUND]] as const) {
      const cycle = cycleLength(gait.stride, gait.stance) * SCALE;
      let previous = legsOf(hareRig(hare(pose), look()));
      let biggest = 0;
      for (let i = 1; i <= 6000; i++) {
        const current = legsOf(hareRig(hare(pose, { walked: cycle * i / 6000 }), look()));
        current.forEach((leg, k) => {
          for (const joint of ['knee', 'ankle'] as const) biggest = Math.max(biggest, Math.hypot(leg[joint].x - previous[k][joint].x, leg[joint].y - previous[k][joint].y));
        });
        previous = current;
      }
      // Under 0.3 page px per sample. A branch flip remains several pixels
      // even at this fine interval; the old foot-only check missed it.
      expect(biggest, pose).toBeLessThan(0.2);
    }
    const at = (frame: number) => legsOf(hareRig(hare('bound', { walked: 85 * frame / 60 }), look({ now: frame * 1000 / 60 })));
    const [before, after] = [at(148), at(149)];
    expect(Math.hypot(after[NEAR_HIND].knee.x - before[NEAR_HIND].knee.x, after[NEAR_HIND].knee.y - before[NEAR_HIND].knee.y)).toBeLessThan(1.5);
  });

  it('lays its ears back running and holds them up sitting', () => {
    const ears = (pose: RigPose) => guideAt(pose, 'ear base')!;
    const tip = (pose: HarePose) => pageReach(hareRig(hare(pose), look({ now: OPEN }))).top;
    expect(ears(hareRig(hare('sit'), look()))).toBeDefined();
    expect(tip('sit')).toBeGreaterThan(tip('bound') + 8);
  });

  it('blinks now and then, and never under reduced motion', () => {
    expect(lidsOf(hareRig(hare('sit'), look({ now: OPEN })))).toHaveLength(0);
    const shut = firstShut((now) => hareRig(hare('sit'), look({ now })));
    expect(shut).toBeDefined();
    expect(lidsOf(hareRig(hare('sit'), look({ now: shut, still: true })))).toHaveLength(0);
  });

  it('holds still under reduced motion, a moving pose drawn crouched', () => {
    const at = (pose: HarePose, now: number) => legsOf(hareRig(hare(pose, { walked: now / 10 }), look({ now, still: true })));
    expect(at('graze', 0)).toEqual(at('graze', 1777));
    expect(at('bound', 900)).toEqual(at('alert', 0));
    expect(at('box', 300)).toEqual(at('alert', 0));
  });

  it('turns its head toward a cursor nearby, but only so far', () => {
    const at = { x: 100, y: 100 };
    expect(gazeAt(1, at, null)).toBe(0);
    expect(gazeAt(1, at, { x: 140, y: 30 })).toBeLessThan(0);
    expect(gazeAt(1, at, { x: 140, y: 120 })).toBeGreaterThan(0);
    expect(Math.abs(gazeAt(1, at, { x: 101, y: -400 }))).toBe(0);
    expect(gazeAt(-1, at, { x: 60, y: 30 })).toBeLessThan(0);
  });

  it('moves smoothly: nothing jumps from one frame to the next', () => {
    // A frame of a chase at 110px/s is under 2px.
    for (const pose of ['bound', 'lope'] as const) {
      const frames = Array.from({ length: 300 }, (_, i) => legsOf(hareRig(hare(pose, { walked: i * 1.8 }), look({ now: i * 16 }))));
      const jumps = frames.slice(1).map((legs, i) => Math.max(...legs.map((l, k) => Math.hypot(l.foot.x - frames[i][k].foot.x, l.foot.y - frames[i][k].foot.y))));
      expect(Math.max(...jumps), pose).toBeLessThan(2.5);
    }
  });
});
