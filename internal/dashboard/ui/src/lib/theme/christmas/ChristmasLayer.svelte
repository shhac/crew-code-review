<script lang="ts">
  import { onMount } from 'svelte';
  import { measureFloors, measureObstacles, type Ledge } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { observeLayout } from '../layout';
  import { ROBIN, snowPath, snowProfile } from './snow';
  import { pointerTracker, observePointer } from '../pointer';
  import { sceneLoop } from '../lifecycle';
  import { createBird, advanceBird, reconcileBird, birdPose, type Bird, type Scene } from './robin';
  import { reconcileSnow, wipeSnow, renderSnow, type Snow } from './wipe';
  import RobinArt from './RobinArt.svelte';
  import { createAtlasIdlePlayback, createIdlePlayback, cosmeticStream } from './idle-playback';
  import { idleClips } from './idle-inventory';
  import { flyingFrame } from './flying-playback';
  import { atlasManifestText } from './atlas-inventory';
  import { validateAtlasIdleManifest } from './manifest';

  // Injected by the synthetic lab; the dashboard uses real elapsed time.
  export let clock: () => number = () => performance.now();
  export let random: () => number = Math.random;
  export let cosmeticRandom: () => number = cosmeticStream();
  const playback = createIdlePlayback(() => cosmeticRandom(), idleClips());
  const atlasPlayback = createAtlasIdlePlayback();
  const flyingCount = (() => {
    try { return validateAtlasIdleManifest(JSON.parse(atlasManifestText)).rows?.flying.count || 4; }
    catch { return 4; }
  })();

  const debug = new URLSearchParams(location.search).get('theme-debug') === '1';
  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: Scene = { floors, obstacles: [], width: 0, height: 0 };
  let bird: Bird = createBird(scene, 0, random);
  let snow: ReadonlyMap<number, Snow[]> = new Map();
  let now = 0;
  let reduced = false;
  $: perch = bird.perch;
  $: drawing = birdPose(bird, scene, now);
  $: frame = playback.frame(bird, now, reduced);
  $: atlasFrame = atlasPlayback.frame(bird, now, reduced);
  $: flightFrame = flyingFrame(bird, now, flyingCount, reduced);
  onMount(() => {
    const pointer = pointerTracker();
    let dirty = true, measuredAt = -Infinity, fresh = true;
    const reset = () => { pointer.reset(); playback.reset(); atlasPlayback.reset(); dirty = true; };
    const measure = (time: number) => {
      floors = measureFloors();
      scene = { floors, obstacles: measureObstacles(), width: innerWidth, height: innerHeight };
      snow = reconcileSnow(floors, snow);
      bird = fresh ? createBird(scene, time, random) : reconcileBird(bird, scene, time, random);
      fresh = false; dirty = false; measuredAt = performance.now();
    };
    const loop = sceneLoop((_time, still) => {
      now = clock();
      if (still !== reduced) { reduced = still; snow = new Map(); reset(); }
      if (dirty) measure(now);
      bird = still ? { ...bird, action: null, alert: false } : advanceBird(bird, scene, now, random);
    }, reset);
    const changed = () => { reset(); loop.invalidate(); };
    const stopObserving = observeLayout(changed);
    const stopPointer = observePointer((e) => {
      if (reduced || dirty || document.hidden) { pointer.reset(); return; }
      const stroke = pointer.move(e, clock());
      if (!stroke) return;
      snow = wipeSnow(snow, floors, stroke);
      bird = advanceBird(bird, scene, stroke.at, random, stroke);
    }, pointer.reset);
    // CSS-only changes need a measurement, but unchanged geometry must not
    // cancel an action every second. Compare bounds before invalidating.
    const timer = window.setInterval(() => {
      if (document.hidden || performance.now() - measuredAt < 1000) return;
      const next = measureFloors();
      const obstacles = measureObstacles();
      if (JSON.stringify([...next]) !== JSON.stringify([...floors]) || JSON.stringify(obstacles) !== JSON.stringify(scene.obstacles)) changed();
    }, 1000);
    return () => { playback.reset(); atlasPlayback.reset(); loop.stop(); stopPointer(); stopObserving(); clearInterval(timer); };
  });
</script>

<div class="seasonal-overlay" aria-hidden="true" data-christmas>
  {#if debug}<Geometry {floors} />{/if}
  <svg width="100%" height="100%">
    {#each [...floors] as [id, f] (id)}
      {@const foot = !bird.action && perch?.floor === id ? perch.x : undefined}
      {@const samples = reduced ? snowProfile(id, f, foot) : renderSnow(snow.get(id) ?? [], now, foot)}
      <g transform="translate({f.left} {f.y})">
        <path data-snow={id} d={snowPath(samples)} />
        <path class="shadow" d={snowPath(samples.map((s) => ({ ...s, depth: Math.min(.65, s.depth) })))} />
      </g>
    {/each}
  </svg>
  {#if drawing}
    <div class="robin" data-pose={drawing.pose}
      style="left: {drawing.x - ROBIN.anchorX}px; top: {drawing.y - ROBIN.anchorY}px; width: {ROBIN.width}px; height: {ROBIN.height}px; transform: scaleX({drawing.dir}); transform-origin: {ROBIN.anchorX}px {ROBIN.anchorY}px; --wing: {drawing.wing}deg">
      <RobinArt pose={drawing.pose} {frame} {atlasFrame} {flightFrame} {reduced} />
    </div>
  {/if}
</div>

<style>
  svg { position: absolute; inset: 0; }
  path { fill: #eaf0ec; }
  .shadow { fill: #b9cbd0; }
  .robin { position: absolute; max-width: none; }
</style>
