<script lang="ts">
  // The northern lights over the page: frost along the ledges, tinted by the
  // aurora in the rail's sky, and an Arctic fox asleep on one of them. The
  // layer takes no pointer events.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import { STILL } from './aurora';
  import { createFox, foxView, POSES, reconcileFox, restingFox, stepFox, trotting, type Fox, type Pose } from './fox';
  import foxAlert from './fox-alert.webp';
  import foxBow from './fox-bow.webp';
  import foxCurled from './fox-curled.webp';
  import foxPounce from './fox-pounce.webp';
  import foxTrot from './fox-trot.webp';
  import { catchLight, frostColour, glintPath, reconcileRime, shine, type Rime } from './frost';

  const ART: Record<Pose, string> = { curled: foxCurled, alert: foxAlert, trot: foxTrot, bow: foxBow, pounce: foxPounce };
  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let rime: ReadonlyMap<number, Rime> = new Map();
  let fox: Fox | null = null;
  let now = 0;
  let reduced = false;
  // Distance trotted, for the bob of its stride.
  let trotted = 0;

  $: view = fox && foxView(fox, scene, now);
  $: art = view && { src: ART[view.pose], ...POSES[view.pose] };
  $: bob = fox && trotting(fox.mode) ? -Math.abs(Math.sin(trotted / 4)) * 1.5 : 0;
  $: colour = frostColour(reduced ? STILL : now);

  // Reduced motion draws a still frame only after a measurement, so the
  // sleeping fox is placed here with everything else.
  function placeFox(current: Fox | null, previous: PageMap, time: number): Fox | null {
    if (reduced) return restingFox(scene, current);
    if (!current) return createFox(scene, time, Math.random);
    return samePage(scene, previous) ? current : reconcileFox(current, scene, time, Math.random);
  }

  onMount(() => ledgeScene({
    // Leaving reduced motion wakes a fresh fox; entering it keeps this one's
    // spot, which placeFox settles it into.
    motion(still) { reduced = still; if (!still) fox = null; },
    measured(page, previous, time) {
      scene = page;
      floors = page.floors;
      rime = reconcileRime(floors, page.obstacles, rime);
      fox = placeFox(fox, previous, time);
    },
    frame(time, step) {
      now = time;
      if (!step) return;
      const before = fox?.x ?? 0;
      fox = fox && stepFox(fox, scene, time, step.dt, Math.random, step.cursor);
      trotted += Math.abs((fox?.x ?? 0) - before);
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
  {#if view && art && fox}
    <img
      class="fox"
      data-fox={fox.mode}
      data-pose={view.pose}
      src={art.src}
      alt=""
      width={art.width}
      height={art.height}
      style="left: {view.x - art.width / 2}px; top: {view.y - art.height + bob}px; opacity: {view.opacity}; transform: scaleX({view.dir})"
    />
  {/if}
</div>

<style>
  svg { position: absolute; inset: 0; }
  img { position: absolute; display: block; max-width: none; }
  .rime { fill: none; stroke-width: 1; stroke-linecap: round; opacity: .75; }
  .glint { fill: #fff; }
  .fox { transform-origin: 50% 100%; }
</style>
