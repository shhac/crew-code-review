// The rail's sky: the free stretch of the rail between the bottom of the nav
// and the top of the theme shelf, where sky effects (fireworks, the aurora)
// can play without ever covering the page. One measurement for every theme,
// in viewport coordinates.
export type Sky = { left: number; top: number; width: number; height: number };

// Kept clear of the nav's last link.
const GAP = 16;
// A tall rail would otherwise stretch an effect thin.
const MAX = 240;

type Rect = { left: number; top: number; bottom: number };
// What measuring needs from the shelf: the element, or a fake one in tests.
type Shelf = { offsetParent: unknown; clientWidth: number; getBoundingClientRect(): Rect; previousElementSibling: { getBoundingClientRect(): Rect } | null };

// None when the shelf is hidden (phones, short windows) or has no nav above.
export function measureRailSky(shelf: Shelf | null): Sky | null {
  const nav = shelf?.previousElementSibling;
  if (!shelf || !nav || shelf.offsetParent === null) return null;
  const box = shelf.getBoundingClientRect();
  const height = Math.max(0, Math.min(MAX, box.top - nav.getBoundingClientRect().bottom - GAP));
  return { left: box.left, top: box.top - height, width: shelf.clientWidth, height };
}

// Calls changed whenever the sky may have moved. In a full-height rail, the
// brand settling or the nav gaining a link moves the sky's top edge without
// resizing the rail, so everything in the rail is watched.
export function watchRailSky(shelf: HTMLElement, changed: () => void): () => void {
  const observer = new ResizeObserver(changed);
  const rail = shelf.parentElement;
  [rail, ...(rail?.children ?? [])].forEach((el) => el && observer.observe(el));
  addEventListener('resize', changed);
  return () => { observer.disconnect(); removeEventListener('resize', changed); };
}
