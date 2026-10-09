<script lang="ts">
  // The northern lights over the page: frost along the ledges, tinted by the
  // aurora in the rail's sky, and Arctic foxes asleep on them. The layer
  // takes no pointer events.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import Rig from '../rig/Rig.svelte';
  import { STILL } from './aurora';
  import { foxView } from './fox';
  import { foxRig } from './fox-rig';
  import { createFoxes, reconcileFoxes, restingFoxes, stepFoxes, type Foxes } from './foxes';
  import { catchLight, frostColour, glintPath, reconcileRime, shine, type Rime } from './frost';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let rime: ReadonlyMap<number, Rime> = new Map();
  let group: Foxes | null = null;
  let now = 0;
  let reduced = false;

  $: shown = (group?.foxes ?? []).flatMap((fox) => {
    const view = foxView(fox, scene, now);
    return view ? [{ fox, view, pose: foxRig(fox, { now, still: reduced }) }] : [];
  });
  $: colour = frostColour(reduced ? STILL : now);

  // Reduced motion draws a still frame only after a measurement, so the
  // sleeping foxes are placed here with everything else.
  function placeFoxes(current: Foxes | null, previous: PageMap, time: number): Foxes {
    if (reduced) return restingFoxes(scene, current);
    if (!current) return createFoxes(scene, time, Math.random);
    return samePage(scene, previous) ? current : reconcileFoxes(current, scene, time, Math.random);
  }

  onMount(() => ledgeScene({
    // Leaving reduced motion wakes fresh foxes; entering it keeps these ones'
    // spots, which placeFoxes settles them into.
    motion(still) { reduced = still; if (!still) group = null; },
    measured(page, previous, time) {
      scene = page;
      floors = page.floors;
      rime = reconcileRime(floors, page.obstacles, rime);
      group = placeFoxes(group, previous, time);
    },
    frame(time, step) {
      now = time;
      if (!step) return;
      group = group && stepFoxes(group, scene, time, step.dt, Math.random, step.cursor);
    },
    stroke(segment) { rime = catchLight(rime, floors, segment); },
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-aurora>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...rime] as [id, r] (id)}
      {@const f = floors.get(id)}
      {#if f && r.d}
        <g transform="translate({f.left} {f.y})">
          <path class="rime" d={r.d} stroke={colour} />
          {#if !reduced}
            {#each r.glints as g (g.key)}
              <path class="glint" transform="translate({g.x} -2)" opacity={shine(g, now)} d={glintPath(g.size)} />
            {/each}
          {/if}
        </g>
      {/if}
    {/each}
  </svg>
  {#each shown as { fox, view, pose } (fox.id)}
    <Rig {pose} x={view.x} y={view.y} dir={view.dir} opacity={view.opacity} data-fox={fox.mode} data-pose={view.pose} data-id={fox.id} />
  {/each}
</div>

<style>
  svg { position: absolute; inset: 0; }
  .rime { fill: none; stroke-width: 1; stroke-linecap: round; opacity: .75; }
  .glint { fill: #fff; }
</style>
