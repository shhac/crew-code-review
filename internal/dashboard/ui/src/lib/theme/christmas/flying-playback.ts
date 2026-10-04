import type { Bird } from './robin';

// Pure articulation sampled from the existing action clock. No new epoch,
// random stream, endpoint holds or world-motion arc.
export function flyingLoopFrame(count: number, elapsed: number, period = 200): string {
  if (![4, 5, 6, 8].includes(count) || !Number.isFinite(elapsed) || !Number.isFinite(period) || period <= 0) throw new Error('Invalid flying loop');
  const phase = ((elapsed % period) + period) % period;
  return `W${Math.min(count - 1, Math.floor(phase * count / period))}`;
}

export function flyingFrame(bird: Bird, now: number, count: number, reduced = false): string | null {
  if (!Number.isFinite(now)) throw new Error('Invalid animation clock');
  const action = bird.action;
  if (reduced || !bird.perch || action?.kind !== 'flight' || !Number.isFinite(action.duration) || action.duration <= 0) return null;
  const elapsed = now - action.start, duration = action.duration;
  if (elapsed < .20 * duration || elapsed >= .80 * duration) return null;
  const middle = .60 * duration, cycles = Math.max(1, Math.round(middle / 200));
  return flyingLoopFrame(count, elapsed - .20 * duration, middle / cycles);
}
