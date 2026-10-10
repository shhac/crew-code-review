// The critters lab's view of a rig's parts: what each layer is called, and
// a pose with only some of them drawn.
import { layerName, type Layer, type RigPose } from '../lib/theme/rig/rig';

type Leaf = Exclude<Layer, { kind: 'group' }>;
const leaves = (layers: readonly Layer[]): Leaf[] => layers.flatMap((l) => (l.kind === 'group' ? leaves(l.layers) : [l]));

// Every part a pose draws, in drawing order, each once.
export const partNames = (pose: RigPose): string[] => [...new Set(leaves(pose.layers).map(layerName))];

// Every part any of the poses draws, in drawing order: one seen in only some
// (an eyelid, mid-blink) goes after the part it follows there.
export const allPartNames = (poses: readonly RigPose[]): string[] => poses.map(partNames).reduce<string[]>((all, names) =>
  names.reduce<string[]>((merged, name, i) => {
    if (merged.includes(name)) return merged;
    const after = i === 0 ? -1 : merged.indexOf(names[i - 1]);
    return [...merged.slice(0, after + 1), name, ...merged.slice(after + 1)];
  }, all), []);

// The art each part is drawn from, each once: images by their part, leg
// pieces by bone and foot.
export const partArt = (pose: RigPose): { name: string; src: string }[] => [...new Map(artOf(pose).map((a) => [a.name, a])).values()];
const artOf = (pose: RigPose): { name: string; src: string }[] => leaves(pose.layers).flatMap((l) => {
  if (l.kind === 'image') return [{ name: l.name, src: l.src }];
  if (l.kind !== 'legs' || l.far || l.fur) return [];
  return l.legs.flatMap(({ art, fore }) => {
    const thigh = art.thigh ? [{ name: 'upper leg', src: art.thigh.src }, { name: 'upper leg, fur', src: art.thigh.fur }] : [];
    const foot = fore ? 'front foot' : 'hind foot';
    return [...thigh, { name: 'leg bone', src: art.bone }, { name: 'leg bone, fur', src: art.boneFur }, { name: foot, src: art.foot.src }, { name: `${foot}, fur`, src: art.foot.fur }];
  });
});

// The pose with only the parts `keep` allows, each still where it is.
export function keepParts(pose: RigPose, keep: (name: string) => boolean): RigPose {
  const filter = (layers: readonly Layer[]): Layer[] => layers.flatMap((l): Layer[] => {
    if (l.kind === 'group') return [{ ...l, layers: filter(l.layers) }];
    return keep(layerName(l)) ? [l] : [];
  });
  return { ...pose, layers: filter(pose.layers) };
}
