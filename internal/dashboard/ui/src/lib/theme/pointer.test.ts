import { afterEach, describe, expect, it, vi } from 'vitest';
import { observePointer, pointerTracker } from './pointer';
afterEach(() => vi.unstubAllGlobals());
const event = (x: number, extra = {}) => ({ clientX: x, clientY: 100, pointerId: 1, pointerType: 'mouse', buttons: 0, pressure: 0, ...extra });
describe('passive pointer segments', () => {
  it('covers fast movement and rejects stationary events', () => {
    const p = pointerTracker();
    expect(p.move(event(0), 0)).toBeNull();
    expect(p.move(event(500), 1)).toMatchObject({ from: { x: 0 }, to: { x: 500 } });
    expect(p.move(event(500), 2)).toBeNull();
  });
  it.each([{ pointerType: 'touch' }, { buttons: 1 }, { pointerType: 'pen', pressure: .1 }, { pointerType: 'pen', buttons: 1 }])('rejects contact and resets origin: %j', (extra) => {
    const p = pointerTracker();
    p.move(event(0), 0);
    expect(p.move(event(100, extra), 1)).toBeNull();
    expect(p.move(event(200), 2)).toBeNull();
  });
  it('accepts hovering pen, resets identity and explicit invalidations', () => {
    const p = pointerTracker();
    p.move(event(0, { pointerType: 'pen' }), 0);
    expect(p.move(event(50, { pointerType: 'pen' }), 1)).not.toBeNull();
    expect(p.move(event(100, { pointerId: 2 }), 2)).toBeNull();
    p.reset();
    expect(p.move(event(200, { pointerId: 2 }), 3)).toBeNull();
  });
});
it('listens passively, resets on exits/gestures and removes all listeners', () => {
  const listeners = new Map<string, (e?: unknown) => void>();
  const add = vi.fn((name, fn) => listeners.set(name, fn));
  const remove = vi.fn((name) => listeners.delete(name));
  vi.stubGlobal('addEventListener', add); vi.stubGlobal('removeEventListener', remove);
  const reset = vi.fn(), move = vi.fn();
  const stop = observePointer(move, reset);
  expect(add).toHaveBeenCalledWith('pointermove', move, { passive: true });
  for (const name of ['pointerdown', 'pointercancel', 'blur', 'pointerleave']) listeners.get(name)!();
  listeners.get('pointerout')!({ relatedTarget: {} }); expect(reset).toHaveBeenCalledTimes(4);
  listeners.get('pointerout')!({ relatedTarget: null }); expect(reset).toHaveBeenCalledTimes(5);
  stop(); expect(listeners.size).toBe(0);
});
