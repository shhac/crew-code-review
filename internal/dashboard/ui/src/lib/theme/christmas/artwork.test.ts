import { expect, it } from 'vitest';
import { render } from 'svelte/server';
import RobinArt from './RobinArt.svelte';
import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import ChristmasShelf from './ChristmasShelf.svelte';
import { ROBIN } from './snow';
import { partsPose } from './parts-pose';

// Every drawing is mounted; only those drawn go without visibility="hidden".
const shown = (body: string) => [...body.matchAll(/<image [^>]*>/g)]
  .filter(([tag]) => !tag.includes('visibility="hidden"'))
  .map(([tag]) => tag.match(/data-part="([^"]+)"/)?.[1]);

it.each(['perch', 'alert', 'flight'] as const)('renders the %s pose using layered component artwork', pose => {
  const { body } = render(RobinArt, { props: { pose } });
  expect(body).toContain('data-robin-art="layered"');
  expect(body).toContain('viewBox="0 0 128 112"');
  expect(shown(body)).toContain('body');
  expect(shown(body)).toContain('tail');
  expect(shown(body)).toContain('head');
  expect(body).not.toMatch(/blob:|atlas-sheet|raised-wing/);
  if (pose === 'flight') {
    expect(shown(body)).toContain('wing-up');
    expect(shown(body)).toContain('leg-near-tucked');
    expect(shown(body)).not.toContain('leg-near');
  } else expect(shown(body)).toContain('leg-near');
});

it('holds the standing geometry under reduced motion, even with stale flight articulation', () => {
  const { body } = render(RobinArt, { props: { pose: 'flight', articulation: partsPose(300, 'flight'), reduced: true } });
  expect(body).toContain('data-flight-weight="0"');
  expect(body).toContain('data-head-angle="0"');
  expect(shown(body)).toContain('leg-near');
  expect(shown(body)).not.toContain('wing-down');
});

it('uses a single shared renderer at the dashboard foot anchor and preserves the shelf', () => {
  const layer = readFileSync(new URL('./ChristmasLayer.svelte', import.meta.url), 'utf8');
  expect(layer).toContain('<RobinArt pose={drawing.pose} {articulation} {reduced} />');
  expect(layer).not.toMatch(/atlas|flightFrame|--wing/);
  expect(ROBIN.width).toBeCloseTo(44.8);
  expect(ROBIN.height).toBeCloseTo(39.2);
  expect(ROBIN.anchorX).toBeCloseTo(22.4);
  expect(ROBIN.anchorY).toBeCloseTo(35.735);
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
