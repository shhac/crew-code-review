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
//   H   the head, from the joint it turns about outward.
//   S   the spine, from the tail forward.
//   O   any other mark the rig makes (a cupid's grip on its bow).
// Within each, Jk is a joint and Bk a bone: a limb's joints run from the
// body outward (J0 its shoulder or hip), and its Bk from Jk to Jk+1. A
// point that is two things keeps the code it was given first (a hip is
// L2J0, never also a joint of the spine), and a spine or head bone ending
// there refers to it by that code.
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
// The marks a part of the body owns, by name, and its bones from one mark
// to another, which may be another part's (the spine's hip is a leg's).
export type Chain = { joints: readonly string[]; bones?: readonly (readonly [from: string, to: string, name: string])[] };
export type BoneNames = {
  // By the leg's layer ('near legs', 'far arm') and whether it is a foreleg.
  legs?: (leg: { layer: string; fore: boolean }) => LegBones;
  marked?: readonly Marked[];
  head?: Chain;
  wings?: Chain;
  spine?: Chain;
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

// A part of the body that owns the marks named so, numbered as its spec
// lists them (one missing now leaves a gap, so the rest keep their codes),
// with its bones between any joints already coded.
function chain(built: Built, marks: readonly Guide[], spec: Chain | undefined, code: string, title: string, isFar: (p: Point) => boolean): Built {
  if (!spec) return built;
  const owned = spec.joints.flatMap((name, k) => {
    const mark = byName(marks.map((g) => ({ ...g, far: isFar(g.at) })), name);
    return mark ? [{ code: `${code}J${k}`, name, at: mark.at, far: mark.far }] : [];
  });
  const joints = [...built.joints, ...owned];
  const bones = (spec.bones ?? []).flatMap(([from, to, name], k) => {
    const a = byName(joints, from), b = byName(joints, to);
    return a && b ? [{ code: `${code}B${k}`, name, from: a.code, to: b.code, far: a.far && b.far }] : [];
  });
  if (!owned.length && !bones.length) return built;
  return { groups: [...built.groups, { code, title, far: false }], joints, bones: [...built.bones, ...bones] };
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
  const free = marks.filter((g) => !onLimbs(g));
  const withHead = chain(built, free, names.head, 'H', 'head', isFar);
  const withWings = chain(withHead, free, names.wings, 'W0', 'near wing', isFar);
  const withSpine = chain(withWings, free, names.spine, 'S', 'spine', isFar);
  const left = free.filter((g) => !withSpine.joints.some((j) => same(j.at, g.at) && j.name === g.name));
  return chain(withSpine, left, { joints: left.map((g) => g.name) }, 'O', 'other marks', isFar);
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

// A legend's rows, part by part: a limb's joints and bones in turn along
// it, the rest joints first.
export function legendOf(skeleton: Skeleton): { group: Group; rows: (Joint | Bone)[] }[] {
  return skeleton.groups.map((group) => {
    const mine = <T extends { code: string }>(all: readonly T[]) => all.filter((x) => parseCode(x.code)?.group === group.code);
    const joints = mine(skeleton.joints), bones = mine(skeleton.bones);
    // Along a limb: J0, B0, J1, B1...
    const along = (x: { code: string }) => {
      const c = parseCode(x.code);
      return c ? 2 * c.index + (c.kind === 'B' ? 1 : 0) : 0;
    };
    const rows = group.code.startsWith('L') ? [...joints, ...bones].sort((a, b) => along(a) - along(b)) : [...joints, ...bones];
    return { group, rows };
  });
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
