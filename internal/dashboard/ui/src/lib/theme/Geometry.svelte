<script lang="ts">
  import { onMount } from 'svelte';
  import { boundsOf, EXITS, type Lane } from './air';
  import { measurePage, wallRuns, walls, type Ledge, type PageMap, type Run } from './floors';
  import { courts, endId, gapRuns, measureGaps, type Gap } from './gaps';
  import { measureRailAir, measureRailSky, watchRailSky, type Sky } from './sky';
  export let floors: ReadonlyMap<number, Ledge>;
  // A month's lanes, which depend on its fliers' footprints.
  export let lanes: readonly Lane[] = [];

  // Drawn only on request (?theme-debug=1), whichever theme is showing.
  const shown = new URLSearchParams(location.search).get('theme-debug') === '1';

  // The rail is remeasured with the ledges, and whenever it changes on its
  // own: the shelf's art settling resizes nothing the ledges watch.
  const shelf = () => document.querySelector<HTMLElement>('.theme-shelf');
  let sky: Sky | null = null;
  let railAir: Sky | null = null;
  const measureRail = () => { sky = measureRailSky(shelf()); railAir = measureRailAir(shelf()); };
  $: if (shown && floors) measureRail();
  // The page measured again alongside the layer's ledges (the ids are the
  // same, kept per element), for what is drawn from obstacles too.
  let page: PageMap | null = null;
  $: page = shown && floors ? measurePage() : null;
  // Walls are shaded where a bee's bonk (34px out from the side) is clear.
  const BONK = 34;
  const sidesOf = (p: PageMap) => walls(p).map((w) => ({ w, runs: wallRuns(w, p, BONK) }));
  $: sides = page ? sidesOf(page) : [];
  // A side gap's column is drawn this far down at most; an under gap's band
  // is hatched where bunting this deep (14px) would not hang clear.
  const COLUMN = 40;
  const HANG = 14;
  const blocked = (g: Gap, runs: readonly Run[]): Run[] => {
    const edges = [0, ...runs.flatMap((r) => [r.lo, r.hi]), g.to.x - g.from.x];
    return edges.flatMap((lo, i) => (i % 2 === 0 && edges[i + 1] - lo > 4 ? [{ lo, hi: edges[i + 1] }] : []));
  };
  const gapsOf = (p: PageMap) => {
    const gaps = measureGaps(p);
    const court = new Set(courts(p, gaps).map((g) => g.id));
    return gaps.map((g) => ({ g, court: court.has(g.id), out: g.kind === 'under' ? blocked(g, gapRuns(g, p.obstacles, HANG)) : [] }));
  };
  $: gaps = page ? gapsOf(page) : [];
  // main's air in view, and the exits this page has for fliers. Chevrons
  // are drawn at these fractions along each exit.
  $: bounds = page ? boundsOf(page, EXITS) : null;
  const MARKS = [0.25, 0.5, 0.75];

  onMount(() => {
    const el = shown ? shelf() : null;
    return el ? watchRailSky(el, measureRail) : undefined;
  });
</script>

{#if shown}
<svg class="geometry" width="100%" height="100%">
  {#each [...floors] as [id, f] (id)}
    <g data-floor-id={id} data-headroom={f.headroom}>
      <line class="floor" x1={f.left} y1={f.y} x2={f.right} y2={f.y} />
      <text x={f.left + 4} y={f.y - 4}>{id}{Number.isFinite(f.headroom) ? ` · headroom ${Math.round(f.headroom)}` : ''}</text>
    </g>
  {/each}
  {#each sides as { w, runs } (w.id)}
    <g data-wall-id={w.id}>
      {#each runs as r (r.lo)}
        <rect class="wall-run" x={w.side < 0 ? w.x - BONK : w.x} y={w.top + r.lo} width={BONK} height={r.hi - r.lo} />
      {/each}
      <line class="wall" x1={w.x} y1={w.top} x2={w.x} y2={w.bottom} />
      <text class:end={w.side > 0} x={w.x + 3 * w.side} y={w.top + 24}>{w.side < 0 ? 'l' : 'r'}</text>
    </g>
  {/each}
  <defs>
    <pattern id="geometry-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line class="hatch" x1="0" y1="0" x2="0" y2="4" />
    </pattern>
  </defs>
  {#each gaps as { g, court, out } (g.id)}
    {@const depth = g.kind === 'side' ? Math.min(g.bottom, g.top + COLUMN) - g.top : g.bottom - g.top}
    <g data-gap-id={g.id} data-gap-kind={g.kind} data-court={court ? '' : undefined}>
      <rect class="gap" x={g.from.x} y={g.top} width={g.to.x - g.from.x} height={depth} />
      {#if g.kind === 'side'}
        <line class="gap" x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} />
        <circle class="gap-end" cx={g.from.x} cy={g.from.y} r="3" />
        <circle class="gap-end" cx={g.to.x} cy={g.to.y} r="3" />
        <text class="gap end" x={g.from.x - 3} y={g.from.y + 12}>{endId(g.from)}</text>
        <text class="gap" x={g.to.x + 3} y={g.to.y + 12}>{endId(g.to)}</text>
        <!-- Written down the gutter, which is clear by definition. -->
        <text class="gap down" transform="translate({(g.from.x + g.to.x) / 2 - 3} {g.top + 6}) rotate(90)">{court ? `court ${g.from.ledge}|${g.to.ledge}` : `${g.id} · step`} {Math.round(g.step)} · {Math.round(g.bottom - g.top)}</text>
      {:else}
        {#each out as r (r.lo)}
          <rect class="hatched" x={g.from.x + r.lo} y={g.top} width={r.hi - r.lo} height={Math.min(HANG, depth)} />
        {/each}
        <text class="gap end" x={g.to.x - 4} y={g.top + 10}>{g.id} · {Math.round(g.step)}</text>
      {/if}
    </g>
  {/each}
  {#if page && bounds?.exits}
    {@const { view, exits } = bounds}
    <g data-air>
      <rect class="air" x={view.left} y={view.top} width={view.right - view.left} height={view.bottom - view.top} />
      <text class="air end" x={view.right - 4} y={view.bottom - 4}>air {Math.round(view.right - view.left)}x{Math.round(view.bottom - view.top)}</text>
    </g>
    {#if exits.right !== undefined}
      <g data-exit="right">
        {#each MARKS as f (f)}
          <path class="exit" d="M {exits.right - 10} {page.height * f - 5} l 5 5 l -5 5" />
        {/each}
      </g>
    {/if}
    {#if exits.top !== undefined}
      <g data-exit="top">
        {#each MARKS as f (f)}
          <path class="exit" d="M {view.left + (view.right - view.left) * f - 5} {exits.top + 10} l 5 -5 l 5 5" />
        {/each}
      </g>
    {/if}
    {#if exits.rail !== undefined}
      <g data-exit="rail">
        <line class="exit" x1={exits.rail} y1={0} x2={exits.rail} y2={page.height} />
        {#each MARKS as f (f)}
          <path class="exit" d="M {exits.rail + 10} {page.height * f - 5} l -5 5 l 5 5" />
        {/each}
      </g>
    {/if}
  {/if}
  {#each lanes as l (l.id)}
    <!-- Only the part in sight: behind the rail and past the window are not. -->
    {@const from = Math.max(l.from, bounds?.exits?.rail ?? 0)}
    <g data-lane-id={l.id}>
      <line class="lane" x1={from} y1={l.y} x2={Math.min(l.to, page?.width ?? l.to)} y2={l.y} />
      <text class="lane" x={from + 4} y={l.y - 3}>lane {l.row} +{l.above}</text>
    </g>
  {/each}
  {#if sky}
    <g data-sky>
      <rect class="sky" x={sky.left} y={sky.top} width={sky.width} height={sky.height} />
      <text x={sky.left + 4} y={sky.top + 12}>sky {Math.round(sky.width)}x{Math.round(sky.height)}</text>
    </g>
  {/if}
  {#if railAir}
    <g data-rail-air>
      <rect class="rail-air" x={railAir.left} y={railAir.top} width={railAir.width} height={railAir.height} />
      <text class="end" x={railAir.left + railAir.width - 4} y={railAir.top + 12}>rail air {Math.round(railAir.width)}x{Math.round(railAir.height)}</text>
    </g>
  {/if}
</svg>
{/if}

<style>
  .geometry { position: absolute; inset: 0; }
  line { stroke-width: 1; stroke-dasharray: 4 3; }
  .floor { stroke: #78c8ff; }
  .wall { stroke: #bd9cff; }
  .wall-run { fill: #bd9cff; opacity: .12; }
  .sky { fill: none; stroke: #78c8ff; stroke-width: 1; stroke-dasharray: 4 3; }
  .rail-air { fill: none; stroke: #9be29b; stroke-width: 1; stroke-dasharray: 2 4; }
  rect.gap { fill: none; stroke: #ffd27a; stroke-width: 1; stroke-dasharray: 3 3; }
  line.gap { stroke: #ffd27a; }
  .gap-end { fill: none; stroke: #ffd27a; stroke-width: 1; }
  .hatched { fill: url(#geometry-hatch); }
  .hatch { stroke: #ffd27a; stroke-dasharray: none; opacity: .6; }
  text.gap { fill: #ffd27a; }
  text.down { font-size: 9px; }
  rect.air { fill: none; stroke: #f2a7d8; stroke-width: 1; stroke-dasharray: 6 4; }
  text.air { fill: #f2a7d8; }
  .exit { fill: none; stroke: #f2a7d8; stroke-width: 1.5; }
  line.exit { stroke-width: 1; stroke-dasharray: 6 4; }
  line.lane { stroke: #9be29b; stroke-dasharray: 8 4; }
  text.lane { fill: #9be29b; }
  text { fill: #78c8ff; font: 10px ui-monospace, monospace; }
  .end { text-anchor: end; }
</style>
