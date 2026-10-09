<script lang="ts">
  // An animal drawn from its parts (rig.ts), standing at (x, y) on the page
  // and facing dir. The caller sets the data attributes tests and the debug
  // overlay read.
  import Layers from './Layers.svelte';
  import type { RigPose } from './rig';

  export let pose: RigPose;
  export let x: number;
  export let y: number;
  export let dir: 1 | -1 = 1;
  export let opacity = 1;
  // Marks the pose's guides: where it stands and where its joints are.
  export let guides = false;
</script>

<svg
  class="rig"
  width={pose.width * pose.scale}
  height={pose.height * pose.scale}
  viewBox="0 0 {pose.width} {pose.height}"
  style="left: {x - pose.anchor.x * pose.scale}px; top: {y - pose.anchor.y * pose.scale}px; opacity: {opacity}; transform: scaleX({dir}); transform-origin: {pose.anchor.x * pose.scale}px 0"
  {...$$restProps}
>
  <Layers layers={pose.layers} />
  {#if guides}
    {#each pose.guides ?? [] as guide}
      <circle class="guide" cx={guide.at.x} cy={guide.at.y} r=".45"><title>{guide.name}</title></circle>
    {/each}
  {/if}
</svg>

<style>
  .rig { position: absolute; display: block; overflow: visible; }
  .guide { fill: none; stroke: #ff3d7f; stroke-width: .18; }
</style>
