<script lang="ts">
  // Bonfire Night over the page: embers smouldering along the card tops, and
  // a hedgehog living in a small unlit woodpile on one of them, well away
  // from the bonfire on the rail. The layer takes no pointer events.
  import { onMount } from 'svelte';
  import { measurePage, samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { observeLayout } from '../layout';
  import { sceneLoop } from '../lifecycle';
  import { observePointer, pointerTracker } from '../pointer';
  import { emberColour, fanEmbers, heat, reconcileEmbers, type Ember } from './embers';
  import { BALL, createHog, HOG, PILE, reconcileHog, restingHog, stepHog, type Cursor, type Hog } from './hedgehog';
  import hedgehogBall from './hedgehog-ball.webp';
  import hedgehogWalk from './hedgehog-walk.webp';
  import woodpile from './woodpile.webp';

  const debug = new URLSearchParams(location.search).get('theme-debug') === '1';
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
  $: hogAt = hog && pile && hog.mode !== 'hidden' ? { x: pile.left + hog.x, y: pile.y } : null;

  onMount(() => {
    const pointer = pointerTracker();
    let cursor: Cursor | null = null;
    let dirty = true, measuredAt = -Infinity, last = performance.now();
    const measure = (time: number) => {
      const previous = scene;
      scene = measurePage();
      floors = scene.floors;
      embers = reconcileEmbers(floors, embers);
      if (!hog) hog = createHog(scene, time);
      else if (!samePage(scene, previous)) hog = reconcileHog(hog, scene, time);
      dirty = false; measuredAt = performance.now();
    };
    const loop = sceneLoop((time, still) => {
      if (still !== reduced) { reduced = still; hog = null; dirty = true; }
      now = time;
      if (dirty) measure(time);
      if (still) { hog = restingHog(scene); return; }
      const dt = Math.min(100, time - last);
      last = time;
      const before = hog?.x ?? 0;
      hog = hog && stepHog(hog, scene, time, dt, Math.random, cursor);
      walked += Math.abs((hog?.x ?? 0) - before);
    }, () => { pointer.reset(); dirty = true; last = performance.now(); });
    const changed = () => { pointer.reset(); dirty = true; loop.invalidate(); };
    const stopObserving = observeLayout(changed);
    const stopPointer = observePointer((e) => {
      cursor = { x: e.clientX, y: e.clientY, at: performance.now() };
      if (reduced || dirty || document.hidden) { pointer.reset(); return; }
      const stroke = pointer.move(e, performance.now());
      if (stroke) embers = fanEmbers(embers, floors, stroke);
    }, pointer.reset);
    // Catches CSS-only layout changes without disturbing an unchanged scene.
    const timer = window.setInterval(() => {
      if (document.hidden || performance.now() - measuredAt < 1000) return;
      if (!samePage(measurePage(), scene)) changed();
    }, 1000);
    return () => { loop.stop(); stopPointer(); stopObserving(); clearInterval(timer); };
  });
</script>

<div class="seasonal-overlay" aria-hidden="true" data-bonfire>
  {#if debug}<Geometry {floors} />{/if}
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
      src={hog.mode === 'curled' ? hedgehogBall : hedgehogWalk}
      alt=""
      width={hog.mode === 'curled' ? BALL.width : HOG.width}
      height={hog.mode === 'curled' ? BALL.height : HOG.height}
      style="left: {hogAt.x - (hog.mode === 'curled' ? BALL.width : HOG.width) / 2}px; top: {hogAt.y - (hog.mode === 'curled' ? BALL.height : HOG.height) + (hog.mode === 'walk' || hog.mode === 'flee' || hog.mode === 'home' ? -Math.abs(Math.sin(walked / 3)) : 0)}px; transform: scaleX({hog.dir})"
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
