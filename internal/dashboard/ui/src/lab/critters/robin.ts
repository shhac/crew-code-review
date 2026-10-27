import { partsModes } from '../../lib/theme/christmas/parts-pose';
import manifest from '../../lib/theme/christmas/robin-parts/manifest.json' with { type: 'json' };
import type { ViewCritter } from './critter';
import RobinView from './RobinView.svelte';

const files = import.meta.glob<string>('../../lib/theme/christmas/robin-parts/*.webp', { eager: true, query: '?url', import: 'default' });

export const robin = {
  kind: 'view',
  name: 'robin',
  modes: partsModes,
  speed: 0,
  walking: [],
  View: RobinView,
  parts: Object.keys(manifest.parts),
  art: Object.entries(manifest.parts).map(([name, part]) => ({ name, src: files[`../../lib/theme/christmas/robin-parts/${part.file}`] })),
  apart: () => 'stage',
  // Before its head turned at the skull and nodded from the neck's base, and
  // its body leaned about the hip, its spine ran from one head joint by the
  // shoulder to a body pivot (SJ1) and the tail's root (SJ2).
  aliases: { SJ1: 'SJ2', SJ2: 'SJ3', SB1: 'SB2', SB2: 'SB3' },
} satisfies ViewCritter;
