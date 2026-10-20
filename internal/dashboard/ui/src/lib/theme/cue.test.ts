import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const load = async (search: string) => {
  vi.stubGlobal('location', { search });
  return import('./cue');
};

it('cues nothing without the parameter', async () => {
  const { cueOf } = await load('');
  expect(cueOf(['sweep', 'rally'])).toBeNull();
  expect(cueOf([''])).toBeNull();
});

it('names the cue a month asks about, typed to its own names', async () => {
  const { cueOf } = await load('?theme=wimbledon&theme-cue=rally');
  const cued = cueOf(['sweep', 'rally']);
  expect(cued).toBe('rally');
  expectTypeOf(cued).toEqualTypeOf<'sweep' | 'rally' | null>();
  expect(cueOf(['swoop'])).toBeNull();
});

it('is read once, at load', async () => {
  const { cueOf } = await load('?theme-cue=scatter');
  vi.stubGlobal('location', { search: '' });
  expect(cueOf(['scatter'])).toBe('scatter');
});

it('draws the debug overlay only on request, as the page is when asked', async () => {
  const { debugOn } = await load('?theme=harvest&theme-debug=1');
  expect(debugOn()).toBe(true);
  vi.stubGlobal('location', { search: '?theme-debug=0' });
  expect(debugOn()).toBe(false);
});
