import { describe, expect, it } from 'vitest';
import { envelopeOf, fitsAir, sweeps, sweptPath, type Piece } from './air';
import { clearFlight, curvePoint, type FlightCurve } from './christmas/flight-route';
import type { Curve } from './curves';
import type { Box, Obstacle, PageMap, Reach } from './floors';
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
const randomRoute = (r: () => number): FlightCurve[] =>
  Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ from: pointIn(r, 1200, 800), control1: pointIn(r, 1200, 800), control2: pointIn(r, 1200, 800), to: pointIn(r, 1200, 800) }));

// The robin's fixed box (christmas/flight-route.ts's curveBounds): 35px
// either side, 59px above, nothing below.
const ROBIN: Reach = { half: 35, up: 59, down: 0 };
const curveOf = (c: FlightCurve): Curve => ({ from: c.from, c1: c.control1, c2: c.control2, to: c.to });

describe('sweptPath', () => {
  const level: Curve = { from: { x: 300, y: 600 }, c1: { x: 400, y: 600 }, c2: { x: 500, y: 600 }, to: { x: 600, y: 600 } };
  const air = airFor(page([{ left: 440, right: 460, top: 520, bottom: 560 }], []));

  it('checks each piece with its own pose\'s box', () => {
    const glide: Reach = { half: 23, up: 20, down: 0 };
    const flap: Reach = { half: 22, up: 46, down: 10 };
    expect(sweptPath([{ curve: level, reach: glide }], fitsAir(air)).clear).toBe(true);
    // Flapping, its wings reach up into the obstacle above the line.
    expect(sweptPath([{ curve: level, reach: flap }], fitsAir(air)).clear).toBe(false);
    const halves: Piece[] = [
      { curve: { from: level.from, c1: { x: 330, y: 600 }, c2: { x: 360, y: 600 }, to: { x: 390, y: 600 } }, reach: flap },
      { curve: { from: { x: 390, y: 600 }, c1: { x: 450, y: 600 }, c2: { x: 520, y: 600 }, to: level.to }, reach: glide },
    ];
    expect(sweptPath(halves, fitsAir(air)).clear).toBe(true);
  });

  it('misses nothing between a piece\'s ends', () => {
    const thin = airFor(page([{ left: 449, right: 451, top: 590, bottom: 610 }], []));
    const dot: Reach = { half: 1, up: 1, down: 1 };
    const [start, end] = [{ curve: { ...level, to: level.from, c1: level.from, c2: level.from }, reach: dot }, { curve: { ...level, from: level.to, c1: level.to, c2: level.to }, reach: dot }];
    expect(sweptPath([start, end], fitsAir(thin)).clear).toBe(true);
    expect(sweptPath([{ curve: level, reach: dot }], fitsAir(thin)).clear).toBe(false);
  });

  it('gives the boxes it was found clear by, which hold the whole curve and its reach', () => {
    const arc: FlightCurve = { from: { x: 300, y: 600 }, control1: { x: 350, y: 300 }, control2: { x: 650, y: 300 }, to: { x: 700, y: 600 } };
    const reach: Reach = { half: 24, up: 30, down: 6 };
    const { clear, boxes } = sweptPath([{ curve: curveOf(arc), reach }], fitsAir(airFor(page([{ left: 480, right: 520, top: 200, bottom: 300 }], []))));
    expect(clear).toBe(true);
    expect(boxes.length).toBeGreaterThan(1);
    for (let i = 0; i <= 100; i++) {
      const p = curvePoint(arc, i / 100);
      const drawn = { left: p.x - reach.half, right: p.x + reach.half, top: p.y - reach.up, bottom: p.y + reach.down };
      expect(boxes.some((b) => b.left <= drawn.left + 1e-9 && b.right >= drawn.right - 1e-9 && b.top <= drawn.top + 1e-9 && b.bottom >= drawn.bottom - 1e-9), `at ${i}`).toBe(true);
    }
  });

  it('splits no further than asked: to a depth, or down to pieces `least` px long', () => {
    const thin = airFor(page([{ left: 449, right: 451, top: 590, bottom: 610 }], []));
    const seen = (sweep: { depth?: number; least?: number }) => {
      const tried: Box[] = [];
      sweptPath([{ curve: level, reach: { half: 1, up: 1, down: 1 } }], (b) => (tried.push(b), fitsAir(thin)(b)), sweep);
      return tried.length;
    };
    // Blocked at its middle: the whole, its blocked first half, then at
    // each depth below a clear half and the blocked one beside it.
    expect(seen({ depth: 3 })).toBe(2 * 3);
    expect(seen({})).toBe(seen({ depth: 12 }));
    expect(seen({})).toBeGreaterThan(seen({ depth: 3 }));
    // 300px long and 100 out to its first control, halved three times is
    // 37.5 and 12.5: 50, short of 60.
    expect(seen({ least: 60 })).toBe(2 * 3);
  });

  it('still takes the older segments, until every month\'s route is pieces', () => {
    const glide = { left: 23, right: 23, up: 20, down: 0 };
    const old = { from: level.from, control1: level.c1, control2: level.c2, to: level.to };
    expect(sweptPath([{ curve: old, envelope: glide }], fitsAir(air))).toEqual(sweptPath([{ curve: level, reach: { half: 23, up: 20, down: 0 } }], fitsAir(air)));
    expect(envelopeOf({ width: 44, height: 46, down: 6 })).toEqual({ left: 22, right: 22, up: 46, down: 6 });
    expect(envelopeOf({ width: 36, height: 26 }).down).toBe(0);
  });

  it('refuses a piece that is not a number anywhere', () => {
    const broken: Curve = { ...level, c1: { x: NaN, y: 600 } };
    expect(sweptPath([{ curve: broken, reach: ROBIN }], () => true).clear).toBe(false);
  });
});

// The robin's clearFlight (now the kit's sweep with the robin's box) and
// the cupids' sweeps answer a fixed set of routes as they did when the kit
// was added: pinned here.
describe('the checks that predate the kit', () => {
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
