import { describe, expect, it } from 'vitest';
import { rabbit } from './critters/rabbit';
import { CRITTERS } from './critters/registry';
import { layColumns, legendOf, litBy, parseCode, skeletonFromPosed, type Skeleton } from './skeleton';

const at = (mode: string, now = 1300) => ({ mode, now, walked: 1.3 });
const look = { gaze: 0, still: false };
const joint = (s: Skeleton, code: string) => s.joints.find((j) => j.code === code);

describe('the skeleton view', () => {
  it('finds bones for every animal drawn from parts, in every mode it has joints in (not one picture, asleep or curled up)', () => {
    for (const c of CRITTERS) {
      if (c.kind !== 'rig') continue;
      for (const mode of c.modes) {
        const p = c.pose(at(mode), look);
        if ((p.guides ?? []).length < 2) continue;
        // As the lab draws it, from its own skeleton.
        expect(p.skeleton, `${c.name} ${mode}`).toBeTruthy();
        if (!p.skeleton) continue;
        const s = skeletonFromPosed(p.skeleton);
        expect(s.bones.length, `${c.name} ${mode}`).toBeGreaterThan(0);
        expect(new Set(s.joints.map((j) => j.code)).size, `${c.name} ${mode}`).toBe(s.joints.length);
        expect(s.bones.every((b) => joint(s, b.from) && joint(s, b.to)), `${c.name} ${mode}`).toBe(true);
      }
    }
  });
});

describe('codes', () => {
  const sat = rabbit.pose(at('sit'), look).skeleton;
  if (!sat) throw new Error('the rabbit is drawn without its skeleton');
  const s = skeletonFromPosed(sat);

  it('reads a code back to its part, kind and place', () => {
    expect(parseCode('L0B2')).toEqual({ group: 'L0', kind: 'B', index: 2 });
    expect(parseCode('W0J0')).toEqual({ group: 'W0', kind: 'J', index: 0 });
    expect(parseCode('elbow')).toBeNull();
  });

  it('lights a bone with its two joints, a joint alone', () => {
    expect([...litBy(s, 'L0B2')]).toEqual(['L0B2', 'L0J2', 'L0J3']);
    expect([...litBy(s, 'L0J1')]).toEqual(['L0J1']);
    expect(litBy(s, null).size).toBe(0);
  });

  it("lists a limb's rows along it, joint and bone in turn", () => {
    const [first] = legendOf(s);
    expect(first.group.code).toBe('L0');
    expect(first.rows.map((r) => r.code)).toEqual(['L0J0', 'L0B0', 'L0J1', 'L0B1', 'L0J2', 'L0B2', 'L0J3', 'L0B3', 'L0J4']);
  });
});

describe('layColumns', () => {
  const label = (text: string, x: number, y: number) => ({ text, at: { x, y }, px: 10 });
  const around = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

  it('stands each label beyond the skeleton on its own side, at its point\'s height while there is room', () => {
    expect(layColumns([label('L0J0', 90, 5), label('L2J0', 10, 40)], 1, around)).toEqual([
      { ...label('L2J0', 10, 40), x: -22, y: 40, anchor: 'end' }, { ...label('L0J0', 90, 5), x: 122, y: 5, anchor: 'start' },
    ]);
  });

  it('stacks crowded labels a line apart, in their points\' order, centred where they would be', () => {
    const laid = layColumns([label('b', 80, 1), label('a', 80, 0), label('c', 80, 2)], 1, around);
    expect(laid.map((l) => l.text)).toEqual(['a', 'b', 'c']);
    expect(laid.map((l) => l.y)).toEqual([-12.5, 1, 14.5]);
  });
});
