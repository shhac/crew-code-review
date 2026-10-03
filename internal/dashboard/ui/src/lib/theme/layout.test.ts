import { afterEach, expect, it, vi } from 'vitest';
import { observeLayout } from './layout';

afterEach(() => vi.unstubAllGlobals());
it('observes dashboard changes passively and removes every subscription', () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  const add = vi.fn();
  const remove = vi.fn();
  const main = {};
  let mutation: (() => void) | undefined;
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: () => void) { mutation = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  vi.stubGlobal('document', { querySelector: () => main });
  vi.stubGlobal('addEventListener', add);
  vi.stubGlobal('removeEventListener', remove);
  const changed = vi.fn();
  const stop = observeLayout(changed);
  mutation?.();
  expect(changed).toHaveBeenCalledOnce();
  expect(observe).toHaveBeenCalledWith(main, { subtree: true, childList: true, attributes: true, characterData: true });
  expect(add).toHaveBeenCalledWith('scroll', changed, { capture: true, passive: true });
  stop();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith('scroll', changed, true);
  expect(remove).toHaveBeenCalledWith('resize', changed);
});
