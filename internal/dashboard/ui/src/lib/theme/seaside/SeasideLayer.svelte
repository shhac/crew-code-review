<script lang="ts">
  // The seaside over the page: low drifts of sand along the ledges, with a
  // shell washed up here and there. Nothing in it moves. The layer takes no
  // pointer events.
  import { onMount } from 'svelte';
  import type { Ledge } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import { reconcileBeaches, shellPaths, type Beach } from './drifts';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let beaches: ReadonlyMap<number, Beach> = new Map();

  onMount(() => ledgeScene({
    motion() {},
    measured(page) {
      floors = page.floors;
      beaches = reconcileBeaches(floors, page.obstacles);
    },
    frame() {},
    stroke() {},
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-seaside>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...beaches] as [id, b] (id)}
      {@const f = floors.get(id)}
      {#if f && b.sand}
        <g transform="translate({f.left} {f.y})">
          <path class="sand" d={b.sand} />
          <path class="crest" d={b.crest} />
          <path class="grains" d={b.grains} />
          {#each b.shells as s (s.key)}
            {@const shell = shellPaths(s.kind, s.size)}
            <g data-shell={s.kind} transform="translate({s.x} 0) scale({s.dir} 1)">
              <path class="shell {s.kind}" d={shell.body} />
              <path class="ribs {s.kind}" d={shell.lines} />
            </g>
          {/each}
        </g>
      {/if}
    {/each}
  </svg>
</div>

<style>
  svg { position: absolute; inset: 0; }
  .sand { fill: #d8bf8a; }
  .crest { fill: none; stroke: #ecd9a8; stroke-width: .8; stroke-linecap: round; }
  .grains { fill: #b49a66; }
  .shell { stroke-width: .6; stroke-linejoin: round; }
  .ribs { fill: none; stroke-width: .5; stroke-linecap: round; }
  .shell.cockle { fill: #f2e2cc; stroke: #9a7656; }
  .ribs.cockle { stroke: #b8936c; }
  .shell.winkle { fill: #6f5e52; stroke: #3f332b; }
  .ribs.winkle { stroke: #a8968a; }
</style>
