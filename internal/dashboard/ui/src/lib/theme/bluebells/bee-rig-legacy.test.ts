import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { bee, beeAt, darted } from '../../../lab/critters/bee';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import { beeRig as built, type BeePose, type RigBee } from './bee-rig';
import { beeRig as legacy } from './bee-rig-legacy';

// The bee moved onto her skeleton draws exactly what her old rig drew, but
// for the mark of where she moves, which now stays on the point a model
// moves rather than bobbing with her body.
const MOVES = 'thorax (moves here)';
const ALL_BUT_MOVES = (plan: Plan): Plan => ({ ...plan, guides: plan.guides.filter((g) => g.name !== MOVES) });

describe('the bee on her skeleton', () => {
  it('draws what her old rig drew in every moment the lab shows, held still, and leaning either way as far as she leans', () => {
    expect(unlike(bee, (at, look) => darted(legacy(beeAt(at, look.gaze), { now: at.now, still: look.still }), at, look.still), 10, ALL_BUT_MOVES)).toEqual([]);
  }, 60000);

  it('draws what she drew in every pose through its whole motion, at every speed, wings folding and beating, knocked any while', () => {
    const poses: BeePose[] = ['perch', 'crawl', 'scurry', 'hover', 'fly', 'land', 'bonk'];
    for (const pose of poses) for (const speed of [0, 30, 70]) for (let i = 0; i < 60; i += 1) {
      const b: RigBee = { pose, seed: 2, walked: i * 0.13, speed, lean: (i % 3) * 15 - 15, wings: (i % 5) / 4, knocked: i * 23 };
      const look = { now: i * 29, still: false };
      expect(planDiff(ALL_BUT_MOVES(planOf(built(b, look))), ALL_BUT_MOVES(planOf(legacy(b, look)))), `${pose} ${i} at ${speed}`).toEqual([]);
    }
  }, 60000);
});
