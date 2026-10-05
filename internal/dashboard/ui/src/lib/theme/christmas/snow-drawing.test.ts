import { expect, test } from 'vitest';
import { createSnowDrawing } from './snow-drawing';
import { renderSnow, type Snow } from './wipe';
import { snowPath } from './snow';

const snow: Snow[] = [0, 10, 20, 30, 40].map(x => ({ x, depth: 4, seed: 4, wiped: 4, at: 0 }));

test('resting snow reuses its paths throughout animation, but updates foot clearances', () => {
  const draw = createSnowDrawing();
  const resting = draw(snow, 0, [], false);
  for (let now = 16; now < 10000; now += 16) expect(draw(snow, now, [], false)).toBe(resting);
  const perched = draw(snow, 10000, [20], false);
  expect(perched.cover).toBe(snowPath(renderSnow(snow, 10000, [20])));
  expect(perched.cover).not.toBe(resting.cover);
  expect(draw(snow, 10016, [20], false)).toBe(perched);
  expect(draw(snow, 10032, [], false).cover).toBe(resting.cover);
});

test('wiping refreshes immediately, recovery updates at 10 Hz and then settles', () => {
  const draw = createSnowDrawing();
  const original = draw(snow, 0, [], false);
  const wiped = snow.map(s => ({ ...s, wiped: 0, at: 0 }));
  const cleared = draw(wiped, 0, [], false);
  expect(cleared.cover).not.toBe(original.cover);
  expect(draw(wiped, 99, [], false)).toBe(cleared);
  const recovering = draw(wiped, 2000, [], false);
  expect(recovering.cover).toBe(snowPath(renderSnow(wiped, 2000, [])));
  expect(recovering.cover).not.toBe(cleared.cover);
  expect(draw(wiped, 2099, [], false)).toBe(recovering);
  const settled = draw(wiped, 61500, [], false);
  expect(settled.cover).toBe(original.cover);
  expect(draw(wiped, 100000, [], false)).toBe(settled);
});

test('reduced motion restores snow; clock reset and new geometry invalidate the drawing', () => {
  const draw = createSnowDrawing();
  const wiped = snow.map(s => ({ ...s, wiped: 0, at: 100 }));
  const cleared = draw(wiped, 100, [], false);
  expect(draw(wiped, 100, [], true).cover).toBe(snowPath(renderSnow(snow, 0)));
  expect(draw(wiped, 100, [], false).cover).toBe(cleared.cover);
  draw(wiped, 10000, [], false);
  expect(draw(wiped, 100, [], false).cover).toBe(cleared.cover);
  const moved = snow.map(s => ({ ...s, x: s.x + 2 }));
  expect(draw(moved, 100, [], false).cover).toBe(snowPath(renderSnow(moved, 100)));
});
