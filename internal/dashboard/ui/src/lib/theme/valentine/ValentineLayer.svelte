<script lang="ts">
  // Valentine's over the page: rose petals along the ledges, and the arrows
  // the cupids shoot stuck in them, wobbling, then fading. The layer takes
  // no pointer events.
  import { onMount } from 'svelte';
  import type { Ledge } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import ArrowArt from './ArrowArt.svelte';
  import { HEART_PATH, hearts, opacity, STUCK_LENGTH, wobble, type Burst, type Stuck } from './arrows';
  import { EDGE, petalPath, scatterPetals, type Petal } from './petals';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let petals: ReadonlyMap<number, Petal[]> = new Map();
  let stuck: Stuck[] = [];
  let bursts: Burst[] = [];
  let now = 0;

  onMount(() => ledgeScene({
    motion() {},
    measured(page) {
      floors = page.floors;
      petals = scatterPetals(floors, page.obstacles);
    },
    frame(time) { now = time; },
    stroke() {},
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-valentine>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...petals] as [id, ps] (id)}
      {@const f = floors.get(id)}
      {#if f && ps.length}
        <g transform="translate({f.left} {f.y})">
          {#each ps as p (p.key)}
            <path class="petal" transform="translate({p.x} 0) rotate({p.angle} 0 -.6)" d={petalPath(p)} fill={p.fill} stroke={EDGE} />
          {/each}
        </g>
      {/if}
    {/each}
    {#each stuck as a (a.key)}
      {@const f = floors.get(a.floor)}
      {#if f}
        <ArrowArt x={f.left + a.x} y={f.y} angle={90 + wobble(a, now)} length={STUCK_LENGTH} opacity={opacity(a, now)} />
      {/if}
    {/each}
    {#each bursts as b (b.key)}
      {@const f = floors.get(b.floor)}
      {#if f}
        {#each hearts(b, now) as h, i (i)}
          <path class="heart" data-heart transform="translate({f.left + b.x + h.dx} {f.y + h.dy}) scale({h.scale})" d={HEART_PATH} fill={h.fill} opacity={h.opacity} />
        {/each}
      {/if}
    {/each}
  </svg>
</div>

<style>
  svg { position: absolute; inset: 0; }
  .petal { stroke-width: .5; stroke-linejoin: round; }
  .heart { stroke: #7a0f2e; stroke-width: .6; }
</style>
