// What the critters lab needs to know to show an animal. Each animal is one
// of these in its own module, listed in registry.ts; the lab reads nothing
// else about it. Its modes are the lab's labels for what it can be seen
// doing, the ones the page's address names.
import type { Component } from 'svelte';
import type { Point } from '../../lib/theme/pointer';
import type { RigPose } from '../../lib/theme/rig/rig';
import type { Drawing } from '../drawings';
import type { BoneNames, Placed } from '../skeleton';

// One frame of it: what it is doing, the time, and how far it has walked.
export type Moment = { mode: string; now: number; walked: number };
type Look = { gaze: number; still: boolean };
// A footprint's box, standing on its anchor; a flier's also reaches `down`
// below it.
type Size = { width: number; height: number; down?: number };
type Art = { name: string; src: string };

type Shown = {
  name: string;
  modes: readonly string[];
  // Its own walking speed in px/s, where the lab's speed dial starts.
  speed: number;
  // The modes it walks in, its stride following the time.
  walking: readonly string[];
  // Its pace in a mode, given the dial's speed, when that differs (a hurry).
  pace?: (mode: string, speed: number) => number;
  // How far (px) it has walked `now` ms into a walking mode it does not
  // walk at a steady pace (a feeding wasp's shuffles, out and back), the
  // dial aside; undefined in the rest.
  walks?: (mode: string, now: number) => number | undefined;
  // Codes its skeleton's joints and bones had before (an old link's
  // &joint= or &bone=, one without &codes=), by the codes they have now. A
  // code can mean another joint now (the hedgehog's J1 was its foot, and is
  // its elbow), so only an old link is read through them.
  aliases?: Readonly<Record<string, string>>;
  // What a link the lab writes now calls its codes (&codes=), where its
  // codes have moved since links said `role` (an insect's, since its coxa
  // became a bone); and for a link naming an earlier one, the codes its
  // joints and bones had then, by the codes they have now.
  codes?: { now: string; before: Readonly<Record<string, Readonly<Record<string, string>>>> };
};

// Drawn from parts by a rig (lib/theme/rig): the lab draws its RigPose, and
// finds the layers to list, hide and show apart in it.
export type RigCritter = Shown & {
  kind: 'rig';
  pose: (at: Moment, look: Look) => RigPose;
  // The box placement allows it on the page, which may change as it moves.
  box: (at: Moment) => Size;
  // A flier hovers this far (page px) above the stage's floor, its anchor
  // in the air rather than on the ledge; one that both stands and flies
  // (a bird) says so mode by mode.
  lift?: number | ((mode: string) => number);
  // How far its head would turn toward the cursor, standing at the stage's
  // anchor; one without it does not look.
  gaze?: (dir: 1 | -1, cursor: Point | null) => number;
  drawings?: Record<string, Drawing>;
  // What its bones are, for the lab's skeleton view.
  bones?: BoneNames;
};

// The props a ViewCritter's view takes. `marked` is the big one on the stage,
// which carries data-critter for tests.
type ViewProps = {
  mode: string;
  now: number;
  walked: number;
  dir: 1 | -1;
  playing: boolean;
  still: boolean;
  guides: boolean;
  separate: boolean;
  hidden: string[];
  marked?: boolean;
  // Its skeleton as drawn now, which the view hands back (bound) for the
  // lab to draw; none where it has no joints to show.
  bones?: Placed | null;
};

// Drawn its own way, by a component standing it on the lab's anchor, which
// cannot be taken apart from outside, so it names its own layers and art.
export type ViewCritter = Shown & {
  kind: 'view';
  View: Component<ViewProps>;
  parts: readonly string[];
  art: readonly Art[];
  // Where its parts are seen apart in a mode: one by one under the stage,
  // pulled apart on it by the view itself, or not at all.
  apart: (mode: string) => 'pieces' | 'stage' | null;
};

export type Critter = RigCritter | ViewCritter;

export const paceOf = (critter: Critter, mode: string, speed: number): number => critter.pace?.(mode, speed) ?? speed;

// How far it has walked `now` ms into a mode at the dial's speed.
export const walkedIn = (critter: Critter, mode: string, now: number, speed: number): number =>
  (critter.walking.includes(mode) ? critter.walks?.(mode, now) ?? (paceOf(critter, mode, speed) * now) / 1000 : 0);

export const gazeOf = (critter: Critter, dir: 1 | -1, cursor: Point | null): number => {
  if (critter.kind !== 'rig' || !critter.gaze) return 0;
  return critter.gaze(dir, cursor);
};

export const liftOf = (rig: RigCritter, mode: string): number => (typeof rig.lift === 'function' ? rig.lift(mode) : rig.lift ?? 0);

export const drawingsOf = (critter: Critter): Record<string, Drawing> => (critter.kind === 'rig' ? critter.drawings : undefined) ?? {};

// The moments over its modes' first few seconds, so a layer seen only now
// and then (an eyelid, mid-blink) is drawn in one of them.
export const momentsOf = (rig: RigCritter): Moment[] => rig.modes.flatMap((mode) =>
  Array.from({ length: 120 }, (_, i) => ({ mode, now: i * 40, walked: rig.walks?.(mode, i * 40) ?? i * 0.5 })));

// Every pose it takes in those moments.
export const posesOf = (rig: RigCritter): RigPose[] => momentsOf(rig).map((at) => rig.pose(at, { gaze: 0, still: false }));

// What a link the lab writes now calls its codes.
export const codesOf = (critter: Critter): string => critter.codes?.now ?? 'role';

// The code a joint or bone has now, for one a link names: one without
// &codes= read through its aliases, one naming earlier codes through
// those.
export const codeNow = (critter: Critter, code: string, codes: string | null = null): string => {
  if (codes === null) return critter.aliases?.[code] ?? code;
  if (codes === codesOf(critter)) return code;
  return critter.codes?.before[codes]?.[code] ?? code;
};
