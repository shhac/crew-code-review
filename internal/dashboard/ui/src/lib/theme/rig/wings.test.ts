import { describe, expect, it } from 'vitest';
import type { RigPose } from './rig';
import { flatLayers, rigBounds } from './test-rig';
import { birdWing, flapping, flaring, foreshortening, FOLDED, gliding, settling, takingOff, wingFace, wingPoint, wingStroke, type Flap, type WingArt } from './wings';

describe('wingStroke', () => {
  it('beats its wings: down broad, up turned edge-on, the tip riding a figure-eight', () => {
    const down = wingStroke(0.25, 12, 75), up = wingStroke(0.75, 12, 75);
    expect(down.squash).toBe(1);
    expect(up.squash).toBeLessThan(0.6);
    expect(wingStroke(0, 12, 75).angle).toBeCloseTo(12);
    expect(wingStroke(0.5, 12, 75).angle).toBeCloseTo(12 - 75);
    // The root rises and falls twice a beat, so the tip's path crosses
    // itself.
    expect(wingStroke(0.125, 12, 75).lift).toBeGreaterThan(0);
    expect(wingStroke(0.375, 12, 75).lift).toBeLessThan(0);
  });
});

const FLAP: Flap = { top: 50, bottom: -35, down: 0.55, fold: 70, sweep: 20 };
const beats = (count: number, of: (beat: number) => number) => Array.from({ length: count + 1 }, (_, i) => of((i / count) * 2));
const steady = (values: readonly number[], most: number) => values.slice(1).every((v, i) => Math.abs(v - values[i]) < most);

describe('flapping', () => {
  it('sweeps from the top of the stroke to the bottom and back, a beat at a time', () => {
    expect(flapping(0, FLAP).lift).toBeCloseTo(50);
    expect(flapping(0.55, FLAP).lift).toBeCloseTo(-35);
    expect(flapping(1, FLAP).lift).toBeCloseTo(50);
    expect(flapping(2.3, FLAP).lift).toBeCloseTo(flapping(0.3, FLAP).lift);
  });

  it('beats down spread, and flexes the wrist on the way up, spreading again at the top', () => {
    for (const beat of [0.1, 0.3, 0.5]) expect(flapping(beat, FLAP).fold).toBe(0);
    const up = flapping(0.55 + 0.45 / 2, FLAP);
    expect(up.fold).toBeCloseTo(70);
    expect(up.sweep).toBeCloseTo(20);
    expect(flapping(0.999, FLAP).fold).toBeLessThan(1);
    // The downstroke reaches a little forward.
    expect(flapping(0.27, FLAP).sweep).toBeLessThan(0);
  });

  it('moves smoothly', () => {
    const at = (beat: number) => flapping(beat, FLAP);
    expect(steady(beats(400, (b) => at(b).lift), 3)).toBe(true);
    expect(steady(beats(400, (b) => at(b).fold), 3)).toBe(true);
  });
});

describe('gliding', () => {
  it('holds its wings as given, rocking them a little', () => {
    const shape = { lift: 6, sweep: 30, fold: 40 };
    expect(gliding(shape, 0)).toEqual(shape);
    expect(gliding(shape, 400, 2, 1600).lift).toBeCloseTo(8);
    expect(gliding(shape, 400, 2, 1600).fold).toBe(40);
  });
});

describe('takingOff', () => {
  it('opens its wings from folded up to the clap, feet still down', () => {
    expect(takingOff(-0.5, FLAP, 85).wings).toEqual(FOLDED);
    const clap = takingOff(-0.0001, FLAP, 85);
    expect(clap.wings.lift).toBeCloseTo(85, 0);
    expect(clap.airborne).toBe(false);
  });

  it('leaves the ground halfway through the first downstroke, legs trailing, then tucks them as its strokes settle', () => {
    expect(takingOff(0.2, FLAP, 85).airborne).toBe(false);
    expect(takingOff(0.3, FLAP, 85).airborne).toBe(true);
    expect(takingOff(0.3, FLAP, 85).legs).toBeLessThan(-0.9);
    const settled = takingOff(3, FLAP, 85, 3);
    expect(settled.legs).toBeCloseTo(0);
    expect(settled.wings).toEqual(flapping(3, FLAP));
    expect(settled.pitch).toBeCloseTo(0);
  });

  it('strokes deepest at first', () => {
    expect(takingOff(0.55, FLAP, 85).wings.lift).toBeLessThan(flapping(0.55, FLAP).lift - 10);
    expect(steady(beats(400, (b) => takingOff(b - 0.5, FLAP, 85).wings.lift), 6)).toBe(true);
  });
});

describe('flaring and settling', () => {
  it('pitches up to brake, wings swept forward, tail fanned, legs reaching for the ledge', () => {
    const start = flaring(0, 0, FLAP, 40), braking = flaring(0.6, 0, FLAP, 40), landed = flaring(1, 0, FLAP, 40);
    expect(start.pitch).toBeCloseTo(0);
    expect(braking.pitch).toBeCloseTo(40);
    expect(landed.pitch).toBeCloseTo(20);
    expect(braking.wings.sweep).toBeLessThan(flapping(0, FLAP).sweep - 30);
    expect(landed.legs).toBeCloseTo(1);
    expect(landed.tail).toBeCloseTo(1);
    expect(landed.airborne).toBe(false);
  });

  it('holds its wings up a moment after touchdown, then folds them away as the body levels', () => {
    const raised = { lift: 70, sweep: -10, fold: 10 };
    expect(settling(0, raised, 20).wings).toEqual(raised);
    expect(settling(0.3, raised, 20).wings).toEqual(raised);
    expect(settling(0, raised, 20).pitch).toBeCloseTo(flaring(1, 0, FLAP, 40).pitch);
    expect(settling(1, raised, 20).wings).toEqual(FOLDED);
    expect(settling(1, raised, 20).pitch).toBeCloseTo(0);
  });
});

describe('a wing seen from the side', () => {
  it('shows a raised near wing\'s underside and a lowered one\'s upper side; the far wing the other way', () => {
    expect(wingFace(40, false)).toBe('under');
    expect(wingFace(-30, false)).toBe('upper');
    expect(wingFace(40, true)).toBe('upper');
    expect(wingFace(-30, true)).toBe('under');
    // Seen a little from above, a near wing just raised still shows its top.
    expect(wingFace(5, false, 10)).toBe('upper');
  });

  it('is shortened across to the sine of its lift, flipped below level, never to a hairline', () => {
    expect(foreshortening(90)).toBeCloseTo(1);
    expect(foreshortening(30)).toBeCloseTo(0.5);
    expect(foreshortening(-30)).toBeCloseTo(-0.5);
    expect(foreshortening(0)).toBeCloseTo(0.12);
    expect(foreshortening(-2)).toBeCloseTo(-0.12);
  });

  const ART: WingArt = {
    name: 'wing', shoulder: { x: 0, y: 0 }, wrist: { x: 0, y: -10 },
    arm: { upper: 'arm.webp', under: 'arm-under.webp', x: -3, y: -11, width: 4, height: 11.5 },
    hand: { upper: 'hand.webp', under: 'hand-under.webp', x: -3, y: -21, width: 4, height: 12 },
  };
  const ROOT = { x: 20, y: 10 };
  const posed = (layer: ReturnType<typeof birdWing>): RigPose => ({ width: 40, height: 40, anchor: { x: 20, y: 20 }, scale: 1, layers: [layer] });
  const shown = (pose: RigPose) => flatLayers(pose.layers).flatMap((l) => (l.kind === 'image' && !l.hidden ? [l.src] : []));

  it('draws both sides of each piece, only the facing one seen; folded away, neither', () => {
    const up = posed(birdWing(ART, { lift: 60, sweep: 0, fold: 0 }, ROOT));
    expect(shown(up)).toEqual(['hand-under.webp', 'arm-under.webp']);
    const down = posed(birdWing(ART, { lift: -30, sweep: 0, fold: 0 }, ROOT));
    expect(shown(down)).toEqual(['hand.webp', 'arm.webp']);
    expect(flatLayers(down.layers).filter((l) => l.kind === 'image')).toHaveLength(4);
    expect(shown(posed(birdWing(ART, FOLDED, ROOT, false, 0, false)))).toEqual([]);
  });

  it('raises the tip above the shoulder and lowers it below, as far as the sine says, its bounds following', () => {
    const tip = { x: 0, y: -20 };
    const up = wingPoint(ART, { lift: 90, sweep: 0, fold: 0 }, ROOT, tip, true);
    expect(up).toEqual({ x: 20, y: -10 });
    const down = wingPoint(ART, { lift: -30, sweep: 0, fold: 0 }, ROOT, tip, true);
    expect(down.y).toBeCloseTo(20);
    const bounds = rigBounds(posed(birdWing(ART, { lift: -30, sweep: 0, fold: 0 }, ROOT)));
    expect(bounds.bottom).toBeCloseTo(10 + 0.5 * 21);
    // The arm's root, half a unit past the shoulder, flipped up with it.
    expect(bounds.top).toBeCloseTo(10 - 0.5 * 0.5);
  });

  it('folds the hand back about the wrist, and sweeps the whole wing back about the shoulder', () => {
    const tip = { x: 0, y: -20 };
    const folded = wingPoint(ART, { lift: 90, sweep: 0, fold: 90 }, ROOT, tip, true);
    expect(folded.x).toBeCloseTo(10);
    expect(folded.y).toBeCloseTo(0);
    const swept = wingPoint(ART, { lift: 90, sweep: 30, fold: 0 }, ROOT, ART.wrist, false);
    expect(swept.x).toBeCloseTo(20 - 10 * Math.sin(Math.PI / 6));
  });
});
