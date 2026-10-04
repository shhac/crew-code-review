// Discrete artwork timing. This module does not advance or retime movement.
export type Clip = { frames: readonly string[]; durations: readonly number[]; loop: boolean; deadline?: number };
export function clipDuration(clip: Clip): number {
  if (!clip.frames.length || clip.frames.length !== clip.durations.length
    || clip.frames.some(id => !id)
    || clip.durations.some(ms => !Number.isFinite(ms) || ms <= 0)) {
    throw new Error('Invalid animation frames or durations');
  }
  if (clip.loop && clip.frames.length > 1 && clip.frames[0] === clip.frames.at(-1)) {
    throw new Error('Duplicate loop endpoint');
  }
  if (clip.loop && clip.frames.some((id, i) => i > 0 && id === clip.frames[i - 1])) {
    throw new Error('Repeated loop turnaround endpoint');
  }
  const total = clip.durations.reduce((sum, ms) => sum + ms, 0);
  if (!Number.isFinite(total)) throw new Error('Invalid animation period');
  // Movement's deadline is authoritative. Repeated fractional additions can
  // overshoot it by a few ulps; never hold a flight past its route's end.
  if (clip.deadline !== undefined) {
    if (clip.loop || !Number.isFinite(clip.deadline) || clip.deadline <= 0
      || Math.abs(total - clip.deadline) > Number.EPSILON * Math.max(total, clip.deadline) * clip.frames.length) {
      throw new Error('Invalid animation deadline');
    }
    return clip.deadline;
  }
  return total;
}
export function selectFrame(clip: Clip, elapsed: number): { frame: string; complete: boolean } {
  const total = clipDuration(clip);
  if (!Number.isFinite(elapsed)) throw new Error('Invalid animation clock');
  const complete = !clip.loop && elapsed >= total;
  if (complete) return { frame: clip.frames[clip.frames.length - 1], complete };
  const time = clip.loop ? Math.max(0, elapsed) % total : Math.max(0, elapsed);
  let end = 0;
  for (let i = 0; i < clip.frames.length; i++) {
    end += clip.durations[i];
    if (time < end || i === clip.frames.length - 1) return { frame: clip.frames[i], complete: false };
  }
  throw new Error('Animation interval not found');
}
export const breathing: Clip = {
  frames: ['I0', 'I1', 'I2', 'I3', 'I2', 'I1'],
  durations: [200, 200, 200, 200, 200, 200], loop: true,
};
export const blink: Clip = { frames: ['I0', 'B1', 'B2', 'B1', 'I0'], durations: [60, 40, 70, 40, 90], loop: false };
export const tilt: Clip = { frames: ['I0', 'T1', 'T2', 'T1', 'I0'], durations: [100, 120, 180, 120, 100], loop: false };
export const alertEntry: Clip = { frames: ['I0', 'A1', 'A2', 'A3'], durations: [40, 60, 80, 100], loop: false };
export const alertReturn: Clip = { frames: ['A3', 'A2', 'A1', 'I0'], durations: [60, 60, 60, 60], loop: false };
export const flap: Clip = { frames: Array.from({ length: 8 }, (_, i) => `W${i}`), durations: Array(8).fill(25), loop: true };
export function movementClip(kind: 'hop' | 'flight', duration: number): Clip {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid movement duration');
  if (kind === 'hop') return {
    frames: ['I0', 'H1', 'H2', 'H3', 'H4', 'H5', 'I0'],
    durations: [.10, .15, .10, .20, .20, .15, .10].map(part => part * duration), loop: false, deadline: duration,
  };
  const cycles = Math.max(1, Math.round(.60 * duration / 200));
  return {
    frames: ['I0', 'F1', 'F2', 'W0', ...Array.from({ length: cycles }, () => flap.frames).flat(), 'W0', 'L1', 'L2', 'L3', 'I0'],
    durations: [...Array(4).fill(.20 * duration / 4), ...Array(8 * cycles).fill(.60 * duration / (8 * cycles)), ...Array(5).fill(.20 * duration / 5)],
    loop: false, deadline: duration,
  };
}
// Each instance is one epoch; repeated samples cannot emit a second completion.
export function playback(clip: Clip) {
  clipDuration(clip);
  let finished = false;
  return (elapsed: number) => {
    const selected = selectFrame(clip, elapsed);
    if (finished) return { frame: clip.frames[clip.frames.length - 1], complete: true, completedNow: false };
    const completedNow = selected.complete && !finished;
    finished ||= selected.complete;
    return { ...selected, completedNow };
  };
}
