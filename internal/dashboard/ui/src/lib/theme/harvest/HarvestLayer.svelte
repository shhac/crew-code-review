<script lang="ts">
  // The harvest over the page: straw and wheat grains along the ledges, and
  // a family of carrion crows feeding on them, which the scarecrow on the
  // rail's shelf scatters off the page by the top or the right edge, and
  // which drift back after a while. The layer takes no pointer events.
  import { onDestroy, onMount } from 'svelte';
  import { cueOf } from '../cue';
  import { pageAt } from '../ledges';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene, placeTroupe } from '../layout';
  import Rig from '../rig/Rig.svelte';
  import { easeGazes } from '../rig/gaze';
  import { alarm, type Alarm } from './alarm';
  import { GRAIN_PATH, grainOpacity, peck, reconcileChaff, regrow, type Chaff } from './chaff';
  import { grounded, type Crow } from './crow';
  import { crowGaze, crowRig } from './crow-rig';
  import { createCrows, feedingSpots, pointOf, reconcileCrows, restingCrows, stepCrows, type Crows, type Field } from './crows';
  import { fieldOf } from './field';
  import { leave, pointAlong, type Flight } from './flight';
  import { crowView, depthFor, type Memory } from './view';

  const debug = new URLSearchParams(location.search).get('theme-debug') === '1';
  // `?theme-cue=scatter` (tests only): the crows are scattered once they
  // have been placed a moment, as if the scarecrow had flapped, and its
  // flapping is taken to have ended 8s before, so they start back within
  // 7 to 17s rather than half a minute, all of them gone by then.
  const CUE = cueOf(['scatter'] as const);
  const CUE_AFTER = 1200;
  const CUE_EARLY = 8000;
  // How fast a crow's strokes deepen or shallow: over 0.25s (the note).
  const DEPTH_EASE = 250;

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let page: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let chaff: ReadonlyMap<number, Chaff> = new Map();
  let field: Field | null = null;
  let group: Crows | null = null;
  let memory: ReadonlyMap<number, Memory> = new Map();
  let gazes: ReadonlyMap<number, number> = new Map();
  let heard: Alarm | null = null;
  let cued: Alarm | null = null;
  let placedAt = -Infinity;
  let now = 0;
  let reduced = false;

  const stopAlarm = alarm.subscribe((a) => { heard = a; });
  onDestroy(stopAlarm);
  // The latest alarm: the scarecrow's, or the cue's.
  const latest = () => (cued && (!heard || cued.at > heard.at) ? cued : heard);

  $: shown = (group?.crows ?? []).flatMap((c) => {
    const view = crowView(c, page, now, memory.get(c.id) ?? { walked: 0, depth: 1 });
    return view ? [{ c, view }] : [];
  });
  // Each feeding spot, and whether it has a way off the page (hollow if not).
  $: spots = debug && field ? feedingSpots(field, []).filter((_, i) => i % 3 === 0).map((s) => ({ ...s, out: escapesFrom(field, s) })) : [];
  const escapesFrom = (f: Field | null, s: { floor: number; x: number }) => {
    const ledge = f?.page.floors.get(s.floor);
    return !!f && !!ledge && !!leave(pageAt(ledge, s.x), f.page.width, f.clear, 0, 200);
  };

  // Eight points along a route, for the debug overlay's envelope boxes.
  const eightOf = (f: Flight) => Array.from({ length: 8 }, (_, i) => pointAlong(f.curves, i / 7).p);

  // Leaving reduced motion brings a fresh family; entering it keeps these
  // where they stand.
  const troupe = placeTroupe<Crows, Field>({ create: createCrows, reconcile: reconcileCrows, resting: restingCrows });

  // How far each has walked (its stride follows it) and how deep its strokes
  // are, eased toward what its route asks for.
  function remember(before: readonly Crow[], after: readonly Crow[], dt: number, time: number) {
    memory = new Map(after.map((c) => {
      const was = memory.get(c.id) ?? { walked: 0, depth: 1 };
      const prior = before.find((b) => b.id === c.id);
      const stepped = prior && grounded(prior) && grounded(c) && prior.floor === c.floor ? Math.abs(c.x - prior.x) : 0;
      const target = depthFor(c, time) ?? was.depth;
      const depth = was.depth + Math.sign(target - was.depth) * Math.min(Math.abs(target - was.depth), dt / DEPTH_EASE);
      return [c.id, { walked: was.walked + stepped, depth }];
    }));
  }

  // Each head turns toward a cursor near enough, eased; flying, it looks
  // ahead.
  function look(crows: readonly Crow[], cursor: { x: number; y: number } | null, dt: number) {
    const toward = (c: Crow) => {
      if (!grounded(c)) return 0;
      const at = pointOf(c, page, now);
      return at ? crowGaze(c.dir, at, cursor) : 0;
    };
    gazes = easeGazes(crows, (c) => c.id, toward, gazes, dt);
  }

  onMount(() => ledgeScene({
    motion(still) { reduced = still; group = troupe.motion(group, still); },
    measured(measured, previous, time) {
      page = measured;
      floors = measured.floors;
      chaff = reconcileChaff(floors, measured.obstacles, chaff);
      field = fieldOf(measured, chaff);
      const fresh = !group;
      group = troupe.place(group, field, samePage(measured, previous), time, reduced);
      if (fresh) placedAt = time;
    },
    frame(time, step) {
      now = time;
      if (!step || !field || !group) return;
      if (CUE === 'scatter' && !cued && time - placedAt >= CUE_AFTER) {
        cued = { at: time, until: time - CUE_EARLY, x: 80, y: page.height - 80 };
      }
      const before = group.crows;
      const stepped = stepCrows(group, { ...field, chaff }, time, step.dt, Math.random, step.cursor, latest());
      group = stepped.group;
      chaff = stepped.bites.reduce<ReadonlyMap<number, Chaff>>((c, b) => peck(c, b.floor, b.x, time), chaff);
      chaff = regrow(chaff, floors, group.crows.flatMap((c) => pointOf(c, page, time) ?? []), time);
      remember(before, group.crows, step.dt, time);
      look(group.crows, step.cursor, step.dt);
    },
    stroke() {},
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-harvest>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...chaff] as [id, c] (id)}
      {@const f = floors.get(id)}
      {#if f && c.stalks.length + c.grains.length}
        <g transform="translate({f.left} {f.y})" data-chaff>
          <path class="straw light" d={c.straw[0]} />
          <path class="straw dark" d={c.straw[1]} />
          <path class="node" d={c.nodes} />
          {#each c.grains as g (g.key)}
            {@const opacity = grainOpacity(g, now, reduced)}
            {#if opacity > 0}
              <g class="grain" transform="translate({g.x} {-0.55}) rotate({g.tilt})" {opacity} data-grain>
                <path class="husk" d={GRAIN_PATH.body} />
                <path class="crease" d={GRAIN_PATH.crease} />
              </g>
            {/if}
          {/each}
        </g>
      {/if}
    {/each}
    {#if debug}
      {#each spots as s}
        {@const f = floors.get(s.floor)}
        {#if f}{@const p = pageAt(f, s.x)}<path class="spot" class:hollow={!s.out} d="M{p.x - 3} {p.y - 3}L{p.x} {p.y}L{p.x + 5} {p.y - 6}" data-spot={s.out ? 'out' : 'shut'} />{/if}
      {/each}
      {#each shown as { c } (c.id)}
        {#if c.flight}
          {#each c.flight.curves as curve}
            <path class="route" d="M{curve.from.x} {curve.from.y}C{curve.c1.x} {curve.c1.y} {curve.c2.x} {curve.c2.y} {curve.to.x} {curve.to.y}" data-route />
          {/each}
          {#each eightOf(c.flight) as p}
            {@const b = field?.envelope(p)}
            {#if b}<rect class="envelope" x={b.left} y={b.top} width={b.right - b.left} height={b.bottom - b.top} />{/if}
          {/each}
        {/if}
      {/each}
    {/if}
  </svg>
  {#each shown as { c, view } (c.id)}
    <Rig
      pose={crowRig(view.rig, { now, still: reduced, gaze: gazes.get(c.id) ?? 0 })}
      x={view.at.x} y={view.at.y} dir={view.dir} data-crow={c.mode} data-pose={view.rig.pose} data-id={c.id}
    />
  {/each}
</div>

<style>
  svg { position: absolute; inset: 0; }
  .straw.light { fill: #e9c973; }
  .straw.dark { fill: #cfa448; }
  .node { fill: #9c7330; }
  .husk { fill: #e2a640; }
  .crease { fill: none; stroke: #8a5a1c; stroke-width: .35; stroke-linecap: round; }
  .spot { fill: none; stroke: #c39be0; stroke-width: 1.5; }
  .spot.hollow { stroke: #ff6b6b; stroke-dasharray: 1 1; }
  .route { fill: none; stroke: #c39be0; stroke-dasharray: 4 3; }
  .envelope { fill: none; stroke: #c39be0; stroke-width: .6; opacity: .6; }
</style>
