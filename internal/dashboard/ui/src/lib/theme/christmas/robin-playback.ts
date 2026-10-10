import type { Bird } from './robin';
import { smooth } from '../math';
import { mixPartsPose, partsPose, type PartsPose } from './parts-pose';

const standing = () => partsPose(0, 'still');

// The scene owns travel and randomness. This player only articulates the bird
// at that position, using the same drawings and joint model as the art lab.
export function createRobinPlayback(phaseOffset = 0) {
  let epoch: number | null = null, lastTime = -Infinity, key = '', changedAt = 0;
  let previous = standing(), transition = previous;
  const reset = () => {
    epoch = null; lastTime = -Infinity; key = ''; changedAt = 0;
    previous = standing(); transition = previous;
  };
  return {
    reset,
    pose(bird: Bird, now: number, reduced = false): PartsPose {
      if (!Number.isFinite(now)) throw new Error('Invalid animation clock');
      if (reduced || !bird.perch) { reset(); return standing(); }
      if (now < lastTime) reset();
      lastTime = now;
      epoch ??= now;
      const elapsed = now - epoch + phaseOffset, action = bird.action;
      let target: PartsPose, nextKey: string;
      if (action) {
        const age = Math.max(0, now - action.start);
        nextKey = action.kind + ':' + action.start;
        if (action.kind === 'flight') {
          const join = Math.min(120, action.duration * .2);
          // Enter with the wing extended back; fold again before the feet land.
          const flying = partsPose(age + 150, 'flight');
          const landing = smooth((age - action.duration + 300) / 180);
          flying.headAngle -= 10 * landing;
          const lookingUp = { ...standing(), headAngle: -12 };
          target = age < join
            ? mixPartsPose(nextKey === key ? transition : previous, flying, smooth(age / join))
            : mixPartsPose(lookingUp, flying, smooth((action.duration - age) / join));
        } else {
          const progress = Math.min(1, age / action.duration);
          const time = progress < .5 ? 700 + progress * 1100 : 1250 + (progress - .5) * 1340;
          // World-space travel already supplies the lift; keep only articulation.
          target = { ...partsPose(time, 'hop'), lift: 0 };
        }
      } else if (bird.alert) {
        nextKey = 'alert'; target = { ...standing(), headAngle: -7 };
      } else {
        const phase = elapsed % 12000;
        const pecking = phase >= 6000 && phase < 8200;
        nextKey = pecking ? 'peck' : 'idle';
        target = pecking ? partsPose(phase - 6000 + 700, 'peck') : partsPose(elapsed, 'alive');
      }
      if (nextKey !== key) {
        transition = previous; changedAt = now; key = nextKey;
      }
      // Flight has explicit takeoff/landing joins. Other state changes blend,
      // including an alert or hop interrupting a peck.
      previous = action?.kind === 'flight' ? target : mixPartsPose(transition, target, smooth((now - changedAt) / 120));
      return previous;
    },
  };
}
