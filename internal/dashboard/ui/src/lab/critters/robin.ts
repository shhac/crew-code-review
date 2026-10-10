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
} satisfies ViewCritter;
