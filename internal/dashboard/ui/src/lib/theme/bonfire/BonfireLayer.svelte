<script lang="ts">
  // Bonfire Night over the page: embers smouldering along the card tops, and
  // a hedgehog living in a small unlit woodpile on one of them, well away
  // from the bonfire on the rail. The layer takes no pointer events.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene } from '../layout';
  import { emberColour, fanEmbers, heat, reconcileEmbers, type Ember } from './embers';
  import { BALL, createHog, HOG, hogPoint, moving, PILE, reconcileHog, restingHog, stepHog, type Hog } from './hedgehog';
  import hedgehogBall from './hedgehog-ball.webp';
  import hedgehogWalk from './hedgehog-walk.webp';
  import woodpile from './woodpile.webp';

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let embers: ReadonlyMap<number, Ember[]> = new Map();
  let hog: Hog | null = null;
  let now = 0;
  let reduced = false;
  // Distance walked, for the waddle.
  let walked = 0;
  const STILL_HEAT = 0.55;

  $: pile = hog?.home ? floors.get(hog.home.floor) : undefined;
  $: hogAt = hog && hog.mode !== 'hidden' ? hogPoint(hog, scene) : null;
  $: art = hog?.mode === 'curled' ? { src: hedgehogBall, ...BALL } : { src: hedgehogWalk, ...HOG };
  $: bob = hog && moving(hog.mode) ? -Math.abs(Math.sin(walked / 3)) : 0;

  // Reduced motion draws a still frame only after a measurement, so the
  // resting hedgehog is placed here with everything else.
  function placeHog(current: Hog | null, previous: PageMap, time: number): Hog {
    if (reduced) return restingHog(scene);
    if (!current) return createHog(scene, time);
    return samePage(scene, previous) ? current : reconcileHog(current, scene, time);
  }

  onMount(() => ledgeScene({
    motion(still) { reduced = still; hog = null; },
    measured(page, previous, time) {
      scene = page;
      floors = page.floors;
      embers = reconcileEmbers(floors, embers);
      hog = placeHog(hog, previous, time);
    },
    frame(time, step) {
      now = time;
      if (!step) return;
      const before = hog?.x ?? 0;
      hog = hog && stepHog(hog, scene, time, step.dt, Math.random, step.cursor);
      walked += Math.abs((hog?.x ?? 0) - before);
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
  {#if hogAt && hog}
    <img
      class="hedgehog"
      class:sniffing={hog.mode === 'sniff' && !reduced}
      data-hedgehog={hog.mode}
      src={art.src}
      alt=""
      width={art.width}
      height={art.height}
      style="left: {hogAt.x - art.width / 2}px; top: {hogAt.y - art.height + bob}px; transform: scaleX({hog.dir})"
    />
  {/if}
  {#if pile && hog?.home}
    <img class="woodpile" data-woodpile src={woodpile} alt="" width={PILE.width} height={PILE.height}
      style="left: {pile.left + hog.home.pile - PILE.width / 2}px; top: {pile.y - PILE.height + 1}px" />
  {/if}
</div>

<style>
  svg { position: absolute; inset: 0; }
  img { position: absolute; display: block; max-width: none; }
  /* The art's den opens on its right; mirrored, it faces the hedgehog's range. */
  .woodpile { transform: scaleX(-1); }
  .hedgehog { transform-origin: 50% 100%; }
  .sniffing { animation: sniff .9s ease-in-out infinite alternate; }
  @keyframes sniff {
    from { rotate: 0deg; }
    to { rotate: -3deg; }
  }
</style>
