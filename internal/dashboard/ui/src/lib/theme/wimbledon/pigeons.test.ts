import { describe, expect, it } from 'vitest';
import { around, meets } from '../air';
import type { Box } from '../floors';
import { fixed, seeded } from '../test-scene';
import { envelopeAt, escape, flying, lengthOfTrack, routeClear } from './flight';
import { board, overview, side, testSky } from './fixtures';
import { GAP, hawkView } from './hawk';
import { ENVELOPES, fresh, grounded, POSES, standing, takeOff, viewOf, type Pigeon } from './pigeon';
import { APART, courtFree, createFlock, FLUSH_BACK, FLUSH_EVERY, LOOK, reconcileFlock, restingFlock, RETRY, stepFlock, type Flock } from './pigeons';

const PAGE = overview();
const SKY = testSky(PAGE);
const at = (id: number, floor: number, x: number): Pigeon => standing(fresh(id), floor, x, 1, 0, fixed(0.5));
const flockOf = (pigeons: Pigeon[]): Flock => ({ target: pigeons.length, pigeons, lastFlush: -Infinity, hawk: { next: Infinity, plan: null } });
const pageX = (p: Pigeon) => PAGE.floors.get(p.floor)!.left + p.x;

// The box each pigeon is drawn in now: its grounded pose's, or its flight
// envelope where it is along its route.
function boxOf(p: Pigeon, now: number): Box | null {
  const v = viewOf(p, PAGE, now);
  if (!v) return null;
  if (!p.flight) {
    const size = POSES[v.pose === 'stand' || v.pose === 'walk' || v.pose === 'peck' || v.pose === 'alert' ? v.pose : 'stand'];
    return around(v, { half: size.width / 2, up: size.height, down: 0 });
  }
  const where = flying(p.flight.track, now - p.flight.start, p.flight.lands);
  return around(v, envelopeAt(ENVELOPES, where.s, lengthOfTrack(p.flight.track), p.flight.lands));
}

describe('the flock', () => {
  it('places three, 70px apart, where each could fly away from again', () => {
    const flock = createFlock(PAGE, SKY, 0, seeded(1));
    expect(flock.target).toBe(3);
    expect(flock.pigeons).toHaveLength(3);
    for (const p of flock.pigeons) {
      // The first row of cards, or the heading's rule where nothing is
      // written over it.
      expect([1, 2, 3]).toContain(p.floor);
      expect(escape(p.floor, PAGE.floors.get(p.floor)!, p.x, 'right', ENVELOPES, SKY) ?? escape(p.floor, PAGE.floors.get(p.floor)!, p.x, 'left', ENVELOPES, SKY)).not.toBeNull();
    }
    flock.pigeons.forEach((a, i) => flock.pigeons.slice(i + 1).forEach((b) => {
      if (a.floor === b.floor) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(APART);
    }));
  });

  it('places two where only two spots have a way out, and none where nothing does', () => {
    // Only the right card, 160px of it, under the band.
    const short = { ...side, right: side.left + 190 };
    const page = overview([], [[3, short]]);
    const two = createFlock(page, testSky(page), 0, seeded(2));
    expect(two.target).toBe(2);
    expect(two.pigeons).toHaveLength(2);
    // Text low over the whole row closes the band: no pigeon at all.
    const closed = overview([{ left: 236, right: 1440, top: 130, bottom: 150 }]);
    expect(createFlock(closed, testSky(closed), 0, seeded(2)).pigeons).toEqual([]);
  });

  it('lets a fast pass close by flush one, away from the cursor, back in 6 to 12s; the others near it look up', () => {
    const flock = flockOf([at(0, 2, 300), at(1, 2, 420), at(2, 3, 200)]);
    const cursor = { x: board.left + 300 + 20, y: board.y - 12 };
    const after = stepFlock(flock, PAGE, SKY, 1000, 16, seeded(3), { cursor, speed: 2000 });
    const [a, b, c] = after.pigeons;
    expect(a.mode).toBe('takeoff');
    expect(a.way).toBe('left');
    expect(a.back - 1000).toBeGreaterThanOrEqual(FLUSH_BACK[0]);
    expect(a.back - 1000).toBeLessThanOrEqual(FLUSH_BACK[1]);
    expect(after.lastFlush).toBe(1000);
    // b is 120px off: it looks up; c is over 200px off: it does not.
    expect(Math.abs(pageX(b) - pageX(a))).toBeLessThanOrEqual(LOOK);
    expect(b.mode).toBe('alert');
    expect(Math.abs(pageX(c) - pageX(a))).toBeGreaterThan(LOOK);
    expect(c.mode).not.toBe('alert');
    // Too slow a pass only makes it shy away.
    expect(stepFlock(flock, PAGE, SKY, 1000, 16, seeded(3), { cursor, speed: 900 }).pigeons[0].mode).toBe('shy');
  });

  it('flushes at most one for the cursor in any 8s', () => {
    const flock = { ...flockOf([at(0, 2, 300), at(1, 2, 350)]), lastFlush: 0 };
    const cursor = { x: board.left + 325, y: board.y - 12 };
    const soon = stepFlock(flock, PAGE, SKY, FLUSH_EVERY - 1, 16, seeded(4), { cursor, speed: 3000 });
    expect(soon.pigeons.some((p) => p.mode === 'takeoff')).toBe(false);
    const later = stepFlock(flock, PAGE, SKY, FLUSH_EVERY, 16, seeded(4), { cursor, speed: 3000 });
    expect(later.pigeons.filter((p) => p.mode === 'takeoff')).toHaveLength(1);
  });

  it('never flies out or back in over a bird on the ground', () => {
    // Flushed from the cursor's left with a bird to its right, it goes left
    // past the cursor rather than over the other.
    const flock = flockOf([at(0, 2, 300), at(1, 2, 420)]);
    const off = stepFlock(flock, PAGE, SKY, 1000, 16, seeded(3), { cursor: { x: board.left + 280, y: board.y - 12 }, speed: 2000 }).pigeons[0];
    expect(off.way).toBe('left');
    // Hemmed in both ways, it only shies.
    const hemmed = flockOf([at(0, 2, 300), at(1, 2, 100), at(2, 2, 500)]);
    expect(stepFlock(hemmed, PAGE, SKY, 1000, 16, seeded(3), { cursor: { x: board.left + 280, y: board.y - 12 }, speed: 2000 }).pigeons[0].mode).not.toBe('takeoff');
    // Coming back in from the right with a bird on the right card, it
    // lands beyond that bird, not over it.
    const route = escape(2, board, 300, 'right', ENVELOPES, SKY)!;
    const away: Pigeon = { ...takeOff(at(0, 2, 300), route, 0), mode: 'away', flight: null, back: 9000 };
    const back = stepFlock(flockOf([away, at(1, 3, 100)]), PAGE, SKY, 9000, 16, seeded(5), null).pigeons[0];
    expect(back).toMatchObject({ mode: 'fly', floor: 3 });
    expect(back.x).toBeGreaterThanOrEqual(100 + APART);
  });

  it('comes back by the exit it left by, to a spot near its old one; or tries again 5s later', () => {
    const route = escape(2, board, 300, 'right', ENVELOPES, SKY)!;
    const away: Pigeon = { ...takeOff(at(0, 2, 300), route, 0), mode: 'away', flight: null, back: 9000 };
    const flock = flockOf([away, at(1, 2, 100)]);
    const back = stepFlock(flock, PAGE, SKY, 9000, 16, seeded(5), null).pigeons[0];
    expect(back.mode).toBe('fly');
    expect(back.flight!.lands).toBe(true);
    expect(back.flight!.route.way).toBe('right');
    expect(back.floor).toBe(2);
    expect(Math.abs(back.x - 300)).toBeLessThanOrEqual(24);
    // With the band closed there is no way back in yet.
    const closed = overview([{ left: 236, right: 1440, top: 130, bottom: 150 }]);
    const waiting = stepFlock(flock, closed, testSky(closed), 9000, 16, seeded(5), null).pigeons[0];
    expect(waiting).toMatchObject({ mode: 'away', back: 9000 + RETRY });
  });

  it('keeps every bird and the hawk in air, and 6px apart, over a long afternoon of passes and sweeps', () => {
    for (const seed of Array.from({ length: 3 }, (_, i) => i + 1)) {
      const rand = seeded(seed);
      const start = createFlock(PAGE, SKY, 0, rand);
      const flock0 = { ...start, hawk: { next: 2000, plan: null } };
      const frames = 60 * 150;
      const seen = new Set<string>();
      Array.from({ length: frames }).reduce<Flock>((flock, _, i) => {
        const now = i * (1000 / 60);
        // Now and then the cursor sweeps fast along the row.
        const sweep = i % 1500 > 1400 ? { cursor: { x: 300 + ((i % 1500) - 1400) * 12, y: 170 }, speed: 2000 } : null;
        const next = stepFlock(flock, PAGE, SKY, now, 1000 / 60, rand, sweep);
        const boxes = next.pigeons.map((p) => ({ p, box: boxOf(p, now) })).filter((d): d is { p: Pigeon; box: Box } => d.box !== null);
        const hawk = hawkView(next.hawk, PAGE, now);
        const all = hawk ? [...boxes, { p: null, box: { left: hawk.x - 23, right: hawk.x + 23, top: hawk.y - 15, bottom: hawk.y + 1 } }] : boxes;
        for (const d of all) expect(SKY.clear(d.box), `seed ${seed} frame ${i} ${d.p?.id} ${d.p?.mode}`).toBe(true);
        const onScreen = all.filter((d) => d.box.right > 0 && d.box.left < 1440 && d.box.top < 900);
        onScreen.forEach((a, j) => onScreen.slice(j + 1).forEach((b) => {
          const grown = { left: a.box.left - GAP, right: a.box.right + GAP, top: a.box.top - GAP, bottom: a.box.bottom + GAP };
          const both = a.p && b.p && grounded(a.p) && grounded(b.p);
          // On the ground they keep the walkers' spacing (6px between
          // walking bodies); everything else keeps 6px between envelopes.
          if (!both) expect(meets(grown, b.box), `seed ${seed} frame ${i}: ${a.p?.id} ${a.p?.mode} and ${b.p?.id} ${b.p?.mode}`).toBe(false);
        }));
        next.pigeons.forEach((p) => seen.add(p.mode));
        if (hawk) seen.add('hawk');
        return next;
      }, flock0);
      expect(seen.has('hawk')).toBe(true);
      expect(seen.has('away')).toBe(true);
      expect(seen.has('land')).toBe(true);
    }
  }, 120_000);

  it('sends a bird whose way has closed under it away at once, and keeps the ones on the ground', () => {
    const route = escape(2, board, 300, 'right', ENVELOPES, SKY)!;
    const up = { ...takeOff(at(0, 2, 300), route, 0), mode: 'fly' as const };
    const flock = flockOf([up, at(1, 3, 250)]);
    expect(reconcileFlock(flock, PAGE, SKY, 500, seeded(6)).pigeons[0].mode).toBe('fly');
    const closed = overview([{ left: 1320, right: 1380, top: 150, bottom: 176 }]);
    const after = reconcileFlock(flock, closed, testSky(closed), 500, seeded(6));
    expect(after.pigeons[0]).toMatchObject({ mode: 'away', flight: null, back: 500 + RETRY });
    expect(routeClear(route, board, ENVELOPES, testSky(closed).clear)).toBe(false);
    expect(after.pigeons[1]).toMatchObject({ floor: 3, x: 250 });
  });

  it('stands still under reduced motion, every bird on a spot, with no hawk', () => {
    const flock = createFlock(PAGE, SKY, 0, seeded(7));
    const route = escape(2, board, flock.pigeons[0].x, 'right', ENVELOPES, SKY)!;
    const flying = { ...flock, pigeons: [{ ...takeOff(flock.pigeons[0], route, 0), mode: 'away' as const, flight: null }, ...flock.pigeons.slice(1)] };
    const still = restingFlock(PAGE, SKY, flying, 0);
    expect(still.hawk.plan).toBeNull();
    expect(still.pigeons).toHaveLength(flock.target);
    for (const p of still.pigeons) expect(p).toMatchObject({ mode: 'stand', flight: null, until: Infinity });
    // The ones on the ground stay where they were.
    expect(still.pigeons.slice(1).map((p) => [p.floor, p.x])).toEqual(flock.pigeons.slice(1).map((p) => [p.floor, p.x]));
    expect(restingFlock(PAGE, SKY, still, 0).pigeons).toEqual(still.pigeons);
  });

  it('frees a court for the rally only with no pigeon in it and none in the air', () => {
    const flock = flockOf([at(0, 2, 100), at(1, 3, 250)]);
    expect(courtFree(flock, [{ floor: 2, lo: 400, hi: 704 }])).toBe(true);
    expect(courtFree(flock, [{ floor: 3, lo: 0, hi: 300 }])).toBe(false);
    const route = escape(2, board, 100, 'left', ENVELOPES, SKY)!;
    expect(courtFree(flockOf([{ ...takeOff(at(0, 2, 100), route, 0), mode: 'fly' }]), [{ floor: 3, lo: 0, hi: 10 }])).toBe(false);
  });
});
