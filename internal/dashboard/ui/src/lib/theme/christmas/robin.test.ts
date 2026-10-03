import { expect, it } from 'vitest';
import { advanceBird, birdPose, createBird, reconcileBird, safePerch, safeRoute, type Scene } from './robin';
const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [{ left: 100, right: 500, top: 200, bottom: 300 }], width: 800, height: 600 };
const rand = () => .5;
const cursor = (x: number, y = 200) => ({ from: { x: x - 1, y }, to: { x, y }, at: 0 });
it('samples rest and flight intervals at both bounds', () => {
  for (const r of [0, 1]) {
    const b = createBird(scene, 100, () => r);
    expect(b.restUntil).toBe(100 + 6000 + r * 6000);
    expect(b.flightAt).toBe(100 + 12000 + r * 8000);
  }
});
it('hops 18–32px in 220–320ms with 6–10px rise and rests after landing', () => {
  const b = createBird(scene, 0, rand);
  expect(advanceBird(b, scene, 8999, rand).action).toBeNull();
  const hop = advanceBird(b, scene, 9000, rand);
  expect(hop.action).toMatchObject({ kind: 'hop', duration: 270, rise: 8 });
  expect(hop.action!.to.x - hop.action!.from.x).toBe(25);
  expect(birdPose(hop, scene, 9135)!.y).toBe(192);
  expect(advanceBird(hop, scene, 9270, rand).action).toBeNull();
  expect(advanceBird(hop, scene, 1e9, rand).action).toBeNull();
});
it('rejects swept-body, text/chart and wing crossings despite safe endpoints', () => {
  const from = { x: 130, y: 200 }, to = { x: 460, y: 200 };
  expect(safeRoute(from, to, 24, scene)).toBe(true);
  for (const obstacle of [
    { left: 250, right: 260, top: 180, bottom: 190 },
    { left: 250, right: 260, top: 140, bottom: 141 },
  ]) expect(safeRoute(from, to, 24, { ...scene, obstacles: [...scene.obstacles, obstacle] })).toBe(false);
  expect(safeRoute({ x: 10, y: 200 }, to, 24, scene)).toBe(false);
});
it('faces and alerts within 90px, escapes away within 48px and ignores action startles', () => {
  const b = { ...createBird(scene, 0, rand), perch: { floor: 1, x: 150, dir: 1 as const } };
  const alert = advanceBird(b, scene, 0, rand, cursor(320));
  expect(alert.alert).toBe(true);
  expect(alert.perch!.dir).toBe(1);
  const escape = advanceBird(alert, scene, 100, rand, cursor(270));
  expect(escape.action!.to.x).toBeLessThan(escape.action!.from.x);
  expect(advanceBird(escape, scene, 200, rand, cursor(240))).toBe(escape);
  const landed = advanceBird(escape, scene, 370, rand);
  expect(advanceBird(landed, scene, 400, rand, cursor(240)).action).toBeNull();
  expect(advanceBird(landed, scene, 2370, rand, cursor(240)).action).not.toBeNull();
  expect(advanceBird(alert, scene, 3000, rand).alert).toBe(false);
});
it('cornered birds fly only after the flight gate, remain still when blocked', () => {
  const b = createBird(scene, 0, rand);
  expect(advanceBird(b, scene, 0, rand, cursor(140)).action).toBeNull();
  const flying = advanceBird(b, scene, 16000, rand, cursor(140));
  expect(flying.action).toMatchObject({ kind: 'flight', duration: 600 });
  expect(flying.flightAt).toBe(32000);
  const blocked = { ...scene, obstacles: [...scene.obstacles, { left: 150, right: 170, top: 100, bottom: 199 }] };
  expect(advanceBird(b, blocked, 16000, rand, cursor(140)).action).toBeNull();
});
it('layout interruption cancels routes, relocates disappeared ledges and hides on empty geometry', () => {
  const hop = advanceBird(createBird(scene, 0, rand), scene, 9000, rand);
  expect(reconcileBird(hop, scene, 9100, rand).action).toBeNull();
  expect(reconcileBird(hop, { ...scene, floors: new Map() }, 9100, rand).perch).toBeNull();
  expect(birdPose(reconcileBird(hop, { ...scene, floors: new Map() }, 9100, rand), scene, 9100)).toBeNull();
});
it.each([0, 1])('pins hop and flight bounds at randomness %s', (r) => {
  const random = () => r;
  const base = createBird(scene, 0, random);
  const b = { ...base, perch: { floor: 1, x: 150, dir: 1 as const } };
  const hop = advanceBird(b, scene, b.restUntil, random);
  expect(hop.action!.duration).toBe(220 + 100 * r);
  expect(hop.action!.rise).toBe(6 + 4 * r);
  expect(Math.abs(hop.action!.to.x - hop.action!.from.x)).toBe(18 + 14 * r);
  const flight = advanceBird(base, scene, base.flightAt, random, cursor(140));
  expect(flight.action!.duration).toBe(450 + 300 * r);
  expect(flight.flightAt - base.flightAt).toBe(12000 + 8000 * r);
});
it('flight spacing survives escapes and a stationary cursor cannot repeatedly flee', () => {
  const base = createBird(scene, 0, rand);
  const flight = advanceBird(base, scene, 16000, rand, cursor(140));
  const landed = advanceBird(flight, scene, 16600, rand);
  expect(advanceBird(landed, scene, 31999, rand, cursor(460)).action).toBeNull();
  expect(advanceBird(landed, scene, 32000, rand, cursor(460)).action!.kind).toBe('flight');
  // No new moving-pointer segment: only the ordinary rest schedule is eligible.
  expect(advanceBird(landed, scene, 18601, rand).action).toBeNull();
});
it('safe perches reject overlapping content, malformed geometry and vanished destinations', () => {
  expect(safePerch({ ...scene, obstacles: [{ left: 0, right: 800, top: 0, bottom: 199 }] })).toBeNull();
  expect(safePerch({ ...scene, floors: new Map([[1, { ...scene.floors.get(1)!, left: NaN }]]) })).toBeNull();
  expect(safeRoute({ x: 130, y: 200 }, { x: 150, y: 200 }, 8, { ...scene, obstacles: [{ left: NaN, right: 800, top: 0, bottom: 199 }] })).toBe(false);
  const hop = advanceBird(createBird(scene, 0, rand), scene, 9000, rand);
  const changed = { ...scene, floors: new Map([[2, scene.floors.get(1)!]]) };
  const relocated = reconcileBird(hop, changed, 9100, rand);
  expect(relocated.perch!.floor).toBe(2); expect(relocated.action).toBeNull();
  const obstructed = { ...scene, obstacles: [{ left: 140, right: 150, top: 100, bottom: 199 }] };
  expect(advanceBird(hop, obstructed, 9100, rand).action).toBeNull();
  const scrolled = { ...scene, floors: new Map([[1, { ...scene.floors.get(1)!, y: 190 }]]) };
  expect(advanceBird(hop, scrolled, 9100, rand).action).toBeNull();
});
