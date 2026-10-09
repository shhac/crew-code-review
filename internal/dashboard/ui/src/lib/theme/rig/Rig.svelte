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
</script>

<svg
  class="rig"
  width={pose.width}
  height={pose.height}
  viewBox="0 0 {pose.width} {pose.height}"
  style="left: {x - pose.anchor.x}px; top: {y - pose.anchor.y}px; opacity: {opacity}; transform: scaleX({dir}); transform-origin: {pose.anchor.x}px 0"
  {...$$restProps}
>
  <Layers layers={pose.layers} />
</svg>

<style>
  .rig { position: absolute; display: block; overflow: visible; }
</style>
