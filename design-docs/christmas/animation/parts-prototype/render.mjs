import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// The dashboard's TypeScript imports its own modules without extensions, as
// Vite resolves them; node, stripping the types, needs them spelled out.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || /\.[a-z]+$/.test(specifier)) throw error;
      return next(specifier + '.ts', context);
    }
  },
});
const { partsPose, partsLayers, partsViewport } = await import('../../../../internal/dashboard/ui/src/lib/theme/christmas/parts-pose.ts');
const { svgMatrix } = await import('../../../../internal/dashboard/ui/src/lib/theme/christmas/parts-affine.ts');
// SVG's matrix product, as parts-affine.ts composes transforms.
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, '../../../../internal/dashboard/ui/src/lib/theme/christmas/robin-parts');
const manifest = JSON.parse(readFileSync(resolve(assets, 'manifest.json'), 'utf8'));
const temporary = mkdtempSync(resolve(tmpdir(), 'robin-parts-preview-'));
const magick = (...args) => execFileSync('magick', args);
const dimensions = {};
for (const [id, p] of Object.entries(manifest.parts)) {
  dimensions[id] = magick('identify', '-format', '%w %h', resolve(assets, p.file)).toString().trim().split(' ').map(Number);
}
const place = (layer, transform, camera, canvas) => {
  const draw = (id, weight = 1, adjustment = '') => {
    const p = manifest.parts[id], [width, height] = dimensions[id];
    const position = [p.width / width, 0, 0, p.height / height, p.x, p.y];
    const affine = multiply(camera, multiply(multiply(transform, svgMatrix(adjustment)), position));
    return ['(', resolve(assets, p.file), '-virtual-pixel', 'transparent',
      '-define', 'distort:viewport=' + canvas + '+0+0', '-distort', 'AffineProjection', affine.join(','), '+repage',
      ...(weight !== 1 ? ['-alpha', 'associate', '-channel', 'RGBA', '-evaluate', 'Multiply', String(weight), '+channel'] : []), ')'];
  };
  const artwork = layer.nextId && layer.blend ? ['(', ...draw(layer.id, 1 - layer.blend), ...draw(layer.nextId, layer.blend, layer.nextAdjustment),
    '-compose', 'Plus', '-composite', '-alpha', 'disassociate', ')'] : draw(layer.id);
  return [...artwork, '-compose', 'Over', '-composite'];
};
function render(time, filename, exploded = false, mode = 'alive') {
  const pose = partsPose(time, mode), [x, y, width, height] = partsViewport(mode);
  // Add canvas clearance for motion; never shrink the bird to fit it.
  const scale = 3, camera = [scale, 0, 0, scale, -x * scale, -y * scale];
  const canvas = width * scale + 'x' + height * scale;
  magick('-size', canvas, 'xc:#f5f0e7',
    ...partsLayers(pose, exploded).flatMap(layer => place(layer, svgMatrix(layer.transform), camera, canvas)), filename);
}
try {
  render(0, resolve(here, 'assembled.png'));
  render(0, resolve(here, 'exploded.png'), true);
  render(0, resolve(temporary, 'eye-open.png'), false, 'blink');
  render(1550, resolve(temporary, 'eye-closed.png'), false, 'blink');
  magick(resolve(temporary, 'eye-open.png'), resolve(temporary, 'eye-closed.png'),
    '+append', resolve(here, 'blink-comparison.png'));
  for (const [mode, time] of [['hop', 1250], ['peck', 1120], ['flight-up', 0], ['flight-forward', 0], ['flight-down', 0], ['flight-recovery', 0]]) {
    render(time, resolve(here, mode + '.png'), false, mode);
  }
  const contactSheet = (modes, file) => {
    const row = pair => ['(', ...pair.flatMap(mode => ['(', resolve(here, mode + '.png'),
      '-background', '#f5f0e7', '-gravity', 'center', '-extent', '632x662', ')']), '+append', ')'];
    magick(...row(modes.slice(0, 2)), ...row(modes.slice(2)), '-append', resolve(here, file));
  };
  contactSheet(['hop', 'peck', 'flight-up', 'flight-down'], 'poses-comparison.png');
  contactSheet(['flight-up', 'flight-forward', 'flight-down', 'flight-recovery'], 'flight-profiles.png');
  if (!process.argv.includes('--still-only')) {
    const mode = process.argv.find(arg => arg.startsWith('--mode='))?.slice(7) ?? 'alive';
    const duration = mode === 'flight' ? 1200 : mode === 'hop' || mode === 'peck' ? 4000 : 12000;
    const step = mode === 'alive' ? 80 : mode === 'flight' ? 20 : 40;
    const frames = [];
    for (let time = 0; time < duration; time += step) {
      const frame = resolve(temporary, 'frame-' + String(time).padStart(5, '0') + '.png');
      render(time, frame, false, mode); frames.push(frame);
    }
    magick('-delay', String(step / 10), ...frames, '-layers', 'Optimize', '-loop', '0',
      resolve(here, mode === 'alive' ? 'preview.gif' : mode + '.gif'));
  }
  console.log('Rendered preview with the same pose functions and transforms as the live rig.');
} finally { rmSync(temporary, { recursive: true, force: true }); }
