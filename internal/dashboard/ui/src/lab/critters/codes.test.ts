import { describe, expect, it } from 'vitest';
import { codeNow, codesOf, type RigCritter } from './critter';
import { CRITTERS } from './registry';

// What each of an insect's leg codes named before her coxa was a bone: the
// coxa (its socket), knee, tibiotarsal joint and claws, and the bones
// between them.
const BEFORE = { J0: 'coxa', J1: 'knee', J2: 'tibiotarsal', J3: 'claws', B0: 'femur', B1: 'tibia', B2: 'tarsus' } as const;

const rig = (name: string) => CRITTERS.find((c): c is RigCritter => c.kind === 'rig' && c.name === name);

describe('a link to an insect leg', () => {
  for (const name of ['bee', 'wasp']) {
    const critter = rig(name);
    if (!critter) throw new Error(`no ${name}`);
    const skeleton = critter.pose({ mode: critter.modes[0], now: 0, walked: 0 }, { gaze: 0, still: true }).skeleton;
    const named = (code: string) => skeleton?.joints.find((j) => j.code === code)?.name ?? skeleton?.bones.find((b) => b.code === code)?.name ?? '';

    it(`written before the ${name}'s coxa was a bone, with or without &codes=role, still names the same joint or bone`, () => {
      for (const leg of [0, 1, 2, 3, 4, 5]) for (const [part, meant] of Object.entries(BEFORE)) {
        for (const codes of [null, 'role']) expect(named(codeNow(critter, `L${leg}${part}`, codes)), `L${leg}${part} &codes=${codes}`).toContain(meant);
      }
    });

    it(`written now, keeps the ${name}'s codes as they are`, () => {
      expect(codesOf(critter)).toBe('coxa');
      expect(codeNow(critter, 'L2J1', codesOf(critter))).toBe('L2J1');
    });
  }

  it('leaves every other animal\'s role codes as they are', () => {
    for (const critter of CRITTERS.filter((c) => !c.codes)) expect(codeNow(critter, 'L0J1', 'role'), critter.name).toBe('L0J1');
  });
});
