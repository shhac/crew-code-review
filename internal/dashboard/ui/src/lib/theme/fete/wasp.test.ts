import { describe, expect, it } from 'vitest';
import { meets } from '../air';
import { seeded } from '../test-scene';
import { windowEdge, type WaspAir } from './air';
import { TALL, places, run } from './fixtures';
import { CAKE } from './table';
import { boxOf, claimsOf, where, type Mode, type Pointer } from './wasp';
import { placeWasps } from './wasps';

describe('how a wasp behaves', () => {
  it('circle, inspect, land, feed, take off, back away and circle again', () => {
    const seen: Mode[] = [];
    const start = placeWasps({ air: TALL, places, now: 0, rand: () => 0.1 });
    run(start, () => TALL, 0, 30000, () => 0.1, () => null, (w) => { if (seen.at(-1) !== w[0].mode) seen.push(w[0].mode); });
    expect(seen.slice(0, 7)).toEqual(['circle', 'inspect', 'land', 'feed', 'takeoff', 'depart', 'circle']);
  });

  it('face the cake as they circle, turning about as they pass in front of it', () => {
    const faces: { side: number; face: number }[] = [];
    run(placeWasps({ air: TALL, places, now: 0, rand: () => 0.9 }), () => TALL, 0, 6000, () => 0.9, () => null, (w, now) => {
      if (w[0].mode !== 'circle') return;
      const p = where(w[0], places, now)!;
      faces.push({ side: Math.sign(p.x - CAKE.x), face: w[0].face });
    });
    const settledFaces = faces.filter((f, i) => i > 10 && faces.slice(i - 10, i).every((g) => g.side === f.side));
    expect(settledFaces.length).toBeGreaterThan(50);
    settledFaces.forEach((f) => expect(f.face).toBe(-f.side));
  });

  it('a fast cursor near a wasp chases it out past the window\'s edge, and it comes back later to circle', () => {
    const start = placeWasps({ air: TALL, places, now: 0, rand: seeded(3) });
    const at = where(start[0], places, 16)!;
    const cursor = (now: number): Pointer | null => (now < 200 ? { x: at.x + 20, y: at.y + 5, at: now, speed: 400 } : null);
    const modes: Mode[] = [];
    const exits: number[] = [];
    run(start, () => TALL, 0, 25000, seeded(3), cursor, (w, now) => {
      if (modes.at(-1) !== w[0].mode) modes.push(w[0].mode);
      if (w[0].mode === 'flee') exits.push(boxOf(w[0], places, now)!.right);
    });
    expect(modes.slice(0, 4)).toEqual(['flee', 'away', 'return', 'circle']);
    expect(Math.min(...exits)).toBeLessThan(windowEdge(TALL));
  });

  it('stays away while a cursor rests near the cake, and lands nowhere near one', () => {
    const start = placeWasps({ air: TALL, places, now: 0, rand: seeded(3) });
    const at = where(start[0], places, 16)!;
    const parked: Pointer = { x: CAKE.x, y: CAKE.y - 10, at: 0, speed: 0 };
    const cursor = (now: number): Pointer => (now < 200 ? { x: at.x + 20, y: at.y + 5, at: now, speed: 400 } : { ...parked, at: 200 });
    const after = run(start, () => TALL, 0, 30000, seeded(3), cursor);
    expect(after[0].mode).toBe('away');
    // Wasp 1 kept on, but never landed on the cake's side.
    const landed: number[] = [];
    run(placeWasps({ air: TALL, places, now: 0, rand: () => 0.1 }), () => TALL, 0, 20000, () => 0.1, () => parked, (w) => { if (w[0].mode === 'land') landed.push(0); });
    expect(landed).toEqual([]);
  });

  it('ignores a cursor that is still, however near', () => {
    const start = placeWasps({ air: TALL, places, now: 0, rand: seeded(3) });
    const at = where(start[0], places, 16)!;
    const after = run(start, () => TALL, 0, 1000, seeded(3), () => ({ x: at.x, y: at.y, at: 0, speed: 0 }));
    expect(after.map((w) => w.mode)).toEqual(['circle', 'circle']);
  });

  it('with no clear way out, dodges to the far side of its orbit', () => {
    // A lane too thin for a wasp to fly along.
    const air: WaspAir = { ...TALL, lane: { ...TALL.lane, bottom: TALL.lane.top + 8 } };
    const start = placeWasps({ air, places, now: 0, rand: seeded(3) });
    const at = where(start[0], places, 16)!;
    const after = run(start, () => air, 0, 32, seeded(3), (now) => ({ x: at.x + 15, y: at.y, at: now, speed: 400 }));
    expect(after[0].mode).toBe('dodge');
  });

  it('keep clear of what the other has claimed, wherever it is going', () => {
    const wasps = placeWasps({ air: TALL, places, now: 0, rand: seeded(5) });
    const claims = claimsOf(wasps[1], places, 0);
    expect(claims.some((c) => meets(c, boxOf(wasps[0], places, 0)!))).toBe(false);
  });
});
