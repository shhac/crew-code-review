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
    footprintsHold: 'sniffing, the head\'s box turned nose down reaches 4.4px under the ledge, though its art does not (its picture\'s see-through margin; a re-crop would fix it); and the box of each leg\'s piece, turned with its shin, reaches up to 0.74px under it at its rounded cap\'s see-through corner',
  },
  fox: {
    bonesKeepLength: 'trotting, a foot beyond thigh and shin straightens the leg and the shank stretches to the hock (spidergait\'s knees)',
    plantedFeetHold: 'digging, a forepaw scrapes back through the snow while it is down, as a dig does',
    footprintsHold: 'in every mode the box of each leg\'s bone up from the toes reaches up to 0.73px under the ledge at its rounded cap\'s corner, which is see-through (its fur does not); and digging, its nose goes into the snow (3.1px), crouching nearly (0.74px)',
  },
  rabbit: { footprintsHold: 'the box of a forepaw\'s metacarpus reaches 0.29px under the ledge at its rounded cap\'s corner, which is see-through, as the page has always drawn it (counted as squares round each joint, as legs were before its skeleton, it never showed)' },
  hare: { footprintsHold: 'alert, its breath lifts its back up to 0.32px over the 27px it keeps to day to day (hare.ts\'s CLEAR); held shallow enough to fit, it would hardly breathe' },
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
        }, 60000);
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

  it('finds toes doubled back over the bone up to them', () => {
    const hinges = { side: 1, knee: { min: 0, max: 180 }, paw: { min: -180, max: 180 }, toes: true } as const;
    const paw = (turn: number): RigPose => {
      const limb = { hip: { x: 5, y: 2 }, knee: { x: 6, y: 5 }, ankle: { x: 5, y: 8 }, foot: { x: 5, y: 9 }, paw: 90 + turn };
      return { ...frame, layers: [], skeleton: { joints: [], bones: [], limbs: [{ id: 'leg', code: 'L2', limb, fore: false, sole: 10, hinges }] } };
    };
    expect(LAWS.toesNeverFoldBack({ moving: [seenOf(paw(-90), 0), seenOf(paw(30), 40)], still: [] })).toEqual([]);
    expect(LAWS.toesNeverFoldBack({ moving: [seenOf(paw(-160), 0)], still: [] })).toEqual(['L2 toes turned -160.00 from the bone up to them test at 0']);
  });

  it('finds a planted wrist turned past what it bears, and lets a lifted one fold', () => {
    const hinges = { side: 1, knee: { min: 0, max: 180 }, paw: { min: -90, max: 90 }, planted: { min: -10, max: 10 }, toes: true } as const;
    // The shin straight down, the bone up from the toes turned 30 from it.
    const wrist = (paw: number): RigPose => {
      const limb = { hip: { x: 5, y: 2 }, knee: { x: 5, y: 5 }, ankle: { x: 5, y: 8 }, foot: { x: 5 - Math.sin(Math.PI / 6), y: 8 + Math.cos(Math.PI / 6) }, paw };
      return { ...frame, layers: [], skeleton: { joints: [], bones: [], limbs: [{ id: 'leg', code: 'L0', limb, fore: true, sole: 10, hinges }] } };
    };
    expect(LAWS.hingesHold({ moving: [seenOf(wrist(0), 0)], still: [] })).toEqual(['L0 planted paw at 30.00 from its shin, past what it bears test at 0']);
    expect(LAWS.hingesHold({ moving: [seenOf(wrist(40), 0)], still: [] })).toEqual([]);
  });

  it('finds a bird\'s ankle opened backwards past straight', () => {
    const leg = (toes: number): RigPose => {
      const ankle = { x: 5, y: 7 };
      const limb = { hip: { x: 5, y: 2 }, knee: { x: 6, y: 4 }, ankle, foot: { x: ankle.x + 2 * Math.cos((toes * Math.PI) / 180), y: ankle.y + 2 * Math.sin((toes * Math.PI) / 180) }, paw: 0 };
      return { ...frame, layers: [], skeleton: { joints: [], bones: [], limbs: [{ id: 'leg', code: 'L2', limb, fore: false, sole: 10, intertarsal: { min: -178, max: 0 } }] } };
    };
    // The drumstick runs down and back at about 108 degrees: a tarsus at 80
    // is flexed the bird's way, one at 140 opened backwards.
    expect(LAWS.intertarsalHolds({ moving: [seenOf(leg(80), 0)], still: [] })).toEqual([]);
    expect(LAWS.intertarsalHolds({ moving: [seenOf(leg(140), 0)], still: [] })).toHaveLength(1);
  });

  it('finds a far part drawn over the body', () => {
    const over: RigPose = { ...frame, layers: [{ ...image('body', 3), width: 4 }, { ...image('far leg', 3), far: true }] };
    expect(LAWS.farBeforeBody({ moving: [seenOf(over, 0)], still: [] })).toHaveLength(1);
  });
});
