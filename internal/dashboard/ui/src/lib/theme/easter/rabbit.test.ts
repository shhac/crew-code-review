import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { fixed, scene, seeded, steps } from '../test-scene';
import { AT_REST, createRabbit, fresh, NUDGE, POSES, rabbitView, reconcileRabbit, restingRabbit, stepRabbit, THUMP, type Rabbit } from './rabbit';
import { HOP_LENGTH } from './rabbit-rig';

const ledge = (y: number, left = 100, right = 700): Ledge => ({ left, right, y, base: y + 200, room: 40, headroom: Infinity, kind: 'card' });
const page = scene([[1, ledge(300)], [2, ledge(500)]]);
const sitting = (over: Partial<Rabbit> = {}): Rabbit => ({ ...createRabbit(page, 0, fixed(0.5))!, until: Infinity, ...over });
const centre = (r: Rabbit) => ({ x: page.floors.get(r.floor)!.left + r.x, y: page.floors.get(r.floor)!.y - 13 });
const run = (r: Rabbit, from: number, to: number, cursor: (t: number) => { x: number; y: number } | null = () => null, rand = seeded(7), canLay = () => false) =>
  steps(r, from, to, (s, t) => stepRabbit(s, page, t, 50, rand, cursor(t) && { ...cursor(t)!, at: t }, [], canLay));

describe('a rabbit', () => {
  it('sits on a clear run in view, its whole body on it', () => {
    const r = createRabbit(page, 0, fixed(0.5))!;
    expect(r.mode).toBe('sit');
    expect(r.x).toBeGreaterThanOrEqual(8 + POSES.hop.width / 2);
    expect(r.x).toBeLessThanOrEqual(600 - 8 - POSES.hop.width / 2);
    expect(r.walked).toBe(AT_REST);
  });

  it('finds no seat where text comes down to every ledge', () => {
    const covered = scene([[1, ledge(300)]], [{ left: 0, right: 1000, top: 250, bottom: 290 }]);
    expect(createRabbit(covered, 0, fixed(0.5))).toBeNull();
  });

  it('sits up on alert when a cursor passes, then settles again', () => {
    const r = sitting();
    const states = run(r, 0, 3000, (t) => (t < 200 ? { x: centre(r).x + 70, y: centre(r).y } : null));
    expect(states.some((s) => s.mode === 'alert')).toBe(true);
    expect(states.at(-1)!.mode).toBe('sit');
  });

  it('thumps when a cursor lingers, then bolts away from it and out at its ledge end', () => {
    const r = sitting();
    const cursor = { x: centre(r).x + 20, y: centre(r).y };
    const states = run(r, 0, 7000, (t) => (t < 1500 ? cursor : null));
    const thump = states.findIndex((s) => s.mode === 'thump');
    expect(thump).toBeGreaterThan(0);
    const after = states.slice(thump);
    expect(after.findIndex((s) => s.mode === 'bolt')).toBeGreaterThan(0);
    const bolt = after.find((s) => s.mode === 'bolt')!;
    expect(bolt.dir).toBe(-1);
    expect(after.some((s) => s.mode === 'away')).toBe(true);
    // Thumping lasts THUMP.
    expect(after.findIndex((s) => s.mode !== 'thump') * 50).toBeGreaterThanOrEqual(THUMP - 50);
  });

  it('comes back in at another ledge end after a while away', () => {
    const r = sitting();
    const cursor = { x: centre(r).x + 20, y: centre(r).y };
    const states = run(r, 0, 12000, (t) => (t < 1500 ? cursor : null));
    const back = states.findIndex((s, i) => i > 0 && states[i - 1].mode === 'away' && s.mode !== 'away');
    expect(back).toBeGreaterThan(0);
    expect(states[back].floor).toBe(2);
    expect(['enter', 'sit']).toContain(states[back].mode);
  });

  it('hops in whole hops, its feet at rest between them where its cycle starts', () => {
    const states = run(sitting({ until: 0 }), 0, 20000, () => null, seeded(3));
    const resting = states.filter((s) => s.mode === 'sit');
    expect(states.some((s) => s.mode === 'hop' || s.mode === 'exit')).toBe(true);
    for (const s of resting) {
      const hops = (s.walked - AT_REST) / HOP_LENGTH;
      expect(Math.abs(hops - Math.round(hops))).toBeLessThan(1e-6);
    }
  });

  it('never walks its body off the clear run while hopping along it', () => {
    const states = run(sitting({ until: 0 }), 0, 30000, () => null, seeded(11));
    for (const s of states) {
      if (s.mode === 'away' || s.mode === 'exit' || s.mode === 'enter' || s.mode === 'bolt') continue;
      expect(s.x).toBeGreaterThanOrEqual(8 + POSES.hop.width / 2 - 1e-6);
      expect(s.x).toBeLessThanOrEqual(600 - 8 - POSES.hop.width / 2 + 1e-6);
    }
  });

  it('hops to a free ledge end, nudges an egg there and hops away', () => {
    const states = Array.from({ length: 40 }, (_, seed) => run(sitting({ until: 0 }), 0, 20000, () => null, seeded(seed), () => true)).find((s) => s.some((r) => r.left))!;
    expect(states).toBeDefined();
    const at = states.findIndex((r) => r.left);
    const nudge = states.findIndex((r) => r.mode === 'nudge');
    expect(nudge).toBeGreaterThan(0);
    expect(at - nudge).toBeGreaterThanOrEqual(NUDGE / 50 - 1);
    const left = states[at].left!;
    const r = states[nudge];
    // Facing the end, its nose near the egg.
    expect(r.dir).toBe(left.end === 'left' ? -1 : 1);
    const egg = left.end === 'left' ? 10 : 590;
    expect(Math.abs(r.x + r.dir * 17 - egg)).toBeLessThanOrEqual(HOP_LENGTH / 2 + 1e-6);
    expect(['hop', 'sit']).toContain(states[at].mode);
  });

  it('is drawn where it sits, and out of sight while away', () => {
    const r = sitting();
    expect(rabbitView(r, page)).toMatchObject({ x: 100 + r.x, y: 300, pose: 'sit', opacity: 1 });
    expect(rabbitView({ ...r, mode: 'away' }, page)).toBeNull();
    expect(rabbitView({ ...r, mode: 'alert', tall: true }, page)!.pose).toBe('alert');
    expect(rabbitView({ ...r, mode: 'alert', tall: false }, page)!.pose).toBe('sit');
  });

  it('keeps its seat over a layout change while the run under it stays clear', () => {
    const r = sitting();
    const moved = scene([[1, ledge(260)], [2, ledge(500)]]);
    expect(reconcileRabbit(r, moved, 0, fixed(0.5))).toEqual(r);
    const covered = scene([[1, ledge(300)], [2, ledge(500)]], [{ left: 100 + r.x - 20, right: 100 + r.x + 20, top: 250, bottom: 296 }]);
    const placed = reconcileRabbit(r, covered, 0, fixed(0.5))!;
    expect(Math.abs(placed.x - r.x) > 20 || placed.floor !== r.floor).toBe(true);
    expect(placed.id).toBe(r.id);
  });

  it('cuts its hops short where its run shrinks', () => {
    const r = { ...sitting(), mode: 'hop' as const, hops: 10, hop: null, dir: 1 as const };
    const shrunk = scene([[1, ledge(300)], [2, ledge(500)]], [{ left: 100 + r.x + 120, right: 800, top: 250, bottom: 296 }]);
    const kept = reconcileRabbit(r, shrunk, 0, fixed(0.5))!;
    expect(kept.hops).toBeLessThan(10);
    expect(kept.x + kept.hops * HOP_LENGTH).toBeLessThanOrEqual(r.x + 120 - POSES.hop.width / 2 + 1e-6);
  });

  it('sits still under reduced motion, keeping its seat across measurements', () => {
    const first = restingRabbit(page, null)!;
    expect(first.mode).toBe('sit');
    expect(first.until).toBe(Infinity);
    expect(restingRabbit(page, first)).toEqual(first);
    expect(restingRabbit(page, { ...first, mode: 'hop', walked: 99 })!.x).toBe(first.x);
    expect(fresh(2).seed).toBe(3);
  });
});
