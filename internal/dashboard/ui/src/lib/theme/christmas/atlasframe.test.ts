import { expect, it } from 'vitest';
import { render } from 'svelte/server';
import { compile } from 'svelte/compiler';
import { readFileSync } from 'node:fs';
import AtlasFrame from './AtlasFrame.svelte';

it('renders absolute cells discretely and preserves the shared scale', () => {
  const { body } = render(AtlasFrame, { props: {
    sheet: '/sheet.webp', frame: 'I2',
    rectangle: { sheet: 'sheet.webp', x: 261, y: 1, width: 128, height: 112 },
  } });
  expect(body).toContain('data-atlas-frame="I2"');
  expect(body).toContain('left: -261px; top: -1px');
  expect(body.match(/<img\b/g)).toHaveLength(1);
  const source = readFileSync(new URL('./AtlasFrame.svelte', import.meta.url), 'utf8');
  const css = compile(source, { filename: 'AtlasFrame.svelte', generate: 'server' }).css?.code ?? '';
  expect(css).toContain('overflow: hidden');
  expect(css).toContain('scale(.35)');
  expect(css).not.toMatch(/transition|rotate|animation/);
});

it('uses the independent reference still for missing sheet or rectangle', () => {
  for (const props of [{}, { sheet: '/missing.webp' }]) {
    expect(render(AtlasFrame, { props }).body).toContain('robin-perch.webp');
  }
});
