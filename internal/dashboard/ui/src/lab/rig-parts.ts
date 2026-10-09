// The critters lab's view of a rig's parts: what each layer is called, and
// a pose with only some of them drawn.
import { layerName, type Layer, type RigPose } from '../lib/theme/rig/rig';

type Leaf = Exclude<Layer, { kind: 'group' }>;
const leaves = (layers: readonly Layer[]): Leaf[] => layers.flatMap((l) => (l.kind === 'group' ? leaves(l.layers) : [l]));

// Every part a pose draws, in drawing order, each once.
export const partNames = (pose: RigPose): string[] => [...new Set(leaves(pose.layers).map(layerName))];

// The art each part is drawn from: images by their part, leg pieces by bone.
export const partArt = (pose: RigPose): { name: string; src: string }[] => leaves(pose.layers).flatMap((l) => {
  if (l.kind === 'image') return [{ name: l.name, src: l.src }];
  if (l.kind === 'legs' && !l.far && !l.fur) {
    return [{ name: 'leg bone', src: l.art.bone }, { name: 'leg bone, fur', src: l.art.boneFur }, { name: 'foot', src: l.art.foot.src }, { name: 'foot, fur', src: l.art.foot.fur }];
  }
  return [];
});

// The pose with only the parts `keep` allows, each still where it is.
export function keepParts(pose: RigPose, keep: (name: string) => boolean): RigPose {
  const filter = (layers: readonly Layer[]): Layer[] => layers.flatMap((l): Layer[] => {
    if (l.kind === 'group') return [{ ...l, layers: filter(l.layers) }];
    return keep(layerName(l)) ? [l] : [];
  });
  return { ...pose, layers: filter(pose.layers) };
}
