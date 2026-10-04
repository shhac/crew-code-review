import { alertEntry, alertReturn, blink, breathing, clipDuration, movementClip, playback, selectFrame, tilt, type Clip } from './animation';
import type { Bird } from './robin';

type Epoch = { clip: Clip; start: number; sample: ReturnType<typeof playback> };
const epoch = (clip: Clip, start: number): Epoch => ({ clip, start, sample: playback(clip) });

// Artwork follows movement; it cannot modify Bird or consume its random stream.
// The caller resets alongside reconciliation, visibility/preference changes and
// teardown. Facing is deliberately left to the existing outer assembly.
export function createPlayback(cosmeticRandom: () => number) {
  let active: Epoch | null = null;
  let action: Bird['action'] = null;
  let idleStart: number | null = null;
  let variationAt = Infinity;
  let nextTilt = false;
  let mode: 'idle' | 'variation' | 'entry' | 'hold' | 'return' | 'movement' = 'idle';
  let lastTime = -Infinity;
  const delay = () => {
    const value = cosmeticRandom();
    if (!Number.isFinite(value)) throw new Error('Invalid cosmetic randomness');
    return 4000 + Math.max(0, Math.min(1, value)) * 4000;
  };
  const rest = (now: number) => {
    mode = 'idle'; active = null; idleStart = now;
    // Choose the nearest available neutral boundary INSIDE the 4–8s window.
    // Rounding an arbitrary delay up can put the final boundary outside it.
    const period = clipDuration(breathing);
    const first = Math.ceil(4000 / period), last = Math.floor(8000 / period);
    variationAt = now + Math.max(first, Math.min(last, Math.round(delay() / period))) * period;
  };
  const reset = () => {
    active = null; action = null; idleStart = null; variationAt = Infinity;
    nextTilt = false; mode = 'idle'; lastTime = -Infinity;
  };
  return {
    reset,
    frame(bird: Bird, now: number, reduced = false): string {
      if (!Number.isFinite(now)) throw new Error('Invalid animation clock');
      if (now < lastTime) reset();
      lastTime = now;
      if (reduced || !bird.perch) { reset(); return 'I0'; }
      if (bird.action) {
        const a = bird.action;
        if (action !== a) {
          action = a; mode = 'movement'; idleStart = null;
          active = epoch(movementClip(a.kind, a.duration), a.start);
        }
        return active!.sample(now - active!.start).frame;
      }
      if (action) {
        action = null; rest(now);
        // Route completion always displays rest, even after a skipped tick.
        return 'I0';
      }
      if (bird.alert) {
        if (mode !== 'entry' && mode !== 'hold') {
          mode = 'entry'; idleStart = null; active = epoch(alertEntry, now);
        }
        if (mode === 'hold') return 'A3';
        const selected = active!.sample(now - active!.start);
        if (selected.complete) mode = 'hold';
        return selected.frame;
      }
      if (mode === 'entry' || mode === 'hold') {
        mode = 'return'; active = epoch(alertReturn, now);
      }
      if (mode === 'return' || mode === 'variation') {
        const selected = active!.sample(now - active!.start);
        if (!selected.complete) return selected.frame;
        rest(now);
        return 'I0';
      }
      if (idleStart === null) rest(now);
      if (now >= variationAt) {
        // A late tick beyond the whole variation does not replay missed art.
        const clip = nextTilt ? tilt : blink;
        nextTilt = !nextTilt;
        if (now >= variationAt + clipDuration(clip)) { rest(now); return 'I0'; }
        mode = 'variation'; active = epoch(clip, variationAt);
        return active.sample(now - active.start).frame;
      }
      return selectFrame(breathing, now - idleStart!).frame;
    },
  };
}
