import { describe, expect, it } from 'vitest';
import type { RigPose } from '../lib/theme/rig/rig';
import { allPartNames } from './rig-parts';

const image = (name: string) => ({ kind: 'image' as const, name, src: '', x: 0, y: 0, width: 1, height: 1 });
const pose = (...names: string[]): RigPose => ({ width: 1, height: 1, anchor: { x: 0, y: 0 }, scale: 1, layers: names.map(image) });

describe('allPartNames', () => {
  it('lists every part any pose draws, each once, one seen only sometimes after what it follows', () => {
    expect(allPartNames([pose('legs', 'body', 'head'), pose('legs', 'body', 'head', 'eyelid'), pose('ball')])).toEqual(['ball', 'legs', 'body', 'head', 'eyelid']);
  });
});
