// What every animal's rig must do, whatever it is: the laws each one is
// held to over the moments the lab shows it in, so a new animal is
// registered rather than given its own copy of each check. A law returns
// what breaks it, each a line saying where; none when it holds.
import type { Point } from '../../pointer';
import type { Limb } from '../gait';
import { piecesOf, type DrawnLeg, type RigPose } from '../rig';
import { flatLayers, pageReach, rigBounds, solesOf } from '../test-rig';
import { kneeAngle, pawAngle } from './hinge';
import { planDiff, type Plan, type PlanDraw } from './plan';

// The box placement allows (rig critters' `box`), in page pixels.
type Size = { width: number; height: number; down?: number };
// One moment: what it was doing, whether it walks in that mode (so the page
// moves it on by `walked`), and the pose drawn and its plan.
export type Seen = { mode: string; still: boolean; now: number; walked: number; walking: boolean; pose: RigPose; plan: Plan; box: Size };
// Its moments as the lab plays them, and with motion reduced.
export type Watched = { moving: readonly Seen[]; still: readonly Seen[] };
export type Law = (watched: Watched) => string[];

const EPSILON = 1e-6;
const where = (s: Seen) => `${s.mode} at ${s.now}${s.still ? ', motion reduced' : ''}`;
const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
// Each leg as posed, in the order legsOf and solesOf list them, and whether
// it stands on its toes, a bone rising from them to the hock or wrist.
type Leg = { limb: Limb; toes: boolean };
const drawnLegs = (pose: RigPose): DrawnLeg[] => flatLayers(pose.layers).flatMap((l) => (l.kind === 'legs' && !l.fur ? [...l.legs] : []));
const legsIn = (pose: RigPose): Leg[] => (pose.skeleton
  ? pose.skeleton.limbs.map(({ limb }) => ({ limb, toes: length(limb.ankle, limb.foot) > EPSILON }))
  : drawnLegs(pose).map(({ limb, art }) => ({ limb, toes: art.knee && length(limb.ankle, limb.foot) > EPSILON })));
const downIn = (s: Seen) => solesOf(s.pose).map((y) => y >= s.pose.anchor.y - EPSILON);
// The moments of one mode in turn, each with the one before it.
const pairs = (seen: readonly Seen[]) => seen.slice(1).flatMap((s, i) => (seen[i].mode === s.mode ? [[seen[i], s] as const] : []));
const shown = (d: PlanDraw) => d.visible && d.opacity > 0;

// Each bone keeps its length, from the first moment it is drawn: on a
// skeleton, every bone not declaring a stretch (one that does stays within
// it); otherwise each leg piece. A skeleton's bones are measured with the
// squashes of the joints above them taken out: a breath squashes everything
// hung from the body, the tail's bones with it, but it is not a stretch,
// and a bone should not have to declare one to breathe; nor is a wing seen
// edge-on, foreshortened, shorter. Only a bone that stretches in its own
// right (a neck span) declares it.
const bonesKeepLength: Law = ({ moving }) => {
  const first = new Map<string, number>();
  const broken = new Map<string, string>();
  const keep = (key: string, now: number, s: Seen, stretch?: { min: number; max: number }) => {
    const was = first.get(key);
    if (was === undefined) first.set(key, now);
    const out = stretch ? now < stretch.min - EPSILON || now > stretch.max + EPSILON : was !== undefined && Math.abs(now - was) > EPSILON;
    if (out && !broken.has(key)) broken.set(key, `${key}: ${(was ?? now).toFixed(4)} then ${now.toFixed(4)} ${where(s)}`);
  };
  moving.forEach((s) => {
    if (s.pose.skeleton) return s.pose.skeleton.bones.forEach((b) => keep(`${b.code} (${b.name})`, b.length, s, b.stretch));
    drawnLegs(s.pose).forEach((leg, i) => piecesOf(leg).forEach((p, k) => keep(`leg ${i} piece ${k} (${p.src.split('/').pop()})`, length(p.from, p.to), s)));
  });
  return [...broken.values()];
};

// Every joint with limits keeps its turn within them.
const limitsHold: Law = ({ moving, still }) => [...moving, ...still].flatMap((s) => (s.pose.skeleton?.joints ?? []).flatMap((j) => {
  if (!j.limits || (j.angle >= j.limits.min && j.angle <= j.limits.max)) return [];
  return [`${j.code} (${j.name}) turned ${j.angle.toFixed(2)} ${where(s)}`];
}));

// Every leg bent at hinges keeps its knee and its paw within their limits
// (types.ts's HingedLeg), whatever its toes are doing.
const hingesHold: Law = ({ moving, still }) => [...moving, ...still].flatMap((s) => (s.pose.skeleton?.limbs ?? []).flatMap(({ code, limb, hinges }) => {
  if (!hinges) return [];
  const knee = kneeAngle(limb, hinges.side);
  const paw = pawAngle(limb, hinges.toes);
  // A turn is the same turn a whole turn round, so it is read within a
  // turn of its least.
  const out = (turn: number, limits: { min: number; max: number }) => {
    const read = limits.min + ((((turn - limits.min) % 360) + 360) % 360);
    return read > limits.max + EPSILON && read < limits.min + 360 - EPSILON;
  };
  return [
    ...(out(knee, hinges.knee) ? [`${code} knee at ${knee.toFixed(2)} ${where(s)}`] : []),
    ...(out(paw, hinges.paw) ? [`${code} paw at ${paw.toFixed(2)} from its shin ${where(s)}`] : []),
  ];
}));

// A foot down and flat in two moments running stays where it is on the
// ledge, which moves back under the animal by how far it has walked.
const plantedFeetHold: Law = ({ moving }) => pairs(moving).flatMap(([a, b]) => {
  const [was, now] = [legsIn(a.pose), legsIn(b.pose)];
  if (was.length !== now.length) return [];
  const [downA, downB] = [downIn(a), downIn(b)];
  const ground = (s: Seen, p: Point) => p.x + (s.walking ? s.walked / s.pose.scale : 0);
  return now.flatMap((leg, i) => {
    const before = was[i];
    if (!downA[i] || !downB[i] || leg.limb.paw !== 0 || before.limb.paw !== 0) return [];
    const slid = Math.hypot(ground(b, leg.limb.foot) - ground(a, before.limb.foot), leg.limb.foot.y - before.limb.foot.y);
    return slid > EPSILON ? [`leg ${i} slides ${slid.toFixed(4)} ${where(b)}`] : [];
  });
});

// A planted foot on its toes (a bone up from them to the hock or wrist)
// has that joint behind the toes and not below them.
const anklesBehindToes: Law = ({ moving }) => moving.flatMap((s) => {
  const down = downIn(s);
  return legsIn(s.pose).flatMap(({ limb, toes }, i) => {
    if (!toes || !down[i]) return [];
    const behind = limb.ankle.x < limb.foot.x && limb.ankle.y <= limb.foot.y + EPSILON;
    return behind ? [] : [`leg ${i} ankle at (${limb.ankle.x.toFixed(2)}, ${limb.ankle.y.toFixed(2)}), toes at (${limb.foot.x.toFixed(2)}, ${limb.foot.y.toFixed(2)}) ${where(s)}`];
  });
});

// No foot reaches into the ledge (or, for a flier, past what its box
// allows below its anchor).
const noFootBelowLedge: Law = ({ moving }) => moving.flatMap((s) => {
  const lowest = Math.max(-Infinity, ...solesOf(s.pose));
  const floor = s.pose.anchor.y + (s.box.down ?? 0) / s.pose.scale;
  return lowest > floor + EPSILON ? [`a foot ${(lowest - floor).toFixed(4)} below the ledge ${where(s)}`] : [];
});

// The drawing stays inside the footprint placement allows it. Only as the
// lab plays it: with motion reduced the page shows another pose than the
// lab's mode (every rabbit sits), and places it by that one's footprint.
const footprintsHold: Law = ({ moving }) => moving.flatMap((s) => {
  const reach = pageReach(s.pose);
  const below = (rigBounds(s.pose).bottom - s.pose.anchor.y) * s.pose.scale;
  const over = [
    ['left', reach.left - s.box.width / 2], ['right', reach.right - s.box.width / 2],
    ['top', reach.top - s.box.height], ['bottom', below - (s.box.down ?? 0)],
  ] as const;
  return over.flatMap(([side, by]) => (by > EPSILON ? [`${side} ${by.toFixed(3)}px over ${where(s)}`] : []));
});

// Every picture it mounts is seen in some moment.
const everyPieceDrawn: Law = ({ moving, still }) => {
  const all = [...moving, ...still].flatMap((s) => s.plan.draws);
  const images = (draws: readonly PlanDraw[]) => new Set(draws.flatMap((d) => (d.kind === 'image' ? [d.href] : [])));
  const seen = images(all.filter(shown));
  return [...images(all)].filter((href) => !seen.has(href)).map((href) => `${href} never seen`);
};

// Two pictures drawn one after the other in the same place are one part's
// variants (a wing's upper side and its underside): never both seen.
const oneVariantShows: Law = ({ moving, still }) => [...moving, ...still].flatMap((s) => s.plan.draws.flatMap((d, i) => {
  const next = s.plan.draws[i + 1];
  if (d.kind !== 'image' || next?.kind !== 'image' || d.href === next.href) return [];
  if (planDiff(d.place, next.place, 1e-9).length) return [];
  return shown(d) && shown(next) ? [`${d.href} and ${next.href} both seen ${where(s)}`] : [];
}));

// What is on the far side is drawn before the body (its largest near
// picture), which hides where it joins.
const farBeforeBody: Law = ({ moving, still }) => [...moving, ...still].flatMap((s) => {
  const area = (d: PlanDraw) => (d.kind === 'image' && d.far === 0 && shown(d) ? Math.abs(d.place[0] * d.place[3] - d.place[1] * d.place[2]) : 0);
  const body = s.plan.draws.reduce((best, d, i) => (area(d) > area(s.plan.draws[best]) ? i : best), 0);
  const late = s.plan.draws.findIndex((d, i) => i > body && d.far > 0 && shown(d));
  if (late < 0) return [];
  const name = (d: PlanDraw) => (d.kind === 'image' ? d.href.split('/').pop() : d.kind);
  return [`far ${name(s.plan.draws[late])} after the body ${name(s.plan.draws[body])} ${where(s)}`];
});

// With motion reduced it holds one pose in each mode and never blinks.
const stillHolds: Law = ({ still }) => [...new Set(still.map((s) => s.mode))].flatMap((mode) => {
  const all = still.filter((s) => s.mode === mode);
  const blink = all.find((s) => s.plan.draws.some((d) => d.kind !== 'image' && 'data-lid' in d.data));
  const moved = all.find((s) => planDiff(all[0].plan, s.plan).length > 0);
  return [...(blink ? [`blinks ${where(blink)}`] : []), ...(moved ? [`moves ${where(moved)}`] : [])];
});

export const LAWS = { bonesKeepLength, limitsHold, hingesHold, plantedFeetHold, anklesBehindToes, noFootBelowLedge, footprintsHold, everyPieceDrawn, oneVariantShows, farBeforeBody, stillHolds } as const satisfies Record<string, Law>;
export type LawName = keyof typeof LAWS;
