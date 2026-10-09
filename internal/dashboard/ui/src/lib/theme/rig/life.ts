import { hash } from '../seed';

// The small signs of life an animal shows whatever it is doing, worked out
// from its seed and the time alone, so nothing needs storing per frame.

const WINDOW = 4000;
const BLINK = 140;
// Where in each window the blink lands: never so late that the next
// window's blink could follow within a second and a half.
const LATEST = 2500;

// Whether the eye is shut at this moment: one blink in each 4s window, at a
// seeded point in it, so blinks come 1.5 to 6.5s apart; now and then two.
export function blinking(seed: number, now: number): boolean {
  const n = Math.floor(now / WINDOW);
  const at = now - n * WINDOW - hash(seed * 7919 + n) * LATEST;
  const twice = hash(seed * 104729 + n) < 0.2;
  return (at >= 0 && at < BLINK) || (twice && at >= 2.2 * BLINK && at < 3.2 * BLINK);
}

// How far into a breath, 0 (out) to 1 (in), smooth either way.
export const breath = (seed: number, now: number, period: number) =>
  0.5 - 0.5 * Math.cos((2 * Math.PI * now) / period + hash(seed) * 2 * Math.PI);

// A sniffing nose's quick snuffles, in degrees: a short burst at a seeded
// moment in each 1.8s, still in between, easing in and out so the head
// never jumps.
const SNUFFLE_EVERY = 1800;
const SNUFFLE = 420;
export function snuffle(seed: number, now: number): number {
  const n = Math.floor(now / SNUFFLE_EVERY);
  const t = (now - n * SNUFFLE_EVERY - hash(seed * 31 + n) * (SNUFFLE_EVERY - SNUFFLE)) / SNUFFLE;
  if (t < 0 || t > 1) return 0;
  return 1.4 * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * 3 * t);
}

// Eases a value toward its target over about `ms`, whatever the frame rate.
export const easeTo = (current: number, target: number, dt: number, ms: number) => target + (current - target) * Math.exp(-dt / ms);
