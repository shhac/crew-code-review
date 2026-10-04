import { expect, it } from 'vitest';
import { alertEntry, alertReturn, blink, breathing, clipDuration, flap, movementClip, playback, selectFrame, tilt } from './animation';

it('covers one breathing period without duplicated ping-pong endpoints or seam delay', () => {
  expect(clipDuration(breathing)).toBe(1200);
  expect(breathing.frames).toEqual(['I0', 'I1', 'I2', 'I3', 'I2', 'I1']);
  for (const period of [0, 1, 10000]) {
    for (let i = 0; i < 6; i++) {
      const start = period * 1200 + i * 200;
      expect(selectFrame(breathing, start).frame).toBe(breathing.frames[i]);
      expect(selectFrame(breathing, start + 199.999).frame).toBe(breathing.frames[i]);
      expect(selectFrame(breathing, start + 200).frame).toBe(breathing.frames[(i + 1) % 6]);
    }
  }
});
it('uses half-open intervals and emits one completion even after skipped ticks', () => {
  for (const clip of [blink, tilt, alertEntry, alertReturn]) {
    let time = 0;
    for (let i = 0; i < clip.frames.length; i++) {
      expect(selectFrame(clip, time).frame).toBe(clip.frames[i]);
      time += clip.durations[i];
      expect(selectFrame(clip, time - .001).frame).toBe(clip.frames[i]);
    }
    const sample = playback(clip);
    expect(sample(time - .001).completedNow).toBe(false);
    expect(sample(time).completedNow).toBe(true);
    expect(sample(time + 1e6)).toMatchObject({ frame: clip.frames.at(-1), complete: true, completedNow: false });
    expect(sample(0)).toMatchObject({ frame: clip.frames.at(-1), complete: true, completedNow: false });
  }
});
it('fits hop phases and complete eight-frame flight periods into unchanged route durations', () => {
  for (const duration of [220, 320]) {
    const clip = movementClip('hop', duration);
    expect(clipDuration(clip)).toBeCloseTo(duration, 10);
    expect(clip.durations.map(ms => ms / duration)).toEqual([.10, .15, .10, .20, .20, .15, .10]);
    expect(selectFrame(clip, duration).frame).toBe('I0');
  }
  for (const duration of [450, 499.99, 500, 750]) {
    const clip = movementClip('flight', duration);
    const cycles = duration < 500 ? 1 : 2;
    expect(clip.frames.slice(4, -5)).toEqual(Array.from({ length: cycles }, () => flap.frames).flat());
    expect(clip.durations.slice(0, 4).reduce((a, b) => a + b)).toBeCloseTo(.2 * duration);
    expect(clip.durations.slice(4, -5).reduce((a, b) => a + b)).toBeCloseTo(.6 * duration);
    expect(clipDuration(clip)).toBeCloseTo(duration, 10);
    expect(clip.durations.every(ms => ms > 0)).toBe(true);
    expect(selectFrame(clip, duration + .001).frame).toBe('I0');
  }
  expect(selectFrame(flap, 199.999).frame).toBe('W7');
  expect(selectFrame(flap, 200).frame).toBe('W0');
  expect(selectFrame(flap, 225).frame).toBe('W1');
});
it('rejects invalid clocks, empty clips, duplicate closures and invalid durations', () => {
  for (const ms of [0, -1, NaN, Infinity]) {
    expect(() => clipDuration({ frames: ['I0'], durations: [ms], loop: false })).toThrow();
    expect(() => movementClip('hop', ms)).toThrow();
  }
  expect(() => clipDuration({ frames: [], durations: [], loop: false })).toThrow();
  expect(() => clipDuration({ frames: ['I0'], durations: [], loop: false })).toThrow();
  expect(() => clipDuration({ frames: ['I0', 'I1', 'I0'], durations: [1, 1, 1], loop: true })).toThrow();
  expect(() => selectFrame(breathing, Infinity)).toThrow();
  expect(selectFrame(breathing, -1).frame).toBe('I0');
});
it('rejects repeated ping-pong turnarounds wherever they occur', () => {
  for (const frames of [['A', 'B', 'C', 'D', 'D', 'C', 'B'], ['A', 'A', 'B'], ['A', 'B', 'C', 'B', 'B']]) {
    expect(() => clipDuration({ frames, durations: frames.map(() => 100), loop: true })).toThrow();
  }
  expect(clipDuration({ frames: ['A', 'B', 'C', 'D', 'C', 'B'], durations: Array(6).fill(100), loop: true })).toBe(600);
});
it('completes movement at the authoritative deadline despite fractional sums', () => {
  for (const kind of ['hop', 'flight'] as const) {
    for (const duration of [220.125, 279.9, 320, 450, 451, 451.125, 499.99, 500.01, 749.999, 750]) {
      const clip = movementClip(kind, duration);
      expect(clipDuration(clip)).toBe(duration);
      const sample = playback(clip);
      expect(sample(duration - .000001).complete).toBe(false);
      expect(sample(duration)).toEqual({ frame: 'I0', complete: true, completedNow: true });
      expect(sample(duration + 1).completedNow).toBe(false);
    }
  }
  for (const deadline of [0, NaN, Infinity, 1, 301]) {
    expect(() => clipDuration({ ...blink, deadline })).toThrow();
  }
  expect(() => clipDuration({ ...breathing, deadline: 1200 })).toThrow();
});
