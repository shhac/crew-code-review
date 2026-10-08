import { expect, it } from 'vitest';
import { clearFlight, curvePoint, flightRoute, routeFacing, routeLength, routePoint, routeTilt } from './flight-route';
import { advanceBird, birdPose, createBird, type Scene } from './robin';

const scene: Scene = { width: 900, height: 700, floors: new Map([
  [1, { left: 150, right: 550, y: 200, base: 300, room: 100, headroom: Infinity }],
  [2, { left: 150, right: 550, y: 450, base: 550, room: 150, headroom: Infinity }],
]), obstacles: [{ left: 150, right: 550, top: 200, bottom: 300 }, { left: 150, right: 550, top: 450, bottom: 550 }] };

it.each([false, true])('uses smooth sweeping curves around stacked cards, reverse=%s', reverse => {
  const endpoints = [{ x: 300, y: 200 }, { x: 300, y: 450 }];
  const [from, to] = reverse ? endpoints.reverse() : endpoints;
  const route = flightRoute(from, to, scene)!;
  expect(route.length).toBe(3);
  expect(clearFlight(route, scene)).toBe(true);
  for (const curve of route) {
    expect(new Set([curve.from.x, curve.control1.x, curve.control2.x, curve.to.x]).size).toBeGreaterThan(1);
    expect(new Set([curve.from.y, curve.control1.y, curve.control2.y, curve.to.y]).size).toBeGreaterThan(1);
  }
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    expect(a.to).toEqual(b.from);
    for (const key of ['x', 'y'] as const) expect(a.to[key] - a.control2[key]).toBeCloseTo(b.control1[key] - b.from[key], 8);
  }
  const directions = new Set<number>();
  for (let i = 1; i < 1000; i++) {
    const progress = i / 1000, before = routePoint(route, progress - .000001), after = routePoint(route, progress + .000001);
    const facing = routeFacing(route, progress);
    directions.add(facing);
    if (Math.abs(after.x - before.x) > .000001) expect(facing).toBe(after.x > before.x ? 1 : -1);
    const tilt = routeTilt(route, progress);
    expect(Math.abs(tilt)).toBeLessThanOrEqual(20);
    if (Math.abs(tilt) > .01) expect(Math.sign(tilt * facing)).toBe(Math.sign(after.y - before.y));
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(routeLength(route) * .000001);
  }
  expect(directions.size).toBe(2);
  expect(routeTilt(route, 0)).toBe(0);
  expect(Math.abs(routeTilt(route, 1))).toBe(0);
});

it('faces the flight direction even when randomness selected the opposite hop direction', () => {
  const single = { ...scene, floors: new Map([[1, scene.floors.get(1)!]]) };
  for (const random of [() => 0, () => 1]) {
    const bird = createBird(single, 0, random);
    const flying = advanceBird(bird, single, 30000, random);
    expect(flying.action?.kind).toBe('flight');
    for (let i = 1; i < 100; i++) {
      const time = 30000 + flying.action!.duration * i / 100;
      const before = birdPose(flying, single, time - .001)!, after = birdPose(flying, single, time + .001)!;
      expect(birdPose(flying, single, time)!.dir).toBe(after.x > before.x ? 1 : -1);
    }
  }
});

it('checks the entire curved path against thin obstacles, not just endpoints', () => {
  const route = flightRoute({ x: 185, y: 200 }, { x: 515, y: 200 }, scene)!;
  const p = curvePoint(route[0], .50321);
  const blocked = { ...scene, obstacles: [...scene.obstacles, { left: p.x, right: p.x + .01, top: p.y - 10, bottom: p.y - 9.99 }] };
  expect(clearFlight(route, blocked)).toBe(false);
});

it('takes the outgoing facing at the exact apex of a turn', () => {
  const route = [{ from: { x: 0, y: 0 }, control1: { x: 100, y: 100 }, control2: { x: 100, y: 200 }, to: { x: 0, y: 300 } }];
  expect(routeFacing(route, .49)).toBe(1);
  expect(routeFacing(route, .5)).toBe(-1);
  expect(routeFacing(route, .51)).toBe(-1);
});
