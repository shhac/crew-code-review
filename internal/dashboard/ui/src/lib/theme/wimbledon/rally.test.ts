import { describe, expect, it } from 'vitest';
import type { Ledge, Obstacle, PageMap } from '../floors';
import { meets } from '../air';
import { seeded } from '../test-scene';
import {
  AGAIN, BALL, ballOf, claimsOf, createRally, FIRST, MAX_APEX, MIN_APEX, NET_CLEAR, pointOf, remeasured, riseFor, segAt, segmentsApart, segPoints, serve,
  SHOTS, SPOT_FAR, SPOT_NEAR, stepRally, tableOf, type CourtPair, type Play, type Rally, type Touch,
} from './rally';

// Two cards side by side under a page heading: the worklist and the "Now"
// card, a 20px gap between them, as on the overview at 1440.
const card = (left: number, right: number, y = 200): Ledge => ({ left, right, y, base: y + 300, room: 48, headroom: 48, kind: 'card' });
const rule: Ledge = { left: 290, right: 1386, y: 152, base: 152, room: 20, headroom: Infinity, kind: 'heading' };
const COURT: CourtPair = { left: 2, right: 3 };
const blocks: Obstacle[] = [
  { left: 290, right: 994, top: 200, bottom: 500, block: true },
  { left: 1014, right: 1386, top: 200, bottom: 450, block: true },
];
const heading: Obstacle = { left: 290, right: 660, top: 110, bottom: 134 };
function pageWith(extra: Obstacle[] = [], floors: [number, Ledge][] = [[1, rule], [2, card(290, 994)], [3, card(1014, 1386)]]): PageMap {
  return { floors: new Map(floors), obstacles: [...blocks, heading, ...extra], width: 1440, height: 900, main: { left: 236, right: 1440, top: 0, bottom: 2000 } };
}
const PAGE = pageWith();
const NONE: Touch = { cursor: null, stroke: null };
const FRAME = 1000 / 60;

// Every frame of a rally from its serve until the ball is gone, with the
// cursor's touch at each frame (by default, none).
function play(first: Play, page: PageMap, rand: () => number, touch: (now: number, r: Rally) => Touch = () => NONE) {
  const frames: { now: number; r: Rally }[] = [];
  const start = first.segs[0].start;
  const run = (r: Rally, now: number): void => {
    frames.push({ now, r });
    if (!r.play || now - start > 60000) return;
    run(stepRally(r, page, [COURT], () => true, now + FRAME, now, rand, touch(now + FRAME, r)), now + FRAME);
  };
  run({ next: Infinity, play: first }, start);
  return frames;
}

const boxOfBall = (b: { x: number; y: number; squash: number }) => ({ left: b.x - BALL / 2 - 1, right: b.x + BALL / 2 + 1, top: b.y - (BALL / 2) * b.squash, bottom: b.y + (BALL / 2) * b.squash });

describe('the rally', () => {
  it('finds the court: the net between the cards, bounce spots 40 to 140px from it', () => {
    const t = tableOf(COURT, PAGE)!;
    expect(t.origin).toEqual({ x: 290, y: 200 });
    expect(t.net).toEqual({ lo: 704, hi: 724 });
    expect(t.sides[0]).toEqual({ lo: 704 - SPOT_FAR, hi: 704 - SPOT_NEAR });
    expect(t.sides[1]).toEqual({ lo: 724 + SPOT_NEAR, hi: 724 + SPOT_FAR });
    // Cards that overlap, or are gone, are no court.
    expect(tableOf({ left: 2, right: 9 }, PAGE)).toBeNull();
  });

  it('serves from the far end of a side, fading in, over the net to a spot on the other side', () => {
    for (const seed of Array.from({ length: 29 }, (_, i) => i + 1)) {
      const p = serve(COURT, PAGE, 1000, seeded(seed))!;
      const [shot, squash, hop] = p.segs;
      expect([shot.kind, squash.kind, hop.kind]).toEqual(['shot', 'squash', 'hop']);
      expect(shot.fade).toBe(1);
      expect([290 - 290 + 704 - SPOT_FAR, 724 + SPOT_FAR]).toContain(shot.from.x);
      const t = tableOf(COURT, PAGE)!;
      const side = t.sides[p.to];
      expect(shot.to.x).toBeGreaterThanOrEqual(side.lo);
      expect(shot.to.x).toBeLessThanOrEqual(side.hi);
      const points = segPoints(shot);
      const top = -Math.min(...points.map((q) => q.y));
      expect(top).toBeGreaterThanOrEqual(MIN_APEX - 0.01);
      expect(top).toBeLessThanOrEqual(MAX_APEX + 0.01);
      for (const q of points.filter((q) => q.x > t.net.lo - 3 && q.x < t.net.hi + 3)) expect(q.y).toBeLessThanOrEqual(-NET_CLEAR);
      expect(p.left).toBeGreaterThanOrEqual(SHOTS[0] - 1);
      expect(p.left).toBeLessThanOrEqual(SHOTS[1] - 1);
    }
  });

  it('peaks a shot at the height asked for', () => {
    const from = { x: 0, y: -6 }, to = { x: 200, y: 0 };
    const rise = riseFor(from, to, 15);
    const lowest = Math.min(...Array.from({ length: 401 }, (_, i) => pointOf({ kind: 'shot', from, to, rise, start: 0, ms: 1 }, i / 400).y));
    expect(lowest).toBeCloseTo(-15, 1);
  });

  it('plays no rally on a court with under 12px of room over it', () => {
    const low: Obstacle = { left: 290, right: 1386, top: 150, bottom: 189 };
    expect(serve(COURT, pageWith([low]), 0, seeded(3))).toBeNull();
  });

  it('keeps the ball in air every frame, plays 4 to 9 shots and ends out or in the net', () => {
    const endings = new Set<string>();
    // A label low over the right card's far side leaves 24px clear there.
    const page = pageWith([{ left: 1100, right: 1180, top: 160, bottom: 176 }]);
    for (const seed of Array.from({ length: 24 }, (_, i) => i + 1)) {
      const rand = seeded(seed);
      const first = serve(COURT, page, 0, rand)!;
      const frames = play(first, page, rand);
      const shots = new Set<number>();
      for (const { now, r } of frames) {
        const ball = ballOf(r, page, now);
        if (!ball || !r.play) continue;
        const { seg } = segAt(r.play, now);
        if (seg.kind === 'shot') shots.add(seg.start);
        const box = boxOfBall(ball);
        const into = page.obstacles.filter((o) => (o.block ? box.bottom - 1 > o.top + (seg.kind === 'drop' ? 20 : 0.5) : meets(box, o)));
        if (into.length) expect(into, `seed ${seed} at ${now}`).toEqual([]);
      }
      expect(shots.size).toBeGreaterThanOrEqual(SHOTS[0]);
      expect(shots.size).toBeLessThanOrEqual(SHOTS[1]);
      const last = frames[frames.length - 2].r.play!;
      endings.add(last.segs[last.segs.length - 1].kind);
      // Then it rests 40 to 90s.
      const after = frames[frames.length - 1];
      expect(after.r.play).toBeNull();
      expect(after.r.next - after.now).toBeGreaterThanOrEqual(AGAIN[0] - FRAME);
      expect(after.r.next - after.now).toBeLessThanOrEqual(AGAIN[1]);
    }
    expect(endings).toEqual(new Set(['roll', 'drop']));
  }, 60_000);

  it('volleys a shot back where the cursor hovers in its path, once a shot', () => {
    const rand = seeded(5);
    const first = serve(COURT, PAGE, 0, rand)!;
    const shot = first.segs[0];
    const halfway = shot.start + shot.ms / 2;
    const at = pointOf(shot, 0.5);
    const cursor = { x: 290 + at.x, y: 200 + at.y - 3 };
    // The cursor rests there from halfway through the first shot on.
    const frames = play(first, PAGE, rand, (now) => ({ cursor: now >= halfway ? cursor : null, stroke: null }));
    const volleyed = frames.find(({ r }) => r.play && !r.play.volleyable && r.play.segs[0].kind === 'shot');
    expect(volleyed).toBeDefined();
    const back = volleyed!.r.play!;
    expect(back.to).not.toBe(first.to);
    // Fast and flat: 1.4 times as fast, barely rising.
    expect(back.segs[0].ms).toBeLessThan((1000 * Math.abs(back.segs[0].to.x - back.segs[0].from.x)) / 320);
    expect(back.segs[0].rise).toBeLessThanOrEqual(2);
    // Resting in the path does not juggle it: the volley is not volleyed again.
    const during = frames.filter(({ now, r }) => r.play === back || (r.play?.segs === back.segs && now < back.segs[0].start + back.segs[0].ms));
    expect(during.every(({ r }) => !r.play!.volleyable)).toBe(true);
  });

  it('volleys where a moving cursor crosses its path within a frame, never with no cursor', () => {
    const rand = seeded(9);
    const first = serve(COURT, PAGE, 0, rand)!;
    const shot = first.segs[0];
    const now = shot.start + shot.ms / 2;
    const at = pointOf(shot, 0.5);
    const mid = { x: 290 + at.x, y: 200 + at.y - 3 };
    const across: Touch = { cursor: { x: mid.x, y: mid.y + 40 }, stroke: { from: { x: mid.x, y: mid.y - 40 }, to: { x: mid.x, y: mid.y + 40 }, at: now } };
    const r: Rally = { next: Infinity, play: first };
    const hit = stepRally(r, PAGE, [COURT], () => true, now, now - FRAME, rand, across);
    expect(hit.play!.volleyable).toBe(false);
    expect(stepRally(r, PAGE, [COURT], () => true, now, now - FRAME, rand, NONE)).toBe(r);
  });

  it('drops dead where it is when no shot back is clear', () => {
    const rand = seeded(5);
    const first = serve(COURT, PAGE, 0, rand)!;
    const shot = first.segs[0];
    const now = shot.start + shot.ms * 0.25;
    const at = pointOf(shot, 0.25);
    // The bounce spots on the side it came from now have something low over
    // them, under where the ball is.
    const back = first.to === 1 ? { left: 840, right: 990, top: 191, bottom: 197 } : { left: 1040, right: 1200, top: 191, bottom: 197 };
    const page = pageWith([back]);
    const cursor = { x: 290 + at.x, y: 200 + at.y - 3 };
    const r = stepRally({ next: Infinity, play: first }, page, [COURT], () => true, now, now - FRAME, rand, { cursor, stroke: null });
    expect(r.play!.over).toBe(true);
    expect(['fall', 'drop']).toContain(r.play!.segs[0].kind);
    expect(r.play!.segs[0].from).toEqual(at);
  });

  it('waits its turn: first after 15 to 30s, and only on a free court', () => {
    const r = createRally(0, seeded(2));
    expect(r.next).toBeGreaterThanOrEqual(FIRST[0]);
    expect(r.next).toBeLessThanOrEqual(FIRST[1]);
    expect(stepRally(r, PAGE, [COURT], () => true, r.next - 1, r.next - 20, seeded(2), NONE)).toBe(r);
    const busy = stepRally(r, PAGE, [COURT], () => false, r.next, r.next - 20, seeded(2), NONE);
    expect(busy.play).toBeNull();
    expect(busy.next).toBe(r.next + 5000);
    expect(stepRally(r, PAGE, [COURT], () => true, r.next, r.next - 20, seeded(2), NONE).play).not.toBeNull();
  });

  it('claims the court while it plays, and ends at once if the page changes under it', () => {
    const rand = seeded(4);
    const r: Rally = { next: Infinity, play: serve(COURT, PAGE, 0, rand)! };
    expect(claimsOf(r, PAGE)).toEqual([{ floor: 2, lo: 12, hi: 704 }, { floor: 3, lo: 0, hi: 372 - 12 }]);
    expect(remeasured(r, PAGE, 10, rand)).toBe(r);
    const covered = pageWith([{ left: 290, right: 1386, top: 170, bottom: 196 }]);
    expect(remeasured(r, covered, 10, rand).play).toBeNull();
    const gone = pageWith([], [[1, rule], [2, card(290, 994)]]);
    expect(remeasured(r, gone, 10, rand).play).toBeNull();
    expect(ballOf(r, gone, 10)).toBeNull();
  });

  it('measures how near two strokes come', () => {
    expect(segmentsApart({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(0);
    expect(segmentsApart({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(5);
    expect(segmentsApart({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 4, y: 4 }, { x: 4, y: 9 })).toBe(5);
  });
});
