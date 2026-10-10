import { describe, expect, it } from 'vitest';
import { cubic } from '../curves';
import { apart } from '../math';
import { clear } from './beeair';
import { airOn, dashboard } from './fixtures';
import { along, flyReach, holdRoute, placeRoute, plan, routeFrom } from './route';

describe('the bees\' routes', () => {
  it('go round the cards, never through a gutter narrower than a bee, clear all the way', () => {
    const air = airOn();
    // From above the first row to the margin below it.
    const route = plan(air, { x: 560, y: 150 }, { x: 263, y: 600 });
    expect(route).not.toBeNull();
    for (const c of route!.curves) {
      for (const i of Array.from({ length: 41 }, (_, k) => k)) expect(clear(air, flyReach(cubic(c, i / 40)))).toBe(true);
    }
    // Into the 18px gutter between the cards there is no way at all.
    expect(plan(air, { x: 560, y: 150 }, { x: 839, y: 300 })).toBeNull();
  });

  it('are flown smoothly from end to end, at the distance asked', () => {
    const route = plan(airOn(), { x: 560, y: 150 }, { x: 263, y: 600 })!;
    const pts = Array.from({ length: 201 }, (_, i) => along(route, (route.length * i) / 200).p);
    expect(apart(pts[0], { x: 560, y: 150 })).toBeLessThan(0.01);
    expect(apart(pts[200], { x: 263, y: 600 })).toBeLessThan(0.01);
    const step = route.length / 200;
    for (const [i, p] of pts.slice(1).entries()) expect(apart(p, pts[i])).toBeLessThan(step * 1.6);
    // What is left from a point on is the same way on.
    const rest = routeFrom(route, route.length / 3);
    expect(rest.length).toBeCloseTo((route.length * 2) / 3, 0);
    expect(apart(along(rest, 0).p, along(route, route.length / 3).p)).toBeLessThan(0.5);
  });

  it('are held by a frame, riding with it', () => {
    const route = plan(airOn(), { x: 560, y: 150 }, { x: 263, y: 600 })!;
    const held = holdRoute(route, { x: 290, y: 182 });
    const back = placeRoute(held, { x: 290, y: 142 });
    expect(along(back, 50).p.y).toBeCloseTo(along(route, 50).p.y - 40);
  });

  it('reach the shelf through the rail\'s air, and nowhere in the rail without it', () => {
    expect(plan(airOn(), { x: 560, y: 150 }, { x: 40, y: 640 })).not.toBeNull();
    expect(plan(airOn(dashboard(), null), { x: 560, y: 150 }, { x: 40, y: 640 })).toBeNull();
  });
});
