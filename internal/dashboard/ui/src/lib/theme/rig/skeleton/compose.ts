// An animal built on a skeleton, drawn: a pose's joints placed (FK, then
// each limb's constraint), every piece hung from its attachment, and the
// pieces' draws laid out as piece layers in z order. The order is worked
// out once for each set of z overrides a pose uses and kept, so from frame
// to frame every draw keeps its paint slot and only its matrix, opacity
// and visibility change; nodes move only when a pose changes the order.
import { degrees } from '../../math';
import type { Point } from '../../pointer';
import type { Limb } from '../gait';
import { bone, type Layer, type RigPose } from '../rig';
import { angleOf, applied, inverse, linear, product, rotate, scale, translate, type Affine } from './affine';
import { frames, local } from './forward';
import { ownedBy, ownedFrames, ownedPoints, solveLimb, standing } from './limbs';
import type { Attachment, Body, Draw, Handle, JointSpec, Piece, PosedBone, PosedJoint, PosedLimb, PoseSpec, Role, Skeleton } from './types';

type PieceLayer = Extract<Layer, { kind: 'piece' }>;

const sideCode = (side: 'near' | 'far') => (side === 'far' ? 1 : 0);
// A joint's code from what it is (lab/skeleton.ts's codes), never from what
// a pose happens to draw.
export function codeOf(role: Role): string {
  switch (role.part) {
    case 'spine': return `SJ${role.index}`;
    case 'limb': return `L${2 * role.pair + sideCode(role.side)}J${role.index}`;
    case 'head': return `HJ${role.index}`;
    case 'wing': return `W${sideCode(role.side)}J${role.index}`;
    case 'other': return `OJ${role.index}`;
  }
}
const farRole = (role: Role) => (role.part === 'limb' || role.part === 'wing') && role.side === 'far';

const direction = (from: Point, to: Point) => degrees(Math.atan2(to.y - from.y, to.x - from.x));
const apart = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

// What a skeleton has at rest, worked out once: each joint's rest point
// (an owned one's from its limb's standing solve) and each limb standing.
type Rest = { points: ReadonlyMap<string, Point>; limbs: ReadonlyMap<string, Limb> };
const rests = new WeakMap<Skeleton, Rest>();
function restOf(skeleton: Skeleton): Rest {
  const had = rests.get(skeleton);
  if (had) return had;
  const owned = ownedBy(skeleton);
  const misplaced = skeleton.joints.filter((j) => !!j.derived !== owned.has(j.id)).map((j) => j.id);
  if (misplaced.length) throw new Error(`skeleton: derived joints must be the limbs' own: ${misplaced.join(', ')}`);
  const points = new Map(skeleton.joints.map((j) => [j.id, j.at]));
  const limbs = new Map(skeleton.limbs.map((limb) => {
    const root = points.get(limb.joints.root);
    if (!root) throw new Error(`skeleton: ${limb.id} has no root ${limb.joints.root}`);
    const stood = standing(limb, root);
    ownedPoints(skeleton, limb, stood, stood).forEach((p, id) => points.set(id, p));
    return [limb.id, stood];
  }));
  const rest = { points, limbs };
  rests.set(skeleton, rest);
  return rest;
}

const UNWRAP = (a: number, from: number) => from + ((((a - from + 180) % 360) + 360) % 360) - 180;

// What a trailing joint turns by: as it did `lag` ms ago (with a spring,
// blended over four such moments, each `spring` times the weight of the one
// after it), from the pose evaluated then, its own `since` moved back too.
function trailing(skeleton: Skeleton, poseAt: (now: number) => PoseSpec, now: number): (j: JointSpec) => Affine | null {
  const past = new Map<number, ReadonlyMap<string, Affine>>();
  const at = (t: number) => {
    const had = past.get(t);
    if (had) return had;
    const world = frames(skeleton, poseAt(t)).world;
    past.set(t, world);
    return world;
  };
  return (j) => {
    if (!j.trail) return null;
    const { lag, spring } = j.trail;
    const moments = (spring ? [1, 2, 3, 4] : [1]).map((k) => at(now - lag * k).get(j.id));
    const [first] = moments;
    if (!first) return null;
    if (!spring) return linear(first);
    const angles = moments.map((m) => UNWRAP(m ? angleOf(m) : angleOf(first), angleOf(first)));
    const weights = angles.map((_, k) => spring ** k);
    const blended = angles.reduce((sum, a, k) => sum + a * weights[k], 0) / weights.reduce((a, b) => a + b, 0);
    return product(rotate(blended - angleOf(first)), linear(first));
  };
}

// Each draw (and each shape) in paint order, by its piece and its place in
// it: draws keep the order they are declared in within a z, shapes after
// the pieces' draws.
type Slot = { piece: number; draw: number } | { shape: number };
const orders = new WeakMap<Body, Map<string, readonly Slot[]>>();
function orderOf(body: Body, z: PoseSpec['z']): readonly Slot[] {
  const known = orders.get(body) ?? new Map<string, readonly Slot[]>();
  orders.set(body, known);
  const key = JSON.stringify(Object.entries(z).sort(([a], [b]) => a.localeCompare(b)));
  const had = known.get(key);
  if (had) return had;
  const all = [
    ...body.pieces.flatMap((p, piece) => p.draws.map((d, draw) => ({ slot: { piece, draw }, id: d.id, z: z[d.id] ?? d.z }))),
    ...(body.shapes ?? []).map((s, shape) => ({ slot: { shape }, id: s.id, z: z[s.id] ?? s.z })),
  ];
  const ids = all.map((d) => d.id);
  const unknown = Object.keys(z).filter((id) => !ids.includes(id));
  if (unknown.length) throw new Error(`skeleton: no draw ${unknown.join(', ')} to move`);
  if (new Set(ids).size !== ids.length) throw new Error('skeleton: two draws share an id');
  const order = all.map((d, i) => ({ ...d, i })).sort((a, b) => a.z - b.z || a.i - b.i).map(({ slot }) => slot);
  known.set(key, order);
  return order;
}

type Posed = { frame: (id: string) => Affine; point: (id: string) => Point; rest: (id: string) => Point; handle: (h: Handle) => Point };

// Where an attachment puts its art: the matrix from the art's own space (rest
// space, or a joint's own frame, or a bar's), and the point its extra pose
// turns about. A bar's box is bone()'s, for its draw.
type Placing = { matrix: Affine; anchor: Point; box?: (draw: Draw) => { x: number; y: number; width: number; height: number } };
function placing(at: Attachment, posed: Posed): Placing {
  switch (at.kind) {
    case 'joint': {
      const frame = posed.frame(at.to);
      const rest = posed.rest(at.to);
      return at.local ? { matrix: product(frame, translate(rest.x, rest.y)), anchor: { x: 0, y: 0 } } : { matrix: frame, anchor: rest };
    }
    case 'bone': {
      const [from, to, wasFrom, wasTo] = [posed.point(at.from), posed.point(at.to), posed.rest(at.from), posed.rest(at.to)];
      return { matrix: product(translate(from.x, from.y), rotate(direction(from, to) - direction(wasFrom, wasTo)), translate(-wasFrom.x, -wasFrom.y)), anchor: wasFrom };
    }
    case 'span': {
      // Worked in the rest space of the joint it hangs from, as a part drawn
      // in that joint's group is, so whatever that frame does (a breath)
      // does the same to it.
      const on = typeof at.from === 'string' ? at.from : at.from.on;
      const base = posed.frame(on);
      const from = typeof at.from === 'string' ? posed.rest(at.from) : at.from.at;
      const to = applied(inverse(base), posed.handle(at.to));
      const held = at.fixed ?? 0;
      const stretch = (apart(from, to) - held) / (apart(at.art.from, at.art.to) - held);
      const matrix = product(
        base, translate(from.x, from.y), rotate(direction(from, to)), translate(held, 0), scale(stretch, 1), translate(-held, 0),
        rotate(-direction(at.art.from, at.art.to)), translate(-at.art.from.x, -at.art.from.y),
      );
      return { matrix, anchor: at.art.from };
    }
    case 'bar': {
      const [from, to] = [posed.point(at.from), posed.point(at.to)];
      const box = (draw: Draw) => {
        const { x, y, width, height } = bone(from, to, at.thick, !!draw.flush, at.anchors);
        return { x, y, width, height };
      };
      return { matrix: product(translate(from.x, from.y), rotate(direction(from, to))), anchor: { x: 0, y: 0 }, box };
    }
  }
}

// A piece's art by variant, a bar's with no box of its own.
const artOf = (piece: Piece): readonly [string, { src: string; fur?: string; box?: { x: number; y: number; width: number; height: number } }][] => Object.entries(piece.art);

// One draw of a piece: every variant of it, the one not shown unseen.
function paints(piece: Piece, draw: Draw, show: string | false | undefined, place: Placing, leg: boolean): PieceLayer[] {
  const variants = artOf(piece);
  const shown = show === false ? null : show ?? variants[0][0];
  if (shown !== null && !variants.some(([k]) => k === shown)) throw new Error(`skeleton: ${piece.id} has no ${shown}`);
  return variants.map(([key, art]) => {
    const src = draw.fur ? art.fur : art.src;
    const box = place.box?.(draw) ?? art.box;
    if (src === undefined) throw new Error(`skeleton: ${piece.id} (${key}) has no fur`);
    if (!box) throw new Error(`skeleton: ${piece.id} (${key}) has no box`);
    const seen = key === shown;
    const look = piece.hide === 'opacity' ? { opacity: seen ? 1 : 0 } : { hidden: !seen };
    const id = variants.length > 1 ? `${draw.id} (${key})` : draw.id;
    return {
      kind: 'piece', id, name: draw.part ?? draw.id, src, box, aspect: piece.at.kind === 'bar' ? 'none' : 'default', matrix: place.matrix,
      far: piece.side === 'far' || undefined, ...look, ...(leg ? { leg } : {}),
    };
  });
}

const corners = (l: PieceLayer): Point[] => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => applied(l.matrix, { x: l.box.x + u * l.box.width, y: l.box.y + v * l.box.height }));
const seenLayer = (l: PieceLayer) => !l.hidden && l.opacity !== 0;

// Each bone coded within its part: along a limb by the joint it leaves (L2B1
// from L2J1), elsewhere in turn.
function posedBones(skeleton: Skeleton, point: (id: string) => Point): PosedBone[] {
  const roleOf = (id: string): Role => {
    const joint = skeleton.joints.find((j) => j.id === id);
    if (!joint) throw new Error(`skeleton: no joint ${id}`);
    return joint.role;
  };
  const groupOf = (id: string) => codeOf(roleOf(id)).replace(/J\d+$/, '');
  return skeleton.bones.map((b, i) => {
    const group = groupOf(b.from);
    const role = roleOf(b.from);
    const k = role.part === 'limb' ? role.index : skeleton.bones.slice(0, i).filter((o) => groupOf(o.from) === group).length;
    const far = farRole(role) && farRole(roleOf(b.to));
    return { code: `${group}B${k}`, name: b.name, from: b.from, to: b.to, far, length: apart(point(b.from), point(b.to)), ...(b.stretch ? { stretch: b.stretch } : {}) };
  });
}

// The animal drawn as `poseAt` has it at `now` (and, for a trailing joint,
// a moment before).
export function compose(body: Body, poseAt: (now: number) => PoseSpec, now: number, seed = 0): RigPose {
  const { skeleton } = body;
  const pose = poseAt(now);
  const rest = restOf(skeleton);
  const { world, carried } = frames(skeleton, pose, trailing(skeleton, poseAt, now));
  const restAt = (id: string) => {
    const p = rest.points.get(id);
    if (!p) throw new Error(`skeleton: no joint ${id}`);
    return p;
  };
  const on = (frameOf: (id: string) => Affine | undefined) => (h: Handle): Point => {
    const [id, at] = typeof h === 'string' ? [h, restAt(h)] : [h.on, h.at];
    const m = frameOf(id);
    if (!m) throw new Error(`skeleton: nothing places ${id} yet`);
    return applied(m, at);
  };
  const authored = on((id) => world.get(id));
  const limbs = skeleton.limbs.map((limb) => {
    const root = authored(limb.joints.root);
    const stood = rest.limbs.get(limb.id);
    if (!stood) throw new Error(`skeleton: ${limb.id} never stood`);
    const goal = pose.limbs[limb.id] ?? { kind: 'plant', at: { x: root.x + limb.leg.reach, y: limb.ground } };
    const limbNow = solveLimb(limb, root, goal, authored);
    return { limb, now: limbNow, points: ownedPoints(skeleton, limb, stood, limbNow), frames: ownedFrames(skeleton, limb, stood, limbNow) };
  });
  const frameMap = new Map([...world, ...limbs.flatMap((l) => [...l.frames])]);
  const pointMap = new Map([...[...world].map(([id, m]): [string, Point] => [id, applied(m, restAt(id))]), ...limbs.flatMap((l) => [...l.points])]);
  const found = <T>(map: ReadonlyMap<string, T>) => (id: string): T => {
    const had = map.get(id);
    if (had === undefined) throw new Error(`skeleton: no joint ${id}`);
    return had;
  };
  const posed: Posed = { frame: found(frameMap), point: found(pointMap), rest: restAt, handle: on((id) => frameMap.get(id)) };
  // Where each joint would be with no squash anywhere above it: what a
  // bone's length is measured between (a limb's own joints are posed from
  // its root, which never takes one).
  const unsquashed = found(new Map([...[...carried].map(([id, m]): [string, Point] => [id, applied(m, restAt(id))]), ...limbs.flatMap((l) => [...l.points])]));

  const placings = body.pieces.map((piece) => {
    const place = placing(piece.at, posed);
    const extra = piece.extra?.(now, seed);
    return extra ? { ...place, matrix: product(place.matrix, local({ at: place.anchor }, extra)) } : place;
  });
  // A limb's pieces: those hung on its joints.
  const limbJoints = new Set(skeleton.limbs.flatMap(({ joints }) => Object.values(joints)));
  const onLimb = (at: Attachment) => limbJoints.has(at.kind === 'joint' ? at.to : typeof at.from === 'string' ? at.from : at.from.on);
  const painted = orderOf(body, pose.z).map((slot): { piece?: Piece; layers: readonly Layer[] } => {
    if ('shape' in slot) {
      const shape = (body.shapes ?? [])[slot.shape];
      const frame: Layer = { kind: 'frame', id: shape.id, matrix: posed.frame(shape.on), layers: pose.shapes?.[shape.id] ?? [] };
      return { layers: [frame] };
    }
    const p = body.pieces[slot.piece];
    return { piece: p, layers: paints(p, p.draws[slot.draw], pose.show[p.id], placings[slot.piece], onLimb(p.at)) };
  });
  const layers = painted.flatMap((p) => p.layers);

  const joints: PosedJoint[] = skeleton.joints.map((j) => ({
    id: j.id, code: codeOf(j.role), name: j.name, at: posed.point(j.id), derived: !!j.derived, far: farRole(j.role), parent: j.parent,
    angle: pose.joints[j.id]?.angle ?? 0, ...(j.limits ? { limits: j.limits } : {}),
  }));
  // How low a limb's foot reaches: its foot's pictures as seen, or the foot
  // itself where nothing is hung on it.
  const posedLimbs: PosedLimb[] = limbs.map(({ limb, now: l }) => {
    const feet = [limb.joints.end, ...(limb.joints.tip ? [limb.joints.tip] : [])];
    const onFoot = painted.flatMap(({ piece, layers: drawn }) => (piece?.at.kind === 'joint' && feet.includes(piece.at.to) ? drawn.flatMap((l) => (l.kind === 'piece' && seenLayer(l) ? [l] : [])) : []));
    const sole = onFoot.length ? Math.max(...onFoot.flatMap(corners).map((c) => c.y)) : l.foot.y;
    return { id: limb.id, code: `L${2 * limb.pair + sideCode(limb.side)}`, limb: l, fore: limb.pair === 0, sole };
  });
  return {
    ...body.frame,
    layers,
    guides: [{ name: 'stands here', at: body.frame.anchor }, ...(body.guides?.map((g) => ({ name: g.name, at: posed.handle(g.at) })) ?? joints.map((j) => ({ name: j.name, at: j.at })))],
    skeleton: { joints, bones: posedBones(skeleton, unsquashed), limbs: posedLimbs },
  };
}
