import manifest from '../../lib/theme/christmas/robin-parts/manifest.json' with { type: 'json' };
import { transformPoint } from '../../lib/theme/christmas/parts-affine';
import { partsLayers, partsPose, type PartId } from '../../lib/theme/christmas/parts-pose';
import type { Group, Joint, Skeleton } from '../skeleton';

// The robin is whole pictures, each turned about its own pivot, with no leg
// or wing posed bone by bone, so its skeleton is joints only: where each
// part it shows now turns, as it is drawn, coded as skeleton.ts codes them.
// The neck turns with the head, and the eyelid and the wing's cover with
// what they lie on.
function pivotOf(id: PartId): { code: string; name: string } | null {
  const far = id.includes('far') ? 1 : 0;
  if (id === 'body' || id === 'body-peck') return { code: 'SJ1', name: 'body turns here' };
  if (id === 'tail') return { code: 'SJ0', name: 'tail root' };
  if (id === 'head') return { code: 'HJ0', name: 'neck (head turns here)' };
  if (id.endsWith('-tucked')) return { code: `L${2 + far}J0`, name: 'hip (tucked leg turns here)' };
  if (id.startsWith('leg-')) return { code: `L${2 + far}J1`, name: 'foot (leg turns here)' };
  if (id.startsWith('wing') && id !== 'wing-shoulder') return { code: `L${far}J0`, name: 'shoulder (wing turns here)' };
  return null;
}

const GROUPS: readonly Group[] = [
  { code: 'L0', title: 'near wing', far: false }, { code: 'L1', title: 'far wing', far: true },
  { code: 'L2', title: 'near leg', far: false }, { code: 'L3', title: 'far leg', far: true },
  { code: 'H', title: 'head', far: false }, { code: 'S', title: 'spine', far: false },
];

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
  return { groups, joints, bones: [] };
}
