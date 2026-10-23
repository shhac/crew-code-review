import { describe, expect, it } from 'vitest';
import { unlike } from '../../../lab/critters/equivalence';
import { cupid, cupidAt } from '../../../lab/critters/cupid';
import { legsOf } from '../rig/test-rig';
import { planDiff, planOf } from '../rig/skeleton/plan';
import { cupidRig as built, type CupidPose } from './cupid-rig';
import { cupidRig as legacy } from './cupid-rig-legacy';

const POSES: CupidPose[] = ['hover', 'flight', 'draw', 'aim', 'loose', 'dodge'];
// Every pose through its whole motion, aimed anywhere it can aim, flying at
// any speed and turning its head either way.
const moments = POSES.flatMap((pose) => [-35, -10, 0, 25, 50, 75].flatMap((aim) => Array.from({ length: 24 }, (_, i) => ({
  cupid: { pose, seed: 1, beat: i / 7, progress: i / 23, aim, speed: (i % 6) * 40, accel: ((i % 5) - 2) * 300, gaze: (i % 4) * 6 - 12 },
  look: { now: i * 97, still: false },
}))));

// The cupid moved onto its skeleton draws exactly what its old rig drew.
describe('the cupid on its skeleton', () => {
  it('draws what its old rig drew in every moment the lab shows, and held still', () => {
    expect(unlike(cupid, (at, look) => legacy(cupidAt(at), { now: at.now, still: look.still }))).toEqual([]);
  }, 60000);

  it('draws what it drew in every pose, aimed anywhere from -35 to 75 degrees', () => {
    for (const { cupid: c, look } of moments) expect(planDiff(planOf(built(c, look)), planOf(legacy(c, look))), `${c.pose} aim ${c.aim} at ${look.now}`).toEqual([]);
  }, 60000);

  // Its arms bend to the side each hold has them, its fists along the
  // forearm, and its legs swing and bend by angles, as its own code posed
  // them: the same limbs, near arm, far arm, near leg, far leg.
  it('poses its arms and legs as its own code did', () => {
    for (const { cupid: c, look } of moments) {
      const [farArm, farLeg, nearLeg, nearArm] = legsOf(legacy(c, look));
      const bare = (l: { hip: unknown; knee: unknown; foot: unknown; paw: number }) => ({ hip: l.hip, knee: l.knee, foot: l.foot, paw: l.paw });
      const posed = legsOf(built(c, look)).map(bare);
      const old = [nearArm, farArm, nearLeg, farLeg].map(bare);
      expect(planDiff(posed, old), `${c.pose} aim ${c.aim}`).toEqual([]);
    }
  }, 60000);
});
