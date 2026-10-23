// The rendered plan: what Rig.svelte draws for a pose, read back from its
// server-rendered markup, so two rigs (an animal before and after a change
// to how it is built) can be shown to draw the same thing. Each drawn
// element in document order, with everything its ancestors do to it
// composed in: where it lands, how see-through it is, whether it is seen,
// and how many far shades darken it. A picture is placed by the matrix
// taking the unit square onto it, so a box and a turn split differently
// between an image and its groups still compare equal; a stroke or a lid by
// its points where they land. What Layers.svelte's stylesheet gives every
// path alike (round caps, no fill but a stroke's own) is not in the markup,
// so not here. Only for tests: it renders on the server.
import { render } from 'svelte/server';
import { svgMatrix } from '../../christmas/parts-affine';
import type { Point } from '../../pointer';
import Rig from '../Rig.svelte';
import type { Frame, RigPose } from '../rig';
import { applied, IDENTITY, product, type Affine } from './affine';

type Look = { opacity: number; visible: boolean; far: number };
// `ratio`: the box's own shape, which decides how a picture keeping its
// aspect fits in it; none for one stretched to its box.
type ImageDraw = { kind: 'image'; href: string; aspect: string; place: Affine; ratio: number | null } & Look;
// `linear`: what the matrix does besides turning and scaling evenly (a
// breath's squash), which round caps and circles show; none when nothing.
type Shape = { data: Readonly<Record<string, string>>; fill: string | null; linear: Affine | null } & Look;
type CircleDraw = { kind: 'circle'; centre: Point; r: number } & Shape;
type PathDraw = { kind: 'path'; points: readonly Point[]; closed: boolean; width: number; stroke: string | null; join: string | null; cap: string | null } & Shape;
export type PlanDraw = ImageDraw | CircleDraw | PathDraw;
export type Plan = { frame: Frame; draws: readonly PlanDraw[]; guides: readonly { name: string; at: Point }[] };

type Node = { tag: string; attrs: ReadonlyMap<string, string>; children: Node[]; text: string[] };

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'" };
const decoded = (s: string) => s.replace(/&(amp|quot|lt|gt|#39);/g, (_, e: string) => ENTITIES[e]);

// Svelte's markup is regular: every element closed, attributes quoted.
function parsed(markup: string): Node {
  const root: Node = { tag: '', attrs: new Map(), children: [], text: [] };
  const open: Node[] = [root];
  const tokens = markup.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g);
  for (const [, closing, tag, attrs, selfClosing, text] of tokens) {
    const top = open[open.length - 1];
    if (text !== undefined) {
      top.text.push(decoded(text));
      continue;
    }
    if (closing) {
      if (top.tag !== tag) throw new Error(`plan: </${tag}> closes <${top.tag}>`);
      open.pop();
      continue;
    }
    const pairs = [...(attrs ?? '').matchAll(/([^\s=]+)(?:="([^"]*)")?/g)].map(([, k, v]): [string, string] => [k, decoded(v ?? '')]);
    const node: Node = { tag, attrs: new Map(pairs), children: [], text: [] };
    top.children.push(node);
    if (!selfClosing) open.push(node);
  }
  return root;
}

type Context = { matrix: Affine; opacity: number; visibility: string; far: number };

const number = (node: Node, name: string) => Number(node.attrs.get(name) ?? 0);
const classes = (node: Node) => (node.attrs.get('class') ?? '').split(/\s+/);
const styles = (node: Node): ReadonlyMap<string, string> =>
  new Map((node.attrs.get('style') ?? '').split(';').flatMap((s) => {
    const [k, v] = s.split(':').map((p) => p.trim());
    return k && v !== undefined ? [[k, v] as const] : [];
  }));
const dataOf = (node: Node) => Object.fromEntries([...node.attrs].filter(([k]) => k.startsWith('data-')).sort(([a], [b]) => a.localeCompare(b)));

const scaleOf = (m: Affine) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
// A turn and an even scale, possibly mirrored, keep circles round.
const conformal = (m: Affine) => Math.abs(Math.hypot(m[0], m[1]) - Math.hypot(m[2], m[3])) < 1e-9 && Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-9;
const linearOf = (m: Affine): Affine | null => (conformal(m) ? null : [m[0], m[1], m[2], m[3], 0, 0]);

// A path's points as Layers.svelte writes them: moves, lines and a close.
function pathPoints(d: string): { points: Point[]; closed: boolean } {
  const commands = [...d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)];
  return commands.reduce<{ points: Point[]; closed: boolean }>(({ points, closed }, [, command, args]) => {
    const n = args.trim() ? args.trim().split(/[ ,]+/).map(Number) : [];
    const last = points[points.length - 1] ?? { x: 0, y: 0 };
    switch (command) {
      case 'M': case 'L': return { points: [...points, { x: n[0], y: n[1] }], closed };
      case 'm': case 'l': return { points: [...points, { x: last.x + n[0], y: last.y + n[1] }], closed };
      case 'H': return { points: [...points, { x: n[0], y: last.y }], closed };
      case 'h': return { points: [...points, { x: last.x + n[0], y: last.y }], closed };
      case 'V': return { points: [...points, { x: last.x, y: n[0] }], closed };
      case 'v': return { points: [...points, { x: last.x, y: last.y + n[0] }], closed };
      case 'Z': case 'z': return { points, closed: true };
      default: throw new Error(`plan: path command ${command}`);
    }
  }, { points: [], closed: false });
}

type Read = { draws: PlanDraw[]; guides: { name: string; at: Point }[] };

function drawOf(node: Node, at: Context): PlanDraw | null {
  const look = { opacity: at.opacity, visible: at.visibility !== 'hidden', far: at.far };
  const m = at.matrix;
  const shape = { data: dataOf(node), linear: linearOf(m), ...look };
  const fill = (fallback: string | null) => styles(node).get('fill') ?? node.attrs.get('fill') ?? fallback;
  if (node.tag === 'image') {
    const [x, y, width, height] = ['x', 'y', 'width', 'height'].map((k) => number(node, k));
    const aspect = node.attrs.get('preserveAspectRatio') ?? 'default';
    return { kind: 'image', href: node.attrs.get('href') ?? '', aspect, place: product(m, [width, 0, 0, height, x, y]), ratio: aspect === 'none' ? null : width / height, ...look };
  }
  if (node.tag === 'circle') {
    return { kind: 'circle', centre: applied(m, { x: number(node, 'cx'), y: number(node, 'cy') }), r: number(node, 'r') * scaleOf(m), ...shape, fill: fill(null) };
  }
  if (node.tag === 'path') {
    const { points, closed } = pathPoints(node.attrs.get('d') ?? '');
    return {
      kind: 'path', points: points.map((p) => applied(m, p)), closed, width: number(node, 'stroke-width') * scaleOf(m), stroke: node.attrs.get('stroke') ?? null,
      join: node.attrs.get('stroke-linejoin') ?? null, cap: node.attrs.get('stroke-linecap') ?? null, ...shape, fill: fill(null),
    };
  }
  return null;
}

function read(node: Node, outer: Context, into: Read): void {
  const at: Context = {
    matrix: product(outer.matrix, svgMatrix(node.attrs.get('transform') ?? '')),
    opacity: outer.opacity * Number(node.attrs.get('opacity') ?? 1),
    visibility: node.attrs.get('visibility') ?? outer.visibility,
    far: outer.far + (classes(node).includes('far') ? 1 : 0),
  };
  if (node.tag === 'circle' && classes(node).includes('guide')) {
    const title = node.children.find((c) => c.tag === 'title');
    into.guides.push({ name: title?.text.join('') ?? '', at: applied(at.matrix, { x: number(node, 'cx'), y: number(node, 'cy') }) });
    return;
  }
  const draw = drawOf(node, at);
  if (draw) into.draws.push(draw);
  node.children.forEach((c) => read(c, at, into));
}

// The plan Rig.svelte draws for a pose, guides included.
export function planOf(pose: RigPose): Plan {
  const markup = render(Rig, { props: { pose, x: 0, y: 0, guides: true } }).body;
  const into: Read = { draws: [], guides: [] };
  read(parsed(markup), { matrix: IDENTITY, opacity: 1, visibility: 'visible', far: 0 }, into);
  const { width, height, anchor, scale } = pose;
  return { frame: { width, height, anchor, scale }, ...into };
}

// Where two plans differ, each place by its path: numbers to `tolerance`,
// everything else exactly. None where they draw the same.
export function planDiff(a: unknown, b: unknown, tolerance = 1e-6, at = 'plan'): string[] {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tolerance ? [] : [`${at}: ${a} vs ${b}`];
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [`${at}: ${a.length} vs ${b.length} entries`];
    return a.flatMap((x, i) => planDiff(x, b[i], tolerance, `${at}[${i}]`));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.flatMap((k) => planDiff(Reflect.get(a, k), Reflect.get(b, k), tolerance, `${at}.${k}`));
  }
  return a === b ? [] : [`${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
}
