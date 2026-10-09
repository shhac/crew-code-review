import { describe, expect, it } from 'vitest';
import { blinking, breath } from './life';

const shutTimes = (seed: number, span: number) =>
  Array.from({ length: span / 10 }, (_, i) => i * 10).filter((t) => blinking(seed, t));

// The starts of each run of shut samples.
const starts = (times: number[]) => times.filter((t, i) => i === 0 || times[i - 1] !== t - 10);

describe('blinking', () => {
  it('blinks briefly, every few seconds', () => {
    const shut = shutTimes(3, 60_000);
    const blinks = starts(shut);
    expect(blinks.length).toBeGreaterThanOrEqual(15);
    expect(blinks.length).toBeLessThanOrEqual(30);
    expect(shut.length / blinks.length).toBeLessThan(16);
  });

  it('never leaves more than about six and a half seconds between blinks', () => {
    const blinks = starts(shutTimes(11, 120_000));
    const gaps = blinks.slice(1).map((t, i) => t - blinks[i]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(6600);
  });

  it('blinks at different moments for different animals', () => {
    expect(shutTimes(1, 20_000)).not.toEqual(shutTimes(2, 20_000));
  });
});

describe('breath', () => {
  it('stays between 0 and 1 and comes round each period', () => {
    const samples = Array.from({ length: 100 }, (_, i) => breath(5, i * 37, 3000));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(breath(5, 1234, 3000)).toBeCloseTo(breath(5, 4234, 3000));
  });
});
