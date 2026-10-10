<script lang="ts">
  // The fête's bunting over the page: pennants on a tape, festooned under
  // page headings' rules and strung across the gutters between cards side
  // by side, only where the gap between the ledges is free. It flutters in a
  // breeze and swings where a cursor brushes it. The wasps are the shelf's;
  // nothing else of June is on the page. The layer takes no pointer events.
  import { onMount } from 'svelte';
  import type { Ledge } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { gapDepth, measureGaps } from '../gaps';
  import { ledgeScene } from '../layout';
  import { brush, COLOURS, drawSwag, EDGES, hangAll, keepSwings, TAPE, type Swag, type Swing } from './bunting';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let swags: Swag[] = [];
  let swings: ReadonlyMap<string, Swing> = new Map();
  let now = 0;
  let reduced = false;
  let lastStroke = 0;

  $: drawn = swags.map((s) => drawSwag(s, swings.get(s.id), now, reduced));
  const line = (points: readonly { x: number; y: number }[]) => `M${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('L')}`;

  onMount(() => ledgeScene({
    motion(still) { reduced = still; if (still) swings = new Map(); },
    measured(page) {
      floors = page.floors;
      swags = hangAll(measureGaps(page).map((gap) => ({ gap, depth: (x0: number, x1: number) => gapDepth(gap, page.obstacles, x0 - gap.from.x, x1 - gap.from.x) })));
      swings = keepSwings(swags, swings);
    },
    frame(time) { now = time; },
    stroke(segment) {
      const speed = (Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y) * 1000) / Math.max(1, segment.at - lastStroke);
      lastStroke = segment.at;
      swings = brush(swags, swings, segment, speed);
    },
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-fete>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each drawn as d (d.id)}
      <g data-bunting={d.id}>
        <path class="tape" d={line(d.tape)} stroke={TAPE} />
        {#each d.pennants as p}
          <path data-pennant d="{line(p.points)}Z" fill={COLOURS[p.colour]} stroke={EDGES[p.colour]} />
        {/each}
      </g>
    {/each}
  </svg>
</div>

<style>
  svg { position: absolute; inset: 0; }
  .tape { fill: none; stroke-width: 1; stroke-linecap: round; }
  [data-pennant] { stroke-width: .6; stroke-linejoin: round; }
</style>
