<script lang="ts">
  // Bonfire Night over the page: embers smouldering along the card tops, and
  // hedgehogs sharing a small unlit woodpile on one of them, well away from
  // the bonfire on the rail. The layer takes no pointer events.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import { emberColour, fanEmbers, heat, reconcileEmbers, type Ember } from './embers';
  import type { Point } from '../pointer';
  import Rig from '../rig/Rig.svelte';
  import { createHogs, hogPoint, PILE, reconcileHogs, restingHogs, stepHogs, type Hogs } from './hedgehog';
  import { hogRig } from './hedgehog-rig';
  import woodpile from './woodpile.webp';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let embers: ReadonlyMap<number, Ember[]> = new Map();
  let group: Hogs | null = null;
  let now = 0;
  let reduced = false;
  let cursor: Point | null = null;
  const STILL_HEAT = 0.55;

  $: pile = group?.home ? floors.get(group.home.floor) : undefined;
  $: shown = (group?.hogs ?? []).flatMap((hog) => {
    const at = hog.mode === 'hidden' ? null : hogPoint(hog, group?.home ?? null, scene);
    return at ? [{ hog, at, pose: hogRig(hog, { now, at, cursor, still: reduced }) }] : [];
  });

  // Reduced motion draws a still frame only after a measurement, so the
  // resting hedgehogs are placed here with everything else.
  function placeHogs(current: Hogs | null, previous: PageMap, time: number): Hogs {
    if (reduced) return restingHogs(scene, current);
    if (!current) return createHogs(scene, time, Math.random);
    return samePage(scene, previous) ? current : reconcileHogs(current, scene, time, Math.random);
  }

  onMount(() => ledgeScene({
    // Either way the group starts afresh; reduced motion then keeps it put.
    motion(still) { reduced = still; group = null; },
    measured(page, previous, time) {
      scene = page;
      floors = page.floors;
      embers = reconcileEmbers(floors, embers);
      group = placeHogs(group, previous, time);
    },
    frame(time, step) {
      now = time;
      cursor = step?.cursor ?? null;
      if (!step) return;
      group = group && stepHogs(group, scene, time, step.dt, Math.random, step.cursor);
    },
    stroke(segment) { embers = fanEmbers(embers, floors, segment); },
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-bonfire>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    <defs>
      <radialGradient id="ember-glow">
        <stop offset="0" stop-color="rgb(255, 150, 60)" stop-opacity=".55" />
        <stop offset="1" stop-color="rgb(255, 120, 30)" stop-opacity="0" />
      </radialGradient>
    </defs>
    {#each [...embers] as [id, list] (id)}
      {@const f = floors.get(id)}
      {#if f && list.length}
        <g transform="translate({f.left} {f.y})">
          {#each list as e (e.key)}
            {@const h = reduced ? STILL_HEAT : heat(e, now)}
            <circle cx={e.x} cy={-e.size * 0.8} r={e.size * 4} fill="url(#ember-glow)" opacity={Math.max(0, h - 0.3)} />
            <circle cx={e.x} cy={-e.size * 0.8} r={e.size} fill={emberColour(h)} />
          {/each}
        </g>
      {/if}
    {/each}
  </svg>
  {#each shown as { hog, at, pose } (hog.id)}
    <Rig {pose} x={at.x} y={at.y} dir={hog.dir} data-hedgehog={hog.mode} data-id={hog.id} />
  {/each}
  <!-- After the hedgehogs, so one peeking from the mouth is half behind it. -->
  {#if pile && group?.home}
    <img class="woodpile" data-woodpile src={woodpile} alt="" width={PILE.width} height={PILE.height}
      style="left: {pile.left + group.home.pile - PILE.width / 2}px; top: {pile.y - PILE.height + 1}px" />
  {/if}
</div>

<style>
  svg { position: absolute; inset: 0; }
  img { position: absolute; display: block; max-width: none; }
  /* The art's den opens on its right; mirrored, it faces the hedgehog's range. */
  .woodpile { transform: scaleX(-1); }
</style>
