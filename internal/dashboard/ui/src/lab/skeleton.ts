// The critters lab's skeleton view: an animal as its joints and the bones
// between them, each named and coded, to talk about how it is put together
// rather than how it is drawn. It is read off what the rig already draws
// and marks (each leg's pose, and its guides), so it cannot disagree with
// the drawing; only the bones' names are the lab's, each animal's module
// giving its own.
//
// The codes, so a joint or bone can be named in a word and linked to:
//   Ln  a limb, fore to hind and near before far whatever the rig's own leg
//       order: L0 the near foreleg, L1 the far one, L2 the near hind leg, L3
//       the far one. A bird's wings are its forelimbs and a cupid's arms
//       its; six or eight legs run front to back the same way, a pair at a
//       time (L0 near front, L1 far front, L2 near second...).
//   Wn  a wing that is not a limb (a cupid's, an insect's): W0 near, W1 far.
//   S   the spine, from the head to the tail: SJ0 the head joint (where the
//       head turns on the neck), then the neck, the shoulders, the hips,
//       the tail's root and tip, as far as the rig has points for them.
//   H   the head's own features (an ear's base, an eye, the nose, a bill's
//       hinge), from the head joint outward.
//   O   any other mark the rig makes (a cupid's grip on its bow).
// Within each, Jk is a joint and Bk a bone: a limb's joints run from the
// body outward (J0 its shoulder or hip), and its Bk from Jk to Jk+1; the
// spine's SBk from one of its points to the next. A point that is two
// things keeps the code it was given first (a hip is L2J0, never also a
// joint of the spine), and a spine or head bone ending there refers to it
// by that code.
import type { Point } from '../lib/theme/pointer';
import { footInUse, turnAbout, turned, type DrawnLeg, type Guide, type Layer, type RigPose } from '../lib/theme/rig/rig';

export type Joint = { code: string; name: string; at: Point; far: boolean };
// From joint to joint, by their codes.
export type Bone = { code: string; name: string; from: string; to: string; far: boolean };
// A limb, a wing, the head, the spine: what its codes start with, and what
// it is.
export type Group = { code: string; title: string; far: boolean };
export type Skeleton = { groups: readonly Group[]; joints: readonly Joint[]; bones: readonly Bone[] };
// A skeleton in its drawing: the drawing's box in its own units, the point
// in it standing on the lab's anchor (and the line it is mirrored about),
// and page pixels per unit.
export type Placed = { skeleton: Skeleton; view: { x: number; y: number; width: number; height: number }; anchor: Point; scale: number };

// A leg as the rig draws it: which pair it is (0 the forelimbs, 1 the hind
// limbs), what it is called, and its bones from the hip to the toes: the
// upper one (hip to knee; hip to foot on a leg drawn as one piece), the
// middle one (knee to ankle), the one up from the toes where the rig has
// it, and what the foot's picture stands for, out to its tip.
export type LegBones = { pair: number; limb: string; upper: string; middle?: string; lower?: string; foot: string; tip?: string };
// Limbs drawn without a posed leg (an insect's strokes, a bird's wing) run
// through the rig's joint marks: the marks' names in order along one limb,
// and the bones' between them. A run's pair is given, or else counted from
// the front.
export type Marked = { joints: readonly string[]; bones: readonly string[]; limb: (pair: number) => string; pair?: number };
// A point of the body: one of the rig's joint marks by its name (shown as
// `name`, where that says more), or the pivot a group of its layers turns
// about, by the picture it turns (a bird's head turns on its head joint).
// A mark already a limb's joint (a shoulder, a hip) is that joint.
export type Spot = { mark: string; name?: string } | { pivot: string; name: string };
// The points a part of the body owns, and its bones by their points'
// names, which may be another part's.
export type Chain = { joints: readonly Spot[]; bones?: readonly (readonly [from: string, to: string, name: string])[] };
// The spine, head to tail, with a line from each point found to the next,
// named for what it stands for.
export type Spine = readonly (Spot & { line?: string })[];
export type BoneNames = {
  // By the leg's layer ('near legs', 'far arm') and whether it is a foreleg.
  legs?: (leg: { layer: string; fore: boolean }) => LegBones;
  marked?: readonly Marked[];
  spine?: Spine;
  head?: Chain;
  wings?: Chain;
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

// Where each group of layers turns, by the pictures it turns itself (not
// those of groups inside it).
type Pivot = { name: string; at: Point };
const pivotsIn = (layers: readonly Layer[], place: Place): Pivot[] => layers.flatMap((l) => {
  if (l.kind !== 'group') return [];
  const at = place(turned(l.turn, l.turn.pivot));
  const own = l.layers.flatMap((c) => (c.kind === 'image' ? [{ name: c.name, at }] : []));
  return [...own, ...pivotsIn(l.layers, within(l, place))];
});

// How far forward the foot's picture reaches: the front of its box at the
// sole, turned with it about the leg's end.
function toesOf(leg: DrawnLeg): Point {
  const foot = footInUse(leg);
  const { x, y } = leg.limb.foot;
  return turned(turnAbout(leg.limb.paw, leg.limb.foot), { x: x - foot.heel.x + foot.width, y: y - foot.heel.y + foot.height });
}

// One limb before it has its code: its joints from the body outward (named
// by the rig's mark there, where it has one) and the bones between them.
type Draft = { pair: number; far: boolean; title: string; joints: { at: Point; name: string }[]; bones: string[] };
const GENERIC = ['hip', 'knee', 'ankle', 'foot'];

// A leg as the rig poses and draws it: a leg too short to show a knee is
// one piece, hip to foot; one standing on its hock or wrist has no bone up
// from the toes.
function legDraft({ leg, far, place }: SeenLeg, names: LegBones, marks: readonly Guide[]): Draft {
  const { hip, knee, ankle, foot } = leg.limb;
  const toes = !same(ankle, foot);
  const along = leg.art.knee
    ? [{ at: hip, bone: names.upper }, { at: knee, bone: names.middle ?? '' }, ...(toes ? [{ at: ankle, bone: names.lower ?? '' }] : [])]
    : [{ at: hip, bone: names.upper }];
  const points = [...along, { at: foot, bone: names.foot }].map((p) => ({ ...p, at: place(p.at) }));
  const joints = points.map((p, k) => ({ at: p.at, name: marks.find((g) => same(g.at, p.at))?.name ?? GENERIC[k] ?? 'joint' }));
  return { pair: names.pair, far, title: names.limb, joints: [...joints, { at: place(toesOf(leg)), name: names.tip ?? 'toe tip' }], bones: points.map((p) => p.bone) };
}

// Each run of marks named as one limb's joints, in order, is one limb; one
// without a pair given is counted from the front, side by side.
function markedDrafts(marks: readonly Guide[], spec: Marked, isFar: (p: Point) => boolean): Draft[] {
  const { joints } = spec;
  const runs = marks.flatMap((g, i) => {
    const run = marks.slice(i, i + joints.length);
    return run.length === joints.length && run.every((r, k) => r.name === joints[k]) ? [{ run, far: isFar(g.at) }] : [];
  });
  const rank = (r: (typeof runs)[number]) => runs.filter((o) => o.far === r.far && o.run[0].at.x > r.run[0].at.x).length;
  return runs.map((r) => {
    const pair = spec.pair ?? rank(r);
    return { pair, far: r.far, title: spec.limb(pair), joints: r.run.map((g) => ({ at: g.at, name: g.name })), bones: [...spec.bones] };
  });
}

const side = (far: boolean) => (far ? 'far' : 'near');

function coded(draft: Draft): { group: Group; joints: Joint[]; bones: Bone[] } {
  const code = `L${2 * draft.pair + (draft.far ? 1 : 0)}`;
  const { far } = draft;
  const joints = draft.joints.map((j, k) => ({ code: `${code}J${k}`, name: j.name, at: j.at, far }));
  const bones = draft.bones.flatMap((name, k) => (k + 1 < joints.length ? [{ code: `${code}B${k}`, name, from: joints[k].code, to: joints[k + 1].code, far }] : []));
  return { group: { code, title: `${side(far)} ${draft.title}`, far }, joints, bones };
}

// The one a name means: the near one where two share it.
const byName = <T extends { name: string; far: boolean }>(all: readonly T[], name: string) =>
  all.find((j) => j.name === name && !j.far) ?? all.find((j) => j.name === name);

type Built = { groups: Group[]; joints: Joint[]; bones: Bone[] };
type Found = { marks: readonly Guide[]; pivots: readonly Pivot[]; isFar: (p: Point) => boolean };

// A point already coded (a limb's), or else where the rig puts it now.
type Spotted = { joint?: Joint; name: string; at: Point; far: boolean };
function spotted(built: Built, found: Found, spot: Spot): Spotted | null {
  if ('pivot' in spot) {
    const pivot = found.pivots.find((p) => p.name === spot.pivot);
    return pivot ? { name: spot.name, at: pivot.at, far: false } : null;
  }
  const joint = byName(built.joints, spot.mark);
  if (joint) return { joint, name: joint.name, at: joint.at, far: joint.far };
  const mark = byName(found.marks.map((g) => ({ ...g, far: found.isFar(g.at) })), spot.mark);
  return mark ? { name: spot.name ?? mark.name, at: mark.at, far: mark.far } : null;
}

const withGroup = (built: Built, group: Group, joints: Joint[], bones: Bone[]): Built => (joints.length || bones.length
  ? { groups: [...built.groups, group], joints: [...built.joints, ...joints], bones: [...built.bones, ...bones] }
  : built);

// A part of the body owning the points its spec lists that are found now,
// numbered in turn, with its bones between any joints already coded.
function chain(built: Built, found: Found, spec: Chain | undefined, code: string, title: string): Built {
  if (!spec) return built;
  const seen = spec.joints.flatMap((spot) => {
    const at = spotted(built, found, spot);
    return at && !at.joint ? [at] : [];
  });
  const owned = seen.map((j, k) => ({ code: `${code}J${k}`, name: j.name, at: j.at, far: j.far }));
  const joints = [...built.joints, ...owned];
  const bones = (spec.bones ?? []).flatMap(([from, to, name], k) => {
    const a = byName(joints, from), b = byName(joints, to);
    return a && b ? [{ code: `${code}B${k}`, name, from: a.code, to: b.code, far: a.far && b.far }] : [];
  });
  return withGroup(built, { code, title, far: false }, owned, bones);
}

// The spine's points found now, head to tail, its own numbered in turn and
// a limb's kept as that limb's, and a line from each to the next. A point
// where an earlier one already is (a tail drawn in the body's own group,
// turning about the body's pivot) is not one of its own.
function spineOf(built: Built, found: Found, spec: Spine | undefined): Built {
  if (!spec) return built;
  const seen = spec.reduce<(Spotted & { line?: string })[]>((all, spot) => {
    const at = spotted(built, found, spot);
    return at && !all.some((a) => same(a.at, at.at)) ? [...all, { ...at, line: spot.line }] : all;
  }, []);
  const coded = seen.reduce<{ joints: Joint[]; own: Joint[] }>(({ joints, own }, j) => {
    if (j.joint) return { joints: [...joints, j.joint], own };
    const joint = { code: `SJ${own.length}`, name: j.name, at: j.at, far: j.far };
    return { joints: [...joints, joint], own: [...own, joint] };
  }, { joints: [], own: [] });
  const bones = coded.joints.slice(1).map((to, k) => {
    const from = coded.joints[k];
    return { code: `SB${k}`, name: `${seen[k].line ?? 'line'} (${from.name} to ${to.name})`, from: from.code, to: to.code, far: from.far && to.far };
  });
  return withGroup(built, { code: 'S', title: 'spine', far: false }, coded.own, bones);
}

export function skeletonOf(pose: RigPose, names: BoneNames): Skeleton {
  const top: Place = (p) => p;
  const far = farPoints(pose.layers, top);
  const isFar = (p: Point) => far.some((q) => same(p, q));
  // Where it stands on the ledge is the rig's anchor, not a joint.
  const marks = (pose.guides ?? []).filter((g) => !same(g.at, pose.anchor));
  const legNames = names.legs;
  const legs = legNames ? legsIn(pose.layers, top).map((s) => legDraft(s, legNames({ layer: s.layer, fore: s.leg.fore }), marks)) : [];
  const drafts = [...legs, ...(names.marked ?? []).flatMap((m) => markedDrafts(marks, m, isFar))];
  const limbs = drafts.map(coded).sort((a, b) => a.group.code.localeCompare(b.group.code, undefined, { numeric: true }));
  const built: Built = { groups: limbs.map((l) => l.group), joints: limbs.flatMap((l) => l.joints), bones: limbs.flatMap((l) => l.bones) };
  const onLimbs = (g: Guide) => built.joints.some((j) => same(j.at, g.at));
  const found: Found = { marks: marks.filter((g) => !onLimbs(g)), pivots: pivotsIn(pose.layers, top), isFar };
  const withSpine = spineOf(built, found, names.spine);
  const withHead = chain(withSpine, found, names.head, 'H', 'head');
  const withWings = chain(withHead, found, names.wings, 'W0', 'near wing');
  const used = (g: Guide) => withWings.joints.some((j) => same(j.at, g.at));
  const left = found.marks.filter((g) => !used(g));
  return chain(withWings, { ...found, marks: left }, { joints: left.map((g) => ({ mark: g.name })) }, 'O', 'other marks');
}

// A code's part and kind, and its place: L0B2 is limb L0's bone 2.
export function parseCode(code: string): { group: string; kind: 'J' | 'B'; index: number } | null {
  const m = /^(.+)([JB])(\d+)$/.exec(code);
  if (!m) return null;
  return { group: m[1], kind: m[2] === 'J' ? 'J' : 'B', index: Number(m[3]) };
}

// What a selected code lights: itself, and a bone's two joints with it.
export function litBy(skeleton: Skeleton, code: string | null): Set<string> {
  if (!code) return new Set();
  const bone = skeleton.bones.find((b) => b.code === code);
  return new Set(bone ? [bone.code, bone.from, bone.to] : [code]);
}

// A legend's rows, part by part, in the order of their codes: a limb's
// joints and bones in turn along it, the rest joints first.
export function legendOf(skeleton: Skeleton): { group: Group; rows: (Joint | Bone)[] }[] {
  return skeleton.groups.map((group) => {
    const mine = <T extends { code: string }>(all: readonly T[]) => all.filter((x) => parseCode(x.code)?.group === group.code);
    const joints = mine(skeleton.joints), bones = mine(skeleton.bones);
    const limb = group.code.startsWith('L');
    // Along a limb J0, B0, J1, B1...; elsewhere J0, J1..., then B0, B1...
    const order = (x: { code: string }) => {
      const c = parseCode(x.code);
      if (!c) return 0;
      return limb ? 2 * c.index + (c.kind === 'B' ? 1 : 0) : c.index + (c.kind === 'B' ? 1000 : 0);
    };
    const rows = [...joints, ...bones].sort((a, b) => order(a) - order(b));
    return { group, rows };
  });
}

// A label to lay out of the way of the skeleton, tied to what it names by
// a leader: its point, and its size in page pixels.
export type Label = { text: string; at: Point; px: number };
export type Laid = { x: number; y: number; anchor: 'start' | 'end' };

// How far beyond the skeleton the columns stand, and the line between
// labels, in page pixels against a label's size.
const MARGIN = 22;
const LINE = 1.35;

type Stack<L> = { top: number; items: L[] };

// Labels stacked a line apart, as near the heights of their points as they
// can be without overlapping: a run that would overlap is one stack,
// centred on where its labels would each rather be.
function stacked<L extends Label>(labels: readonly L[], line: number): Stack<L>[] {
  const settle = (stacks: Stack<L>[]): Stack<L>[] => {
    if (stacks.length < 2) return stacks;
    const a = stacks[stacks.length - 2], b = stacks[stacks.length - 1];
    if (a.top + a.items.length * line <= b.top) return stacks;
    const items = [...a.items, ...b.items];
    const top = items.reduce((sum, l, k) => sum + l.at.y - k * line, 0) / items.length;
    return settle([...stacks.slice(0, -2), { top, items }]);
  };
  return [...labels].sort((a, b) => a.at.y - b.at.y).reduce<Stack<L>[]>((stacks, l) => settle([...stacks, { top: l.at.y, items: [l] }]), []);
}

// Every label in one of two columns, left and right of the skeleton's box
// (`around`, its points) with a margin, on the side its point is: in each,
// in the order of its points' heights, so leaders seldom cross, and a line
// apart, and none lower than `lowest`, where the stage ends (each pushed up
// only as far as the one under it needs). `u` is units to a page pixel at
// the lab's zoom, so labels keep one size on screen.
export function layColumns<L extends Label>(labels: readonly L[], u: number, around: readonly Point[], lowest = Infinity): (L & Laid)[] {
  if (!labels.length) return [];
  const xs = (around.length ? around : labels.map((l) => l.at)).map((p) => p.x);
  const left = Math.min(...xs), right = Math.max(...xs), middle = (left + right) / 2;
  const line = LINE * Math.max(...labels.map((l) => l.px)) * u;
  const column = (items: readonly L[], x: number, anchor: Laid['anchor']) => {
    const laid = stacked(items, line).flatMap((stack) => stack.items.map((l, k) => ({ ...l, x, y: stack.top + k * line, anchor })));
    return laid.reduceRight<(L & Laid)[]>((below, l) => [{ ...l, y: Math.min(l.y, (below[0]?.y ?? lowest + line) - line) }, ...below], []);
  };
  return [
    ...column(labels.filter((l) => l.at.x < middle), left - MARGIN * u, 'end'),
    ...column(labels.filter((l) => l.at.x >= middle), right + MARGIN * u, 'start'),
  ];
}
