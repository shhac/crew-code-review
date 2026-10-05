import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '../../../../internal/dashboard/ui/src/lib/theme/christmas/robin-parts');
mkdirSync(output, { recursive: true });
const magick = (...args) => execFileSync('magick', args, { encoding: 'utf8' }).trim();
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
// Native registration is anatomical, manually calibrated against the canonical.
// Each generated component has its own scale; variants of a component must share it.
const placements = {
  body: { x: 35, y: 25, width: 75, pivot: [64, 83] },
  // The shortened peck attachment keeps the same belly baseline as standing.
  'body-peck': { x: 35, y: 30.997657, width: 75, pivot: [64, 83] },
  head: { x: 66, y: 8, width: 49, pivot: [82, 42] },
  neck: { x: 68, y: 34, width: 37, pivot: [82, 42] },
  wing: { x: 29, y: 32, width: 59, pivot: [79, 43] },
  // The root edit retains the original source canvas. Preserve that registration
  // instead of scaling/recentring the tail when its feathered alpha bounds change.
  tail: { source: 'tail-feather-root.png', x: 8, y: 58, width: 43, pivot: [46, 65], registrationBounds: [97, 174, 1399, 691] },
  // The visible near leg sits on the left in this right-facing view.
  // Compare the visible feet rather than full-image height; near width +5%.
  // The near foot sits slightly lower to reflect its position in perspective.
  'leg-near': { x: 57, y: 85, width: 15.2, pivot: [64, 99.1] },
  'leg-far': { x: 70, y: 78.8, width: 14.5, pivot: [78, 98] },
  // Align the drawn lid, which is off-centre within its feather patch, to the
  // open eye at approximately (98.1, 24.0). Both inherit the head transform.
  // The feather patch must also cover the entire open-eye perimeter.
  eyelid: { x: 89, y: 17.7, width: 14, pivot: [98.1, 24] },
  // Measured crops have different aspect ratios and shoulder locations. These
  // placements align the drawn roots, not the generated canvas centres.
  'wing-up': { source: 'wing-up-anatomy.png', rootSource: [1100, 1030], tipSource: [916, 41], projectedSpan: 82, pivot: [79, 43] },
  'wing-down': { source: 'wing-down-anatomy.png', rootSource: [460, 200], tipSource: [130, 1180], projectedSpan: 82, pivot: [79, 43] },
  'wing-far-up': { source: 'wing-far-up-anatomy.png', rootSource: [1040, 980], tipSource: [850, 67], projectedSpan: 74, pivot: [90, 42] },
  'wing-far-down': { source: 'wing-far-down-anatomy.png', rootSource: [890, 210], tipSource: [263, 1013], projectedSpan: 74, pivot: [90, 42] },
  'wing-forward': { rootSource: [1490, 280], tipSource: [185, 435], projectedSpan: 68, pivot: [79, 43] },
  'wing-far-forward': { rootSource: [1500, 280], tipSource: [232, 473], projectedSpan: 60, pivot: [90, 42] },
  'wing-recovery': { rootSource: [1390, 530], tipSource: [380, 110], projectedSpan: 60, pivot: [79, 43] },
  'wing-far-recovery': { rootSource: [1360, 610], tipSource: [401, 73], projectedSpan: 54, pivot: [90, 42] },
  'wing-high-fall': { rootSource: [1060, 1020], tipSource: [292, 86], projectedSpan: 78, pivot: [79, 43] },
  'wing-far-high-fall': { rootSource: [1060, 1000], tipSource: [209, 66], projectedSpan: 70, pivot: [90, 42] },
  'wing-low-fall': { rootSource: [845, 220], tipSource: [65, 1100], projectedSpan: 78, pivot: [79, 43] },
  'wing-far-low-fall': { rootSource: [890, 190], tipSource: [107, 1170], projectedSpan: 70, pivot: [90, 42] },
  'wing-low-rise': { rootSource: [960, 220], tipSource: [175, 1130], projectedSpan: 74, pivot: [79, 43] },
  'wing-far-low-rise': { rootSource: [950, 240], tipSource: [231, 1150], projectedSpan: 66, pivot: [90, 42] },
  'wing-high-rise': { rootSource: [1000, 1050], tipSource: [335, 73], projectedSpan: 72, pivot: [79, 43] },
  'wing-far-high-rise': { rootSource: [1060, 1020], tipSource: [240, 86], projectedSpan: 64, pivot: [90, 42] },
  'wing-shoulder': { x: 58.8, y: 35.71, width: 28, pivot: [79, 43] },
  'leg-near-tucked': { source: 'leg-near-flight-anatomy.png', x: 63.11, y: 85.14, width: 16.5, pivot: [65.85, 88.61] },
  'leg-far-tucked': { source: 'leg-far-flight-anatomy.png', x: 75.61, y: 78.1, width: 15, pivot: [77.71, 81.75] },

};
const parts = {};
for (const [id, placement] of Object.entries(placements)) {
  const sourceFile = placement.source ?? id + '.png';
  const source = resolve(here, 'sources', sourceFile);
  // Bounds come from actual alpha support, never assumed cells or image centres.
  const support = magick(source, '-alpha', 'extract', '-threshold', '1%', '-format', '%@', 'info:');
  const match = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(support);
  if (!match) throw new Error('Empty or invalid alpha bounds: ' + id);
  const [, visibleWidth, visibleHeight, visibleLeft, visibleTop] = match.map(Number);
  const [canvasWidth, canvasHeight] = magick('identify', '-format', '%w %h', source).split(' ').map(Number);
  if (visibleLeft < 8 || visibleTop < 8 || visibleLeft + visibleWidth > canvasWidth - 8 || visibleTop + visibleHeight > canvasHeight - 8) {
    throw new Error('Component touches the source edge: ' + id);
  }
  // Tiny alpha residue exists across generated canvases. Preserve eight source
  // pixels beyond the >1% support; do not threshold or recolour the retained art.
  const left = Math.max(0, visibleLeft - 8), top = Math.max(0, visibleTop - 8);
  const sourceWidth = Math.min(canvasWidth, visibleLeft + visibleWidth + 8) - left;
  const sourceHeight = Math.min(canvasHeight, visibleTop + visibleHeight + 8) - top;
  const geometry = sourceWidth + 'x' + sourceHeight + '+' + left + '+' + top;
  // A flight wing is registered by the measured shoulder and leading primary
  // tip, not by its variable feather-fan bounding box. Apparent shortening in
  // the horizontal/recovery profiles is deliberate perspective foreshortening.
  const scale = placement.registrationBounds ? placement.width / placement.registrationBounds[2] : placement.rootSource ? placement.projectedSpan / Math.hypot(
    placement.rootSource[0] - placement.tipSource[0], placement.rootSource[1] - placement.tipSource[1]) : null;
  const width = scale ? sourceWidth * scale : placement.width ?? placement.height * sourceWidth / sourceHeight;
  const height = scale ? sourceHeight * scale : placement.height ?? placement.width * sourceHeight / sourceWidth;
  const x = placement.registrationBounds ? placement.x + (left - placement.registrationBounds[0]) * scale
    : scale ? placement.pivot[0] - (placement.rootSource[0] - left) * scale : placement.x;
  const y = placement.registrationBounds ? placement.y + (top - placement.registrationBounds[1]) * scale
    : scale ? placement.pivot[1] - (placement.rootSource[1] - top) * scale : placement.y;
  const target = resolve(output, id + '.webp');
  magick(source, '-crop', geometry, '+repage', '-resize', Math.round(width * 6) + 'x',
    '-define', 'webp:lossless=true', '-define', 'webp:exact=true', target);
  parts[id] = { ...placement, sourceFile, x, y, width, height, file: id + '.webp', sourceBounds: [left, top, sourceWidth, sourceHeight],
    sourceSha256: hash(source), sha256: hash(target) };
}
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ version: 1, status: 'prototype',
  canvas: [128, 112], scale: 0.35, anchor: [64, 100], parts }, null, 2) + '\n');
console.log('Prepared ' + Object.keys(parts).length + ' alpha-bounded components.');
