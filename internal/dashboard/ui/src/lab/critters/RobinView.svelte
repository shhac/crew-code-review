<script lang="ts">
  // The robin in the critters lab, stood on the lab's anchor. Pulled apart,
  // its pieces spread out where it stands.
  import LayeredRobin from '../../lib/theme/christmas/LayeredRobin.svelte';
  import { partsViewport } from '../../lib/theme/christmas/parts-pose';

  export let mode: string;
  export let now: number;
  export let dir: 1 | -1;
  export let still: boolean;
  export let guides: boolean;
  export let separate: boolean;
  export let hidden: string[];
  export let marked = false;

  // The robin's drawing is 128x112 at 0.35 on the page, standing at (64, 100).
  const ROBIN = { scale: 0.35, x: 64, y: 100 };
  $: viewport = partsViewport(mode, still);
</script>

<div class="robin" data-critter={marked ? mode : undefined} style="left: {(viewport[0] - ROBIN.x) * ROBIN.scale}px; top: {(viewport[1] - ROBIN.y) * ROBIN.scale}px; width: {viewport[2] * ROBIN.scale}px; height: {viewport[3] * ROBIN.scale}px">
  <LayeredRobin elapsed={now} {mode} reduced={still} mirrored={dir === -1} exploded={separate} {guides} {hidden} />
</div>

<style>
  .robin { position: absolute; }
  .robin :global(svg) { width: 100%; height: 100%; display: block; }
</style>
