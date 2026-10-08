import { measurePage, samePage, type PageMap } from './floors';

// Both seasonal scenes invalidate layout on the same dashboard changes.
// Callers decide when to measure; invalidations never read layout themselves.
export function observeLayout(changed: () => void): () => void {
  const observer = new MutationObserver(changed);
  const main = document.querySelector('main');
  if (main) observer.observe(main, { subtree: true, childList: true, attributes: true, characterData: true });
  addEventListener('scroll', changed, { capture: true, passive: true });
  addEventListener('resize', changed);
  return () => {
    observer.disconnect();
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
