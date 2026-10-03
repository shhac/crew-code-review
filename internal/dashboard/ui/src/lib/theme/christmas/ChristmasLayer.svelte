<script lang="ts">
  import { onMount } from 'svelte';
  import { measureFloors, type Ledge } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { observeLayout } from '../layout';
  import { choosePerch, ROBIN, snowPath, snowProfile, type Perch } from './snow';
  import robin from './robin-perch.svg';

  const debug = new URLSearchParams(location.search).get('theme-debug') === '1';
  let floors: ReadonlyMap<number, Ledge> = new Map();
  let perch: Perch | null = null;
  onMount(() => {
    let frame = 0;
    let active = true;
    const measure = () => {
      frame = 0;
      if (!active) return;
      floors = measureFloors();
      perch = choosePerch(floors, innerWidth, innerHeight, perch);
    };
    const changed = () => { if (!frame && active) frame = requestAnimationFrame(measure); };
    const stopObserving = observeLayout(changed);
    // Catches CSS-only changes as Halloween does, without a motion loop.
    const timer = window.setInterval(changed, 1000);
    measure();
    return () => { active = false; stopObserving(); clearInterval(timer); cancelAnimationFrame(frame); };
  });
</script>

<div class="seasonal-overlay" aria-hidden="true" data-christmas>
  {#if debug}<Geometry {floors} />{/if}
  <svg width="100%" height="100%">
    {#each [...floors] as [id, f] (id)}
      {@const samples = snowProfile(id, f, perch?.floor === id ? perch.x : undefined)}
      <g transform="translate({f.left} {f.y})">
        <path data-snow={id} d={snowPath(samples)} />
        <path class="shadow" d={snowPath(samples.map((s) => ({ ...s, depth: Math.min(.65, s.depth) })))} />
      </g>
    {/each}
  </svg>
  {#if perch && floors.has(perch.floor)}
    {@const f = floors.get(perch.floor)!}
    <img class="robin" src={robin} alt="" width={ROBIN.width} height={ROBIN.height}
      style="left: {f.left + perch.x - ROBIN.anchorX}px; top: {f.y - ROBIN.anchorY}px; transform: scaleX({perch.dir}); transform-origin: {ROBIN.anchorX}px {ROBIN.anchorY}px" />
  {/if}
</div>

<style>
  svg { position: absolute; inset: 0; }
  path { fill: #eaf0ec; }
  .shadow { fill: #b9cbd0; }
  .robin { position: absolute; max-width: none; }
</style>
