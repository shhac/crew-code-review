import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const load = async () => {
  vi.stubGlobal('location', { search: '' });
  const { THEMES } = await import('./theme');
  const { scenes, sceneOf } = await import('./scenes');
  return { THEMES, scenes, sceneOf };
};

it('has a scene for every theme name and nothing else', async () => {
  const { THEMES, scenes } = await load();
  expect(Object.keys(scenes).sort()).toEqual([...THEMES].sort());
});

it('draws nothing for none and keeps the finished sets whole', async () => {
  const { sceneOf } = await load();
  expect(sceneOf('none')).toEqual({});
  for (const name of ['halloween', 'bonfire', 'christmas', 'aurora', 'valentine'] as const) {
    expect(sceneOf(name).Shelf).toBeTypeOf('function');
    expect(sceneOf(name).Layer).toBeTypeOf('function');
  }
});
