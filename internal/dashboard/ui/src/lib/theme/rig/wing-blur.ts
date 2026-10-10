import { mix, rad } from '../math';
import { hash } from '../seed';
import type { Point } from '../pointer';
import { turnAbout, type Layer } from './rig';

// An insect's wingbeat as the eye sees it. A bumblebee beats its wings 130
// to 200 times a second and a wasp about 150: a page drawn at 60 frames a
// second cannot show that, and any flap drawn frame by frame would alias
// into a slow, wrong one. So the stroke is a blur: a pale fan swept from the
// wing's hinge between the two ends of its stroke, and the wing itself
// drawn faintly at each end, where it slows to turn. Nothing in it moves
// from frame to frame unless asked (a shimmer, below), so it never flickers.

// A wing as drawn (the forewing and hindwing as one piece, as the hooks
// between them hold them in flight): its picture where it lies folded, the
// hinge it turns about, which way its long axis points from the hinge to the
// tip as drawn (degrees, 0 ahead, 90 down), and how long it is hinge to tip.
export type BlurWing = { picture: Layer; hinge: Point; axis: number; length: number };

// The stroke, in the body's own frame so it tilts with the body: where the
// wing's long axis points at the front and the back of the stroke (degrees;
// the fan sweeps between them through the angles in between), how faint the
// wing is drawn at each end and how faint the fan, and the fan's colour.
// `mid` draws the wing once more part-way through the stroke (0 its front,
// 1 its back), as a wasp's shimmering third wing.
export type WingBeat = {
  front: number;
  back: number;
  ghost: number;
  fan: number;
  colour: string;
  mid?: { at: number; opacity: number };
};

// Points round the fan: the hinge, then out along the arc from the front of
// the stroke to its back, a little inside the wing's tip so the fan never
// pokes out past the ghosts.
export function fanOf(hinge: Point, from: number, to: number, radius: number): Point[] {
  const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 10));
  const arc = Array.from({ length: steps + 1 }, (_, i) => {
    const a = rad(mix(from, to, i / steps));
    return { x: hinge.x + radius * Math.cos(a), y: hinge.y + radius * Math.sin(a) };
  });
  return [hinge, ...arc];
}

const faint = (opacity: number, layers: readonly Layer[], at: Point): Layer => ({ kind: 'group', turn: turnAbout(0, at), opacity, layers });

// The wing's picture turned about its hinge to point `angle`.
export const wingAt = (wing: BlurWing, angle: number): Layer => ({ kind: 'group', turn: turnAbout(angle - wing.axis, wing.hinge), layers: [wing.picture] });

// The wing beating, as layers to draw where the wing goes (inside the
// body's group): the fan, then the wing at each end of the stroke, and at
// `mid` if asked. `amount` fades the whole blur in or out (0 to 1), as a
// bee lifting off starts its wings.
export function wingBlur(wing: BlurWing, beat: WingBeat, amount = 1, name = 'wing blur'): Layer[] {
  if (amount <= 0) return [];
  const fan: Layer = { kind: 'stroke', name, points: fanOf(wing.hinge, beat.front, beat.back, wing.length * 0.92), width: 0, colour: 'none', fill: beat.colour };
  const ends = [beat.front, beat.back].map((angle) => faint(beat.ghost * amount, [wingAt(wing, angle)], wing.hinge));
  const mid = beat.mid ? [faint(beat.mid.opacity * amount, [wingAt(wing, mix(beat.front, beat.back, beat.mid.at))], wing.hinge)] : [];
  return [faint(beat.fan * amount, [fan], wing.hinge), ...ends, ...mid];
}

// A seeded place in the stroke for this frame (0 to 1): where a shimmering
// third wing is drawn, different every frame and in no pattern.
export const shimmer = (seed: number, now: number) => hash(seed * 7.13 + Math.floor(now / (1000 / 60)) * 0.917);
