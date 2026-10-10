import { mix, smooth } from '../math';
import type { Point } from '../pointer';
import { hash } from '../seed';

// How a small insect holds itself in the air, as pose functions of its
// speed and the time: where it goes is the month's, how it looks getting
// there is here. Insects hover with the body tilted steeply nose up and
// flatten toward level as forward speed rises (Dudley and Ellington 1990,
// bumblebees); hovering, the legs hang, the hind pair trailing; at speed
// they are drawn up under the body.

// Its pitch hovering and at cruising speed (degrees, nose up negative, as
// the page turns), and the speed (page px/s) at which it is fully level to
// that cruise.
export type Pitching = { hover: number; cruise: number; speed: number };

// The body's pitch at this speed: eased from the hover's to the cruise's.
export const pitchAt = (p: Pitching, speed: number) => mix(p.hover, p.cruise, smooth(Math.abs(speed) / p.speed));

// How far the legs hang at this speed (1 hovering, 0 tucked at `cruise`
// px/s), for hexapod.ts's airLegs.
export const hangAt = (speed: number, cruise: number) => 1 - smooth(Math.abs(speed) / cruise);

// The hover's slow bob, page-free: up and down `amplitude` at `hz`, seeded
// so a group never bobs in step, with a smaller second wave so no two
// cycles look the same.
export function hoverBob(seed: number, now: number, amplitude: number, hz: number): number {
  const t = (now / 1000) * hz * 2 * Math.PI;
  return amplitude * (0.8 * Math.sin(t + hash(seed) * 2 * Math.PI) + 0.2 * Math.sin(2.7 * t + hash(seed + 1) * 2 * Math.PI));
}

// A dart: a short, quick flight from one spot to another, started and
// stopped without a jolt (a minimum-jerk profile, the smoothest that covers
// the distance in the time), with where it is and how fast it is going at
// each moment. `t` runs 0 to 1 over the dart; speed is in distance per
// second for a dart lasting `ms`.
export type Dart = { at: Point; speed: number; heading: number };
export function dartAt(from: Point, to: Point, t: number, ms: number): Dart {
  const u = Math.min(1, Math.max(0, t));
  const s = u * u * u * (10 - 15 * u + 6 * u * u);
  const rate = 30 * u * u * (1 - u) * (1 - u);
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  return { at: { x: from.x + dx * s, y: from.y + dy * s }, speed: (distance * rate * 1000) / ms, heading: Math.atan2(dy, dx) };
}

// How long a dart of `distance` takes to peak at `speed` (both page px and
// px/s): its peak is 1.875 times its average.
export const dartMs = (distance: number, speed: number) => (1.875 * distance * 1000) / speed;
