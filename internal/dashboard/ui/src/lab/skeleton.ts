// The critters lab's skeleton view: an animal as its joints and the bones
// between them, each named, to talk about how it is put together rather
// than how it is drawn. It is read off what the rig already draws and marks
// (each leg's pose, and its guides), so it cannot disagree with the
// drawing; only the bones' names are the lab's, each animal's module giving
// its own.
import type { Point } from '../lib/theme/pointer';
import { footInUse, turnAbout, turned, type DrawnLeg, type Guide, type Layer, type RigPose } from '../lib/theme/rig/rig';

export type Joint = { name: string; at: Point; far: boolean };
export type Bone = { name: string; from: Point; to: Point; far: boolean };
export type Skeleton = { joints: readonly Joint[]; bones: readonly Bone[] };
// A skeleton in its drawing: the drawing's box in its own units, the point
// in it standing on the lab's anchor (and the line it is mirrored about),
// and page pixels per unit.
export type Placed = { skeleton: Skeleton; view: { x: number; y: number; width: number; height: number }; anchor: Point; scale: number };

// What the bones along a leg are, hip to toes: the upper one (hip to knee;
// hip to foot on a leg drawn as one piece), the middle one (knee to ankle),
// the one up from the toes where the rig has it, and what the foot's
// picture stands for.
export type LegBones = { upper: string; middle?: string; lower?: string; foot: string };
export type BoneNames = {
  // By the leg's layer ('near legs', 'far arm') and whether it is a foreleg.
  legs?: (leg: { layer: string; fore: boolean }) => LegBones;
  // Legs drawn as strokes (an insect's) leave no pose to read, so they run
  // through the rig's joint marks: the marks' names in order along one leg,
  // and the bones' between them.
  marked?: { joints: readonly string[]; bones: readonly string[] };
  // A bone from one joint mark to another, by name (the trunk, a wing): the
  // near one where two share a name, and none while either is unmarked.
  between?: readonly (readonly [from: string, to: string, name: string])[];
};

type Place = (p: Point) => Point;
type SeenLeg = { leg: DrawnLeg; layer: string; far: boolean; place: Place };

// Where a group's layers are drawn: squashed about its pivot, then turned
// and moved, as transformOf draws it.
const within = (group: Extract<Layer, { kind: 'group' }>, place: Place): Place => {
  const squash = (group.scaleY ?? 1) * (group.foreshorten ?? 1);
  const { pivot } = group.turn;
  return (p) => place(turned(group.turn, { x: p.x, y: pivot.y + (p.y - pivot.y) * squash }));
};

// Each leg is drawn twice, outlined and as fur alone; the outlined pass
// finds it once.
const legsIn = (layers: readonly Layer[], place: Place): SeenLeg[] => layers.flatMap((l) => {
  if (l.kind === 'group') return legsIn(l.layers, within(l, place));
  if (l.kind !== 'legs' || l.fur) return [];
  return l.legs.map((leg) => ({ leg, layer: l.name, far: l.far, place }));
});

// Every point drawn on the far side, which tells a far joint's mark from
// its near twin's.
const farPoints = (layers: readonly Layer[], place: Place): Point[] => layers.flatMap((l) => {
  if (l.kind === 'group') return farPoints(l.layers, within(l, place));
  if (l.kind === 'legs' && l.far) return l.legs.flatMap(({ limb }) => [limb.hip, limb.knee, limb.ankle, limb.foot].map(place));
  if (l.kind === 'stroke' && l.name.startsWith('far ')) return l.points.map(place);
  return [];
});

const same = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-3;

// How far forward the foot's picture reaches: the front of its box at the
// sole, turned with it about the leg's end.
function toesOf(leg: DrawnLeg): Point {
  const foot = footInUse(leg);
  const { x, y } = leg.limb.foot;
  return turned(turnAbout(leg.limb.paw, leg.limb.foot), { x: x - foot.heel.x + foot.width, y: y - foot.heel.y + foot.height });
}

// A leg's bones as the rig poses and draws it: a leg too short to show a
// knee is one piece, hip to foot; one standing on its hock or wrist has no
// bone up from the toes.
function legBones({ leg, far, place }: SeenLeg, names: LegBones): Bone[] {
  const { hip, knee, ankle, foot } = leg.limb;
  const toes = same(ankle, foot) ? [] : [{ from: ankle, to: foot, name: names.lower ?? '' }];
  const along = leg.art.knee
    ? [{ from: hip, to: knee, name: names.upper }, { from: knee, to: ankle, name: names.middle ?? '' }, ...toes]
    : [{ from: hip, to: foot, name: names.upper }];
  return [...along, { from: foot, to: toesOf(leg), name: names.foot }].map((b) => ({ name: b.name, from: place(b.from), to: place(b.to), far }));
}

// Each run of marks named as one leg's joints, in order, is one leg.
function markedBones(guides: readonly Guide[], chain: NonNullable<BoneNames['marked']>, isFar: (p: Point) => boolean): Bone[] {
  const { joints, bones } = chain;
  return guides.flatMap((g, i) => {
    const run = guides.slice(i, i + joints.length);
    if (run.length < joints.length || run.some((r, k) => r.name !== joints[k])) return [];
    const far = isFar(g.at);
    return run.slice(1).map((r, k) => ({ name: bones[k] ?? '', from: run[k].at, to: r.at, far }));
  });
}

const named = (joints: readonly Joint[], name: string) => joints.find((j) => j.name === name && !j.far) ?? joints.find((j) => j.name === name);

export function skeletonOf(pose: RigPose, names: BoneNames): Skeleton {
  const top: Place = (p) => p;
  const far = farPoints(pose.layers, top);
  const isFar = (p: Point) => far.some((q) => same(p, q));
  // Where it stands on the ledge is the rig's anchor, not a joint.
  const joints = (pose.guides ?? []).filter((g) => !same(g.at, pose.anchor)).map((g) => ({ name: g.name, at: g.at, far: isFar(g.at) }));
  const legNames = names.legs;
  const legs = legNames ? legsIn(pose.layers, top).flatMap((s) => legBones(s, legNames({ layer: s.layer, fore: s.leg.fore }))) : [];
  const marked = names.marked ? markedBones(pose.guides ?? [], names.marked, isFar) : [];
  const between = (names.between ?? []).flatMap(([from, to, name]) => {
    const a = named(joints, from), b = named(joints, to);
    return a && b ? [{ name, from: a.at, to: b.at, far: a.far && b.far }] : [];
  });
  return { joints, bones: [...legs, ...marked, ...between] };
}

// A label to lay beside what it names, in the drawing's units: its point,
// the way from it to go (a unit vector) and its size in page pixels.
export type Label = { text: string; at: Point; toward: Point; px: number };
// `moved`: nudged off its own line, to be tied back to its point.
export type Laid = { x: number; y: number; anchor: 'start' | 'middle' | 'end'; moved: boolean };
type Box = { left: number; right: number; top: number; bottom: number };

const GAP = 5;
// About how wide a character of the lab's sans-serif is, against its size.
const CHAR = 0.56;

const boxOf = (l: Label & Laid, u: number): Box => {
  const width = l.text.length * CHAR * l.px * u;
  const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - width : l.x - width / 2;
  const half = 0.6 * l.px * u;
  return { left, right: left + width, top: l.y - half, bottom: l.y + half };
};
// How much of one box lies over another.
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

// Each label a gap from its point, its way or else the other way, nudged a
// line at a time up or down off the joints and the labels laid before it:
// the nearest place clear of them all, or failing that the least covered.
// `u` is units to a page pixel at the lab's zoom, so labels keep one size
// on screen.
export function layLabels<L extends Label>(labels: readonly L[], u: number, dots: readonly Point[] = []): (L & Laid)[] {
  const taken = dots.map((d) => ({ left: d.x - 4 * u, right: d.x + 4 * u, top: d.y - 4 * u, bottom: d.y + 4 * u }));
  return labels.reduce<{ laid: (L & Laid)[]; boxes: Box[] }>(({ laid, boxes }, l) => {
    const line = 1.25 * l.px * u;
    const toward = (way: Point) => ({
      ...l, x: l.at.x + way.x * GAP * u, y: l.at.y + way.y * GAP * u,
      anchor: way.x > 0.3 ? 'start' : way.x < -0.3 ? 'end' : 'middle', moved: false,
    } satisfies L & Laid);
    const ways = [toward(l.toward), toward({ x: -l.toward.x, y: -l.toward.y })];
    const tries = [0, 1, -1, 2, -2, 3, -3, 4, -4].flatMap((k) => ways.map((t) => ({ ...t, y: t.y + k * line, moved: k !== 0 })));
    const covered = tries.map((t) => boxes.reduce((sum, b) => sum + overlap(b, boxOf(t, u)), 0));
    const clear = covered.findIndex((c) => c === 0);
    const best = clear >= 0 ? clear : covered.indexOf(Math.min(...covered));
    return { laid: [...laid, tries[best]], boxes: [...boxes, boxOf(tries[best], u)] };
  }, { laid: [], boxes: taken }).laid;
}
