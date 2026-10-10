import { describe, expect, it } from 'vitest';
import { around } from '../air';
import {
  along, durationOf, envelopeAt, escape, escapeFrom, flying, LAND, LAND_RUN, LIFT_RUN, lengthOfTrack, routeClear, routeIn, SPEED, TAKEOFF, trackOf, type Route,
} from './flight';
import { board, EXITS, overview, PIGEON_ENVELOPES as ENV, lower, side, testSky } from './fixtures';

const PAGE = overview();
const SKY = testSky(PAGE);
const onPage = (r: Route) => trackOf(r).map((q) => ({ x: board.left + q.at.x, y: board.y + q.at.y, s: q.s }));

describe('pigeon flights', () => {
  it('flies out along the band over its row, past the window edge, lifting off with its wings up', () => {
    const r = escape(2, board, 300, 'right', ENV, SKY)!;
    expect(r.way).toBe('right');
    const pts = onPage(r);
    expect(pts[0]).toMatchObject({ x: 590, y: 182 });
    // Ends with its whole flying box past the window's right edge.
    expect(pts[pts.length - 1].x - ENV.fly.half).toBeGreaterThan(EXITS.right);
    // Never above the band, never into a card.
    const total = lengthOfTrack(trackOf(r));
    for (const p of pts) {
      const box = around(p, envelopeAt(ENV, p.s, total, false));
      expect(box.bottom).toBeLessThanOrEqual(182);
      expect(SKY.clear(box)).toBe(true);
    }
  });

  it('goes the other way behind the rail, and away from what flushed it first', () => {
    const left = escape(2, board, 300, 'left', ENV, SKY)!;
    const end = onPage(left).at(-1)!;
    expect(end.x + ENV.fly.half).toBeLessThan(EXITS.left!);
    // A cursor to its right sends it left, one to its left right.
    expect(escapeFrom(2, board, 300, 700, ENV, SKY)!.way).toBe('left');
    expect(escapeFrom(2, board, 300, 400, ENV, SKY)!.way).toBe('right');
    // With no rail column there is no way out to the left, so it goes right.
    const phone = testSky(PAGE, { left: null, right: 1440 });
    expect(escape(2, board, 300, 'left', ENV, phone)).toBeNull();
    expect(escapeFrom(2, board, 300, 700, ENV, phone)!.way).toBe('right');
  });

  it('has no way out from a deeper row, nor through a band too low for its wings', () => {
    expect(escapeFrom(4, lower, 300, null, ENV, SKY)).toBeNull();
    // Text reaching 32px above the cards closes the band over them.
    const low = testSky(overview([{ left: 290, right: 1386, top: 130, bottom: 150 }]));
    expect(escapeFrom(2, board, 300, null, ENV, low)).toBeNull();
  });

  it('flies up and out of the top where the band is closed but the air above is open', () => {
    // A tall card on the right closes the band that way; the heading has
    // no text over the board's left half.
    const page = overview([{ left: 1000, right: 1440, top: 140, bottom: 175 }]);
    const sky = testSky({ ...page, obstacles: page.obstacles.filter((o) => o !== page.obstacles[0] && o !== page.obstacles[1]) });
    const r = escape(2, board, 100, 'right', ENV, sky)!;
    expect(r.way).toBe('top');
    const end = onPage(r).at(-1)!;
    expect(end.y + ENV.fly.down).toBeLessThan(0);
  });

  it('comes back in the way it went, landing on its spot with its landing envelope clear', () => {
    const r = routeIn(3, side, 120, 'right', ENV, SKY)!;
    const pts = trackOf(r);
    expect(pts[0].at.x + side.left - ENV.fly.half).toBeGreaterThan(EXITS.right);
    expect(pts.at(-1)!.at).toEqual({ x: 120, y: 0 });
    expect(routeClear(r, side, ENV, SKY.clear, true)).toBe(true);
    // No way in to the deeper row.
    expect(routeIn(4, lower, 300, 'right', ENV, SKY)).toBeNull();
  });

  it('speeds up evenly through the takeoff, then flies at 480px/s to its exit', () => {
    const track = trackOf(escape(2, board, 300, 'right', ENV, SKY)!);
    expect(flying(track, 0, false)).toMatchObject({ pose: 'takeoff', s: 0, done: false });
    expect(flying(track, TAKEOFF, false).s).toBeCloseTo(LIFT_RUN);
    expect(flying(track, TAKEOFF - 1, false).pose).toBe('takeoff');
    expect(flying(track, TAKEOFF + 1000, false)).toMatchObject({ pose: 'fly' });
    expect(flying(track, TAKEOFF + 1000, false).s).toBeCloseTo(LIFT_RUN + SPEED);
    // Smooth: no step in speed where the takeoff ends.
    const v = (ms: number) => flying(track, ms + 1, false).s - flying(track, ms, false).s;
    expect(v(TAKEOFF - 1)).toBeCloseTo(v(TAKEOFF + 1), 1);
    const total = durationOf(track, false);
    expect(flying(track, total + 1, false).done).toBe(true);
    expect(flying(track, total - 5, false).done).toBe(false);
  });

  it('lands slowing evenly from flying speed to a stop on its spot', () => {
    const track = trackOf(routeIn(3, side, 120, 'right', ENV, SKY)!);
    const total = durationOf(track, true);
    const cruise = total - LAND;
    expect(flying(track, cruise - 1, true).pose).toBe('fly');
    expect(flying(track, cruise + 1, true).pose).toBe('land');
    const v = (ms: number) => flying(track, ms + 1, true).s - flying(track, ms, true).s;
    expect(v(cruise - 2)).toBeCloseTo(v(cruise + 1), 1);
    expect(v(total - 2)).toBeLessThan(0.05);
    expect(flying(track, total, true)).toMatchObject({ at: { x: 120, y: 0 }, done: true });
    expect(lengthOfTrack(track) - flying(track, cruise, true).s).toBeCloseTo(LAND_RUN);
  });

  it('finds the point along a track', () => {
    const track = trackOf(escape(2, board, 300, 'right', ENV, SKY)!);
    expect(along(track, 0)).toEqual({ x: 300, y: 0 });
    expect(along(track, 1e9)).toEqual(track.at(-1)!.at);
    const mid = along(track, 200);
    expect(mid.y).toBeCloseTo(-10);
  });
});
