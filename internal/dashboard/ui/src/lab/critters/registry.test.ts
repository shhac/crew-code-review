import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { Critter } from './critter';
import { CRITTERS, critterNamed } from './registry';

// Every moment the lab can ask for, in each mode: still and moving, at the
// start and some way in.
const momentsOf = (critter: Critter) => critter.modes.flatMap((mode) =>
  [false, true].flatMap((still) => [0, 1300, 4321].map((now) => ({ at: { mode, now, walked: now / 100 }, still }))));

describe('the registered animals', () => {
  it('each has its own name, by which the address finds it', () => {
    const names = CRITTERS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(critterNamed(name)?.name).toBe(name);
  });

  it('each walks only in modes it has', () => {
    for (const critter of CRITTERS) {
      expect(critter.modes.length).toBeGreaterThan(0);
      expect(critter.walking.filter((m) => !critter.modes.includes(m))).toEqual([]);
    }
  });

  for (const critter of CRITTERS) {
    it(`draws the ${critter.name} in every mode`, () => {
      for (const { at, still } of momentsOf(critter)) {
        if (critter.kind === 'rig') {
          const pose = critter.pose(at, { gaze: 0, still });
          expect(pose.layers.length, `${at.mode} at ${at.now}`).toBeGreaterThan(0);
          expect(critter.box(at).width).toBeGreaterThan(0);
          continue;
        }
        const props = { ...at, dir: 1 as const, playing: true, still, guides: false, separate: false, hidden: [], marked: true };
        expect(render(critter.View, { props }).body, `${at.mode} at ${at.now}`).toContain(`data-critter="${at.mode}"`);
      }
    });
  }
});
