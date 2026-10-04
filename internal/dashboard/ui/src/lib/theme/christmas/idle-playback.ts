import { blink, breathing, clipDuration, playback, selectFrame, type Clip } from './animation';
import type { Bird } from './robin';
import { atlasIdleDurations, atlasIdleFrames } from './manifest';

export function createAtlasIdlePlayback() {
  const clip: Clip = { frames: atlasIdleFrames, durations: atlasIdleDurations, loop: true };
  let start: number | null = null, last = -Infinity;
  const reset = () => { start = null; last = -Infinity; };
  return {
    reset,
    frame(bird: Bird, now: number, reduced = false): string {
      if (!Number.isFinite(now)) throw new Error('Invalid animation clock');
      if (now < last) reset();
      last = now;
      if (reduced || !bird.perch || bird.action || bird.alert) { reset(); return 'I0'; }
      start ??= now;
      // This row already contains its blink, with no second cosmetic overlay.
      return selectFrame(clip, now - start).frame;
    },
  };
}

// This stream is independent of movement's Math.random/injected RNG.
export function cosmeticStream(seed = Date.now()) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
}

export function createIdlePlayback(random: () => number, clips: { breathing: Clip; blink: Clip } = { breathing, blink }) {
  const period = clipDuration(clips.breathing), blinkDuration = clipDuration(clips.blink);
  let start: number | null = null, variationAt = Infinity, lastTime = -Infinity;
  let variation: ReturnType<typeof playback> | null = null;
  const reset = () => { start = null; variationAt = Infinity; variation = null; lastTime = -Infinity; };
  const rest = (now: number) => {
    const value = random();
    if (!Number.isFinite(value)) throw new Error('Invalid cosmetic randomness');
    const first = Math.ceil(4000 / period), last = Math.floor(8000 / period);
    if (first > last) throw new Error('No neutral boundary in cosmetic interval');
    start = now; variation = null;
    variationAt = now + Math.max(first, Math.min(last, Math.round((4000 + Math.max(0, Math.min(1, value)) * 4000) / period))) * period;
  };
  return {
    reset,
    frame(bird: Bird, now: number, reduced = false): string {
      if (!Number.isFinite(now)) throw new Error('Invalid animation clock');
      if (now < lastTime) reset();
      lastTime = now;
      // Existing movement/alert art takes priority; no new action or RNG call.
      if (reduced || !bird.perch || bird.action || bird.alert) { reset(); return 'I0'; }
      if (start === null) rest(now);
      if (variation) {
        const selected = variation(now - variationAt);
        if (!selected.complete) return selected.frame;
        rest(now); return 'I0';
      }
      if (now >= variationAt) {
        if (now >= variationAt + blinkDuration) { rest(now); return 'I0'; }
        variation = playback(clips.blink);
        return variation(now - variationAt).frame;
      }
      return selectFrame(clips.breathing, now - start!).frame;
    },
  };
}
