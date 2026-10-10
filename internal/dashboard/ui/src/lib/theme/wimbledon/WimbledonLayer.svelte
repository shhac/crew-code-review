<script lang="ts">
  // Summer tennis over the page: chalk court lines along the ledges. The
  // layer takes no pointer events.
  import { onMount } from 'svelte';
  import type { Ledge } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import { chalkLines, LINE, linesPath, wornOf, wornPath, type Lines } from './lines';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let lines: ReadonlyMap<number, Lines> = new Map();

  onMount(() => ledgeScene({
    motion() {},
    measured(page) {
      floors = page.floors;
      lines = chalkLines(floors, page.obstacles);
    },
    frame() {},
    stroke() {},
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-wimbledon>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...lines] as [id, chalk] (id)}
      {@const f = floors.get(id)}
      {#if f && chalk.length}
        <g class="court-lines" data-lines={id} transform="translate({f.left} {f.y})">
          <path class="chalk" d={linesPath(chalk)} stroke-width={LINE} />
          {#each wornOf(chalk) as s (s.key)}
            <path class="chalk worn" d={wornPath(s)} stroke-width={LINE} style="opacity: {0.15 + 0.2 * s.tone}" />
          {/each}
        </g>
      {/if}
    {/each}
  </svg>
</div>

<style>
  svg { position: absolute; inset: 0; }
  .chalk { fill: none; stroke: #f4f4ec; opacity: .7; }
</style>
