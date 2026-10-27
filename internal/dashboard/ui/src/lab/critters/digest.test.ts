import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changed, digestOf, type Digest } from './digest';
import { hedgehog } from './hedgehog';
import { CRITTERS } from './registry';

// Every rig draws what it drew when its digest was last written. A change
// meant to show (a fix, a new pose) is written in with UPDATE_DIGESTS=1,
// and seen in the lab at the times the failure names.
const FILE = new URL('./digests.json', import.meta.url);
const UPDATE = process.env.UPDATE_DIGESTS === '1';
const committed: Record<string, Digest> = JSON.parse(readFileSync(FILE, 'utf8'));
const RIGS = CRITTERS.flatMap((c) => (c.kind === 'rig' ? [c] : []));
const written: Record<string, Digest> = {};
// One line a mode, so a change shows in the file's diff where it is.
const laidOut = (all: Record<string, Digest>) => `{\n${Object.entries(all).map(([name, modes]) =>
  `  ${JSON.stringify(name)}: {\n${Object.entries(modes).map(([mode, runs]) => `    ${JSON.stringify(mode)}: ${JSON.stringify(runs)}`).join(',\n')}\n  }`).join(',\n')}\n}\n`;

describe('every rig draws what its digest says', () => {
  for (const rig of RIGS) {
    it(`the ${rig.name}`, () => {
      const now = digestOf(rig);
      if (UPDATE) {
        written[rig.name] = now;
        if (Object.keys(written).length === RIGS.length) writeFileSync(FILE, laidOut(written));
        return;
      }
      expect(changed(rig, committed[rig.name], now), 'drawn otherwise: if meant, UPDATE_DIGESTS=1 npm test -- digest').toEqual([]);
    }, 120000);
  }

  it.skipIf(UPDATE)('knows only animals there are', () => {
    expect(Object.keys(committed).sort()).toEqual(RIGS.map((r) => r.name).sort());
  });
});

describe('a digest', () => {
  it('finds a head that no longer turns, by the times it is drawn at', () => {
    const unturned = { ...hedgehog, pose: (at: Parameters<typeof hedgehog.pose>[0], look: Parameters<typeof hedgehog.pose>[1]) => hedgehog.pose(at, { ...look, gaze: 0 }) };
    const was = digestOf(hedgehog);
    expect(changed(hedgehog, was, was)).toEqual([]);
    expect(changed(hedgehog, was, digestOf(unturned))[0]).toMatch(/^hedgehog \w+: \d+ to \d+ms drawn otherwise$/);
  }, 120000);
});
