<script lang="ts">
  // Mad March hares over the page: grass and daffodil shoots along the
  // ledges, and brown hares grazing, boxing and chasing ledge to ledge. The
  // layer takes no pointer events.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import type { Cursor } from '../pointer';
  import { easeTo } from '../rig/life';
  import Rig from '../rig/Rig.svelte';
  import { bladePath, brush, leanOf, reconcileMeadows, BUD_TOP, type Meadow } from './grass';
  import { gazeAt, hareRig } from './hare-rig';
  import { createHares, hareViews, reconcileHares, restingHares, stepHares, type HareView, type Hares } from './hares';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let meadows: ReadonlyMap<number, Meadow> = new Map();
  let group: Hares | null = null;
  let now = 0;
  let reduced = false;
  // How far each hare's head is turned toward the cursor, eased so it turns
  // smoothly rather than snapping.
  let gazes: ReadonlyMap<number, number> = new Map();
  const GAZE_EASE = 220;
  // Poses that look about; the others keep their heads to what they do.
  const LOOKING = new Set(['sit', 'alert']);

  $: views = group ? hareViews(group, scene) : [];
  $: shown = views.map((view) => ({ view, pose: hareRig({ pose: view.pose, walked: view.hare.walked, seed: view.hare.seed, leapt: view.leapt }, { now, gaze: gazes.get(view.hare.id) ?? 0, still: reduced }) }));

  function gazing(list: readonly HareView[], cursor: Cursor | null, dt: number): ReadonlyMap<number, number> {
    return new Map(list.map((v) => {
      const to = LOOKING.has(v.pose) ? gazeAt(v.dir, v, cursor) : 0;
      return [v.hare.id, easeTo(gazes.get(v.hare.id) ?? 0, to, dt, GAZE_EASE)];
    }));
  }

  // Reduced motion draws a still frame only after a measurement, so the
  // sitting hares are placed here with everything else.
  function placeHares(current: Hares | null, previous: PageMap, time: number): Hares {
    if (reduced) return restingHares(scene, current);
    if (!current) return createHares(scene, time, Math.random);
    return samePage(scene, previous) ? current : reconcileHares(current, scene, time, Math.random);
  }

  // Two greens for the grass, two blue-greens for the shoots, so the blades
  // of a tuft read as separate.
  const green = (shoot: boolean, tone: number) => (shoot ? (tone < 0.5 ? '#4f8a52' : '#62a065') : tone < 0.5 ? '#6fa83c' : '#8cc152');

  onMount(() => ledgeScene({
    // Leaving reduced motion brings fresh hares; entering it keeps these
    // ones' spots, which placeHares settles them into.
    motion(still) { reduced = still; if (!still) group = null; },
    measured(page, previous, time) {
      scene = page;
      floors = page.floors;
      meadows = reconcileMeadows(floors, page.obstacles, meadows);
      group = placeHares(group, previous, time);
    },
    frame(time, step) {
      now = time;
      if (!step) return;
      group = group && stepHares(group, scene, time, step.dt, Math.random, step.cursor);
      gazes = gazing(group ? hareViews(group, scene) : [], step.cursor, step.dt);
    },
    stroke(segment) { meadows = brush(meadows, floors, segment); },
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-hares>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...meadows] as [id, meadow] (id)}
      {@const f = floors.get(id)}
      {#if f && meadow.length}
        <g transform="translate({f.left} {f.y})">
          {#each meadow as p (p.key)}
            <g data-plant={p.kind} transform="translate({p.x} 0) rotate({reduced ? 0 : leanOf(p, f.left + p.x, now)})">
              {#each p.blades as b}<path d={bladePath(b)} fill={green(p.kind === 'shoot', b.tone)} />{/each}
              {#if p.bud}
                <path class="stalk" d="M0 0V{-BUD_TOP + 2}" />
                <ellipse class="bud" cx="0" cy={-BUD_TOP + 1.6} rx=".9" ry="1.6" />
              {/if}
            </g>
          {/each}
        </g>
      {/if}
    {/each}
  </svg>
  {#each shown as { view, pose } (view.hare.id)}
    <Rig {pose} x={view.x} y={view.y} dir={view.dir} opacity={view.opacity} data-hare={view.hare.mode} data-pose={view.pose} data-id={view.hare.id} />
  {/each}
</div>

<style>
  svg { position: absolute; inset: 0; }
  .stalk { stroke: #4f8a52; stroke-width: .8; fill: none; }
  .bud { fill: #d9cf5a; }
</style>
