<script lang="ts">
  // A bluebell wood over the page: a rim of moss along the ledges, with
  // clumps of bluebells and cushions of moss growing out of it where there
  // is room. Still under reduced motion as at any other time. The layer
  // takes no pointer events.
  import { onMount } from 'svelte';
  import type { Ledge } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import { CLUMPS, CUSHIONS } from './art';
  import clump0 from './clump-0.webp';
  import clump1 from './clump-1.webp';
  import clump2 from './clump-2.webp';
  import cushion0 from './cushion-0.webp';
  import cushion1 from './cushion-1.webp';
  import { growMoss, MOSS_LINE, type Moss } from './moss';

  const CLUMP_ART = [clump0, clump1, clump2];
  const CUSHION_ART = [cushion0, cushion1];

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let wood: ReadonlyMap<number, Moss> = new Map();

  onMount(() => ledgeScene({
    motion() {},
    measured(page) {
      floors = page.floors;
      wood = growMoss(floors, page.obstacles);
    },
    frame() {},
    stroke() {},
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-bluebells>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...wood] as [id, m] (id)}
      {@const f = floors.get(id)}
      {#if f}
        <g transform="translate({f.left} {f.y})">
          {#if m.d}
            <g data-moss>
              <path class="moss" d={m.d} stroke-width={MOSS_LINE} />
              <path class="tops" d={m.tops} />
            </g>
          {/if}
          {#each m.cushions as c (c.key)}
            {@const art = CUSHIONS[c.art]}
            <g data-cushion transform="translate({c.x} 0) scale({c.flip ? -1 : 1} 1)">
              <image href={CUSHION_ART[c.art]} x={-art.width / 2} y={-art.height} width={art.width} height={art.height} />
            </g>
          {/each}
          {#each m.clumps as c (c.key)}
            {@const art = CLUMPS[c.art]}
            <g data-clump={c.key} transform="translate({c.x} 0) scale({c.flip ? -1 : 1} 1)">
              <image href={CLUMP_ART[c.art]} x={-art.width / 2} y={-art.height} width={art.width} height={art.height} />
            </g>
          {/each}
        </g>
      {/if}
    {/each}
  </svg>
</div>

<style>
  svg { position: absolute; inset: 0; }
  .moss { fill: #62a012; stroke: #2c4f0e; stroke-linejoin: round; }
  .tops { fill: #8cc626; }
</style>
