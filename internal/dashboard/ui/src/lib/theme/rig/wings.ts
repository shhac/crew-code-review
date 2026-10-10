import type { Point } from '../pointer';
import { turnAbout, type Layer } from './rig';

// A beating wing: a picture turned about its root through each stroke,
// broad on the downstroke and turned edge-on on the upstroke.

// The wing's stroke at this point of the beat: the angle it is turned from
// as drawn (negative sweeps it down and back), how far it is squashed across
// its length (turned edge-on on the upstroke), and the root's small rise and
// fall, which makes the tip trace a flattened figure-eight. `top` is where
// the stroke starts, `arc` how far down it sweeps.
export type Stroke = { angle: number; squash: number; lift: number };
export function wingStroke(beat: number, top: number, arc: number): Stroke {
  const phase = ((beat % 1) + 1) % 1;
  const down = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const up = phase >= 0.5 ? Math.sin(2 * Math.PI * (phase - 0.5)) : 0;
  return { angle: top - arc * down, squash: 1 - 0.45 * up, lift: 0.3 * Math.sin(4 * Math.PI * phase) };
}

// The wing's picture at this point of its stroke, about its root; `axis` is
// its long axis as drawn, root to tip (degrees), across which it is
// squashed: turned so its length lies level, squashed, and turned back.
export function wingLayer(picture: Layer, root: Point, axis: number, stroke: Stroke): Layer {
  const edgeOn: Layer = { kind: 'group', turn: turnAbout(-axis - 180, root), layers: [picture] };
  const squashed: Layer = { kind: 'group', turn: turnAbout(axis + 180, root), scaleY: stroke.squash, layers: [edgeOn] };
  return { kind: 'group', turn: turnAbout(stroke.angle, root, 0, stroke.lift), layers: [squashed] };
}
