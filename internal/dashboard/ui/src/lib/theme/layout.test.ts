import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageMap } from './floors';
import { ledgeScene, observeLayout, placeTroupe, type LedgeScene } from './layout';

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

describe('placeTroupe', () => {
  // A troupe that records how it came to be.
  type Made = { how: string; from?: Made | null };
  const troupe = (freshOnEnter?: boolean) => placeTroupe<Made, string>({
    create: (scene, now, rand) => ({ how: `created on ${scene} at ${now} with ${rand()}` }),
    reconcile: (group, scene) => ({ how: `reconciled on ${scene}`, from: group }),
    resting: (scene, previous) => ({ how: `resting on ${scene}`, from: previous }),
    freshOnEnter,
  }, () => 0.5);
  const there = { how: 'there' };

  it('places a fresh troupe when there is none', () => {
    expect(troupe().place(null, 'a', true, 7, false)).toEqual({ how: 'created on a at 7 with 0.5' });
  });

  it('keeps the troupe as it is on the same page, and reconciles it on a changed one', () => {
    expect(troupe().place(there, 'a', true, 7, false)).toBe(there);
    expect(troupe().place(there, 'a', false, 7, false)).toEqual({ how: 'reconciled on a', from: there });
  });

  it('puts it to rest under reduced motion, same page or not', () => {
    expect(troupe().place(there, 'a', true, 7, true)).toEqual({ how: 'resting on a', from: there });
    expect(troupe().place(null, 'a', false, 7, true)).toEqual({ how: 'resting on a', from: null });
  });

  it('starts afresh on leaving reduced motion, and on entering it only when asked to', () => {
    expect(troupe().motion(there, false)).toBeNull();
    expect(troupe().motion(there, true)).toBe(there);
    expect(troupe(true).motion(there, true)).toBeNull();
    expect(troupe(true).motion(there, false)).toBeNull();
  });
});

describe('ledgeScene', () => {
  // A page with nothing on it, a frame clock to run by hand, and the
  // window's listeners to fire.
  function stage() {
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    const listeners = new Map<string, (e: unknown) => void>();
    const media = { matches: false, change: () => {}, addEventListener(_: string, f: () => void) { media.change = f; }, removeEventListener: () => {} };
    vi.stubGlobal('matchMedia', () => media);
    vi.stubGlobal('document', { hidden: false, addEventListener: () => {}, removeEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] });
    vi.stubGlobal('window', { setInterval: () => 0 });
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('addEventListener', (name: string, f: (e: unknown) => void) => listeners.set(name, f));
    vi.stubGlobal('removeEventListener', () => {});
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { frames.set(++id, f); return id; });
    vi.stubGlobal('cancelAnimationFrame', (i: number) => frames.delete(i));
    const seen: string[] = [];
    const steps: ({ cursor: unknown } | null)[] = [];
    const scene: LedgeScene = {
      motion: (still) => seen.push(`motion ${still}`),
      measured: (page: PageMap) => seen.push(`measured ${page.width}`),
      frame: (_, step) => { seen.push('frame'); steps.push(step && { cursor: step.cursor }); },
      stroke: () => seen.push('stroke'),
    };
    const stop = ledgeScene(scene);
    const run = (time: number) => {
      const due = [...frames.values()];
      frames.clear();
      due.forEach((f) => f(time));
    };
    const move = (x: number) => listeners.get('pointermove')?.({ pointerType: 'mouse', pointerId: 1, buttons: 0, pressure: 0, clientX: x, clientY: 10 });
    const fire = (name: string) => listeners.get(name)?.({});
    const preference = (still: boolean) => { media.matches = still; media.change(); };
    return { seen, steps, stop, run, move, fire, preference };
  }

  it('says whether motion is reduced before the first measurement, and measures before the frame', () => {
    const s = stage();
    s.run(16);
    expect(s.seen).toEqual(['motion false', 'measured 1000', 'frame']);
    s.stop();
  });

  it('drops strokes while the page waits to be measured again, and starts the next stroke afresh', () => {
    const s = stage();
    s.run(16);
    s.move(10); s.move(20);
    expect(s.seen.filter((e) => e === 'stroke')).toHaveLength(1);
    s.fire('scroll');
    s.move(30);
    s.run(32);
    s.move(40);
    expect(s.seen.filter((e) => e === 'stroke')).toHaveLength(1);
    s.move(50);
    expect(s.seen.filter((e) => e === 'stroke')).toHaveLength(2);
    s.stop();
  });

  it('forgets the cursor under reduced motion, and comes back without it', () => {
    const s = stage();
    s.run(16);
    s.move(10);
    s.run(32);
    expect(s.steps.at(-1)?.cursor).toMatchObject({ x: 10, y: 10 });
    s.preference(true);
    s.run(48);
    s.move(20); s.move(30);
    expect(s.seen.slice(-3)).toEqual(['motion true', 'measured 1000', 'frame']);
    expect(s.steps.at(-1)).toBeNull();
    s.preference(false);
    s.run(64);
    expect(s.seen.slice(-3)).toEqual(['motion false', 'measured 1000', 'frame']);
    expect(s.steps.at(-1)?.cursor).toBeNull();
    s.stop();
  });
});
