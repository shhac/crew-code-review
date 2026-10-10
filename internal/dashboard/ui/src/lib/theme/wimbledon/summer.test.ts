import { describe, expect, it } from 'vitest';
import { seeded } from '../test-scene';
import { overview } from './fixtures';
import { chalkLines } from './lines';
import { flyingNow, grounded } from './pigeon';
import { ballOf } from './rally';
import { createPlay, restingPlay, stepPlay, summerOf, type Cue, type Play } from './summer';

const PAGE = overview();
const SUMMER = summerOf(PAGE);
const LINES = chalkLines(PAGE.floors, PAGE.obstacles);
const FRAME = 1000 / 60;
const NONE = { cursor: null, stroke: null, speed: 0 };

// Every frame of a summer afternoon from `start`, for `ms`.
function afternoon(cue: Cue, seed: number, ms: number) {
  const rand = seeded(seed);
  const first = createPlay(SUMMER, 0, rand, cue);
  return Array.from({ length: Math.ceil(ms / FRAME) }).reduce<{ now: number; play: Play }[]>((all, _, i) => {
    const prev = all[all.length - 1];
    const now = (i + 1) * FRAME;
    all.push({ now, play: stepPlay(prev.play, SUMMER, LINES, now, prev.now, rand, NONE) });
    return all;
  }, [{ now: 0, play: first }]);
}

describe('summer tennis together', { timeout: 60_000 }, () => {
  it('finds the court between the board and the card beside it', () => {
    expect(SUMMER.courts).toEqual([{ left: 2, right: 3 }]);
  });

  it('sends the hawk over at once when cued, and the pigeons on its row away', () => {
    const frames = afternoon('sweep', 1, 3000);
    const swept = frames.find((f) => f.play.flock.hawk.plan);
    expect(swept!.now).toBeLessThan(1000);
    expect(frames.at(-1)!.play.flock.pigeons.some((p) => !grounded(p))).toBe(true);
  });

  it('serves at once when the rally is cued', () => {
    const frames = afternoon('rally', 2, 3000);
    const first = frames.findIndex((f) => ballOf(f.play.rally, PAGE, f.now));
    expect(first).toBeGreaterThan(0);
    expect(frames[first].now).toBeLessThan(1000);
  });

  it('starts a rally only with every bird on the ground, and a sweep only with no ball in play', () => {
    for (const [cue, seed] of [['rally', 3], ['sweep', 4], [null, 5]] as const) {
      const frames = afternoon(cue, seed, 90000);
      frames.slice(1).forEach(({ play }, i) => {
        const before = frames[i].play;
        if (play.rally.play && !before.rally.play) {
          expect(before.flock.pigeons.some(flyingNow) || !!before.flock.hawk.plan || before.flock.pigeons.some((p) => !grounded(p))).toBe(false);
        }
        if (play.flock.hawk.plan && !before.flock.hawk.plan) expect(before.rally.play).toBeNull();
      });
    }
  });

  it('stands every pigeon still under reduced motion, with no hawk and no ball', () => {
    const still = restingPlay(SUMMER, null, 0);
    expect(still.rally.play).toBeNull();
    expect(still.flock.hawk.plan).toBeNull();
    expect(still.flock.pigeons.every((p) => p.mode === 'stand' && p.until === Infinity)).toBe(true);
  });
});
