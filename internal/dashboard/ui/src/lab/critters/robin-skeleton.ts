import { transformPoint } from '../../lib/theme/christmas/parts-affine';
import { partsLayers, partsPivots, partsPose, type PartId } from '../../lib/theme/christmas/parts-pose';
import type { Bone, Group, Joint, Skeleton } from '../skeleton';

// The robin is whole pictures, each turned about its joints, with no leg
// or wing posed bone by bone, so its skeleton is where each part it shows
// turns now, as the rig turns it about the joints measured on its drawing
// (partsPivots, the manifest's joints), coded as skeleton.ts codes them,
// and a spine through those of them it runs through: the head's own joint
// at the skull, the neck's base, the near shoulder, the hip and the tail's
// root; it has no point for the tail's tip. A leg's codes are a bird's
// (rig/bird.ts): what a picture shows of it starts at the knee or the
// ankle, the hip and femur being inside the body. The eyelid and the
// wing's cover turn with what they lie on.
type Spot = { code: string; name: string; at: readonly [number, number] };
function spotsOf(id: PartId): Spot[] {
  const p = partsPivots;
  const far = id.includes('far') ? 1 : 0;
  if (id === 'head') return [{ code: 'SJ0', name: 'head joint (the skull: the head\'s small turns)', at: p.skull }];
  if (id === 'neck') return [{ code: 'SJ1', name: 'neck base (it nods and pecks from here)', at: p.neckBase }];
  if (id === 'body' || id === 'body-peck') return [{ code: 'SJ2', name: 'hip (the body leans about it)', at: p.hip }];
  if (id === 'tail') return [{ code: 'SJ3', name: 'tail root', at: p.tail }];
  if (id.endsWith('-tucked')) return [{ code: `L${2 + far}J1`, name: 'knee (the drumstick\'s top; the tucked leg turns here)', at: far ? p.farTucked : p.nearTucked }];
  if (id.startsWith('leg-')) return [
    { code: `L${2 + far}J2`, name: 'ankle (where the leg leaves the belly; it turns here in a hop)', at: far ? p.farLegRoot : p.nearLegRoot },
    { code: `L${2 + far}J3`, name: 'foot (where it stands; the leg squashes from here and turns as the body leans)', at: far ? p.farFoot : p.nearFoot },
  ];
  if (id.startsWith('wing') && id !== 'wing-shoulder') return [{ code: `L${far}J0`, name: 'shoulder (the wing turns here)', at: far ? p.farShoulder : p.shoulder }];
  return [];
}

const GROUPS: readonly Group[] = [
  { code: 'L0', title: 'near wing', far: false }, { code: 'L1', title: 'far wing', far: true },
  { code: 'L2', title: 'near leg', far: false }, { code: 'L3', title: 'far leg', far: true },
  { code: 'S', title: 'spine', far: false },
];
const SPINE = [{ code: 'SJ0', line: 'neck line' }, { code: 'SJ1', line: 'neck line' }, { code: 'L0J0', line: 'back line' }, { code: 'SJ2', line: 'back line' }, { code: 'SJ3' }];

export function robinSkeleton(mode: string, now: number, still: boolean, separate: boolean): Skeleton {
  const pose = still ? partsPose(0, 'still') : partsPose(now, mode);
  const drawn = partsLayers(pose, separate).flatMap((layer): Joint[] => {
    if (layer.opacity === 0) return [];
    return spotsOf(layer.id).map((spot) => {
      const [x, y] = transformPoint(layer.transform, spot.at[0], spot.at[1]);
      return { code: spot.code, name: spot.name, at: { x, y }, far: layer.id.includes('far') };
    });
  });
  // Mid-flight, two wing drawings cross-fade on one shoulder.
  const joints = drawn.filter((j, i) => drawn.findIndex((o) => o.code === j.code) === i);
  const groups = GROUPS.filter((g) => joints.some((j) => j.code.startsWith(g.code)));
  const path = SPINE.flatMap((s) => {
    const joint = joints.find((j) => j.code === s.code);
    return joint ? [{ ...joint, line: s.line }] : [];
  });
  const spine = path.slice(1).map((to, k): Bone =>
    ({ code: `SB${k}`, name: `${path[k].line ?? 'line'} (${path[k].name} to ${to.name})`, from: path[k].code, to: to.code, far: false }));
  // A grounded leg's one picture is the tarsometatarsus and the toes.
  const legs = [0, 1].flatMap((far): Bone[] => {
    const code = `L${2 + far}`;
    const ankle = joints.find((j) => j.code === `${code}J2`), foot = joints.find((j) => j.code === `${code}J3`);
    return ankle && foot ? [{ code: `${code}B2`, name: 'tarsometatarsus', from: ankle.code, to: foot.code, far: far === 1 }] : [];
  });
  return { groups, joints, bones: [...legs, ...spine] };
}
