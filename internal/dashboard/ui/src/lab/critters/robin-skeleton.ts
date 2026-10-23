import manifest from '../../lib/theme/christmas/robin-parts/manifest.json' with { type: 'json' };
import { transformPoint } from '../../lib/theme/christmas/parts-affine';
import { partsLayers, partsPose, type PartId } from '../../lib/theme/christmas/parts-pose';
import type { Bone, Group, Joint, Skeleton } from '../skeleton';

// The robin is whole pictures, each turned about its own pivot, with no leg
// or wing posed bone by bone, so its skeleton is where each part it shows
// now turns, as it is drawn, coded as skeleton.ts codes them, and a spine
// through those of them it runs through: the head's joint, the near
// shoulder, the body's middle, the near hip while its leg is tucked up in
// flight, and the tail's root; it has no point for the neck's base or the
// tail's tip. The neck turns with the head, and the eyelid and the wing's
// cover with what they lie on.
function pivotOf(id: PartId): { code: string; name: string } | null {
  const far = id.includes('far') ? 1 : 0;
  if (id === 'head') return { code: 'SJ0', name: 'head joint' };
  if (id === 'body' || id === 'body-peck') return { code: 'SJ1', name: 'body pivot' };
  if (id === 'tail') return { code: 'SJ2', name: 'tail root' };
  if (id.endsWith('-tucked')) return { code: `L${2 + far}J0`, name: 'hip (the tucked leg turns here)' };
  if (id.startsWith('leg-')) return { code: `L${2 + far}J1`, name: 'foot (the leg turns here)' };
  if (id.startsWith('wing') && id !== 'wing-shoulder') return { code: `L${far}J0`, name: 'shoulder (the wing turns here)' };
  return null;
}

const GROUPS: readonly Group[] = [
  { code: 'L0', title: 'near wing', far: false }, { code: 'L1', title: 'far wing', far: true },
  { code: 'L2', title: 'near leg', far: false }, { code: 'L3', title: 'far leg', far: true },
  { code: 'S', title: 'spine', far: false },
];
const SPINE = [{ code: 'SJ0', line: 'neck line' }, { code: 'L0J0', line: 'back line' }, { code: 'SJ1', line: 'back line' }, { code: 'L2J0', line: 'pelvis line' }, { code: 'SJ2' }];

export function robinSkeleton(mode: string, now: number, still: boolean, separate: boolean): Skeleton {
  const pose = still ? partsPose(0, 'still') : partsPose(now, mode);
  const drawn = partsLayers(pose, separate).flatMap((layer): Joint[] => {
    const pivot = pivotOf(layer.id);
    if (!pivot || layer.opacity === 0) return [];
    const [x, y] = manifest.parts[layer.id].pivot;
    const [px, py] = transformPoint(layer.transform, x, y);
    return [{ ...pivot, at: { x: px, y: py }, far: layer.id.includes('far') }];
  });
  // Mid-flight, two wing drawings cross-fade on one shoulder.
  const joints = drawn.filter((j, i) => drawn.findIndex((o) => o.code === j.code) === i);
  const groups = GROUPS.filter((g) => joints.some((j) => j.code.startsWith(g.code)));
  const path = SPINE.flatMap((s) => {
    const joint = joints.find((j) => j.code === s.code);
    return joint ? [{ ...joint, line: s.line }] : [];
  });
  const bones = path.slice(1).map((to, k): Bone =>
    ({ code: `SB${k}`, name: `${path[k].line ?? 'line'} (${path[k].name} to ${to.name})`, from: path[k].code, to: to.code, far: false }));
  return { groups, joints, bones };
}
