<script lang="ts">
  // The seaside over the page: low drifts of sand along the ledges, with a
  // shell washed up here and there, and herring gulls strutting the ledges,
  // eyeing the cursor and swooping at one left still. The layer takes no
  // pointer events.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene, placeTroupe } from '../layout';
  import type { Cursor, Point } from '../pointer';
  import { easeGazes } from '../rig/gaze';
  import Rig from '../rig/Rig.svelte';
  import { reconcileBeaches, shellPaths, type Beach } from './drifts';
  import { middleOf, gullView, type Gull, type GullView } from './gull';
  import { gazeAt, gullRig } from './gull-rig';
  import { airspace, createGulls, reconcileGulls, restingGulls, stepGulls, type Gulls } from './gulls';
  import { routeOf, swept } from './swoop';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let beaches: ReadonlyMap<number, Beach> = new Map();
  let group: Gulls | null = null;
  let now = 0;
  let reduced = false;
  // How far each gull's head is turned toward what it eyes, eased so it
  // turns smoothly rather than snapping.
  let gazes: ReadonlyMap<number, number> = new Map();
  // Poses that look about; the others keep their heads to what they do.
  const LOOKING = new Set(['stand', 'eye']);
  // A glance about after a wander: down at the ledge ahead, or a little up.
  const glance = (side: number) => (side > 0 ? 10 : -4);
  const debug = new URLSearchParams(location.search).get('theme-debug') === '1';

  type Shown = { gull: Gull; view: GullView };
  $: views = (group?.gulls ?? []).flatMap((gull): Shown[] => {
    const view = gullView(gull, scene, now);
    return view ? [{ gull, view }] : [];
  });
  $: shown = views.map(({ gull, view }) => ({
    gull, view,
    pose: gullRig({ pose: view.pose, walked: view.walked, seed: gull.seed, beat: view.beat, t: view.t }, { now, still: reduced, gaze: gazes.get(gull.id) ?? 0 }),
    // Turning round, it is drawn narrowing from the old way to the new.
    squash: view.turn < 1 ? -Math.cos(Math.PI * view.turn) : 1,
  }));
  // With ?theme-debug=1: each flight's route and the boxes it was found
  // clear by.
  $: routes = debug && group ? group.gulls.flatMap((gull) => {
    const legs = gull.flight && routeOf(scene, gull.flight);
    return legs ? [{ id: gull.id, legs, boxes: swept(airspace(scene).room, legs).boxes }] : [];
  }) : [];

  // What a gull eyes: the gull in the air it watches, else the cursor.
  function eyed(s: Shown, cursor: Cursor | null): Point | null {
    const flier = s.gull.watch === null ? null : group?.gulls.find((g) => g.id === s.gull.watch);
    return flier ? middleOf(flier, scene, now) : cursor;
  }
  function gazing(list: readonly Shown[], cursor: Cursor | null, dt: number): ReadonlyMap<number, number> {
    return easeGazes(list, (s) => s.gull.id, (s) => {
      if (!LOOKING.has(s.view.pose)) return 0;
      if (s.view.glance) return glance(s.view.glance);
      return gazeAt(s.view.dir, s.view, eyed(s, cursor));
    }, gazes, dt);
  }

  // Leaving reduced motion brings fresh gulls; entering it stands these
  // ones where they are (or where a flier was landing).
  const troupe = placeTroupe({ create: createGulls, reconcile: reconcileGulls, resting: restingGulls });

  const curve = (c: { from: Point; c1: Point; c2: Point; to: Point }) => `M${c.from.x} ${c.from.y}C${c.c1.x} ${c.c1.y} ${c.c2.x} ${c.c2.y} ${c.to.x} ${c.to.y}`;

  onMount(() => ledgeScene({
    motion(still) { reduced = still; group = troupe.motion(group, still); },
    measured(page, previous, time) {
      scene = page;
      floors = page.floors;
      beaches = reconcileBeaches(floors, page.obstacles);
      group = troupe.place(group, page, samePage(page, previous), time, reduced);
    },
    frame(time, step) {
      now = time;
      if (!step) return;
      group = group && stepGulls(group, scene, time, step.dt, Math.random, step.cursor);
      gazes = gazing(views, step.cursor, step.dt);
    },
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
    {#each routes as r (r.id)}
      <g class="route" data-route={r.id}>
        {#each r.boxes as b}<rect x={b.left} y={b.top} width={b.right - b.left} height={b.bottom - b.top} />{/each}
        {#each r.legs as l}<path d={curve(l.curve)} />{/each}
      </g>
    {/each}
  </svg>
  {#each shown as { gull, view, pose, squash } (gull.id)}
    <Rig {pose} x={view.x} y={view.y} dir={view.dir} {squash} opacity={view.opacity} data-gull={gull.mode} data-pose={view.pose} data-id={gull.id} />
  {/each}
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
  .route rect { fill: rgba(80, 180, 255, .06); stroke: rgba(80, 180, 255, .5); stroke-width: .5; }
  .route path { fill: none; stroke: #ff3d7f; stroke-width: 1.2; }
</style>
