import { expect, it } from 'vitest';
import { advanceFlock, createFlock, reconcileFlock } from './flock';
import { advanceBird, birdPose, createBird, position, safeRoute, type Scene } from './robin';
import { clearFlight, flightRoute, routePoint } from './flight-route';
import { createRobinPlayback } from './robin-playback';
import { partsLayers } from './parts-pose';
import { footClearance } from './snow';

const scene: Scene = {
  floors: new Map([
    [1, { left: 100, right: 500, y: 200, base: 300, room: 100 }],
    [2, { left: 100, right: 500, y: 450, base: 550, room: 150 }],
  ]),
  obstacles: [{ left: 100, right: 500, top: 200, bottom: 300 }, { left: 100, right: 500, top: 450, bottom: 550 }],
  width: 800, height: 750,
};
const random = () => .5;

it('flies between different heights around card walls in both directions', () => {
  for (const [from, to] of [[{ x: 250, y: 200 }, { x: 250, y: 450 }], [{ x: 250, y: 450 }, { x: 250, y: 200 }]]) {
    expect(safeRoute(from, to, 24, scene)).toBe(false);
    const route = flightRoute(from, to, scene)!;
    expect(route.length).toBeGreaterThan(1);
    expect(clearFlight(route, scene)).toBe(true);
    expect(routePoint(route, 0)).toEqual(from);
    expect(routePoint(route, 1)).toEqual(to);
    for (let i = 0; i <= 1000; i++) {
      const p = routePoint(route, i / 1000);
      expect(p.x - 35).toBeGreaterThanOrEqual(0);
      expect(p.y - 59).toBeGreaterThanOrEqual(0);
      expect(scene.obstacles.some(o => p.x - 35 < o.right && p.x + 35 > o.left && p.y - 59 < o.bottom && p.y > o.top)).toBe(false);
    }
  }
});

it('prefers another floor despite map order and lands at the reserved destination', () => {
  const bird = createBird(scene, 0, random);
  const flight = advanceBird(bird, scene, 16000, random);
  expect(flight.action?.kind).toBe('flight');
  expect(flight.action?.target.floor).toBe(2);
  const end = flight.action!.start + flight.action!.duration;
  expect(birdPose(flight, scene, end)).toMatchObject(position(flight.action!.target, scene));
  expect(advanceBird(flight, scene, end, random).perch).toEqual(flight.action!.target);
  const sealed = { ...scene, obstacles: [...scene.obstacles, { left: 0, right: 800, top: 310, bottom: 400 }] };
  expect(flightRoute({ x: 250, y: 200 }, { x: 250, y: 450 }, sealed)).toBeNull();
});

it('finds flight landing pockets when both ends of the destination have text', () => {
  const heading: Scene = { ...scene, floors: new Map([
    [1, scene.floors.get(1)!], [2, { left: 600, right: 780, y: 300, base: 300, room: 100 }],
  ]), obstacles: [scene.obstacles[0], { left: 600, right: 640, top: 210, bottom: 299 }, { left: 745, right: 780, top: 210, bottom: 299 }] };
  const flight = advanceBird(createBird(heading, 0, random), heading, 16000, random);
  expect(flight.action?.target.floor).toBe(2);
  expect(flight.action!.to.x).toBeGreaterThan(670);
  expect(flight.action!.to.x).toBeLessThan(715);
});

it('keeps two separate birds on different ledges or separate pockets, including after layout changes', () => {
  const birds = createFlock(scene, 0, random);
  expect(birds.map(b => b.perch?.floor)).toEqual([1, 2]);
  expect(birds[0].restUntil).not.toBe(birds[1].restUntil);
  const oneFloor = { ...scene, floors: new Map([[1, scene.floors.get(1)!]]) };
  const settled = reconcileFlock(birds, oneFloor, 1000, random);
  expect(settled.every(b => b.perch?.floor === 1)).toBe(true);
  expect(Math.abs(settled[0].perch!.x - settled[1].perch!.x)).toBeGreaterThanOrEqual(60);
  const empty = { ...scene, floors: new Map() };
  const hidden = reconcileFlock(birds, empty, 1000, random);
  expect(hidden.every(b => b.perch === null)).toBe(true);
  expect(advanceFlock(hidden, scene, 2000, random).every(b => b.perch !== null)).toBe(true);
});

it('clears snow beneath both birds when they share a ledge', () => {
  expect(footClearance(50, [50, 150])).toBe(0);
  expect(footClearance(150, [50, 150])).toBe(0);
  expect(footClearance(100, [50, 150])).toBe(1);
  expect(footClearance(50, [])).toBe(1);
});

it('fits two birds into the exact clear pocket beside mobile heading text', () => {
  const mobile: Scene = { width: 390, height: 900,
    floors: new Map([[1, { left: 14, right: 376, y: 310, base: 600, room: 30 }]]),
    obstacles: [{ left: 14, right: 249, top: 264, bottom: 280 }, { left: 14, right: 376, top: 310, bottom: 600 }] };
  const birds = createFlock(mobile, 0, random);
  expect(birds.every(b => b.perch !== null)).toBe(true);
  expect(Math.abs(birds[0].perch!.x - birds[1].perch!.x)).toBeGreaterThanOrEqual(60);
});

it('uses all live animations independently, takes turns flying, and keeps flights registered', () => {
  let birds = createFlock(scene, 0, random);
  const players = [createRobinPlayback(), createRobinPlayback(1800)];
  const seen = birds.map(() => new Set<string>());
  const wingStates = birds.map(() => new Set<string>());
  for (let now = 0; now <= 90000; now += 20) {
    const before = birds;
    birds = advanceFlock(birds, scene, now, random);
    before.forEach((bird, index) => {
      if (!bird.action) return;
      if (now < bird.action.start + bird.action.duration) expect(birds[index].action).toBe(bird.action);
      else expect(birds[index].perch).toEqual(bird.action.target);
    });
    expect(birds.filter(b => b.action?.kind === 'flight').length).toBeLessThanOrEqual(1);
    birds.forEach((bird, index) => {
      const p = players[index].pose(bird, now);
      if (p.breathing > .9) seen[index].add('breathing');
      if (p.closed) seen[index].add('blink');
      if (!p.pecking && !p.flying && Math.abs(p.headAngle) > 3) seen[index].add('tilt');
      if (!p.pecking && !p.flying && Math.abs(p.tailAngle) > 3) seen[index].add('tail');
      if (p.peckMix === 1) seen[index].add('peck');
      if (bird.action?.kind === 'hop') seen[index].add('hop');
      if (p.flightMix === 1) {
        seen[index].add('flight'); wingStates[index].add(p.nearWing.state);
        const layers = partsLayers(p);
        expect(layers.some(l => l.id === 'leg-near-tucked')).toBe(true);
        expect(layers.some(l => l.id === 'wing-shoulder')).toBe(true);
      }
      if (bird.action?.route) expect(clearFlight(bird.action.route, scene)).toBe(true);
    });
  }
  for (const animations of seen) expect([...animations].sort()).toEqual(['blink', 'breathing', 'flight', 'hop', 'peck', 'tail', 'tilt']);
  for (const states of wingStates) expect(states.size).toBe(8);
});
