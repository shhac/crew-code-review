// What an animal draws, held to account without its old rig beside it: a
// digest of the rendered plan (rig/skeleton/plan.ts) of every moment the
// lab shows each of its modes in, held still, and with its head turned as
// far as it goes either way, its numbers rounded so that float noise never
// moves it. The moments are hashed ten at a time, so a change says which
// it touched. digest.test.ts holds every rig to the digests committed in
// digests.json; UPDATE_DIGESTS=1 writes them afresh once a change is meant.
import { planOf } from '../../lib/theme/rig/skeleton/plan';
import { momentsOf, type Moment, type RigCritter } from './critter';

// Moments to a hash: a run of them, as momentsOf lists a mode's.
export const RUN = 10;
const PLACES = 1e4;

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

const rounded = (_key: string, v: unknown) => (typeof v === 'number' ? Math.round(v * PLACES) / PLACES + 0 : v);

// FNV-1a, 32 bits, as eight hex digits.
function hashOf(text: string): string {
  const h = Array.from(text).reduce((acc, ch) => Math.imul(acc ^ ch.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);
  return h.toString(16).padStart(8, '0');
}

// One moment's plans, in every look the lab can give it.
function seen(rig: RigCritter, at: Moment): string {
  const looks = [{ gaze: 0, still: false }, { gaze: 0, still: true }, ...gazeExtremes(rig).map((gaze) => ({ gaze, still: false }))];
  return looks.map((look) => JSON.stringify(planOf(rig.pose(at, look)), rounded)).join('\n');
}

// Each mode's runs of moments, hashed.
export type Digest = Readonly<Record<string, readonly string[]>>;
export function digestOf(rig: RigCritter): Digest {
  const moments = momentsOf(rig);
  return Object.fromEntries(rig.modes.map((mode) => {
    const own = moments.filter((m) => m.mode === mode);
    const runs = Array.from({ length: Math.ceil(own.length / RUN) }, (_, k) => own.slice(k * RUN, (k + 1) * RUN));
    return [mode, runs.map((run) => hashOf(run.map((at) => seen(rig, at)).join('\n\n')))];
  }));
}

// Where a digest differs from the one it was: each mode's runs that
// changed, by the times (ms) the lab shows them at.
export function changed(rig: RigCritter, was: Digest | undefined, now: Digest): string[] {
  const moments = momentsOf(rig);
  return Object.entries(now).flatMap(([mode, runs]) => {
    const before = was?.[mode];
    if (!before) return [`${rig.name} ${mode}: no digest yet`];
    const own = moments.filter((m) => m.mode === mode);
    return runs.flatMap((hash, k) => {
      if (hash === before[k]) return [];
      const [first, last] = [own[k * RUN], own[Math.min(own.length, (k + 1) * RUN) - 1]];
      return [`${rig.name} ${mode}: ${first.now} to ${last.now}ms drawn otherwise`];
    });
  });
}
