// What every animal's rig must do, whatever it is: the laws each one is
// held to over the moments the lab shows it in, so a new animal is
// registered rather than given its own copy of each check. A law returns
// what breaks it, each a line saying where; none when it holds.
import type { Point } from '../../pointer';
import { piecesOf, type DrawnLeg, type RigPose } from '../rig';
import { flatLayers, pageReach, rigBounds, solesOf } from '../test-rig';
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
const legsIn = (pose: RigPose): DrawnLeg[] => flatLayers(pose.layers).flatMap((l) => (l.kind === 'legs' && !l.fur ? [...l.legs] : []));
const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const downIn = (s: Seen) => solesOf(s.pose).map((y) => y >= s.pose.anchor.y - EPSILON);
// The moments of one mode in turn, each with the one before it.
const pairs = (seen: readonly Seen[]) => seen.slice(1).flatMap((s, i) => (seen[i].mode === s.mode ? [[seen[i], s] as const] : []));
const shown = (d: PlanDraw) => d.visible && d.opacity > 0;

// Each leg piece keeps its length (no bone declares a stretch yet), from
// the first moment it is drawn.
const bonesKeepLength: Law = ({ moving }) => {
  const first = new Map<string, number>();
  const broken = new Map<string, string>();
  moving.forEach((s) => legsIn(s.pose).forEach((leg, i) => piecesOf(leg).forEach((p, k) => {
    const key = `leg ${i} piece ${k} (${p.src.split('/').pop()})`;
    const now = length(p.from, p.to);
    const was = first.get(key);
    if (was === undefined) first.set(key, now);
    else if (Math.abs(now - was) > EPSILON && !broken.has(key)) broken.set(key, `${key}: ${was.toFixed(4)} then ${now.toFixed(4)} ${where(s)}`);
  })));
  return [...broken.values()];
};

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
  return legsIn(s.pose).flatMap(({ limb, art }, i) => {
    const toes = art.knee && length(limb.ankle, limb.foot) > EPSILON;
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

export const LAWS = { bonesKeepLength, plantedFeetHold, anklesBehindToes, noFootBelowLedge, footprintsHold, everyPieceDrawn, oneVariantShows, farBeforeBody, stillHolds } as const satisfies Record<string, Law>;
export type LawName = keyof typeof LAWS;
