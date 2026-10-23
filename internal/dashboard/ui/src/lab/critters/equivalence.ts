// An animal moved onto a skeleton must draw what its old rig drew: the same
// rendered plan, numbers to 1e-6, in every moment the lab shows each of its
// modes in, held still, and with its head turned as far as it goes either
// way. Its old rig is kept beside it (its *-legacy.ts) until its last
// planned change, only for this.
import { planDiff, planOf, type Plan } from '../../lib/theme/rig/skeleton/plan';
import { momentsOf, type RigCritter } from './critter';

type Pose = RigCritter['pose'];

// How far its head turns toward a cursor, at most each way, over cursors
// all round it, near and far, facing either way.
export function gazeExtremes(rig: RigCritter): number[] {
  const gaze = rig.gaze;
  if (!gaze) return [];
  const turns = ([1, -1] as const).flatMap((dir) => [20, 40, 80, 120].flatMap((r) => Array.from({ length: 72 }, (_, i) => {
    const a = (i * 5 * Math.PI) / 180;
    return gaze(dir, { x: r * Math.cos(a), y: r * Math.sin(a) });
  })));
  return [Math.min(...turns), Math.max(...turns)];
}

// Where the new rig draws otherwise than the old, the first `limit` of
// them, each saying when; `except` takes out of both what a fix since has
// meant to change (a turned head), so all the rest must still match.
export function unlike(rig: RigCritter, legacy: Pose, limit = 10, except: (plan: Plan) => Plan = (plan) => plan): string[] {
  const looks = [{ gaze: 0, still: false }, { gaze: 0, still: true }, ...gazeExtremes(rig).map((gaze) => ({ gaze, still: false }))];
  return momentsOf(rig).flatMap((at) => looks.map((look) => ({ at, look }))).reduce<string[]>((found, { at, look }) => {
    if (found.length >= limit) return found;
    const when = `${at.mode} at ${at.now}, gaze ${look.gaze.toFixed(2)}${look.still ? ', still' : ''}`;
    return [...found, ...planDiff(except(planOf(rig.pose(at, look))), except(planOf(legacy(at, look))), 1e-6, when)].slice(0, limit);
  }, []);
}
