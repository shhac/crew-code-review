<script lang="ts">
  // Valentine's over the page: rose petals along the ledges, and two or
  // three cupids hovering in the page's open air. A cupid shoots when the
  // cursor goes still, its arrow sticking in the ledge nearest the cursor
  // and popping into hearts, and dodges a cursor whipping past. The layer
  // takes no pointer events.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import Rig from '../rig/Rig.svelte';
  import { airOf, around, type Air } from './air';
  import ArrowArt from './ArrowArt.svelte';
  import { HEART_PATH, hearts, opacity, STUCK_LENGTH, wobble } from './arrows';
  import { footprintOf } from './cupid';
  import { cupidRig } from './cupid-rig';
  import { arrowAt, createCupids, dash, reconcileCupids, restingCupids, stepCupids, views, type Cupids } from './cupids';
  import { SPOT } from './footprints';
  import { EDGE, petalPath, scatterPetals, type Petal } from './petals';

  const debug = new URLSearchParams(location.search).get('theme-debug') === '1';
  let floors: ReadonlyMap<number, Ledge> = new Map();
  let page: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let air: Air | null = null;
  let petals: ReadonlyMap<number, Petal[]> = new Map();
  let group: Cupids | null = null;
  let now = 0;
  let reduced = false;
  let lastStroke = { at: -Infinity };

  $: shown = group ? views(group, page, now) : [];
  $: arrow = group?.flying ? arrowAt(page, group.flying, now) : null;

  function mainBox() {
    const r = document.querySelector('main')?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
  }

  // Reduced motion draws a still frame only after a measurement, so the
  // cupids are placed here with everything else.
  function place(current: Cupids | null, next: Air, previous: PageMap, time: number): Cupids {
    if (reduced) return restingCupids(next, current);
    if (!current) return createCupids(next, time, Math.random);
    return samePage(next.page, previous) ? current : reconcileCupids(current, next, time, Math.random);
  }

  onMount(() => ledgeScene({
    // Leaving reduced motion brings fresh cupids; entering it keeps these
    // ones' spots, which place settles them into.
    motion(still) { reduced = still; if (!still) group = null; },
    measured(measured, previous, time) {
      page = measured;
      floors = measured.floors;
      petals = scatterPetals(floors, measured.obstacles);
      air = airOf(measured, mainBox(), SPOT);
      group = place(group, air, previous, time);
    },
    frame(time, step) {
      now = time;
      if (!step || !air || !group) return;
      group = stepCupids(group, air, time, step.dt, Math.random, step.cursor);
    },
    stroke(segment) {
      const speed = (Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y) * 1000) / Math.max(1, segment.at - lastStroke.at);
      lastStroke = { at: segment.at };
      if (air && group) group = dash(group, air, segment.at, segment.from, segment.to, speed);
    },
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
    {#each group?.stuck ?? [] as a (a.key)}
      {@const f = floors.get(a.floor)}
      {#if f}
        <g data-arrow="stuck"><ArrowArt x={f.left + a.x} y={f.y} angle={90 + wobble(a, now)} length={STUCK_LENGTH} opacity={opacity(a, now)} /></g>
      {/if}
    {/each}
    {#each group?.bursts ?? [] as b (b.key)}
      {@const f = floors.get(b.floor)}
      {#if f}
        {#each hearts(b, now) as h, i (i)}
          <path class="heart" data-heart transform="translate({f.left + b.x + h.dx} {f.y + h.dy}) scale({h.scale})" d={HEART_PATH} fill={h.fill} opacity={h.opacity} />
        {/each}
      {/if}
    {/each}
    {#if arrow}
      <g data-arrow="flying"><ArrowArt x={arrow.x} y={arrow.y} angle={arrow.angle} length={12} head /></g>
    {/if}
    {#if debug && air}
      {#each air.spots as s}<circle class="spot" cx={s.x} cy={s.y} r="1.5" />{/each}
      {#each shown as { view } (view)}
        {@const b = around(view, footprintOf(view))}
        <rect class="footprint" x={b.left} y={b.top} width={b.right - b.left} height={b.bottom - b.top} />
      {/each}
    {/if}
  </svg>
  {#each shown as { c, view } (c.id)}
    <Rig
      pose={cupidRig({ pose: view.pose, seed: c.seed, beat: c.beat, progress: view.progress, aim: c.target?.aim ?? 0, speed: view.speed, accel: view.accel, gaze: c.gaze }, { now, still: reduced })}
      x={view.x} y={view.y} dir={view.dir} opacity={view.opacity} data-cupid={c.mode} data-pose={view.pose} data-id={c.id}
    />
  {/each}
</div>

<style>
  svg { position: absolute; inset: 0; }
  .petal { stroke-width: .5; stroke-linejoin: round; }
  .heart { stroke: #7a0f2e; stroke-width: .6; }
  .spot { fill: #ff8fb3; opacity: .5; }
  .footprint { fill: none; stroke: #ff8fb3; stroke-dasharray: 2 2; }
</style>
