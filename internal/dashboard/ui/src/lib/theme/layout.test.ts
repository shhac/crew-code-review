import { afterEach, expect, it, vi } from 'vitest';
import { observeLayout } from './layout';

afterEach(() => vi.unstubAllGlobals());
it('observes dashboard changes passively and removes every subscription', () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  const add = vi.fn();
  const remove = vi.fn();
  const main = {};
  const rail = {};
  let mutation: (() => void) | undefined;
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: () => void) { mutation = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  const sized = vi.fn();
  const unsized = vi.fn();
  let resize: (() => void) | undefined;
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe = sized;
    disconnect = unsized;
  });
  vi.stubGlobal('document', { querySelector: (selector: string) => (selector === 'main' ? main : selector === '.rail' ? rail : null) });
  vi.stubGlobal('addEventListener', add);
  vi.stubGlobal('removeEventListener', remove);
  const changed = vi.fn();
  const stop = observeLayout(changed);
  mutation?.();
  expect(changed).toHaveBeenCalledOnce();
  expect(observe).toHaveBeenCalledWith(main, { subtree: true, childList: true, attributes: true, characterData: true });
  expect(add).toHaveBeenCalledWith('scroll', changed, { capture: true, passive: true });
  // A phone's rail sits above main: its height moves every ledge.
  expect(sized).toHaveBeenCalledWith(rail);
  resize?.();
  expect(changed).toHaveBeenCalledTimes(2);
  stop();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(unsized).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith('scroll', changed, true);
  expect(remove).toHaveBeenCalledWith('resize', changed);
});
