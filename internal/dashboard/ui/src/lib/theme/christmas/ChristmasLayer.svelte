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
  import { createRobinPlayback } from './robin-playback';

  // Injected by the synthetic lab; the dashboard uses real elapsed time.
  export let clock: () => number = () => performance.now();
  export let random: () => number = Math.random;
  const playback = createRobinPlayback();

  const debug = new URLSearchParams(location.search).get('theme-debug') === '1';
  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: Scene = { floors, obstacles: [], width: 0, height: 0 };
  let bird: Bird = createBird(scene, 0, random);
  let snow: ReadonlyMap<number, Snow[]> = new Map();
  let now = 0;
  let reduced = false;
  $: perch = bird.perch;
  $: drawing = birdPose(bird, scene, now);
  $: articulation = playback.pose(bird, now, reduced);
  onMount(() => {
    const pointer = pointerTracker();
    let dirty = true, measuredAt = -Infinity, fresh = true, restarting = true;
    const reset = () => { pointer.reset(); playback.reset(); dirty = true; restarting = true; };
    const measure = (time: number) => {
      const previousScene = scene;
      floors = measureFloors();
      scene = { floors, obstacles: measureObstacles(), width: innerWidth, height: innerHeight };
      snow = reconcileSnow(floors, snow);
      const sameGeometry = JSON.stringify([...floors]) === JSON.stringify([...previousScene.floors])
        && JSON.stringify(scene.obstacles) === JSON.stringify(previousScene.obstacles)
        && scene.width === previousScene.width && scene.height === previousScene.height;
      if (fresh) bird = createBird(scene, time, random);
      else if (restarting || !sameGeometry) {
        const checked = reconcileBird(bird, scene, time, random);
        const before = bird.perch && previousScene.floors.get(bird.perch.floor);
        const after = bird.perch && scene.floors.get(bird.perch.floor);
        // Live data updates below a safe perch must not restart every breath
        // or postpone hopping forever. Actual movement/layout interruptions reset.
        const idleUnmoved = !bird.action && !bird.alert && checked.perch === bird.perch
          && before && after && before.left === after.left && before.y === after.y;
        if (restarting || !idleUnmoved) { bird = checked; playback.reset(); }
      }
      fresh = false; restarting = false; dirty = false; measuredAt = performance.now();
    };
    const loop = sceneLoop((_time, still) => {
      now = clock();
      if (still !== reduced) { reduced = still; snow = new Map(); reset(); }
      if (dirty) measure(now);
      bird = still ? { ...bird, action: null, alert: false } : advanceBird(bird, scene, now, random);
    }, reset);
    const changed = () => { pointer.reset(); dirty = true; loop.invalidate(); };
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
    return () => { playback.reset(); loop.stop(); stopPointer(); stopObserving(); clearInterval(timer); };
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
      style="left: {drawing.x - ROBIN.anchorX}px; top: {drawing.y - ROBIN.anchorY}px; width: {ROBIN.width}px; height: {ROBIN.height}px; transform: scaleX({drawing.dir}); transform-origin: {ROBIN.anchorX}px {ROBIN.anchorY}px">
      <RobinArt pose={drawing.pose} {articulation} {reduced} />
    </div>
  {/if}
</div>

<style>
  svg { position: absolute; inset: 0; }
  path { fill: #eaf0ec; }
  .shadow { fill: #b9cbd0; }
  .robin { position: absolute; max-width: none; }
</style>
