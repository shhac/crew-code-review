<script lang="ts">
  import LayeredRobin from './LayeredRobin.svelte';
  import { partsPose, type PartsPose } from './parts-pose';

  export let pose: 'perch' | 'alert' | 'flight' = 'perch';
  export let elapsed = 0;
  export let reduced = false;
  export let articulation: PartsPose | null = null;
  $: drawing = articulation ?? (pose === 'alert' ? { ...partsPose(0, 'still'), headAngle: -7 }
    : partsPose(elapsed, pose === 'flight' ? 'flight' : 'alive'));
</script>

<!-- A fixed native cell preserves dashboard scale while wings overflow it. -->
<div class="robin-art" data-robin-art="layered">
  <LayeredRobin {reduced} poseOverride={drawing} fitted={false} />
</div>

<style>
  .robin-art { position: relative; width: 44.8px; height: 39.2px; pointer-events: none; }
</style>
