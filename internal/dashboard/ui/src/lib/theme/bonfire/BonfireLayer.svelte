<script lang="ts">
  // Bonfire Night over the page: embers smouldering along the card tops, and
  // hedgehogs sharing a small unlit woodpile on one of them, well away from
  // the bonfire on the rail. The layer takes no pointer events.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene, placeTroupe } from '../layout';
  import type { Cursor } from '../pointer';
  import { easeGazes } from '../rig/gaze';
  import Rig from '../rig/Rig.svelte';
  import { emberColour, fanEmbers, heat, reconcileEmbers, type Ember } from './embers';
  import { createHogs, hogPoint, PILE, reconcileHogs, restingHogs, stepHogs, type Hog, type Hogs } from './hedgehog';
  import { gazeAt, hogRig } from './hedgehog-rig';
  import woodpile from './woodpile.webp';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let embers: ReadonlyMap<number, Ember[]> = new Map();
  let group: Hogs | null = null;
  let now = 0;
  let reduced = false;
  // How far each hedgehog's head is turned toward the cursor, eased so it
  // turns smoothly rather than snapping.
  let gazes: ReadonlyMap<number, number> = new Map();
  const STILL_HEAT = 0.55;

  const at = (hog: Hog) => (hog.mode === 'hidden' ? null : hogPoint(hog, group?.home ?? null, scene));
  $: pile = group?.home ? floors.get(group.home.floor) : undefined;
  $: shown = (group?.hogs ?? []).flatMap((hog) => {
    const point = at(hog);
    return point ? [{ hog, point, pose: hogRig(hog, { now, gaze: gazes.get(hog.id) ?? 0, still: reduced }) }] : [];
  });

  function gazing(hogs: readonly Hog[], cursor: Cursor | null, dt: number): ReadonlyMap<number, number> {
    return easeGazes(hogs, (hog) => hog.id, (hog) => {
      const point = at(hog);
      return point ? gazeAt(hog, point, cursor) : 0;
    }, gazes, dt);
  }

  // Either way reduced motion switches, the hedgehogs start afresh; reduced
  // motion then keeps them put.
  const troupe = placeTroupe({ create: createHogs, reconcile: reconcileHogs, resting: restingHogs, freshOnEnter: true });

  onMount(() => ledgeScene({
    motion(still) { reduced = still; group = troupe.motion(group, still); },
    measured(page, previous, time) {
      scene = page;
      floors = page.floors;
      embers = reconcileEmbers(floors, embers);
      group = troupe.place(group, page, samePage(page, previous), time, reduced);
    },
    frame(time, step) {
      now = time;
      if (!step) return;
      group = group && stepHogs(group, scene, time, step.dt, Math.random, step.cursor);
      gazes = gazing(group?.hogs ?? [], step.cursor, step.dt);
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
  {#each shown as { hog, point, pose } (hog.id)}
    <Rig {pose} x={point.x} y={point.y} dir={hog.dir} data-hedgehog={hog.mode} data-id={hog.id} />
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
