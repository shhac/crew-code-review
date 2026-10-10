import { describe, expect, it } from 'vitest';
import { seeded } from '../test-scene';
import { anchor, around } from './air';
import { cupidView, dodge, flightCurve, fresh, hoverAt, reconcileCupid, stepCupid, where, type Cupid } from './cupid';
import { airFor, page } from './fixtures';
import { FOOTPRINTS } from './footprints';

const air = airFor();
const hovering = (x: number, y: number, over: Partial<Cupid> = {}): Cupid => ({ ...hoverAt(fresh(0), anchor(air.page, { x, y })!, 0, Infinity), ...over });

describe('a cupid', () => {
  it('flits to another spot when restless, along a clear curve, and hovers there', () => {
    const c = hovering(1100, 60, { restless: 0 });
    const off = stepCupid(c, air, 16, 16, seeded(2), null);
    expect(off.mode).toBe('flit');
    const done = Array.from({ length: 400 }, (_, i) => 32 + i * 16).reduce((s, t) => stepCupid(s, air, t, 16, seeded(2), null), off);
    expect(done.mode).toBe('hover');
    expect(done.flight).toBeNull();
    expect(where(done, air.page, 0)).not.toEqual(where(c, air.page, 0));
  });

  it('pitches forward and speeds up then slows along a flit, eased', () => {
    const off = stepCupid(hovering(1100, 60, { restless: 0 }), air, 16, 16, seeded(2), null);
    const f = off.flight!;
    const mid = cupidView(off, air.page, f.start + f.duration / 2)!;
    const end = cupidView(off, air.page, f.start + f.duration * 0.98)!;
    expect(mid.pose).toBe('flight');
    expect(mid.speed).toBeGreaterThan(end.speed);
  });

  it('does not flit while another is shooting', () => {
    const c = hovering(1100, 60, { restless: 0 });
    const other = { ...hovering(700, 60), id: 1, mode: 'draw' as const };
    expect(stepCupid(c, air, 16, 16, seeded(2), null, [other]).mode).toBe('hover');
  });

  it('dodges a fast cursor passing close, away from it, and calms down before dodging again', () => {
    const c = hovering(1100, 60);
    const here = where(c, air.page, 0)!;
    const dodged = dodge(c, air, 100, { x: here.x - 80, y: here.y + 10 }, { x: here.x + 20, y: here.y }, []);
    expect(dodged.mode).toBe('dodge');
    const curve = flightCurve(air.page, dodged.flight!)!;
    expect(Math.hypot(curve.to.x - here.x - 20, curve.to.y - here.y)).toBeGreaterThan(60);
    expect(dodge(dodged, air, 200, here, { x: here.x + 1, y: here.y }, [])).toBe(dodged);
  });

  it('ignores a fast cursor passing far away', () => {
    const c = hovering(1100, 60);
    expect(dodge(c, air, 100, { x: 300, y: 600 }, { x: 400, y: 600 }, [])).toBe(c);
  });

  it('flutters in place when there is nowhere to dodge to', () => {
    const tiny = airFor(page([], [[1, { left: 300, right: 400, y: 100, base: 100, room: 40, headroom: Infinity, kind: 'heading' }]]), { left: 290, right: 410, top: 40, bottom: 110 });
    const c = { ...hoverAt(fresh(0), anchor(tiny.page, { x: 350, y: 70 })!, 0, Infinity) };
    const startled = dodge(c, tiny, 100, { x: 300, y: 70 }, { x: 352, y: 70 }, []);
    expect(startled.flight).toBeNull();
    expect(startled.flutter).toBeGreaterThan(100);
  });

  it('keeps hovering where its spot still holds after a layout change', () => {
    const c = hovering(1100, 60);
    expect(reconcileCupid(c, air, 100, seeded(1))).toBe(c);
  });

  it('flies to clear air when its spot is covered, and never lands over what covered it', () => {
    const c = hovering(1100, 60);
    const blot = { left: 1060, right: 1140, top: 20, bottom: 100 };
    const covered = airFor(page([...air.page.obstacles, blot]));
    const moved = reconcileCupid(c, covered, 100, seeded(1))!;
    expect(moved).not.toBeNull();
    const spot = moved.flight ? flightCurve(covered.page, moved.flight)!.to : where(moved, covered.page, 0)!;
    const box = around(spot, FOOTPRINTS.hover);
    expect(box.right <= blot.left || box.left >= blot.right || box.bottom <= blot.top || box.top >= blot.bottom).toBe(true);
  });

  it('is placed afresh, fading in, when its ledge is gone', () => {
    const c = hovering(1100, 60);
    const gone = airFor(page(air.page.obstacles, [[2, air.page.floors.get(2)!], [3, air.page.floors.get(3)!]]));
    const back = reconcileCupid(c, gone, 100, seeded(1))!;
    expect(back.mode).toBe('enter');
    expect(cupidView(back, gone.page, 100)!.opacity).toBe(0);
    expect(cupidView(back, gone.page, 500)!.opacity).toBe(1);
  });

  it('flies on through a layout change that leaves its way clear', () => {
    const off = stepCupid(hovering(1100, 60, { restless: 0 }), air, 16, 16, seeded(2), null);
    expect(reconcileCupid(off, air, 200, seeded(1))).toBe(off);
  });
});
