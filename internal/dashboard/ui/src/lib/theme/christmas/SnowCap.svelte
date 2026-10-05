<script lang="ts">
  import { createSnowDrawing } from './snow-drawing';
  import type { Snow } from './wipe';
  export let id: number;
  export let samples: readonly Snow[];
  export let feet: readonly number[];
  export let now: number;
  export let reduced: boolean;
  const draw = createSnowDrawing();
  $: paths = draw(samples, now, feet, reduced);
</script>

<path data-snow={id} d={paths.cover} />
<path class="shadow" d={paths.shadow} />

<style>
  path { fill: #eaf0ec; }
  .shadow { fill: #b9cbd0; }
</style>
