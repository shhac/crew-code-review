<script lang="ts">
  // The spider in the critters lab, stood on the lab's anchor, or hung from
  // above it.
  import { afterUpdate } from 'svelte';
  import Spider from '../../lib/theme/halloween/Spider.svelte';
  import type { Placed } from '../skeleton';
  import { spiderSkeleton } from './spider-skeleton';

  export let mode: string;
  export let walked: number;
  export let dir: 1 | -1;
  export let playing: boolean;
  export let hidden: string[];
  export let marked = false;
  export let bones: Placed | null = null;

  let holder: HTMLDivElement;
  // Its legs are read back once drawn (spider-skeleton.ts), and handed on
  // only when they move, or each hand-off would draw it again. Hanging, it
  // is one picture, with no joints to show.
  afterUpdate(() => {
    const drawing = holder.querySelector('svg.walker');
    const next = drawing instanceof SVGSVGElement
      ? { skeleton: spiderSkeleton(drawing), view: { x: 0, y: 0, width: 78, height: 40 }, anchor: { x: 39, y: 38 }, scale: 1 }
      : null;
    if (JSON.stringify(next) !== JSON.stringify(bones)) bones = next;
  });
</script>

<div class="spider" class:hanging={mode === 'hang'} style="transform: scaleX({dir})" data-critter={marked ? mode : undefined} bind:this={holder}>
  <Spider moving={playing && mode === 'walk'} hanging={mode === 'hang'} {walked} crouch={mode === 'crouch' ? 1 : 0} tuck={mode === 'jump' ? 1 : 0} {hidden} />
</div>

<style>
  /* The spider's walking box has its feet at y 38 of 40; hanging, its silk is
     tied 4px down its strip, here hung from 60px up. */
  .spider { position: absolute; left: -39px; top: -38px; transform-origin: 39px 0; }
  .spider.hanging { left: -31px; top: -60px; transform-origin: 31px 0; }
</style>
