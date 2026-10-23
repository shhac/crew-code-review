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

const PAIRS = ['first', 'second', 'third', 'fourth'];

// A spider's leg runs coxa, trochanter, femur, patella, tibia, metatarsus,
// tarsus; drawn, it is two pieces bending at the femur's end. Its legs are
// coded as skeleton.ts codes limbs, front to back a pair at a time, near
// before far.
export function spiderSkeleton(drawing: SVGSVGElement): Skeleton {
  const pieces = [...drawing.querySelectorAll('image[transform]')];
  const legs = pieces.flatMap((shin, i) => (i % 2 === 0 && pieces[i + 1] ? [{ shin: along(shin), thigh: along(pieces[i + 1]), far: !!shin.closest('g[filter]') }] : []));
  const coded = legs.map((leg) => {
    const pair = legs.filter((o) => o.far === leg.far && o.thigh.from.x > leg.thigh.from.x).length;
    return { ...leg, pair, code: `L${2 * pair + (leg.far ? 1 : 0)}` };
  }).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const joints = coded.flatMap(({ shin, thigh, far, code }): Joint[] =>
    [{ code: `${code}J0`, name: 'coxa', at: thigh.from, far }, { code: `${code}J1`, name: 'knee', at: thigh.to, far }, { code: `${code}J2`, name: 'claws', at: shin.to, far }]);
  const bones = coded.flatMap(({ far, code }): Bone[] => [
    { code: `${code}B0`, name: 'femur (with coxa and trochanter)', from: `${code}J0`, to: `${code}J1`, far },
    { code: `${code}B1`, name: 'shin (patella to tarsus)', from: `${code}J1`, to: `${code}J2`, far },
  ]);
  const groups = coded.map(({ code, far, pair }) => ({ code, title: `${far ? 'far' : 'near'} ${PAIRS[pair] ?? ''} leg`, far }));
  return { groups, joints, bones };
}
