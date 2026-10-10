<script lang="ts">
  // The harvest over the page: straw and wheat grains along the ledges. The
  // layer takes no pointer events.
  import { onMount } from 'svelte';
  import type { Ledge } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import { GRAIN_PATH, grainOpacity, reconcileChaff, regrow, type Chaff } from './chaff';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let chaff: ReadonlyMap<number, Chaff> = new Map();
  let now = 0;
  let reduced = false;

  onMount(() => ledgeScene({
    motion(still) { reduced = still; },
    measured(page) {
      floors = page.floors;
      chaff = reconcileChaff(floors, page.obstacles, chaff);
    },
    frame(time, step) {
      now = time;
      if (!step) return;
      chaff = regrow(chaff, floors, [], time);
    },
    stroke() {},
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-harvest>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...chaff] as [id, c] (id)}
      {@const f = floors.get(id)}
      {#if f && c.stalks.length + c.grains.length}
        <g transform="translate({f.left} {f.y})" data-chaff>
          <path class="straw light" d={c.straw[0]} />
          <path class="straw dark" d={c.straw[1]} />
          <path class="node" d={c.nodes} />
          {#each c.grains as g (g.key)}
            {@const opacity = grainOpacity(g, now, reduced)}
            {#if opacity > 0}
              <g class="grain" transform="translate({g.x} {-0.55}) rotate({g.tilt})" {opacity} data-grain>
                <path class="husk" d={GRAIN_PATH.body} />
                <path class="crease" d={GRAIN_PATH.crease} />
              </g>
            {/if}
          {/each}
        </g>
      {/if}
    {/each}
  </svg>
</div>

<style>
  svg { position: absolute; inset: 0; }
  .straw.light { fill: #e9c973; }
  .straw.dark { fill: #cfa448; }
  .node { fill: #9c7330; }
  .husk { fill: #e2a640; }
  .crease { fill: none; stroke: #8a5a1c; stroke-width: .35; stroke-linecap: round; }
</style>
