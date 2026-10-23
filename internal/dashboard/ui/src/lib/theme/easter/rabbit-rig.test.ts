import { describe, expect, it } from 'vitest';
import type { RigPose } from '../rig/rig';
import { firstShut, guideAt, imagesOf, legsOf, lidsOf, pageReach, rigBounds, solesOf } from '../rig/test-rig';
import { POSES } from './rabbit-basics';
import { HOP_LENGTH, rabbitRig, REST, SCALE, type Pose, type RabbitLook, type RigRabbit } from './rabbit-rig';

const rabbit = (pose: Pose, walked = 0, since = 0, bolting = false): RigRabbit => ({ pose, walked, since, seed: 1, bolting });
const look = (over: Partial<RabbitLook> = {}): RabbitLook => ({ now: 0, gaze: 0, still: false, ...over });
const POSE_NAMES: Pose[] = ['sit', 'alert', 'groom', 'hop', 'nudge', 'thump'];

// Every moment of a pose over a few seconds and several hops, both ways a
// hop goes (walking and bolting), with the head turned either way.
const momentsOf = (pose: Pose) => Array.from({ length: 300 }, (_, i) => i * 13).flatMap((now) =>
  [false, true].flatMap((bolting) => [-8, 0, 8].map((gaze) => rabbitRig(rabbit(pose, now / 9, now, bolting), look({ now, gaze })))));
const most = (rigs: readonly RigPose[], of: (rig: RigPose) => number) => Math.max(...rigs.map(of));
// How far a picture's box may reach under the ledge, in page pixels: a leg
// piece's rounded cap, turned with the foot, reaches about 0.29px under
// it, as the page has always drawn it (counted as squares round each
// joint, as legs were before its skeleton, the caps never showed it).
const CAP_DIP = 0.5;

// Legs are listed (legsOf, solesOf) far hind, far fore, near hind, near fore.
const down = (pose: RigPose) => solesOf(pose).map((y) => y >= pose.anchor.y - 1e-6);

describe('rabbit rig', () => {
  // Placing and spacing work from POSES, so the drawing must never reach
  // past it on the page, whatever it does.
  for (const name of POSE_NAMES) {
    it(`stays inside its ${name} footprint, its feet never sinking into the ledge`, () => {
      const rigs = momentsOf(name);
      expect(most(rigs, (r) => pageReach(r).left)).toBeLessThanOrEqual(POSES[name].width / 2);
      expect(most(rigs, (r) => pageReach(r).right)).toBeLessThanOrEqual(POSES[name].width / 2);
      expect(most(rigs, (r) => pageReach(r).top)).toBeLessThanOrEqual(POSES[name].height);
      expect(most(rigs, (r) => Math.max(...solesOf(r)) - r.anchor.y)).toBeLessThanOrEqual(1e-6);
      // Nor any picture's box, which the page's content check measures.
      expect(most(rigs, (r) => (rigBounds(r).bottom - r.anchor.y) * r.scale)).toBeLessThan(CAP_DIP);
      expect(most(rigs, (r) => (guideAt(r, 'nose')?.y ?? -Infinity) - r.anchor.y)).toBeLessThan(0);
    });
  }

  it('stays inside the larger of the two footprints as it eases from one pose into the next', () => {
    for (const was of POSE_NAMES) for (const pose of POSE_NAMES) {
      const rigs = Array.from({ length: 27 }, (_, i) => rabbitRig({ ...rabbit(pose, 0, i * 10), was }, look({ now: i * 10 })));
      const box = { width: Math.max(POSES[was].width, POSES[pose].width), height: Math.max(POSES[was].height, POSES[pose].height) };
      expect(most(rigs, (r) => Math.max(pageReach(r).left, pageReach(r).right)), `${was} to ${pose}`).toBeLessThanOrEqual(box.width / 2);
      expect(most(rigs, (r) => pageReach(r).top), `${was} to ${pose}`).toBeLessThanOrEqual(box.height);
      expect(most(rigs, (r) => Math.max(...solesOf(r)) - r.anchor.y), `${was} to ${pose}`).toBeLessThanOrEqual(1e-6);
      expect(most(rigs, (r) => (rigBounds(r).bottom - r.anchor.y) * r.scale), `${was} to ${pose}`).toBeLessThan(CAP_DIP);
    }
  });

  it('fits every pose but sitting up under 27px, the room a first-row card has', () => {
    for (const name of POSE_NAMES) if (name !== 'alert') expect(POSES[name].height, name).toBeLessThanOrEqual(27);
  });

  it('sits on four feet, the hind ones flat on the ledge from hock to toes', () => {
    const pose = rabbitRig(rabbit('sit'), look());
    expect(down(pose)).toEqual([true, true, true, true]);
    expect(legsOf(pose)).toHaveLength(4);
  });

  // As the skeleton has it (design-docs/easter/README.md): the hock on the
  // ledge under the hip, the stifle forward of both; the elbow tucked back
  // behind the shoulder, the forearm upright or reaching forward to the
  // wrist, never raked back under the belly.
  it('sits and rests between hops with each hock under its hip and each forepaw under its chest', () => {
    for (const pose of [rabbitRig(rabbit('sit'), look()), rabbitRig(rabbit('hop', REST * HOP_LENGTH), look())]) {
      const [farHind, farFore, nearHind, nearFore] = legsOf(pose);
      for (const leg of [farHind, nearHind]) {
        expect(Math.abs(leg.ankle.x - leg.hip.x)).toBeLessThan(0.8);
        expect(leg.knee.x).toBeGreaterThan(leg.hip.x + 2);
      }
      for (const leg of [farFore, nearFore]) {
        expect(leg.knee.x).toBeLessThan(leg.hip.x - 0.5);
        expect(leg.ankle.x).toBeGreaterThanOrEqual(leg.knee.x - 0.1);
      }
    }
  });

  // A rabbit stands on its fore toes: the metacarpus slopes down and
  // forward from the wrist to them (about 37 degrees off upright in the
  // standing skeleton, lower as a hop's forefoot trails behind), so the
  // wrist is behind the toes, never ahead of them, which would read as a
  // second wrist.
  it('stands each planted forepaw with its wrist behind the toes, the metacarpus sloping down and forward', () => {
    const slope = (leg: { ankle: { x: number; y: number }; foot: { x: number; y: number } }) =>
      (Math.atan2(leg.foot.x - leg.ankle.x, leg.foot.y - leg.ankle.y) * 180) / Math.PI;
    for (const name of POSE_NAMES) for (const pose of momentsOf(name)) {
      const [, farFore, , nearFore] = legsOf(pose);
      const [, farDown, , nearDown] = down(pose);
      for (const [leg, planted] of [[farFore, farDown], [nearFore, nearDown]] as const) {
        if (!planted) continue;
        expect(leg.ankle.x, name).toBeLessThan(leg.foot.x);
        expect(slope(leg), name).toBeGreaterThan(25);
        expect(slope(leg), name).toBeLessThan(60);
      }
    }
  });

  it('keeps every bone its own length, whatever it does', () => {
    const [first] = momentsOf('sit');
    const lengths = (pose: RigPose) => legsOf(pose).map((l) => [Math.hypot(l.knee.x - l.hip.x, l.knee.y - l.hip.y), Math.hypot(l.ankle.x - l.knee.x, l.ankle.y - l.knee.y)]);
    for (const name of POSE_NAMES) for (const pose of momentsOf(name)) {
      lengths(pose).forEach(([thigh, shin], i) => {
        expect(thigh).toBeCloseTo(lengths(first)[i][0], 6);
        expect(shin).toBeCloseTo(lengths(first)[i][1], 6);
      });
    }
  });

  it('hops as a half-bound: hind feet together, forefeet one after the other, and a flight between', () => {
    const cycle = HOP_LENGTH / SCALE;
    const frames = Array.from({ length: 400 }, (_, i) => down(rabbitRig(rabbit('hop', ((REST + i / 400) * cycle) * SCALE), look())));
    for (const [farHind, , nearHind] of frames) expect(farHind).toBe(nearHind);
    expect(frames.some((f) => f.every((d) => !d))).toBe(true);
    const lands = (leg: number) => frames.findIndex((f, i) => i > 0 && f[leg] && !frames[i - 1][leg]);
    // The near forefoot lands first, then the far, and the hind pair last.
    expect(lands(3)).toBeLessThan(lands(1));
    expect(lands(1)).toBeLessThan(lands(0));
    // It starts and ends each hop with all four feet down.
    expect(frames[0]).toEqual([true, true, true, true]);
  });

  it('holds each planted foot still on the ledge as it hops', () => {
    const cycle = HOP_LENGTH / SCALE;
    const at = (i: number) => {
      const walked = (REST + i / 200) * cycle;
      return { walked, pose: rabbitRig(rabbit('hop', walked * SCALE), look()) };
    };
    const frames = Array.from({ length: 200 }, (_, i) => at(i));
    frames.slice(1).forEach(({ walked, pose }, i) => {
      const before = frames[i];
      legsOf(pose).forEach((leg, n) => {
        const was = legsOf(before.pose)[n];
        // A hind foot is checked while flat: peeling, its heel lifts about
        // its planted toes, so the heel itself moves.
        if (!down(pose)[n] || !down(before.pose)[n] || leg.paw !== 0 || was.paw !== 0) return;
        // On the ledge, where the rabbit has moved on by walked.
        expect(leg.foot.x + walked - (was.foot.x + before.walked)).toBeCloseTo(0, 6);
      });
    });
  });

  it('draws every part, and its eye blinks', () => {
    const images = imagesOf(rabbitRig(rabbit('sit'), look()));
    expect(images).toHaveLength(4);
    expect(firstShut((now) => rabbitRig(rabbit('sit'), look({ now })))).toBeDefined();
  });

  it('holds still under reduced motion: sitting, no blink, whatever it was doing', () => {
    const at = (pose: Pose, now: number) => rabbitRig(rabbit(pose, now / 9, now), look({ now, still: true }));
    const first = at('sit', 0);
    for (const pose of POSE_NAMES) for (const now of [0, 700, 3100]) {
      expect(lidsOf(at(pose, now))).toEqual([]);
      expect(at(pose, now)).toEqual(first);
    }
  });
});
