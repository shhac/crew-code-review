import { describe, expect, it } from 'vitest';
import type { Cursor } from '../pointer';
import type { Chaff, Grain } from './chaff';
import { BILL, CALM, CROUCH, FIRST_SCAN, PECK, SCAN, SETTLE, SIDLE, SIDLE_MOST, SPRING, standing, stepCrow, takeOff, comeIn, WALK, WALK_MOST, type Bite, type Crow, type Ground } from './crow';
import { PAGE, OPEN, seeded } from './fixtures';
import { arrive, leave } from './flight';

// Grain only where a test puts it, on ledge 1 (left 300, y 200).
const grain = (x: number): Grain => ({ key: `g${x}`, x, tilt: 0, eaten: null, quiet: -Infinity, back: -Infinity });
const chaffOf = (...xs: number[]): ReadonlyMap<number, Chaff> => new Map([[1, { stalks: [], straw: ['', ''], nodes: '', grains: xs.map(grain) }]]);
const ground = (over: Partial<Ground> = {}): Ground => ({ scene: PAGE, chaff: chaffOf(), now: 0, dt: 16, rand: seeded(3), cursor: null, others: [], ...over });

// Steps a crow frame by frame from `from` for ms, collecting its bites and
// every state it passed through.
function run(c: Crow, from: number, ms: number, over: Partial<Ground> = {}, cursorAt?: (now: number) => Cursor | null) {
  return Array.from({ length: Math.ceil(ms / 16) }, (_, i) => from + (i + 1) * 16).reduce(
    (acc, now) => {
      const { crow, bite } = stepCrow(acc.crow, ground({ ...over, now, cursor: cursorAt ? cursorAt(now) : over.cursor ?? null }));
      return { crow, bites: bite ? [...acc.bites, bite] : acc.bites, states: [...acc.states, crow] };
    },
    { crow: c, bites: [] as Bite[], states: [] as Crow[] },
  );
}
const at = (x: number, dir: 1 | -1 = 1, until = 0): Crow => ({ ...standing(0, 1, x, dir, 0, () => 0), until });

describe('a crow on a ledge', () => {
  it('pecks when its scan ends with grain under its bill, in bouts of two to five pecks of 0.35s', () => {
    const { states, bites } = run(at(200), 0, 3000, { chaff: chaffOf(200 + BILL) });
    const bout = states.filter((s) => s.mode === 'peck');
    expect(bout.length).toBeGreaterThan(0);
    const pecks = bout[0].pecks;
    expect(pecks).toBeGreaterThanOrEqual(2);
    expect(pecks).toBeLessThanOrEqual(5);
    expect(bout[0].until - bout[0].since).toBe(pecks * PECK);
    // Every peck of the first bout bites where the bill comes down.
    expect(bites.slice(0, pecks).every((b) => b.floor === 1 && b.x === 200 + BILL)).toBe(true);
  });

  it('walks to grain along its run at 20px/s, stopping with its bill over it, then pecks', () => {
    const { states } = run(at(200), 0, 4000, { chaff: chaffOf(200 + BILL + 50) });
    const stop = states.findIndex((s) => s.mode !== 'walk');
    const walking = states.slice(0, stop);
    expect(walking.length).toBeGreaterThan(0);
    const steps = walking.slice(1).map((s, i) => Math.abs(s.x - walking[i].x));
    expect(Math.max(...steps)).toBeCloseTo((WALK * 16) / 1000, 5);
    const after = states[stop];
    expect(after.mode).toBe('peck');
    expect(after.x).toBeCloseTo(250);
  });

  it('turns to grain behind it, and wanders at most 60px when none is near', () => {
    const behind = run(at(400, 1), 0, 300, { chaff: chaffOf(340) }).states.find((s) => s.mode === 'walk')!;
    expect(behind.dir).toBe(-1);
    expect(behind.target).toBeCloseTo(340 + BILL);
    const wander = run(at(400), 0, 300).states.find((s) => s.mode === 'walk')!;
    expect(Math.abs(wander.target - 400)).toBeLessThanOrEqual(WALK_MOST);
  });

  it('stops 60px short of another crow and never passes it', () => {
    const other = { ...standing(1, 1, 300, -1, 0, () => 0), until: Infinity };
    const { states } = run(at(200), 0, 6000, { chaff: chaffOf(300), others: [other] });
    expect(Math.max(...states.map((s) => s.x))).toBeLessThanOrEqual(240 + 1e-6);
  });

  it('settles for 0.6s on landing, then looks about 1.5 to 3s the first time and 0.8 to 2s after', () => {
    const settle = { ...at(200), mode: 'settle' as const, since: 0, until: SETTLE };
    const { states } = run(settle, 0, 700);
    const scan = states.find((s) => s.mode === 'scan')!;
    expect(scan.since).toBeGreaterThanOrEqual(SETTLE);
    expect(scan.until - scan.since).toBeGreaterThanOrEqual(FIRST_SCAN.lo);
    expect(scan.until - scan.since).toBeLessThanOrEqual(FIRST_SCAN.hi);
    const later = run(at(200), 0, 6000, { chaff: chaffOf(200 + BILL) }).states.filter((s) => s.mode === 'scan' && s.since > 0);
    for (const s of later) {
      expect(s.until - s.since).toBeGreaterThanOrEqual(SCAN.lo);
      expect(s.until - s.since).toBeLessThanOrEqual(SCAN.hi);
    }
  });

  it('grows wary of a cursor within 70px, facing it, until it has stayed away 1.2s', () => {
    // The crow's middle is at page (600, 187).
    const near = (now: number): Cursor | null => (now < 1000 ? { x: 650, y: 187, at: now } : { x: 900, y: 187, at: now });
    const { states } = run(at(300, -1, 5000), 0, 3000, {}, near);
    const wary = states.filter((s) => s.mode === 'wary');
    expect(wary[0].dir).toBe(1);
    const calm = states.find((s) => s.mode === 'scan' && s.since > 1000)!;
    expect(calm.since).toBeGreaterThanOrEqual(1000 + CALM - 16);
    expect(calm.since).toBeLessThan(1000 + CALM + 40);
    // A cursor that stops nearby counts only for 1.2s.
    const resting = run(at(300, -1, 5000), 0, 3000, {}, () => ({ x: 650, y: 187, at: 0 })).states;
    expect(resting.at(-1)!.mode).not.toBe('wary');
  });

  it('sidles away at 45px/s, 30px at most, from a cursor coming at it, then stands wary', () => {
    const coming = (now: number): Cursor => ({ x: 690 - now / 10, y: 187, at: now });
    const { states } = run(at(300, 1, 5000), 0, 1500, {}, coming);
    const sidle = states.filter((s) => s.mode === 'sidle');
    expect(sidle.length).toBeGreaterThan(0);
    expect(sidle[0].dir).toBe(-1);
    const steps = states.slice(1).flatMap((s, i) => (s.mode === 'sidle' && states[i].mode === 'sidle' ? [Math.abs(s.x - states[i].x)] : []));
    expect(Math.max(...steps)).toBeCloseTo((SIDLE * 16) / 1000, 5);
    // Each sidle goes 30px at most; a cursor that keeps coming sends it on again.
    const starts = states.flatMap((s, i) => (s.mode === 'sidle' && states[i - 1]?.mode !== 'sidle' ? [i] : []));
    for (const i of starts) {
      const end = states.findIndex((s, j) => j > i && s.mode !== 'sidle');
      expect(Math.abs(states.at(end)!.x - (states[i - 1]?.x ?? 300))).toBeLessThanOrEqual(SIDLE_MOST + 1e-6);
    }
    expect(states.some((s, i) => s.mode === 'wary' && states[i - 1]?.mode === 'sidle')).toBe(true);
  });

  it('never flies from the cursor alone', () => {
    const swirl = (now: number): Cursor => ({ x: 600 + 30 * Math.cos(now / 100), y: 187 + 20 * Math.sin(now / 100), at: now });
    const { states } = run(at(300, 1, 0), 0, 10000, { chaff: chaffOf(330, 360) }, swirl);
    expect(states.every((s) => ['scan', 'walk', 'peck', 'wary', 'sidle'].includes(s.mode))).toBe(true);
  });
});

describe('a crow in the air', () => {
  it('crouches and springs for 0.27s, flies its route out, and is away once past the edge', () => {
    const route = leave({ x: 600, y: 200 }, 1440, OPEN, CROUCH, 200)!;
    const off = takeOff(at(300), route, 0);
    expect(off.mode).toBe('takeoff');
    const { states } = run(off, 0, route.duration + 400);
    const depart = states.find((s) => s.mode === 'depart')!;
    expect(depart.since).toBeGreaterThanOrEqual(CROUCH + SPRING);
    const gone = states.find((s) => s.mode === 'away')!;
    expect(gone.since).toBeGreaterThanOrEqual(CROUCH + route.duration);
    expect(gone.from).toEqual({ floor: 1, x: 300 });
  });

  it('comes in along its route and settles where it lands, facing the way it came', () => {
    const route = arrive({ x: 600, y: 200 }, 1440, OPEN, 0, 200)!;
    const coming = comeIn({ ...at(0), mode: 'away' }, route, 1, 300, 0);
    const { states } = run(coming, 0, route.duration + 100);
    const landed = states.find((s) => s.mode === 'settle')!;
    expect(landed.since).toBeGreaterThanOrEqual(route.duration);
    expect([landed.floor, landed.x]).toEqual([1, 300]);
    expect(landed.flight).toBeNull();
  });
});
