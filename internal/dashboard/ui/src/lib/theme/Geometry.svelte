<script lang="ts">
  import type { Ledge } from './floors';
  export let floors: ReadonlyMap<number, Ledge>;
</script>

<svg class="geometry" width="100%" height="100%">
  {#each [...floors] as [id, f] (id)}
    <g data-floor-id={id} data-headroom={f.headroom}>
      <line class="floor" x1={f.left} y1={f.y} x2={f.right} y2={f.y} />
      {#if f.base > f.y}
        <line class="wall" x1={f.left} y1={f.y} x2={f.left} y2={f.base} />
        <line class="wall" x1={f.right} y1={f.y} x2={f.right} y2={f.base} />
      {/if}
      <text x={f.left + 4} y={f.y - 4}>{id}{Number.isFinite(f.headroom) ? ` · headroom ${Math.round(f.headroom)}` : ''}</text>
    </g>
  {/each}
</svg>

<style>
  .geometry { position: absolute; inset: 0; }
  line { stroke-width: 1; stroke-dasharray: 4 3; }
  .floor { stroke: #78c8ff; }
  .wall { stroke: #bd9cff; }
  text { fill: #78c8ff; font: 10px ui-monospace, monospace; }
</style>
