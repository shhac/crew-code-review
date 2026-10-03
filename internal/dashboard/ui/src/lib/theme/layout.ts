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
