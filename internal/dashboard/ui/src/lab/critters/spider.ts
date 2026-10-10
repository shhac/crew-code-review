import spiderShin from '../../lib/theme/halloween/leg-shin.webp';
import spiderThigh from '../../lib/theme/halloween/leg-thigh.webp';
import spiderBody from '../../lib/theme/halloween/spider-body.webp';
import spiderHanging from '../../lib/theme/halloween/spider-hanging.webp';
import type { ViewCritter } from './critter';
import SpiderView from './SpiderView.svelte';

export const spider = {
  kind: 'view',
  name: 'spider',
  modes: ['walk', 'hang', 'crouch', 'jump'],
  speed: 26,
  walking: ['walk'],
  View: SpiderView,
  // Its layers, as Spider.svelte names them.
  parts: ['far legs', 'body', 'near legs'],
  art: [{ name: 'body', src: spiderBody }, { name: 'thigh', src: spiderThigh }, { name: 'shin', src: spiderShin }, { name: 'hanging', src: spiderHanging }],
  // Hanging, it is one generated drawing, not parts.
  apart: (mode) => (mode === 'hang' ? null : 'pieces'),
} satisfies ViewCritter;
