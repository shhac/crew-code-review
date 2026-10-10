<script lang="ts">
  // The spider in the critters lab, stood on the lab's anchor, or hung from
  // above it.
  import Spider from '../../lib/theme/halloween/Spider.svelte';

  export let mode: string;
  export let walked: number;
  export let dir: 1 | -1;
  export let playing: boolean;
  export let hidden: string[];
  export let marked = false;
</script>

<div class="spider" class:hanging={mode === 'hang'} style="transform: scaleX({dir})" data-critter={marked ? mode : undefined}>
  <Spider moving={playing && mode === 'walk'} hanging={mode === 'hang'} {walked} crouch={mode === 'crouch' ? 1 : 0} tuck={mode === 'jump' ? 1 : 0} {hidden} />
</div>

<style>
  /* The spider's walking box has its feet at y 38 of 40; hanging, its silk is
     tied 4px down its strip, here hung from 60px up. */
  .spider { position: absolute; left: -39px; top: -38px; transform-origin: 39px 0; }
  .spider.hanging { left: -31px; top: -60px; transform-origin: 31px 0; }
</style>
