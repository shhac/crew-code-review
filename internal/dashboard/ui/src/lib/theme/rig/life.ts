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
