import { describe, expect, it } from 'vitest';
import { envelopeOf, fitsAir, meets, mirrored, sweeps, sweptPath, type Cubic, type Envelope, type Segment } from './air';
import { clearFlight, curvePoint } from './christmas/flight-route';
import type { Box, Obstacle, PageMap } from './floors';
import { hash } from './seed';
import { airFor, page } from './valentine/fixtures';

// A seeded stream of numbers in [0, 1).
const stream = (seed: number) => {
  const at = { n: seed * 1000 };
  return () => hash((at.n += 1));
};
const pointIn = (r: () => number, w: number, h: number) => ({ x: r() * w, y: r() * h });

// A random page, as the robin sees one: its window and a few obstacles.
function randomScene(r: () => number): PageMap {
  const obstacles: Obstacle[] = Array.from({ length: 1 + Math.floor(r() * 6) }, () => {
    const at = pointIn(r, 1200, 800);
    return { left: at.x, top: at.y, right: at.x + 10 + r() * 300, bottom: at.y + 4 + r() * 120 };
  });
  return { floors: new Map(), obstacles, width: 1200, height: 800 };
}
const randomRoute = (r: () => number): Cubic[] =>
  Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ from: pointIn(r, 1200, 800), control1: pointIn(r, 1200, 800), control2: pointIn(r, 1200, 800), to: pointIn(r, 1200, 800) }));

// The robin's fixed box (christmas/flight-route.ts's curveBounds): 35px
// either side, 59px above, nothing below.
const ROBIN: Envelope = { left: 35, right: 35, up: 59, down: 0 };
const inScene = (scene: PageMap) => (box: Box) =>
  box.left >= 0 && box.right <= scene.width && box.top >= 0 && box.bottom <= scene.height && !scene.obstacles.some((o) => meets(box, o));

describe('sweptPath', () => {
  it('is the robin\'s clearFlight, given the robin\'s box: the same answer on every route', () => {
    const answers = Array.from({ length: 600 }, (_, i) => {
      const r = stream(i + 1);
      const scene = randomScene(r);
      const route = randomRoute(r);
      // Short routes, so that some are clear.
      const near = route.map((c) => ({ ...c, control1: { x: (c.from.x * 3 + c.to.x) / 4, y: c.control1.y / 4 + c.from.y * 0.75 }, control2: c.to, to: { x: c.from.x + (c.to.x - c.from.x) / 6, y: c.from.y + (c.to.y - c.from.y) / 6 } }));
      const robin = clearFlight(near, scene);
      expect(sweptPath(near.map((curve) => ({ curve, envelope: ROBIN })), inScene(scene)).clear, `route ${i}`).toBe(robin);
      return robin;
    });
    // Both answers come up, so the agreement means something.
    expect(answers.filter(Boolean).length).toBeGreaterThan(50);
    expect(answers.filter((a) => !a).length).toBeGreaterThan(50);
  });

  const level: Cubic = { from: { x: 300, y: 600 }, control1: { x: 400, y: 600 }, control2: { x: 500, y: 600 }, to: { x: 600, y: 600 } };
  const air = airFor(page([{ left: 440, right: 460, top: 520, bottom: 560 }], []));

  it('checks each piece with its own pose\'s box', () => {
    const glide: Envelope = { left: 23, right: 23, up: 20, down: 0 };
    const flap: Envelope = { left: 22, right: 22, up: 46, down: 10 };
    expect(sweptPath([{ curve: level, envelope: glide }], fitsAir(air)).clear).toBe(true);
    // Flapping, its wings reach up into the obstacle above the line.
    expect(sweptPath([{ curve: level, envelope: flap }], fitsAir(air)).clear).toBe(false);
    const halves: Segment[] = [
      { curve: { from: level.from, control1: { x: 330, y: 600 }, control2: { x: 360, y: 600 }, to: { x: 390, y: 600 } }, envelope: flap },
      { curve: { from: { x: 390, y: 600 }, control1: { x: 450, y: 600 }, control2: { x: 520, y: 600 }, to: level.to }, envelope: glide },
    ];
    expect(sweptPath(halves, fitsAir(air)).clear).toBe(true);
  });

  it('misses nothing between a piece\'s ends', () => {
    const thin = airFor(page([{ left: 449, right: 451, top: 590, bottom: 610 }], []));
    const dot: Envelope = { left: 1, right: 1, up: 1, down: 1 };
    const [start, end] = [{ curve: { ...level, to: level.from, control1: level.from, control2: level.from }, envelope: dot }, { curve: { ...level, from: level.to, control1: level.to, control2: level.to }, envelope: dot }];
    expect(sweptPath([start, end], fitsAir(thin)).clear).toBe(true);
    expect(sweptPath([{ curve: level, envelope: dot }], fitsAir(thin)).clear).toBe(false);
  });

  it('gives the boxes it was found clear by, which hold the whole curve and its envelope', () => {
    const arc: Cubic = { from: { x: 300, y: 600 }, control1: { x: 350, y: 300 }, control2: { x: 650, y: 300 }, to: { x: 700, y: 600 } };
    const envelope: Envelope = { left: 20, right: 24, up: 30, down: 6 };
    const { clear, boxes } = sweptPath([{ curve: arc, envelope }], fitsAir(airFor(page([{ left: 480, right: 520, top: 200, bottom: 300 }], []))));
    expect(clear).toBe(true);
    expect(boxes.length).toBeGreaterThan(1);
    for (let i = 0; i <= 100; i++) {
      const p = curvePoint(arc, i / 100);
      const reach = { left: p.x - envelope.left, right: p.x + envelope.right, top: p.y - envelope.up, bottom: p.y + envelope.down };
      expect(boxes.some((b) => b.left <= reach.left + 1e-9 && b.right >= reach.right - 1e-9 && b.top <= reach.top + 1e-9 && b.bottom >= reach.bottom - 1e-9), `at ${i}`).toBe(true);
    }
  });

  it('turns an envelope about, and makes one of a footprint', () => {
    expect(mirrored({ left: 10, right: 30, up: 5, down: 2 })).toEqual({ left: 30, right: 10, up: 5, down: 2 });
    expect(envelopeOf({ width: 44, height: 46, down: 6 })).toEqual({ left: 22, right: 22, up: 46, down: 6 });
    expect(envelopeOf({ width: 36, height: 26 }).down).toBe(0);
  });

  it('refuses a piece that is not a number anywhere', () => {
    const broken: Cubic = { ...level, control1: { x: NaN, y: 600 } };
    expect(sweptPath([{ curve: broken, envelope: ROBIN }], () => true).clear).toBe(false);
  });
});

// The robin and the cupids keep their own checks, unchanged by the kit:
// each one's answers on a fixed set of routes are pinned here as they were
// when the kit was added.
describe('the checks the kit leaves alone', () => {
  const bits = (answers: readonly boolean[]) => answers.map((a) => (a ? '1' : '0')).join('');

  it('the robin\'s clearFlight answers as it always has', () => {
    const answers = Array.from({ length: 64 }, (_, i) => {
      const r = stream(5000 + i);
      const scene = randomScene(r);
      const route = randomRoute(r).map((c) => ({ ...c, to: { x: c.from.x + (c.to.x - c.from.x) / 5, y: c.from.y + (c.to.y - c.from.y) / 5 }, control1: c.from, control2: c.from }));
      return clearFlight(route, scene);
    });
    expect(bits(answers)).toBe('1001111100001110011101110110000000111010111010101111110101111101');
  });

  it('the cupids\' sweeps answers as it always has', () => {
    const air = airFor();
    const answers = Array.from({ length: 64 }, (_, i) => {
      const r = stream(9000 + i);
      const from = { x: 240 + r() * 1190, y: r() * 900 };
      const to = { x: from.x + (r() - 0.5) * 300, y: from.y + (r() - 0.5) * 300 };
      const boxes = Array.from({ length: 8 }, (_, k) => {
        const x = from.x + ((to.x - from.x) * k) / 7, y = from.y + ((to.y - from.y) * k) / 7;
        return { left: x - 12, right: x + 12, top: y - 20, bottom: y + 8 };
      });
      return sweeps(air, boxes);
    });
    expect(bits(answers)).toBe('0011010010010110111001000101100111001001000111001100101101111010');
  });
});
