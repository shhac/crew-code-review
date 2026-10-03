import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('accepts Christmas and honors query preview and opt-out', async () => {
  vi.stubGlobal('location', { search: '?theme=christmas' });
  const theme = await import('./theme');
  expect(theme.resolveTheme('none')).toBe('christmas');
  expect(theme.THEMES).toContain('christmas');
  const root = { dataset: {} };
  vi.stubGlobal('document', { documentElement: root });
  theme.markTheme('christmas');
  expect(root.dataset).toEqual({ theme: 'christmas' });
  theme.markTheme('none');
  expect(root.dataset).toEqual({});
});

it('uses configured names and ignores invalid previews', async () => {
  vi.stubGlobal('location', { search: '?theme=typo' });
  const { resolveTheme } = await import('./theme');
  expect(resolveTheme('christmas')).toBe('christmas');
  expect(resolveTheme('none')).toBe('none');
  expect(resolveTheme('typo')).toBe('none');
});
