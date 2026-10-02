import { describe, expect, it } from 'vitest';
import { away, pose, step, type Floor, type Spider } from './spiderwalk';

const vp = { width: 1200, height: 800 };
const card = (y: number, left = 300, right = 900): Floor => ({ left, right, y });
const fixed = (v: number) => () => v;

// Runs a spider for `seconds` at 60fps and returns every state it passed
// through, so a test can ask about the journey, not just where it ended.
function run(s: Spider, floors: Map<number, Floor>, seconds: number, rand: () => number = Math.random): Spider[] {
  const trail = [s];
  for (let t = 0; t < seconds; t += 1 / 60) trail.push(step(trail[trail.length - 1], floors, vp, 1 / 60, rand));
  return trail;
}

describe('arriving', () => {
  it('lets itself down from the top of the screen onto a visible floor', () => {
    const floors = new Map([[1, card(200)]]);
    const trail = run(away(fixed(0)), floors, 10, fixed(0.5));
    const landed = trail.find((s) => s.kind === 'walk');
    expect(landed).toMatchObject({ kind: 'walk', floor: 1 });
    expect(pose(landed!, floors)?.y).toBe(200);
  });

  it('waits rather than arriving when no floor is in view', () => {
    const floors = new Map([[1, card(-400)]]);
    expect(step(away(fixed(0)), floors, vp, 1, fixed(0.5)).kind).toBe('away');
  });
});

describe('walking', () => {
  it('rides its floor when the page scrolls', () => {
    const s: Spider = { kind: 'rest', floor: 1, x: 100, dir: 1, left: 5 };
    expect(pose(s, new Map([[1, card(300)]]))).toMatchObject({ x: 400, y: 300 });
    expect(pose(s, new Map([[1, card(150)]]))).toMatchObject({ x: 400, y: 150 });
  });

  it('never walks off the end of its floor', () => {
    const floors = new Map([[1, card(300)]]);
    // rand 0.9: never chooses to drop, so it can only turn at the ends.
    const trail = run({ kind: 'walk', floor: 1, x: 300, dir: 1, left: 100 }, floors, 60, fixed(0.9));
    for (const s of trail) {
      const p = pose(s, floors);
      if (p && !p.hanging) expect(p.x).toBeGreaterThanOrEqual(300);
      if (p && !p.hanging) expect(p.x).toBeLessThanOrEqual(900);
    }
    expect(trail.some((s) => s.kind === 'walk' && s.dir === -1)).toBe(true);
  });

});

// A route change swaps every card out from under the spiders, in whatever
// state they happen to be in. None of them may throw or be drawn floating.
describe('when its floor vanishes', () => {
  const gone = new Map<number, Floor>();
  const cases: [string, Spider][] = [
    ['walking', { kind: 'walk', floor: 7, x: 50, dir: 1, left: 3 }],
    ['resting', { kind: 'rest', floor: 7, x: 50, dir: 1, left: 3 }],
    ['hanging from it', { kind: 'dangle', from: 7, x: 50, dir: 1, drop: 40, to: null, reach: 100, phase: 'hang', left: 2 }],
  ];
  it.each(cases)('a spider %s leaves and is not drawn', (_, s) => {
    expect(pose(s, gone)).toBeNull();
    expect(step(s, gone, vp, 1 / 60, fixed(0.5)).kind).toBe('away');
  });

  it('a spider dropping toward a vanished floor climbs back up', () => {
    const s: Spider = { kind: 'dangle', from: null, x: 400, dir: 1, drop: 100, to: 9, reach: Infinity, phase: 'down', left: 0 };
    expect(step(s, new Map(), vp, 1 / 60, fixed(0.5))).toMatchObject({ kind: 'dangle', phase: 'up' });
  });

  it('a floor scrolled well out of view takes its spider with it', () => {
    const s: Spider = { kind: 'walk', floor: 1, x: 50, dir: 1, left: 3 };
    expect(step(s, new Map([[1, card(-200)]]), vp, 1 / 60, fixed(0.5)).kind).toBe('away');
  });
});

describe('dangling', () => {
  it('drops from the end of one floor onto the floor below it', () => {
    const floors = new Map([
      [1, card(200)],
      [2, card(420)],
    ]);
    // rand 0.1: always chooses the thread at the end of the floor.
    const trail = run({ kind: 'walk', floor: 1, x: 570, dir: 1, left: 100 }, floors, 10, fixed(0.1));
    const firstDangle = trail.findIndex((s) => s.kind === 'dangle');
    expect(firstDangle).toBeGreaterThan(0);
    const after = trail.slice(firstDangle).find((s) => s.kind !== 'dangle');
    expect(after).toMatchObject({ kind: 'walk', floor: 2 });
  });

  it('hangs and climbs back up when there is nothing below to land on', () => {
    const floors = new Map([[1, card(300)]]);
    const trail = run({ kind: 'walk', floor: 1, x: 570, dir: 1, left: 100 }, floors, 20, fixed(0.1));
    const phases = trail.flatMap((s) => (s.kind === 'dangle' ? [s.phase] : []));
    expect(phases).toContain('hang');
    expect(phases).toContain('up');
    const deepest = Math.max(...trail.map((s) => (s.kind === 'dangle' ? s.drop : 0)));
    expect(deepest).toBeLessThanOrEqual(170);
    const back = trail.slice(trail.findIndex((s) => s.kind === 'dangle' && s.phase === 'up')).find((s) => s.kind !== 'dangle');
    expect(back).toMatchObject({ floor: 1 });
  });

  it('hangs its thread from the floor it left', () => {
    const floors = new Map([[1, card(300)]]);
    const s: Spider = { kind: 'dangle', from: 1, x: 40, dir: 1, drop: 50, to: null, reach: 100, phase: 'down', left: 0 };
    expect(pose(s, floors)).toMatchObject({ x: 340, y: 350, anchorY: 300, hanging: true });
  });
});
