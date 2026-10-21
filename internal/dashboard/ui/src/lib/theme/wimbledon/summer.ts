import type { Airspace } from '../air';
import { courts } from '../gaps';
import type { PageMap } from '../floors';
import type { Point, Segment } from '../pointer';
import type { Rand } from '../seed';
import { skyOf } from './airspace';
import { livePuffs, markNear, puffAt, type Lines, type Puff } from './lines';
import { courtFree, createFlock, reconcileFlock, restingFlock, stepFlock, type Flock, type Pass } from './pigeons';
import { courtClaims, claimsOf, createRally, remeasured, stepRally, tableOf, type CourtPair, type Rally } from './rally';

// Everything summer tennis sets moving on the page, stepped together: the
// flock and its hawk (pigeons.ts, hawk.ts) and the rally (rally.ts), each
// keeping clear of the others, and the chalk a bounce kicks up from the
// court lines. The layer draws it; this is the part that decides.

// The page as summer tennis sees it: its air (on the surfaces kit) and its
// courts, two cards side by side with the gap between them the net.
export type Summer = { page: PageMap; sky: Airspace; courts: readonly CourtPair[] };
export function summerOf(page: PageMap): Summer {
  return { page, sky: skyOf(page), courts: courts(page).map((g) => ({ left: g.from.ledge, right: g.to.ledge })) };
}

// A test's cue (`?theme-cue=sweep` or `rally`) starts that at once.
export type Cue = 'sweep' | 'rally' | null;
const CUED = 300;

// The chalk puffed up, on the ledge it was puffed from.
type Chalk = Puff & { floor: number };
export type Play = { flock: Flock; rally: Rally; chalk: readonly Chalk[] };

export function createPlay(s: Summer, now: number, rand: Rand, cue: Cue = null): Play {
  // Cued for a rally, the pigeons are placed off the courts, so it can start.
  const avoid = cue === 'rally' ? s.courts.flatMap((c) => courtClaims(c, s.page)) : [];
  const flock = createFlock(s.page, s.sky, now, rand, avoid);
  const rally = createRally(now, rand);
  return {
    flock: cue === 'sweep' ? { ...flock, hawk: { ...flock.hawk, next: now + CUED } } : flock,
    rally: cue === 'rally' ? { ...rally, next: now + CUED } : rally,
    chalk: [],
  };
}

export const reconcilePlay = (p: Play, s: Summer, now: number, rand: Rand): Play =>
  ({ ...p, flock: reconcileFlock(p.flock, s.page, s.sky, now, rand), rally: remeasured(p.rally, s.page, now, rand) });

// Reduced motion: the pigeons stand still on their spots; no hawk, no ball.
export const restingPlay = (s: Summer, previous: Play | null, now: number): Play =>
  ({ flock: restingFlock(s.page, s.sky, previous?.flock ?? null, now), rally: { next: Infinity, play: null }, chalk: [] });

// What the cursor did this frame: where it rests, the stroke it moved along
// (if it moved), and how fast.
type Touch = { cursor: Point | null; stroke: Segment | null; speed: number };

// A frame on: the birds (kept off the court while a ball is in play), then
// the rally (started only on a court with no pigeon in it and no bird in
// the air), then any chalk a bounce kicks up from a line.
export function stepPlay(p: Play, s: Summer, lines: ReadonlyMap<number, Lines>, now: number, last: number, rand: Rand, touch: Touch): Play {
  const pass = touch.cursor ? { cursor: touch.cursor, speed: touch.speed } satisfies Pass : null;
  const flock = stepFlock(p.flock, s.page, s.sky, now, now - last, rand, pass, claimsOf(p.rally, s.page), !!p.rally.play);
  const free = (court: CourtPair) => !flock.hawk.plan && courtFree(flock, courtClaims(court, s.page));
  const rally = stepRally(p.rally, s.page, s.courts, free, now, last, rand, { cursor: touch.cursor, stroke: touch.stroke });
  const chalk = [...livePuffs(p.chalk, now), ...bounces(rally, s.page, lines, last, now)];
  return { flock, rally, chalk: chalk.filter((c, i) => chalk.findIndex((d) => d.key === c.key) === i) };
}

// Chalk from each bounce landing within PUFF_REACH of a mark since the last
// frame: the ball squashed on a ledge, or its low bounces as it goes out.
function bounces(rally: Rally, page: PageMap, lines: ReadonlyMap<number, Lines>, last: number, now: number): Chalk[] {
  const play = rally.play;
  const t = play && tableOf(play.court, page);
  if (!play || !t) return [];
  const landed = play.segs.filter((g) => (g.kind === 'squash' || (g.kind === 'hop' && Math.abs(g.from.y - g.to.y) < 0.5)) && g.start > last && g.start <= now);
  return landed.flatMap((g) => {
    const left = g.from.x < (t.net.lo + t.net.hi) / 2;
    const floor = left ? play.court.left : play.court.right;
    const x = left ? g.from.x : g.from.x - t.right;
    const mark = markNear(lines.get(floor) ?? [], x);
    return mark === undefined ? [] : [{ ...puffAt(`${floor}:${Math.round(g.start)}`, mark, g.start), floor }];
  });
}
