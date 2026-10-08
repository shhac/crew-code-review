import { describe, expect, it } from 'vitest';
import type { Ledge, PageMap } from '../floors';
import type { Cursor } from '../pointer';
import { fixed, scene, steps } from '../test-scene';
import { createFox, FADE, foxView, POSES, reconcileFox, restingFox, stepFox, type Fox, type Trip } from './fox';

// A heading rule with room above it, and a card top below with the 22px the
// dashboard's first row of cards has.
const rule: Ledge = { left: 100, right: 700, y: 200, base: 200, room: 40, headroom: Infinity, kind: 'heading' };
const card: Ledge = { left: 100, right: 400, y: 222, base: 500, room: 22, headroom: 22, kind: 'card' };
const still = (x: number, y: number, at = -Infinity): Cursor => ({ x, y, at });

// Runs the fox forward in 50ms steps, keeping every state it passes through.
const trace = (fox: Fox, s: PageMap, from: number, to: number, cursor: (t: number) => Cursor | null = () => null, rand = fixed(0.5)) =>
  steps(fox, from, to, (f, t) => stepFox(f, s, t, 50, rand, cursor(t)));
const modes = (states: Fox[]) => states.map((f) => f.mode).filter((m, i, all) => m !== all[i - 1]);
const asleep = (floor: number, x: number, over: Partial<Fox> = {}): Fox => ({ ...createFox(scene([[floor, floor === 1 ? rule : card]]), 0, fixed(0.5))!, floor, x, until: Infinity, ...over });

describe('fox placement', () => {
  it('curls up on the longest clear stretch in view', () => {
    const fox = createFox(scene([[1, rule], [2, card]]), 0, fixed(0.5))!;
    expect(fox).toMatchObject({ floor: 1, mode: 'asleep' });
    expect(fox.x).toBeCloseTo(300, 0);
  });

  it('finds nowhere when text crowds every ledge or none is in view', () => {
    expect(createFox(scene([[1, rule]], [{ left: 0, right: 1000, top: 150, bottom: 190 }]), 0, fixed(0.5))).toBeNull();
    expect(createFox(scene([[1, { ...rule, y: 20 }]]), 0, fixed(0.5))).toBeNull();
  });

  it('sleeps through reduced motion where it lay, and in the middle of a fresh stretch otherwise', () => {
    const s = scene([[1, rule]]);
    const lay = { ...asleep(1, 150), mode: 'trot' as const };
    expect(restingFox(s, lay)).toMatchObject({ floor: 1, x: 150, mode: 'asleep', until: Infinity });
    expect(restingFox(s, null)).toMatchObject({ floor: 1, x: 300 });
  });
});

describe('fox asleep', () => {
  const s = scene([[1, rule]]);
  const fox = asleep(1, 300);
  const at = { x: rule.left + 300, y: rule.y - 8 };

  it('twitches an ear at a passing cursor, then rests the ear', () => {
    const passing = (t: number) => still(at.x + 90, at.y, t);
    const states = trace(fox, s, 0, 2000, passing);
    const ups = states.filter((f, i) => i > 0 && f.ear !== states[i - 1].ear);
    expect(ups.length).toBe(2);
    expect(foxView(states[1], s, 100)!.pose).toBe('alert');
    expect(foxView(states[1], s, 600)!.pose).toBe('curled');
    expect(states.at(-1)!.mode).toBe('asleep');
  });

  it('ignores a cursor that has stopped moving out of reach', () => {
    expect(trace(fox, s, 0, 3000, () => still(at.x + 90, at.y)).every((f) => f.ear === 0 && f.mode === 'asleep')).toBe(true);
  });

  it('wakes when the cursor lingers close, moving or not', () => {
    const states = trace(fox, s, 0, 1400, () => still(at.x + 40, at.y));
    expect(states.at(-1)!.mode).toBe('asleep');
    expect(trace(states.at(-1)!, s, 1450, 1600, () => still(at.x + 40, at.y)).at(-1)!.mode).toBe('waking');
  });

  it('starts the wait over when the cursor goes', () => {
    const cursor = (t: number) => (t < 1000 || t > 1200 ? still(at.x + 40, at.y) : null);
    expect(trace(fox, s, 0, 2000, cursor).at(-1)!.mode).toBe('asleep');
  });
});

describe('fox woken by the cursor', () => {
  it('stretches, then trots off its ledge and in at another, away from the cursor', () => {
    const lower = { ...card, left: 100, right: 700, y: 260, headroom: 60 };
    const far = { ...card, left: 600, right: 900, y: 600, headroom: 60 };
    const s = scene([[1, rule], [2, lower], [3, far]]);
    const cursor = still(rule.left + 300 + 40, rule.y - 8);
    const states = trace(asleep(1, 300), s, 0, 30000, () => cursor);
    expect(modes(states).slice(0, 8)).toEqual(['asleep', 'waking', 'stretch', 'exit', 'away', 'enter', 'settle', 'asleep']);
    const landed = states.find((f) => f.mode === 'enter')!;
    expect(landed.floor).toBe(3);
    expect(states.at(-1)).toMatchObject({ floor: 3, mode: 'asleep' });
  });

  it('skips the stretch where there is no room to stand that tall', () => {
    const s = scene([[2, card]]);
    const cursor = still(card.left + 150 + 40, card.y - 8);
    expect(modes(trace(asleep(2, 150), s, 0, 4000, () => cursor)).slice(0, 3)).toEqual(['asleep', 'waking', 'trot']);
  });

  it('with no other ledge, moves along its own, away from the cursor', () => {
    const s = scene([[1, rule]]);
    const cursor = still(rule.left + 300 - 40, rule.y - 8);
    const trotting = trace(asleep(1, 300), s, 0, 4000, () => cursor).find((f) => f.mode === 'trot')!;
    expect(trotting.dir).toBe(1);
    expect(trotting.target - 300).toBeGreaterThanOrEqual(60);
  });

  it('curls back up where it is when there is nowhere to go', () => {
    const short = { ...card, right: 160, headroom: 60 };
    const s = scene([[2, short]]);
    const fox = asleep(2, 30);
    const cursor = still(short.left + 30 + 40, short.y - 8);
    const states = trace(fox, s, 0, 4000, () => cursor);
    expect(modes(states).slice(0, 4)).toEqual(['asleep', 'waking', 'stretch', 'settle']);
    expect(states.every((f) => f.floor === 2 && f.x === 30)).toBe(true);
  });

  it('fades out at the end of its ledge and in at the next, never drawn between', () => {
    const lower = { ...card, y: 300, headroom: 60 };
    const s = scene([[1, rule], [2, lower]]);
    const states = trace(asleep(1, 300), s, 0, 30000, () => still(rule.left + 340, rule.y - 8));
    const views = states.map((f, i) => [f, foxView(f, s, (i - 1) * 50)] as const);
    for (const [f, v] of views) {
      if (f.mode === 'away') expect(v).toBeNull();
      if (f.mode === 'exit') expect(v!.opacity).toBeCloseTo(Math.min(1, Math.abs(f.target - f.x) / FADE));
    }
    expect(views.filter(([f]) => f.mode === 'exit').at(-1)![1]!.opacity).toBeLessThan(0.2);
    expect(views.find(([f]) => f.mode === 'enter')![1]!.opacity).toBeLessThan(0.2);
  });

  it('turns up asleep elsewhere when the ledge it was heading for has gone', () => {
    const lower = { ...card, y: 300, headroom: 60 };
    const states = trace(asleep(1, 300), scene([[1, rule], [2, lower]]), 0, 30000, () => still(rule.left + 340, rule.y - 8));
    const away = states.find((f) => f.mode === 'away')!;
    const after = stepFox(away, scene([[1, rule]]), away.until + 1, 50, fixed(0.5), null);
    expect(after).toMatchObject({ floor: 1, mode: 'asleep' });
  });
});

describe('fox on its own', () => {
  it('wakes when restless and pounces where there is room, the arc held under the clear space', () => {
    const s = scene([[1, rule]], [{ left: 0, right: 1000, top: 140, bottom: 160 }]);
    const fox = asleep(1, 300, { until: 100 });
    const states = trace(fox, s, 0, 5000);
    expect(modes(states).slice(0, 6)).toEqual(['asleep', 'waking', 'crouch', 'leap', 'dig', 'settle']);
    const leaps = states.map((f, i) => [f, foxView(f, s, (i - 1) * 50)!] as const).filter(([f]) => f.mode === 'leap');
    const top = Math.min(...leaps.map(([, v]) => v.y - POSES.pounce.height));
    expect(top).toBeGreaterThanOrEqual(160);
    expect(Math.min(...leaps.map(([, v]) => v.y))).toBeLessThan(rule.y - 2);
    expect(Math.abs(states.at(-1)!.x - 300)).toBe(36);
  });

  it('trots somewhere else instead where a pounce would not fit', () => {
    const s = scene([[2, card]]);
    const states = trace(asleep(2, 150, { until: 100 }), s, 0, 2000);
    expect(modes(states).slice(0, 3)).toEqual(['asleep', 'waking', 'trot']);
  });

  it('lies down facing the way it came in, and stays asleep a good while', () => {
    const s = scene([[1, rule]]);
    const states = trace(asleep(1, 300, { mode: 'trot', target: 400, dir: 1 }), s, 0, 5000);
    const turning = states.flatMap((f, i) => (f.mode === 'settle' ? [foxView(f, s, (i - 1) * 50)!.dir] : []));
    expect(turning.filter((d, i) => i > 0 && d !== turning[i - 1]).length).toBe(2);
    expect(states.at(-1)).toMatchObject({ mode: 'asleep', x: 400, dir: 1 });
    expect(states.at(-1)!.until).toBeGreaterThan(40000);
  });
});

describe('fox and layout changes', () => {
  it('rides along with its ledge and keeps doing what it was doing', () => {
    const trotting = asleep(1, 300, { mode: 'trot', target: 400 });
    const scrolled = scene([[1, { ...rule, y: 150 }]]);
    expect(reconcileFox(trotting, scrolled, 0, fixed(0.5))).toEqual(trotting);
  });

  it('is pulled back inside a stretch that shrank', () => {
    const trotting = asleep(1, 300, { mode: 'trot', target: 560 });
    const narrowed = reconcileFox(trotting, scene([[1, { ...rule, right: 500 }]]), 0, fixed(0.5))!;
    expect(narrowed).toMatchObject({ mode: 'trot', x: 300 });
    expect(narrowed.target).toBeLessThanOrEqual(400 - 8);
  });

  it('is placed asleep somewhere new when its spot is covered or gone', () => {
    const fox = asleep(1, 300, { mode: 'trot', target: 400 });
    const covered = scene([[1, rule], [2, { ...card, right: 700, y: 400, headroom: 60 }]], [{ left: 350, right: 450, top: 185, bottom: 195 }]);
    expect(reconcileFox(fox, covered, 0, fixed(0.5))).toMatchObject({ mode: 'asleep' });
    expect(reconcileFox(fox, scene([[2, { ...card, y: 400, headroom: 60 }]]), 0, fixed(0.5))).toMatchObject({ floor: 2, mode: 'asleep' });
  });

  it('keeps a trip under way while out of sight', () => {
    const away = asleep(1, 300, { mode: 'away', until: 500, trip: { floor: 2, entry: 8, x: 100 } });
    expect(reconcileFox(away, scene([]), 0, fixed(0.5))).toBe(away);
  });
});

describe('fox trips', () => {
  const lower: Ledge = { ...card, y: 300, headroom: 60 };
  const away = (trip: Trip) => asleep(1, 300, { mode: 'away', until: 0, trip });
  const trip = { floor: 2, entry: 8, x: 100 };

  it('trots in only while the way in is still open', () => {
    expect(stepFox(away(trip), scene([[1, rule], [2, lower]]), 10, 50, fixed(0.5), null)).toMatchObject({ mode: 'enter', floor: 2, x: 8, target: 100 });
    const closed = [
      scene([[1, rule], [2, { ...lower, y: 780 }]]),
      scene([[1, rule], [2, lower]], [{ left: 100, right: 130, top: 285, bottom: 295 }]),
      scene([[1, rule], [2, lower]], [{ left: 190, right: 210, top: 285, bottom: 295 }]),
    ];
    for (const s of closed) expect(stepFox(away(trip), s, 10, 50, fixed(0.5), null)).toMatchObject({ mode: 'asleep', floor: 1 });
  });

  it('stays out of sight and tries again later when there is nowhere at all', () => {
    expect(stepFox(away(trip), scene([]), 10, 50, fixed(0.5), null)).toMatchObject({ mode: 'away', until: 2010 });
  });

  it('keeps to its own ledge when its stretch reaches neither end, whatever else is free', () => {
    const boxedIn = [{ left: 150, right: 160, top: 185, bottom: 195 }, { left: 540, right: 550, top: 185, bottom: 195 }];
    const s = scene([[1, rule], [2, lower]], boxedIn);
    const states = trace(asleep(1, 300), s, 0, 5000, () => still(rule.left + 340, rule.y - 8));
    expect(states.some((f) => f.mode === 'exit')).toBe(false);
    expect(states.find((f) => f.mode === 'trot')).toMatchObject({ floor: 1, dir: -1 });
  });

  it('changes ledge on its own too, when it wakes restless with no room to pounce', () => {
    const s = scene([[2, card], [3, { ...card, y: 400, headroom: 60 }]]);
    const states = trace(asleep(2, 150, { until: 100 }), s, 0, 20000);
    expect(modes(states).slice(0, 4)).toEqual(['asleep', 'waking', 'exit', 'away']);
    expect(states.find((f) => f.mode === 'enter')).toMatchObject({ floor: 3 });
  });

  it('pounces back the way it came when there is no room ahead', () => {
    const s = scene([[1, rule]], [{ left: 0, right: 1000, top: 140, bottom: 160 }]);
    const crouched = trace(asleep(1, 580, { until: 100, dir: 1 }), s, 0, 800).find((f) => f.mode === 'crouch');
    expect(crouched).toMatchObject({ target: 544, dir: -1 });
  });
});
