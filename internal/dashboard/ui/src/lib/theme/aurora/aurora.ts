import { hash } from '../seed';
import type { SkySize } from '../sky';

// The northern lights in the rail's sky: three curtains, each a rippling
// lower edge with rays fading upward, coloured from one slow cycle. Kept
// deliberately calm: everything changes over many seconds, nothing jumps,
// and no curtain is ever more than PEAK opaque.

export type Rgb = readonly [number, number, number];
// Green, teal, violet, and round again.
const STOPS: readonly Rgb[] = [[111, 245, 176], [95, 224, 224], [180, 140, 255]];
const CYCLE = 48000;
// Reduced motion holds every aurora colour at this moment.
export const STILL = 0;
export const PEAK = 0.45;

// The cycle's colour at now, eased between stops. A pure function of time, so
// the shelf's sky and the page's frost agree without talking to each other.
export function auroraRgb(now: number): Rgb {
  const t = ((now / CYCLE) % 1 + 1) % 1 * STOPS.length;
  const i = Math.floor(t);
  const a = STOPS[i], b = STOPS[(i + 1) % STOPS.length];
  return mixRgb(a, b, (1 - Math.cos(Math.PI * (t - i))) / 2);
}

// k of the way from a to b, channel by channel.
export function mixRgb(a: Rgb, b: Rgb, k: number): Rgb {
  const mix = (c: 0 | 1 | 2) => Math.round(a[c] + (b[c] - a[c]) * k);
  return [mix(0), mix(1), mix(2)];
}

export const rgb = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

export type Curtain = { d: string; colour: string; opacity: number };

// Each curtain's shape and pace: where its lower edge hangs (as a share of
// the sky's height), how tall its rays are, how far it ripples, and how fast.
const CURTAINS = [
  { base: 0.5, rays: 0.42, ripple: 9, wave: 150, drift: 9000, breathe: 9000, phase: 0 },
  { base: 0.64, rays: 0.36, ripple: 7, wave: 110, drift: 13000, breathe: 13000, phase: 2.1 },
  { base: 0.78, rays: 0.3, ripple: 6, wave: 190, drift: 17000, breathe: 17000, phase: 4.2 },
];
const STEP = 6;

// A sky too small to hold the curtains gets none.
export const roomy = (sky: SkySize) => sky.width >= 120 && sky.height >= 60;

export function curtains(sky: SkySize, now: number): Curtain[] {
  const xs = Array.from({ length: Math.ceil(sky.width / STEP) + 1 }, (_, i) => Math.min(sky.width, i * STEP));
  return CURTAINS.map((c, n) => {
    const swing = (2 * Math.PI * now) / c.drift + c.phase;
    const edge = (x: number) => sky.height * c.base + c.ripple * (Math.sin((2 * Math.PI * x) / c.wave + swing) + 0.4 * Math.sin((2 * Math.PI * x) / (c.wave * 0.45) - swing * 1.3));
    // The rays' tops wave less than the edge, which reads as folds.
    const top = (x: number) => edge(x) - sky.height * c.rays * (0.85 + 0.15 * Math.sin((2 * Math.PI * x) / (c.wave * 0.7) + swing * 0.6));
    const lower = xs.map((x) => `${x.toFixed(1)} ${edge(x).toFixed(1)}`);
    const upper = [...xs].reverse().map((x) => `${x.toFixed(1)} ${Math.max(0, top(x)).toFixed(1)}`);
    const opacity = PEAK * (0.6 + 0.4 * Math.sin((2 * Math.PI * now) / c.breathe + c.phase));
    return { d: `M${lower.join('L')}L${upper.join('L')}Z`, colour: rgb(auroraRgb(now + (n * CYCLE) / 9)), opacity };
  });
}

// The rays inside the curtains: seeded stripes, each shimmering on its own
// slow beat, so they never line up into a regular pattern.
export type Ray = { x: number; width: number; opacity: number };
const RAY_SPACING = 5;

export function rays(sky: SkySize, now: number): Ray[] {
  return Array.from({ length: Math.ceil(sky.width / RAY_SPACING) }, (_, i) => {
    const seed = i * 7.31;
    const beat = 4000 + 7000 * hash(seed + 1);
    const glow = 0.5 + 0.5 * Math.sin((2 * Math.PI * now) / beat + 6.3 * hash(seed + 2));
    return { x: RAY_SPACING * (i + hash(seed)), width: 1.2 + 2.6 * hash(seed + 3), opacity: 0.25 + 0.75 * glow * hash(seed + 4) };
  });
}
