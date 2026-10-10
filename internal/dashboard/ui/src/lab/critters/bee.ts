import { smooth } from '../../lib/theme/math';
import { ANCHOR, beeRig, collarOf, EYE, GROUND, REACH, REFERENCE, SCALE, type BeePose, type RigBee } from '../../lib/theme/bluebells/bee-rig';
import { gazeFrom } from '../../lib/theme/rig/gaze';
import { dartAt } from '../../lib/theme/rig/insect-flight';
import { turnAbout } from '../../lib/theme/rig/rig';
import bonk from '../bee-pose-bonk.webp';
import crawl from '../bee-pose-crawl.webp';
import fly from '../bee-pose-fly.webp';
import hover from '../bee-pose-hover.webp';
import land from '../bee-pose-land.webp';
import perch from '../bee-pose-perch.webp';
import reference from '../bee-reference.webp';
import type { Drawing } from '../drawings';
import type { Moment, RigCritter } from './critter';

// The bumblebee the insect rig was proved on (rig/wing-blur.ts,
// rig/hexapod.ts, rig/antennae.ts, rig/insect-flight.ts). The lab's labels
// for what she does: her poses, plus a dart there and back and a lift-off
// with the blur fading in, each on a loop to scrub through.
const MODES: { label: string; pose: BeePose }[] = [
  { label: 'perch', pose: 'perch' }, { label: 'crawl', pose: 'crawl' }, { label: 'scurry', pose: 'scurry' },
  { label: 'hover', pose: 'hover' }, { label: 'fly', pose: 'fly' }, { label: 'dart', pose: 'fly' },
  { label: 'lift off', pose: 'land' }, { label: 'land', pose: 'land' }, { label: 'bonk', pose: 'bonk' },
];
// The bonk's knock back off the wall, again every 900ms.
const KNOCK_EVERY = 900;

// The dart: 14px ahead in 300ms, a hover, and back (bees fly backwards as
// readily), round every 1.2s.
const DART = { distance: 14, ms: 300, every: 1200 };
function darting(now: number): { dx: number; speed: number } {
  const t = now % DART.every;
  const leg = Math.floor(t / (DART.every / 4));
  const into = (t - leg * (DART.every / 4)) / DART.ms;
  if (leg === 1) return { dx: DART.distance, speed: 0 };
  if (leg === 3) return { dx: 0, speed: 0 };
  const there = leg === 0;
  const d = dartAt({ x: there ? 0 : DART.distance, y: 0 }, { x: there ? DART.distance : 0, y: 0 }, into, DART.ms);
  return { dx: d.at.x, speed: d.speed };
}

const beeAt = ({ mode, now, walked }: Moment, lean: number): RigBee => {
  const pick = MODES.find((m) => m.label === mode) ?? MODES[0];
  // Flying, the dial's speed is her speed ahead.
  const speed = mode === 'dart' ? darting(now).speed : pick.pose === 'fly' ? walked / Math.max(0.001, now / 1000) : 0;
  const wings = pick.pose === 'perch' || pick.pose === 'crawl' || pick.pose === 'scurry' ? 0 : mode === 'lift off' ? smooth((now % 1500) / 250) : 1;
  return { pose: pick.pose, seed: 1, walked, speed, lean, wings, ...(pick.pose === 'bonk' ? { knocked: now % KNOCK_EVERY } : {}) };
};

// Each key pose laid over the rig collar to collar (the export prints where
// each one's collar is), the rig's own collar placed as the mode pitches it.
// The bonk's drawing is laid over its own mode, the knock back off a wall.
const byCollar = (src: string, width: number, height: number, collar: { x: number; y: number }, mode: string): Drawing => {
  const at = collarOf(beeAt({ mode, now: 0, walked: 0 }, 0));
  return { src, width, height, at: { x: at.x - collar.x, y: at.y - collar.y }, mode };
};
const DRAWINGS: Record<string, Drawing> = {
  standing: { src: reference, ...REFERENCE, at: REFERENCE },
  perch: byCollar(perch, 21.92, 19.92, { x: 13.05, y: 5.57 }, 'perch'),
  crawl: byCollar(crawl, 22.83, 12.58, { x: 14.4, y: 4.08 }, 'crawl'),
  hover: byCollar(hover, 20.58, 15.75, { x: 12.31, y: 4.5 }, 'hover'),
  fly: byCollar(fly, 22.42, 15.92, { x: 13.68, y: 6.84 }, 'fly'),
  land: byCollar(land, 21.67, 16.75, { x: 12.7, y: 7 }, 'land'),
  bonk: byCollar(bonk, 21.67, 19.25, { x: 12.46, y: 7.12 }, 'bonk'),
};

const gaze = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: 15, reach: 120 });

export const bee = {
  kind: 'rig',
  name: 'bee',
  modes: MODES.map((m) => m.label),
  speed: 70,
  walking: ['crawl', 'scurry', 'fly'],
  pace: (mode, speed) => (mode === 'crawl' ? 10 : mode === 'scurry' ? 25 : speed),
  lift: (GROUND - ANCHOR.y) * SCALE,
  pose: (at, { gaze: lean, still }) => {
    const pose = beeRig(beeAt(at, lean), { now: at.now, still });
    if (at.mode !== 'dart' || still) return pose;
    return { ...pose, layers: [{ kind: 'group', turn: turnAbout(0, ANCHOR, darting(at.now).dx, 0), layers: pose.layers }] };
  },
  // Her reach in the mode, centred on her as the lab draws a footprint; a
  // dart's carries her its length ahead.
  box: ({ mode }) => {
    const reach = REACH[(MODES.find((m) => m.label === mode) ?? MODES[0]).pose];
    const ahead = reach.ahead + (mode === 'dart' ? DART.distance : 0);
    return { width: 2 * Math.max(reach.behind, ahead), height: reach.up, down: reach.down };
  },
  gaze: (dir, cursor) => gaze(dir, { x: 0, y: -(GROUND - ANCHOR.y) * SCALE }, cursor),
  drawings: DRAWINGS,
} satisfies RigCritter;
