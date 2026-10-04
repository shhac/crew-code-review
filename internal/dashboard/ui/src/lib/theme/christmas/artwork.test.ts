import { expect, it } from 'vitest';
import { render } from 'svelte/server';
import RobinArt from './RobinArt.svelte';
import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import ChristmasShelf from './ChristmasShelf.svelte';
import { ROBIN } from './snow';
import { atlasFallbackUrl } from './atlas-inventory';
const neutral = atlasFallbackUrl() ?? 'robin-perch.webp';

it.each(['perch', 'alert', 'flight'] as const)('renders the %s raster pose with native aligned cells', (pose) => {
  const { body } = render(RobinArt, { props: { pose } });
  expect(body).toContain(pose === 'perch' ? neutral : `robin-${pose}.webp`);
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

it('forces the independently packaged neutral under reduced motion even for a stale flight/blink', () => {
  const { body } = render(RobinArt, { props: { pose: 'flight', frame: 'B2', reduced: true } });
  expect(body).toContain('data-atlas-frame="I0"');
  expect(body).toContain(neutral);
  expect(body).not.toContain('raised-wing');
});

it('replaces every layer use while retaining the existing outer registration and shelf', () => {
  const layer = readFileSync(new URL('./ChristmasLayer.svelte', import.meta.url), 'utf8');
  expect(layer).toContain('<RobinArt pose={drawing.pose} {frame} {atlasFrame} {reduced} />');
  expect(layer).not.toMatch(/\.svg|\{@html/);
  expect(layer).toContain('left: {drawing.x - ROBIN.anchorX}px; top: {drawing.y - ROBIN.anchorY}px');
  expect(layer).toContain('transform: scaleX({drawing.dir}); transform-origin: {ROBIN.anchorX}px {ROBIN.anchorY}px; --wing: {drawing.wing}deg');
  expect(ROBIN.width).toBeCloseTo(44.8);
  expect(ROBIN.height).toBeCloseTo(39.2);
  expect(ROBIN.anchorX).toBeCloseTo(22.4);
  expect(ROBIN.anchorY).toBe(35);
  const { body } = render(ChristmasShelf);
  expect(body).toContain('tree.webp');
  expect(body).toContain('presents.webp');
  expect(body).toContain('theme-shelf christmas-shelf');
  expect(body).toContain('width="88" height="83"');
  expect(body).toContain('width="124" height="66"');
  expect(body.match(/class="fairy-light /g)).toHaveLength(7);
  expect(body).toContain('aria-hidden="true"');
  expect(body.match(/alt=""/g)).toHaveLength(2);
});

it('twinkles only opacity and leaves steady click-through lights under reduced motion', () => {
  const source = readFileSync(new URL('./ChristmasShelf.svelte', import.meta.url), 'utf8');
  const css = compile(source, { filename: 'ChristmasShelf.svelte', generate: 'server' }).css?.code ?? '';
  expect(css).toMatch(/@keyframes[^}]+\{\s*from\s*\{\s*opacity:\s*\.35;?\s*\}\s*to\s*\{\s*opacity:\s*\.70/);
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce[^}]+animation:\s*none;\s*opacity:\s*\.5/);
  expect(css).toContain('pointer-events: none');
  expect(css).toMatch(/\.christmas-shelf[^}]*pointer-events:\s*none/);
  expect(css).toMatch(/\.fairy-light[^}]*pointer-events:\s*none/);
  expect(css).toMatch(/\.shelf-stage[^}]*width:\s*192px;\s*height:\s*83px/);
  expect(css).toMatch(/\.presents[^}]*left:\s*68px;\s*top:\s*17px/);
  expect(render(ChristmasShelf).body).not.toMatch(/tabindex|<button|<a\b/);
});

it('retains the shared desktop rail visibility boundaries', () => {
  const shell = readFileSync(new URL('../../../styles/shell.css', import.meta.url), 'utf8');
  expect(shell).toMatch(/@media\s*\(max-height:\s*640px\),\s*\(max-width:\s*760px\)\s*\{\s*\.shell \.rail \.theme-shelf\s*\{\s*display:\s*none/);
});
