<script lang="ts">
  // A bluebell wood over the page: a rim of moss along the ledges, with
  // clumps of bluebells and cushions of moss growing out of it where there
  // is room, and two or three buff-tailed bumblebees going from flower to
  // flower. A bell under a perched bee dips a little. The wood is still
  // under reduced motion as at any other time, and the bees perch still.
  // The layer takes no pointer events.
  import { onMount } from 'svelte';
  import { cueOf, debugOn } from '../cue';
  import { samePage, type Box, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene, placeTroupe } from '../layout';
  import type { Cursor } from '../pointer';
  import { easeGazes, gazeFrom } from '../rig/gaze';
  import Rig from '../rig/Rig.svelte';
  import { measureRailAir, measureRailSky, watchRailSky } from '../sky';
  import { CLUMPS, CUSHIONS } from './art';
  import type { BeeView } from './bee';
  import { ANCHOR, beeRig, EYE, SCALE } from './bee-rig';
  import { beeAirOf, railRoom } from './beeair';
  import { beeViews, boxesOf, createBees, meadowOf, reconcileBees, restingBees, stepBees, type Bees, type Meadow } from './bees';
  import { bonksOf } from './bonks';
  import clump0 from './clump-0.webp';
  import clump1 from './clump-1.webp';
  import clump2 from './clump-2.webp';
  import cushion0 from './cushion-0.webp';
  import cushion1 from './cushion-1.webp';
  import { flowersOf } from './flowers';
  import { growMoss, MOSS_LINE, type Moss } from './moss';

  const CLUMP_ART = [clump0, clump1, clump2];
  const CUSHION_ART = [cushion0, cushion1];
  const debug = debugOn();
  // Perched or hovering, a bee's antennae lean toward a cursor within 120px.
  const gaze = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: 15, reach: 120 });
  const LOOKING = new Set(['perch', 'shiver', 'hover', 'approach']);
  // A test's cue: a bonk at the first bee's next choice, or the shelf first.
  const CUE = cueOf(['bonk', 'shelf'] as const);

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let page: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let wood: ReadonlyMap<number, Moss> = new Map();
  let meadow: Meadow | null = null;
  let group: Bees | null = null;
  let now = 0;
  let reduced = false;
  let gazes: ReadonlyMap<number, number> = new Map();
  let rail: { room: Box | null; shelf: Box | null } = { room: null, shelf: null };
  // The rail does not scroll and the page's measuring does not see it, so
  // it is watched on its own; when it may have moved, its air is looked at
  // again at the next frame, and the bees told if it did.
  let railStale = false;
  let stopRail: (() => void) | null = null;

  $: shown = group ? beeViews(group, page, now) : [];
  $: dipped = new Set(shown.flatMap(({ view }) => (view.on ? [view.on.flower] : [])));
  $: boxes = debug && group ? boxesOf(group, page, now) : [];

  function gazing(list: readonly { b: { id: number }; view: BeeView }[], cursor: Cursor | null, dt: number): ReadonlyMap<number, number> {
    return easeGazes(list, (v) => v.b.id, (v) => (LOOKING.has(v.view.mode) ? gaze(v.view.dir, v.view, cursor) : 0), gazes, dt);
  }

  const rectBox = (r: DOMRect): Box => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  const shelfEl = () => document.querySelector<HTMLElement>('.bluebells-shelf');
  // The shelf may mount after the layer, or not at all (the lab's scene),
  // so it is looked for at each frame until found.
  function watchRail() {
    const el = stopRail ? null : shelfEl();
    if (el) stopRail = watchRailSky(el, () => { railStale = true; });
  }
  // The rail's air the bees may use, and the shelf's flowers in it: none
  // with the shelf hidden or its sky too short.
  function railNow(measured: PageMap): typeof rail {
    const el = shelfEl();
    const room = railRoom(measureRailSky(el), measureRailAir(el), measured);
    const art = el?.querySelector('[data-bluebell-shelf]');
    return { room, shelf: room && art ? rectBox(art.getBoundingClientRect()) : null };
  }
  const sameRail = (a: typeof rail, b: typeof rail) => JSON.stringify(a) === JSON.stringify(b);
  const meadowFor = (measured: PageMap) => meadowOf(beeAirOf(measured, rail.room), flowersOf(wood, rail.shelf), bonksOf(measured), CUE);

  // Leaving reduced motion brings fresh bees; entering it perches these
  // ones where they are.
  const troupe = placeTroupe({ create: createBees, reconcile: reconcileBees, resting: restingBees });

  onMount(() => {
    const stopScene = ledgeScene({
      motion(still) { reduced = still; group = troupe.motion(group, still); },
      measured(measured, previous, time) {
        page = measured;
        floors = measured.floors;
        wood = growMoss(floors, measured.obstacles);
        const railed = railNow(measured);
        const same = samePage(measured, previous) && sameRail(railed, rail);
        rail = railed;
        railStale = false;
        meadow = meadowFor(measured);
        group = troupe.place(group, meadow, same, time, reduced);
      },
      frame(time, step) {
        now = time;
        watchRail();
        if (railStale) {
          railStale = false;
          const railed = railNow(page);
          if (!sameRail(railed, rail)) {
            rail = railed;
            meadow = meadowFor(page);
            group = troupe.place(group, meadow, false, time, reduced);
          }
        }
        if (!step || !meadow || !group) return;
        group = stepBees(group, meadow, time, step.dt, Math.random, step.cursor);
        gazes = gazing(beeViews(group, page, time), step.cursor, step.dt);
      },
      stroke() {},
    });
    return () => { stopScene(); stopRail?.(); };
  });
</script>

<div class="seasonal-overlay" aria-hidden="true" data-bluebells>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...wood] as [id, m] (id)}
      {@const f = floors.get(id)}
      {#if f}
        <g transform="translate({f.left} {f.y})">
          {#if m.d}
            <g data-moss>
              <path class="moss" d={m.d} stroke-width={MOSS_LINE} />
              <path class="tops" d={m.tops} />
            </g>
          {/if}
          {#each m.cushions as c (c.key)}
            {@const art = CUSHIONS[c.art]}
            <g data-cushion transform="translate({c.x} 0) scale({c.flip ? -1 : 1} 1)">
              <image href={CUSHION_ART[c.art]} x={-art.width / 2} y={-art.height} width={art.width} height={art.height} />
            </g>
          {/each}
          {#each m.clumps as c (c.key)}
            {@const art = CLUMPS[c.art]}
            <g data-clump={c.key} transform="translate({c.x} 0) scale({c.flip ? -1 : 1} 1)">
              <g class="clump" class:dipped={!reduced && dipped.has(`${id}:${c.key}`)} style="--dip: {1 - 1 / art.height}">
                <image href={CLUMP_ART[c.art]} x={-art.width / 2} y={-art.height} width={art.width} height={art.height} />
              </g>
            </g>
          {/each}
        </g>
      {/if}
    {/each}
    {#if debug}
      {#each boxes as b}
        <rect class="footprint" x={b.left} y={b.top} width={b.right - b.left} height={b.bottom - b.top} />
      {/each}
      {#each shown as { b, view } (b.id)}
        <text class="mode" x={view.x + 14} y={view.y - 14}>{b.id} {view.mode}</text>
      {/each}
    {/if}
  </svg>
  {#each shown as { b, view } (b.id)}
    <Rig
      pose={beeRig({ pose: view.pose, seed: b.seed, walked: view.walked, speed: view.speed, lean: gazes.get(b.id) ?? 0, wings: view.wings, knocked: view.knocked }, { now, still: reduced })}
      x={view.x} y={view.y} dir={view.dir} opacity={view.opacity} data-bee={view.mode} data-pose={view.pose} data-id={b.id}
    />
  {/each}
</div>

<style>
  svg { position: absolute; inset: 0; }
  .moss { fill: #62a012; stroke: #2c4f0e; stroke-linejoin: round; }
  .tops { fill: #8cc626; }
  /* A bell under a perched bee dips a pixel: the clump squashed from its
     foot, eased. */
  .clump { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .35s ease-out; }
  .clump.dipped { transform: scaleY(var(--dip)); }
  .footprint { fill: none; stroke: #f4c25b; stroke-dasharray: 2 2; }
  .mode { fill: #f4c25b; font: 10px ui-monospace, monospace; }
</style>
