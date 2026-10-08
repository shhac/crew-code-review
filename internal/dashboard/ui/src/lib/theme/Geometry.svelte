<script lang="ts">
  import type { Ledge } from './floors';
  import { measureRailSky } from './sky';
  export let floors: ReadonlyMap<number, Ledge>;

  // Remeasured whenever the ledges are, which is often enough for debugging.
  $: sky = floors && measureRailSky(document.querySelector<HTMLElement>('.theme-shelf'));
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
  {#if sky}
    <g data-sky>
      <rect class="sky" x={sky.left} y={sky.top} width={sky.width} height={sky.height} />
      <text x={sky.left + 4} y={sky.top + 12}>sky {Math.round(sky.width)}x{Math.round(sky.height)}</text>
    </g>
  {/if}
</svg>

<style>
  .geometry { position: absolute; inset: 0; }
  line { stroke-width: 1; stroke-dasharray: 4 3; }
  .floor { stroke: #78c8ff; }
  .wall { stroke: #bd9cff; }
  .sky { fill: none; stroke: #78c8ff; stroke-width: 1; stroke-dasharray: 4 3; }
  text { fill: #78c8ff; font: 10px ui-monospace, monospace; }
</style>
