import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { wasp, waspAt } from '../../../lab/critters/wasp';
import { planDiff, planOf, type Plan } from '../rig/skeleton/plan';
import type { WaspPose } from './footprints';
import { waspRig as built, type RigWasp } from './wasp-rig';
import { waspRig as legacy } from './wasp-rig-legacy';

// The wasp moved onto her skeleton draws exactly what her old rig drew,
// but for the mark of where she moves, which now stays on the point a
// model moves rather than bobbing with her body.
const MOVES = 'body (moves here)';
const ALL_BUT_MOVES = (plan: Plan): Plan => ({ ...plan, guides: plan.guides.filter((g) => g.name !== MOVES) });

describe('the wasp on her skeleton', () => {
  it('draws what her old rig drew in every moment the lab shows, held still, and leaning either way as far as she leans', () => {
    expect(unlike(wasp, (at, look) => legacy(waspAt(at, look.gaze), { now: at.now, still: look.still }), 10, ALL_BUT_MOVES)).toEqual([]);
  }, 60000);

  it('draws what she drew in every pose through its whole motion, at every speed, wings folding and beating', () => {
    const poses: WaspPose[] = ['standing', 'feed', 'hover', 'land', 'cruise'];
    for (const pose of poses) for (const speed of [0, 60, 200]) for (let i = 0; i < 60; i += 1) {
      const w: RigWasp = { pose, seed: 2, walked: i * 0.13, speed, lean: (i % 3) * 15 - 15, wings: (i % 5) / 4 };
      const look = { now: i * 29, still: false };
      expect(planDiff(ALL_BUT_MOVES(planOf(built(w, look))), ALL_BUT_MOVES(planOf(legacy(w, look)))), `${pose} ${i} at ${speed}`).toEqual([]);
    }
  }, 60000);
});
