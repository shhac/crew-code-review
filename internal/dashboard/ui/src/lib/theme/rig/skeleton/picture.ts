// An animal drawn as one picture (a hedgehog curled into a ball): a
// skeleton of one joint where it stands, which breathes, and the picture
// standing on it, as rig.ts's stillPicture draws it. It marks only where it
// stands.
import { turnAbout, type Frame, type RigPose } from '../rig';
import { compose } from './compose';
import type { Body, PoseSpec } from './types';

type Art = { name: string; src: string; width: number; height: number };

export function wholePicture(frame: Frame, art: Art): (squash: number) => RigPose {
  const { anchor } = frame;
  const body: Body = {
    frame,
    skeleton: { joints: [{ id: 'body', parent: null, role: { part: 'spine', index: 1 }, at: anchor, name: `${art.name} (where it stands)` }], bones: [], limbs: [] },
    pieces: [{ id: art.name, art: { drawn: { src: art.src, box: { x: anchor.x - art.width / 2, y: anchor.y - art.height, width: art.width, height: art.height } } }, at: { kind: 'joint', to: 'body' }, draws: [{ id: art.name, z: 0 }] }],
    guides: [],
  };
  const pose = (squash: number): PoseSpec => ({ root: turnAbout(0, anchor), joints: { body: { squash: { by: squash } } }, limbs: {}, show: {}, z: {} });
  return (squash) => compose(body, () => pose(squash), 0);
}
