import { measurePage, samePage, type PageMap } from './floors';
import { sceneLoop } from './lifecycle';
import { observePointer, pointerTracker, type Cursor, type Segment } from './pointer';

// Both seasonal scenes invalidate layout on the same dashboard changes.
// Callers decide when to measure; invalidations never read layout themselves.
// On a phone the rail stacks above main, so the rail changing height moves
// every ledge with nothing in main changing; its size is watched too.
export function observeLayout(changed: () => void): () => void {
  const observer = new MutationObserver(changed);
  const main = document.querySelector('main');
  if (main) observer.observe(main, { subtree: true, childList: true, attributes: true, characterData: true });
  const resized = new ResizeObserver(changed);
  const rail = document.querySelector('.rail');
  if (rail) resized.observe(rail);
  addEventListener('scroll', changed, { capture: true, passive: true });
  addEventListener('resize', changed);
  return () => {
    observer.disconnect();
    resized.disconnect();
    removeEventListener('scroll', changed, true);
    removeEventListener('resize', changed);
  };
}

// observeLayout, plus a once-a-second check for layout that moved with no
// mutation, scroll or resize to say so (a CSS-only change). It invalidates
// only when the page really differs from the scene last measured, so an
// unchanged page never cancels an animation mid-way.
export function watchPage(changed: () => void, last: () => { scene: PageMap; at: number }): () => void {
  const stopObserving = observeLayout(changed);
  const timer = window.setInterval(() => {
    const { scene, at } = last();
    if (document.hidden || performance.now() - at < 1000) return;
    if (!samePage(measurePage(), scene)) changed();
  }, 1000);
  return () => { stopObserving(); clearInterval(timer); };
}

// What a scene on the page's ledges does at each point of the shared cycle.
export type LedgeScene = {
  // Reduced motion switched on (true) or off, before the page is remeasured.
  motion(reduced: boolean): void;
  // A fresh measurement, the one before it, and the frame's time.
  measured(page: PageMap, previous: PageMap, time: number): void;
  // Every frame. While moving, step carries the time since the last frame
  // (at most 100ms, so a stalled tab does not leap) and the cursor.
  frame(time: number, step: { dt: number; cursor: Cursor | null } | null): void;
  // A moving mouse or pen passed along this segment.
  stroke(segment: Segment): void;
};

// The cycle every ledge scene shares: measure when the page has changed, then
// step; follow the passive cursor; and forget it when it leaves, the tab is
// hidden or reduced motion changes. Returns the teardown.
export function ledgeScene(scene: LedgeScene): () => void {
  const pointer = pointerTracker();
  let page: PageMap = { floors: new Map(), obstacles: [], width: 0, height: 0 };
  let cursor: Cursor | null = null;
  let reduced: boolean | null = null, dirty = true, measuredAt = -Infinity, last = performance.now();
  const forget = () => { pointer.reset(); cursor = null; };
  const loop = sceneLoop((time, still) => {
    if (still !== reduced) { reduced = still; scene.motion(still); dirty = true; }
    if (dirty) {
      const previous = page;
      page = measurePage();
      dirty = false; measuredAt = performance.now();
      scene.measured(page, previous, time);
    }
    if (still) { scene.frame(time, null); return; }
    const dt = Math.min(100, time - last);
    last = time;
    scene.frame(time, { dt, cursor });
  }, () => { forget(); dirty = true; last = performance.now(); });
  const changed = () => { pointer.reset(); dirty = true; loop.invalidate(); };
  const stopWatching = watchPage(changed, () => ({ scene: page, at: measuredAt }));
  const stopPointer = observePointer((e) => {
    if (reduced || document.hidden) { forget(); return; }
    cursor = { x: e.clientX, y: e.clientY, at: performance.now() };
    if (dirty) { pointer.reset(); return; }
    const stroke = pointer.move(e, performance.now());
    if (stroke) scene.stroke(stroke);
  }, forget);
  return () => { loop.stop(); stopPointer(); stopWatching(); };
}
