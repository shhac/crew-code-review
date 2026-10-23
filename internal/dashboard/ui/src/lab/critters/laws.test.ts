import { describe, expect, it } from 'vitest';
import type { RigPose } from '../../lib/theme/rig/rig';
import { LAWS, type LawName, type Seen, type Watched } from '../../lib/theme/rig/skeleton/laws';
import { planOf } from '../../lib/theme/rig/skeleton/plan';
import { momentsOf, type Moment, type RigCritter } from './critter';
import { CRITTERS } from './registry';

// Where an animal breaks a law today, and why. Each is to be fixed as its
// rig moves onto a skeleton, not here; the test fails once one holds, so
// it comes off this list then.
const KNOWN = {
  hedgehog: {
    bonesKeepLength: 'its legs are one piece over two bones (knee: false): out of reach, the shin from the solved knee to the heel stretches, and the piece from hip to heel with it',
    plantedFeetHold: 'each planted foot is placed from its hip, which the body\'s rock and bob carry (stepping\'s footOf from the turned hips)',
    footprintsHold: 'sniffing, the head\'s box turned nose down reaches under the ledge, though its art does not; and the corners of its leg pieces\' boxes, turned along each leg, reach a little under it, as the page measures them (counted before its skeleton as squares round each joint, they did not)',
  },
  fox: {
    bonesKeepLength: 'trotting, a foot beyond thigh and shin straightens the leg and the shank stretches to the hock (spidergait\'s knees)',
    plantedFeetHold: 'leaping and digging, the feet are set under the hips the body turns (restingFeet from the turned hips)',
    anklesBehindToes: 'trotting, a planted paw late in its stance has its wrist or hock ahead of its toes',
    noFootBelowLedge: 'a paw folding toes down as it lifts turns its box about the heel, so its toes dip under the ledge before the foot is clear',
    footprintsHold: 'in every mode the leg pieces\' caps and folding paws reach under the ledge by under a pixel',
  },
  rabbit: { footprintsHold: 'a leg piece\'s rounded cap, turned with the foot, reaches about 0.29px under the ledge, as the page has always drawn it (counted as squares round each joint, as legs were before its skeleton, it never showed)' },
  cupid: { footprintsHold: 'dodging, the drawing reaches up to 0.16px over its footprint\'s top' },
  bee: { footprintsHold: 'lifting off, the drawing reaches 0.18px past its footprint\'s left' },
  gull: {
    plantedFeetHold: 'taking off and settling, the feet are set under the hips the body turns (plantedLegs from the turned hips)',
    anklesBehindToes: 'walking, the tarsus swings with the leg like a pendulum from the foot (bird.ts\'s swungBy), so late in the stance the ankle passes ahead of the toes',
  },
  crow: {
    plantedFeetHold: 'pecking, taking off and settling, the feet are set under the hips the body turns (plantedLegs from the turned hips)',
    anklesBehindToes: 'walking, the tarsus swings with the leg like a pendulum from the foot (bird.ts\'s swungBy), so late in the stance the ankle passes ahead of the toes',
    footprintsHold: 'flaring, the drawing reaches 0.55px past its footprint\'s left',
  },
  pigeon: {
    bonesKeepLength: 'walking, a foot beyond reach straightens the leg and the drumstick stretches (spidergait\'s knees)',
    plantedFeetHold: 'pecking, taking off and settling, the feet are set under the hips the body turns (plantedLegs from the turned hips)',
    anklesBehindToes: 'walking, the tarsus swings with the leg like a pendulum from the foot (bird.ts\'s swungBy), so late in the stance the ankle passes ahead of the toes',
    footprintsHold: 'landing, the drawing reaches 0.07px past its footprint\'s right',
  },
} satisfies Record<string, Partial<Record<LawName, string>>>;

const knownFor = (rig: string, law: string): string | undefined =>
  Object.entries(Object.entries(KNOWN).find(([name]) => name === rig)?.[1] ?? {}).find(([name]) => name === law)?.[1];

const seenAt = (rig: RigCritter, at: Moment, still: boolean): Seen => {
  const pose = rig.pose(at, { gaze: 0, still });
  return { ...at, still, walking: rig.walking.includes(at.mode), pose, plan: planOf(pose), box: rig.box(at) };
};

// As the lab plays it, and held still with motion reduced, as the page
// holds it where it is.
const watch = (rig: RigCritter): Watched => ({
  moving: momentsOf(rig).map((at) => seenAt(rig, at, false)),
  still: rig.modes.flatMap((mode) => Array.from({ length: 100 }, (_, i) => seenAt(rig, { mode, now: i * 40, walked: 0 }, true))),
});

const RIGS = CRITTERS.flatMap((c) => (c.kind === 'rig' ? [c] : []));

describe('the laws every rig keeps', () => {
  for (const rig of RIGS) {
    describe(`the ${rig.name}`, () => {
      const watched: Watched[] = [];
      const seen = () => {
        if (!watched.length) watched.push(watch(rig));
        return watched[0];
      };
      for (const [name, law] of Object.entries(LAWS)) {
        const known = knownFor(rig.name, name);
        it(known ? `breaks ${name}, as is known: ${known}` : `keeps ${name}`, () => {
          const broken = law(seen());
          if (known) expect(broken.length, 'it holds now: take it off KNOWN').toBeGreaterThan(0);
          else expect(broken.slice(0, 5)).toEqual([]);
        });
      }
    });
  }

  it('knows only animals and laws there are', () => {
    for (const [name, laws] of Object.entries(KNOWN)) {
      expect(RIGS.map((r) => r.name)).toContain(name);
      for (const law of Object.keys(laws)) expect(Object.keys(LAWS)).toContain(law);
    }
  });
});

// Each law can break: a pose made to break it, seen in two moments.
describe('the laws themselves', () => {
  const frame = { width: 10, height: 10, anchor: { x: 5, y: 10 }, scale: 1 };
  const box = { width: 10, height: 10 };
  const seenOf = (pose: RigPose, now: number, still = false): Seen => ({ mode: 'test', still, now, walked: 0, walking: false, pose, plan: planOf(pose), box });
  const image = (src: string, x: number, hidden = false) => ({ kind: 'image', name: src, src, x, y: 4, width: 2, height: 2, hidden }) as const;

  it('finds both sides of a part seen at once, and a picture never seen', () => {
    const both: RigPose = { ...frame, layers: [image('upper', 1), image('under', 1)] };
    const one: RigPose = { ...frame, layers: [image('upper', 1), image('under', 1, true), image('never', 5, true)] };
    expect(LAWS.oneVariantShows({ moving: [seenOf(both, 0)], still: [] })).toHaveLength(1);
    expect(LAWS.oneVariantShows({ moving: [seenOf(one, 0)], still: [] })).toEqual([]);
    expect(LAWS.everyPieceDrawn({ moving: [seenOf(one, 0), seenOf(both, 40)], still: [] })).toEqual(['never never seen']);
  });

  it('finds a pose reaching past its footprint, and one that moves or blinks held still', () => {
    const wide: RigPose = { ...frame, layers: [image('body', -2)] };
    expect(LAWS.footprintsHold({ moving: [seenOf(wide, 0)], still: [] })).toEqual(['left 2.000px over test at 0']);
    const blink: RigPose = { ...frame, layers: [{ kind: 'lid', at: { x: 5, y: 5 }, r: 1, fur: { fill: '#fff', outline: '#000' } }] };
    const moved: RigPose = { ...frame, layers: [image('body', 3)] };
    expect(LAWS.stillHolds({ moving: [], still: [seenOf(wide, 0, true), seenOf(moved, 40, true), seenOf(blink, 80, true)] }))
      .toEqual(['blinks test at 80, motion reduced', 'moves test at 40, motion reduced']);
  });

  it('finds a far part drawn over the body', () => {
    const over: RigPose = { ...frame, layers: [{ ...image('body', 3), width: 4 }, { ...image('far leg', 3), far: true }] };
    expect(LAWS.farBeforeBody({ moving: [seenOf(over, 0)], still: [] })).toHaveLength(1);
  });
});
