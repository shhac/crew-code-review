import { expect, it } from 'vitest';
import { render } from 'svelte/server';
import RobinArt from './RobinArt.svelte';
import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import ChristmasShelf from './ChristmasShelf.svelte';
import { ROBIN } from './snow';

it.each(['perch', 'alert', 'flight'] as const)('renders the %s raster pose with native aligned cells', (pose) => {
  const { body } = render(RobinArt, { props: { pose } });
  expect(body).toContain(`robin-${pose}.webp`);
  expect(body).not.toContain('<svg');
  const images = body.match(/<img\b[^>]*>/g) ?? [];
  expect(images).toHaveLength(pose === 'flight' ? 2 : 1);
  for (const image of images) {
    expect(image).toContain('width="128"');
    expect(image).toContain('height="112"');
    expect(image).toContain('alt=""');
  }
  if (pose === 'flight') {
    expect(images[0]).toContain('robin-flight.webp');
    expect(images[1]).toContain('robin-flight-wing.webp');
    expect(images[1]).toContain('raised-wing');
  }
});

it('scales the native stage once and rotates only the wing about its native pivot', () => {
  const source = readFileSync(new URL('./RobinArt.svelte', import.meta.url), 'utf8');
  const css = compile(source, { filename: 'RobinArt.svelte', generate: 'server' }).css?.code ?? '';
  expect(css).toMatch(/\.art-cell[^}]*width:\s*128px[^}]*height:\s*112px[^}]*transform:\s*scale\(\.35\)[^}]*transform-origin:\s*0 0/);
  expect(css.match(/scale\(/g)).toHaveLength(1);
  expect(css).toMatch(/\.raised-wing[^}]*rotate\(var\(--wing, 0deg\)\)[^}]*transform-origin:\s*64px 57px[^}]*transform-box:\s*border-box/);
});

it('replaces every layer use while retaining the existing outer registration and shelf', () => {
  const layer = readFileSync(new URL('./ChristmasLayer.svelte', import.meta.url), 'utf8');
  expect(layer).toContain('<RobinArt pose={drawing.pose} />');
  expect(layer).not.toMatch(/\.svg|\{@html/);
  expect(layer).toContain('left: {drawing.x - ROBIN.anchorX}px; top: {drawing.y - ROBIN.anchorY}px');
  expect(layer).toContain('transform: scaleX({drawing.dir}); transform-origin: {ROBIN.anchorX}px {ROBIN.anchorY}px; --wing: {drawing.wing}deg');
  expect(ROBIN.width).toBeCloseTo(44.8);
  expect(ROBIN.height).toBeCloseTo(39.2);
  expect(ROBIN.anchorX).toBeCloseTo(22.4);
  expect(ROBIN.anchorY).toBe(35);
  const { body } = render(ChristmasShelf);
  expect(body).toContain('holly.webp');
  expect(body).toContain('theme-shelf christmas-shelf');
  expect(body).toContain('width="48" height="32"');
});
