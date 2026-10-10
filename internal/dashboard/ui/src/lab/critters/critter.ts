// What the critters lab needs to know to show an animal. Each animal is one
// of these in its own module, listed in registry.ts; the lab reads nothing
// else about it. Its modes are the lab's labels for what it can be seen
// doing, the ones the page's address names.
import type { Component } from 'svelte';
import type { Point } from '../../lib/theme/pointer';
import type { RigPose } from '../../lib/theme/rig/rig';
import type { Drawing } from '../drawings';

// One frame of it: what it is doing, the time, and how far it has walked.
export type Moment = { mode: string; now: number; walked: number };
export type Look = { gaze: number; still: boolean };
export type Size = { width: number; height: number };
export type Art = { name: string; src: string };

type Shown = {
  name: string;
  modes: readonly string[];
  // Its own walking speed in px/s, where the lab's speed dial starts.
  speed: number;
  // The modes it walks in, its stride following the time.
  walking: readonly string[];
  // Its pace in a mode, given the dial's speed, when that differs (a hurry).
  pace?: (mode: string, speed: number) => number;
};

// Drawn from parts by a rig (lib/theme/rig): the lab draws its RigPose, and
// finds the layers to list, hide and show apart in it.
export type RigCritter = Shown & {
  kind: 'rig';
  pose: (at: Moment, look: Look) => RigPose;
  // The box placement allows it on the page, which may change as it moves.
  box: (at: Moment) => Size;
  // How far its head would turn toward the cursor, standing at the stage's
  // anchor; one without it does not look.
  gaze?: (dir: 1 | -1, cursor: Point | null) => number;
  drawings?: Record<string, Drawing>;
};

// The props a ViewCritter's view takes. `marked` is the big one on the stage,
// which carries data-critter for tests.
export type ViewProps = {
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

export const gazeOf = (critter: Critter, dir: 1 | -1, cursor: Point | null): number => {
  if (critter.kind !== 'rig' || !critter.gaze) return 0;
  return critter.gaze(dir, cursor);
};

export const drawingsOf = (critter: Critter): Record<string, Drawing> => (critter.kind === 'rig' ? critter.drawings : undefined) ?? {};

// Every pose it takes over its modes' first few seconds, so a layer seen
// only now and then (an eyelid, mid-blink) is among them.
export const posesOf = (rig: RigCritter): RigPose[] => rig.modes.flatMap((mode) =>
  Array.from({ length: 120 }, (_, i) => rig.pose({ mode, now: i * 40, walked: i * 0.5 }, { gaze: 0, still: false })));
