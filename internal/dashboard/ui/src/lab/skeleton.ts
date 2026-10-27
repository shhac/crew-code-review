// The critters lab's skeleton view: an animal as its joints and the bones
// between them, each named and coded, to talk about how it is put together
// rather than how it is drawn. A rig says where its joints are itself, on
// the skeleton it is drawn from (RigPose's `skeleton`), so the view cannot
// disagree with the drawing; an animal drawn its own way (the robin, the
// spider) reads its joints off what it draws.
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
import type { PosedSkeleton } from '../lib/theme/rig/skeleton/types';

// `derived`: placed by its limb's solve, not authored (a skeleton's own).
export type Joint = { code: string; name: string; at: Point; far: boolean; derived?: boolean };
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

const side = (far: boolean) => (far ? 'far' : 'near');

const TITLES: Readonly<Record<string, string>> = { S: 'spine', H: 'head', W0: 'near wing', W1: 'far wing', O: 'other marks' };

// An animal built on a skeleton says where its joints are itself
// (RigPose's `skeleton`), coded by what each is, so nothing is read off the
// drawing: its parts in order (limbs, then the spine, the head, wings and
// the rest), a joint its limb's constraint placed marked as derived.
export function skeletonFromPosed(posed: PosedSkeleton): Skeleton {
  const groupOf = (code: string) => code.replace(/[JB]\d+$/, '');
  const codes = new Map(posed.joints.map((j) => [j.id, j.code]));
  const joints = posed.joints.map((j) => ({ code: j.code, name: j.name, at: j.at, far: j.far, ...(j.derived ? { derived: true } : {}) }));
  const bones = posed.bones.map((b) => ({ code: b.code, name: b.name, from: codes.get(b.from) ?? b.from, to: codes.get(b.to) ?? b.to, far: b.far }));
  const title = (code: string) => {
    const limb = posed.limbs.find((l) => l.code === code);
    const named = posed.titles?.[code];
    const far = Number(code.slice(1)) % 2 === 1;
    if (named) return `${side(far)} ${named}`;
    if (limb) return `${side(far)} ${limb.fore ? 'foreleg' : 'hind leg'}`;
    return TITLES[code] ?? code;
  };
  const rank = (code: string) => (code.startsWith('L') ? 0 : ['S', 'H', 'W0', 'W1'].indexOf(code) + 1 || 5);
  const order = [...new Set(joints.map((j) => groupOf(j.code)))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true }));
  const groups = order.map((code) => ({ code, title: title(code), far: joints.filter((j) => groupOf(j.code) === code).every((j) => j.far) }));
  return { groups, joints, bones };
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
