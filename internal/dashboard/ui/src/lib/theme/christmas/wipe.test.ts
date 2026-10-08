import { expect, it } from 'vitest';
import { depth, reconcileSnow, renderSnow, wipeSnow, type Snow } from './wipe';
const floors = new Map([[1, { left: 0, right: 500, y: 100, base: 200, room: 100, headroom: Infinity }]]);
const sample = (x: number): Snow => ({ x, depth: 6, seed: 6, wiped: 6, at: 0 });
const stroke = (y: number, at = 0) => ({ from: { x: 0, y }, to: { x: 500, y }, at });
it('wipes the complete segment, 24px core, 8px falloff and exact boundary', () => {
  const snow = new Map([[1, [sample(250)]]]);
  expect(wipeSnow(snow, floors, stroke(97 + 24)).get(1)![0].wiped).toBe(0);
  expect(wipeSnow(snow, floors, stroke(97 + 28)).get(1)![0].wiped).toBe(3);
  expect(wipeSnow(snow, floors, stroke(97 + 32)).get(1)![0]).toBe(snow.get(1)![0]);
  expect(wipeSnow(snow, floors, stroke(97)).get(1)![0].wiped).toBe(0);
});
it('waits 1.5 seconds then recovers with a four-second half-life independently of frames', () => {
  const s = { ...sample(250), wiped: 0, at: 1000 };
  expect(depth(s, 2499)).toBe(0);
  expect(depth(s, 2500)).toBe(0);
  expect(depth(s, 6500)).toBe(3);
  for (let t = 1000; t < 6500; t += 17) depth(s, t);
  expect(depth(s, 6500)).toBe(3);
  expect(depth(s, 1e10)).toBe(6);
});
it('overlaps never increase depth, renew only affected delays and leave foot patches ephemeral', () => {
  let snow = new Map([[1, [sample(250), sample(600)]]]);
  snow = wipeSnow(snow, floors, stroke(97));
  const unaffected = snow.get(1)![1];
  snow = wipeSnow(snow, floors, stroke(125, 1000));
  expect(snow.get(1)![0].wiped).toBe(0);
  expect(snow.get(1)![0].at).toBe(1000);
  expect(snow.get(1)![1]).toBe(unaffected);
  expect(renderSnow([sample(250)], 0, 250)[0].depth).toBe(0);
  expect(renderSnow([sample(250)], 0)[0].depth).toBe(6);
});
it('reconciles by ledge ID and local position, discarding disappeared ledges', () => {
  const seeded = reconcileSnow(floors);
  const wiped = wipeSnow(seeded, floors, stroke(97));
  const scrolled = new Map([[1, { ...floors.get(1)!, left: 30, right: 530, y: 80 }]]);
  expect(reconcileSnow(scrolled, wiped).get(1)![20]).toBe(wiped.get(1)![20]);
  expect(reconcileSnow(new Map(), wiped).size).toBe(0);
});
