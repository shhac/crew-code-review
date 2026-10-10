<script lang="ts">
  import { onMount } from 'svelte';
  import type { Ledge } from './floors';
  import { measureRailAir, measureRailSky, watchRailSky, type Sky } from './sky';
  export let floors: ReadonlyMap<number, Ledge>;

  // Drawn only on request (?theme-debug=1), whichever theme is showing.
  const shown = new URLSearchParams(location.search).get('theme-debug') === '1';

  // The rail is remeasured with the ledges, and whenever it changes on its
  // own: the shelf's art settling resizes nothing the ledges watch.
  const shelf = () => document.querySelector<HTMLElement>('.theme-shelf');
  let sky: Sky | null = null;
  let railAir: Sky | null = null;
  const measureRail = () => { sky = measureRailSky(shelf()); railAir = measureRailAir(shelf()); };
  $: if (shown && floors) measureRail();
  onMount(() => {
    const el = shown ? shelf() : null;
    return el ? watchRailSky(el, measureRail) : undefined;
  });
</script>

{#if shown}
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
  {#if railAir}
    <g data-rail-air>
      <rect class="rail-air" x={railAir.left} y={railAir.top} width={railAir.width} height={railAir.height} />
      <text class="end" x={railAir.left + railAir.width - 4} y={railAir.top + 12}>rail air {Math.round(railAir.width)}x{Math.round(railAir.height)}</text>
    </g>
  {/if}
</svg>
{/if}

<style>
  .geometry { position: absolute; inset: 0; }
  line { stroke-width: 1; stroke-dasharray: 4 3; }
  .floor { stroke: #78c8ff; }
  .wall { stroke: #bd9cff; }
  .sky { fill: none; stroke: #78c8ff; stroke-width: 1; stroke-dasharray: 4 3; }
  .rail-air { fill: none; stroke: #9be29b; stroke-width: 1; stroke-dasharray: 2 4; }
  text { fill: #78c8ff; font: 10px ui-monospace, monospace; }
  .end { text-anchor: end; }
</style>
