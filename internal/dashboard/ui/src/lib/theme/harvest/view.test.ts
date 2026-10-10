import { describe, expect, it } from 'vitest';
import type { PageMap } from '../floors';
import { away, comeIn, standing, takeOff, type Crow } from './crow';
import { crowAir, ENVELOPES, fieldOf, inCrowAir } from './field';
import { card, OPEN, PAGE } from './fixtures';
import { arrive, departures, fly, leave } from './flight';
import { crowView } from './view';
import { reconcileChaff } from './chaff';

const memory = { walked: 0, depth: 1 };
const at = (c: Crow, now: number) => crowView(c, PAGE, now, memory);
const feet = { x: 600, y: 200 };

describe('a crow as drawn', () => {
  it('shows its mode on the ledge, and nothing away', () => {
    const c = standing(0, 1, 300, 1, 0, () => 0);
    expect(at(c, 0)?.rig.pose).toBe('stand');
    expect(at(c, 0)?.at).toEqual(feet);
    expect(at({ ...c, mode: 'walk' }, 0)?.rig.pose).toBe('walk');
    expect(at({ ...c, mode: 'peck', since: 0 }, 175)?.rig.t).toBeCloseTo(0.5);
    expect(at({ ...c, mode: 'settle', since: 0 }, 300)?.rig).toMatchObject({ pose: 'settle', t: 0.5 });
    expect(at(away(0, 10), 0)).toBeNull();
  });

  it('stands alert where its stretched neck has room, else stands with its head up', () => {
    const c = { ...standing(0, 1, 300, 1, 0, () => 0), mode: 'wary' as const };
    expect(at(c, 0)?.rig.pose).toBe('alert');
    const low: PageMap = { ...PAGE, obstacles: [{ left: 560, right: 640, top: 150, bottom: 172 }] };
    expect(crowView(c, low, 0, memory)?.rig.pose).toBe('stand');
  });

  it('takes off as its route begins, low into a skim and full into a climb, then flaps along it', () => {
    const c = standing(0, 1, 300, 1, 0, () => 0);
    const [climb, skim] = departures(feet, 1440);
    const full = takeOff(c, fly(climb, 'depart', 150, 200), 0);
    expect(at(full, 50)?.rig).toMatchObject({ pose: 'takeoff', depth: 1 });
    expect(at(full, 50)?.at).toEqual(feet);
    const low = takeOff(c, fly(skim, 'depart', 150, 200), 0);
    expect(at(low, 50)?.rig).toMatchObject({ pose: 'takeoff', depth: 0 });
    const out = { ...full, mode: 'depart' as const };
    expect(at(out, 1500)?.rig.pose).toBe('flap');
    expect(at(out, 1500)?.flying).toBe(true);
  });

  it('flares on the last stretch of an arrival', () => {
    const route = arrive(feet, 1440, OPEN, 0, 200)!;
    const c = comeIn(away(0, 0), route, 1, 300, 0);
    expect(at(c, route.duration * 0.2)?.rig.pose).toBe('flap');
    expect(at(c, route.duration * 0.995)?.rig.pose).toBe('flare');
  });
});

describe('the crows’ air', () => {
  const page: PageMap = { ...PAGE, obstacles: [{ ...card(300, 1300, 200), left: 300, right: 1300, top: 200, bottom: 400, block: true }, { left: 320, right: 500, top: 220, bottom: 236 }] };
  const inside = inCrowAir(crowAir(page));
  const box = (top: number, bottom: number) => ({ left: 600, right: 640, top, bottom });

  it('lets a crow reach 6px into a card, never its inside, nor near its text', () => {
    expect(inside(box(150, 205))).toBe(true);
    expect(inside(box(150, 207))).toBe(false);
    expect(inside({ left: 330, right: 360, top: 150, bottom: 205 })).toBe(true);
    expect(inside({ left: 330, right: 360, top: 150, bottom: 219 })).toBe(false);
  });

  it('opens past the top and the right edges, never the rail', () => {
    expect(inside({ left: 1450, right: 1500, top: 100, bottom: 150 })).toBe(true);
    expect(inside({ left: 600, right: 640, top: -80, bottom: -30 })).toBe(true);
    expect(inside({ left: 100, right: 140, top: 100, bottom: 150 })).toBe(false);
  });

  it('sweeps each piece of a route with its own envelope, a low take-off lower than a full one', () => {
    expect(ENVELOPES.depart.lift.up).toBeLessThan(ENVELOPES.depart.hop.up);
    expect(ENVELOPES.arrive.lift.up).toBeLessThan(ENVELOPES.arrive.hop.up);
    const field = fieldOf(page, reconcileChaff(page.floors, page.obstacles));
    expect(leave(feet, 1440, field.clear, 0, 200)).not.toBeNull();
  });
});
