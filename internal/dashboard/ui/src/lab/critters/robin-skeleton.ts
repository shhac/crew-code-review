import manifest from '../../lib/theme/christmas/robin-parts/manifest.json' with { type: 'json' };
import { transformPoint } from '../../lib/theme/christmas/parts-affine';
import { partsLayers, partsPose, type PartId } from '../../lib/theme/christmas/parts-pose';
import type { Joint, Skeleton } from '../skeleton';

// The robin is whole pictures, each turned about its own pivot, with no leg
// or wing posed bone by bone, so its skeleton is joints only: where each
// part it shows now turns, as it is drawn. The neck turns with the head,
// and the eyelid and the wing's cover with what they lie on.
function pivotName(id: PartId): string | null {
  if (id === 'body' || id === 'body-peck') return 'body turns here';
  if (id === 'head') return 'neck (head turns here)';
  if (id === 'tail') return 'tail root';
  if (id.endsWith('-tucked')) return 'hip (tucked leg turns here)';
  if (id.startsWith('leg-')) return 'foot (leg turns here)';
  if (id.startsWith('wing') && id !== 'wing-shoulder') return 'shoulder (wing turns here)';
  return null;
}

export function robinSkeleton(mode: string, now: number, still: boolean, separate: boolean): Skeleton {
  const pose = still ? partsPose(0, 'still') : partsPose(now, mode);
  const joints = partsLayers(pose, separate).flatMap((layer): Joint[] => {
    const name = pivotName(layer.id);
    if (!name || layer.opacity === 0) return [];
    const [x, y] = manifest.parts[layer.id].pivot;
    const [px, py] = transformPoint(layer.transform, x, y);
    return [{ name, at: { x: px, y: py }, far: layer.id.includes('far') }];
  });
  return { joints, bones: [] };
}
