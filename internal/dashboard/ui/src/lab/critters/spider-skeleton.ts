import { transformPoint } from '../../lib/theme/christmas/parts-affine';
import type { Point } from '../../lib/theme/pointer';
import type { Bone, Joint, Skeleton } from '../skeleton';

// The spider poses its legs inside Spider.svelte and keeps them there, so
// rather than copy its numbers the lab reads each leg back off the two
// pieces of art Limb.svelte lays along it, shin then thigh: a piece starts
// half its thickness before its bone's first joint, lies along its own x,
// and runs half its thickness past the second.
const along = (piece: Element): { from: Point; to: Point } => {
  const transform = piece.getAttribute('transform') ?? '';
  const start = Number(piece.getAttribute('x'));
  const length = Number(piece.getAttribute('width')) + 2 * start;
  const [fx, fy] = transformPoint(transform, 0, 0);
  const [tx, ty] = transformPoint(transform, length, 0);
  return { from: { x: fx, y: fy }, to: { x: tx, y: ty } };
};

// A spider's leg runs coxa, trochanter, femur, patella, tibia, metatarsus,
// tarsus; drawn, it is two pieces bending at the femur's end.
export function spiderSkeleton(drawing: SVGSVGElement): Skeleton {
  const pieces = [...drawing.querySelectorAll('image[transform]')];
  const legs = pieces.flatMap((shin, i) => (i % 2 === 0 && pieces[i + 1] ? [{ shin: along(shin), thigh: along(pieces[i + 1]), far: !!shin.closest('g[filter]') }] : []));
  const joints = legs.flatMap(({ shin, thigh, far }): Joint[] =>
    [{ name: 'coxa', at: thigh.from, far }, { name: 'knee', at: thigh.to, far }, { name: 'claws', at: shin.to, far }]);
  const bones = legs.flatMap(({ shin, thigh, far }): Bone[] =>
    [{ name: 'femur (with coxa and trochanter)', ...thigh, far }, { name: 'shin (patella to tarsus)', ...shin, far }]);
  return { joints, bones };
}
