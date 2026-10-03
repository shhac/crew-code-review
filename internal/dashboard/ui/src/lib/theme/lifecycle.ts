// Exactly one pending frame, including rapid preference/visibility changes.
// Still scenes get invalidation frames but never an animation loop.
export function sceneLoop(draw: (now: number, reduced: boolean) => void, reset: () => void): { invalidate: () => void; stop: () => void } {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, active = true;
  const tick = (now: number) => {
    frame = 0;
    if (!active || document.hidden) return;
    draw(now, media.matches);
    if (!media.matches) schedule();
  };
  const schedule = () => { if (active && !document.hidden && !frame) frame = requestAnimationFrame(tick); };
  const changed = () => { cancelAnimationFrame(frame); frame = 0; reset(); schedule(); };
  media.addEventListener('change', changed);
  document.addEventListener('visibilitychange', changed);
  schedule();
  return {
    invalidate: schedule,
    stop() { active = false; cancelAnimationFrame(frame); frame = 0; media.removeEventListener('change', changed); document.removeEventListener('visibilitychange', changed); },
  };
}
