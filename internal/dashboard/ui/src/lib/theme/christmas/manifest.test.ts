import { expect, it } from 'vitest';
import { alertEntry, alertReturn, blink, breathing, flap, movementClip, tilt } from './animation';
import { frameIDs, validateManifest, validateSheetInventory, type Manifest, type Sheet, type ManifestClip } from './manifest';
import type { Clip } from './animation';
const metadata = (clip: Clip): ManifestClip => ({ ...clip, terminalFrame: clip.frames[clip.frames.length - 1], restFrame: 'I0' });

// Synthetic metadata only, not substitute production artwork or acceptance.
const inventory = (): Manifest => ({
  version: 1, anchor: [64, 100], scale: .35,
  sheets: { 'bird.webp': { width: 130 * 29, height: 114, sha256: 'a'.repeat(64) } },
  fallback: { file: 'i0.webp', width: 128, height: 112, sha256: 'b'.repeat(64) },
  frames: Object.fromEntries(frameIDs.map((id, i) => [id, { sheet: 'bird.webp', x: 130 * i, y: 1, width: 128, height: 112 }])),
  clips: {
    breathing: metadata(breathing), blink: metadata(blink), tilt: metadata(tilt), hop: metadata(movementClip('hop', 280)),
    flap: metadata(flap), alertEntry: metadata(alertEntry), alertReturn: metadata(alertReturn),
    takeoff: metadata({ frames: ['I0', 'F1', 'F2', 'W0'], durations: [30, 30, 30, 30], loop: false }),
    landing: metadata({ frames: ['W0', 'L1', 'L2', 'L3', 'I0'], durations: [24, 24, 24, 24, 24], loop: false }),
  },
});

it('validates the complete 29-frame absolute inventory and actual sheet metadata', () => {
  const manifest = inventory();
  expect(validateManifest(manifest)).toEqual(manifest);
  expect(() => validateSheetInventory(manifest, { ...manifest.sheets, 'i0.webp': manifest.fallback })).not.toThrow();
  expect(() => validateSheetInventory(manifest, manifest.sheets)).toThrow('i0.webp');
  const mismatches: Record<string, Sheet>[] = [{}, { 'bird.webp': { ...manifest.sheets['bird.webp'], width: 128 } }, { 'bird.webp': { ...manifest.sheets['bird.webp'], height: 112 } }, { 'bird.webp': { ...manifest.sheets['bird.webp'], sha256: 'b'.repeat(64) } }];
  for (const decoded of mismatches) {
    expect(() => validateSheetInventory(manifest, decoded)).toThrow();
  }
});

it('rejects absent frames, sheets and clips and broken registrations', () => {
  for (const mutate of [
    (m: Manifest) => { delete m.frames.I0; },
    (m: Manifest) => { delete m.sheets['bird.webp']; },
    (m: Manifest) => { delete m.clips.landing; },
    (m: Manifest) => { m.frames.I0.sheet = 'missing.webp'; },
    (m: Manifest) => { m.clips.blink.frames = ['missing']; },
  ]) {
    const manifest = inventory(); mutate(manifest);
    expect(() => validateManifest(manifest)).toThrow();
  }
  for (const value of [null, [], {}, { ...inventory(), scale: 1 }, { ...inventory(), anchor: [64, 99] }, { ...inventory(), version: 2 }, { ...inventory(), fallback: undefined }, { ...inventory(), fallback: { ...inventory().fallback, height: 113 } }]) expect(() => validateManifest(value)).toThrow();
});

it('rejects fractional, overlapping, negative, nonfinite and out-of-sheet rectangles', () => {
  for (const patch of [{ x: -1 }, { x: .5 }, { y: NaN }, { x: Infinity }, { width: 127 }, { height: 113 }, { x: 130 * 29 }, { y: 3 }, { x: 130 }]) {
    const manifest = inventory(); Object.assign(manifest.frames.I0, patch);
    expect(() => validateManifest(manifest)).toThrow();
  }
});

it('rejects unsafe filenames, invalid sheet hashes and invalid timing including endpoint repetitions', () => {
  for (const filename of ['../bird.webp', '/bird.webp', 'https://example.com/bird.webp']) {
    const manifest = inventory(); manifest.sheets = { [filename]: manifest.sheets['bird.webp'] };
    expect(() => validateManifest(manifest)).toThrow();
  }
  const invalidHash = inventory(); invalidHash.sheets['bird.webp'].sha256 = 'a';
  expect(() => validateManifest(invalidHash)).toThrow();
  for (const duration of [0, -1, NaN, Infinity]) {
    const manifest = inventory(); manifest.clips.breathing = metadata({ ...breathing, durations: [duration, 200, 200, 200, 200, 200] });
    expect(() => validateManifest(manifest)).toThrow();
  }
  for (const frames of [['I0', 'I1', 'I0'], ['I0', 'I1', 'I2', 'I2', 'I1']]) {
    const manifest = inventory(); manifest.clips.breathing = metadata({ frames, durations: frames.map(() => 200), loop: true });
    expect(() => validateManifest(manifest)).toThrow();
  }
});

it('requires named terminal/rest metadata and validates each reference and completion pose', () => {
  for (const patch of [{ terminalFrame: undefined }, { restFrame: undefined }, { terminalFrame: 'absent' }, { restFrame: 'absent' }, { terminalFrame: 'I0' }, { restFrame: 'I1' }]) {
    const manifest = inventory(); Object.assign(manifest.clips.alertEntry, patch);
    expect(() => validateManifest(manifest)).toThrow();
  }
  expect(validateManifest(inventory()).clips.alertEntry).toMatchObject({ terminalFrame: 'A3', restFrame: 'I0' });
});
