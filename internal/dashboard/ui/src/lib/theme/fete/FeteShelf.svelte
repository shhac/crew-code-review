<script lang="ts">
  // The fête's cake stall on the rail's empty stretch above the identity
  // chip: a coconut shy, a prize-winning Victoria sandwich on its stand and
  // three jars of jam, on a white tablecloth. Two common wasps circle the
  // cake in the rail's air above it, now and then landing to feed; a cursor
  // that comes at one chases it off past the window's edge, and it comes
  // back later. They keep to the rail's air and never cross the page, the
  // nav or the identity chip; with the shelf hidden there are none.
  import { onMount } from 'svelte';
  import { cueOf } from '../cue';
  import { sceneLoop } from '../lifecycle';
  import { hovering, observePointer } from '../pointer';
  import { easeTo } from '../rig/life';
  import { gazeFrom, GAZE_EASE } from '../rig/gaze';
  import Rig from '../rig/Rig.svelte';
  import { measureRailAir, watchRailSky } from '../sky';
  import { waspAir, type WaspAir } from './air';
  import table from './fete-table.webp';
  import { ART, CAKE, CLOTH, JAR, STAGE } from './table';
  import { waspView, type Pointer, type Wasp, type WaspView } from './wasp';
  import { ANCHOR, CRUISE, EYE, SCALE, waspRig } from './wasp-rig';
  import { inspectNow, placeWasps, reconcileWasps, stepWasps } from './wasps';

  // The cloth's scalloped hem, one scallop every 7px.
  const HEM = `M0 ${CLOTH}H${STAGE.width}V${STAGE.height - 3}`
    + Array.from({ length: 24 }, () => 'q-3.5 4 -7 0').join('')
    + 'Z';
  const PLACES = { cake: CAKE, jar: JAR };
  // A test's cue to send wasp 0 in to land on the cake at once.
  const CUE = cueOf(['land'] as const);
  const gaze = gazeFrom({ eye: EYE, anchor: ANCHOR, scale: SCALE, look: 15, reach: 80 });

  let root: HTMLElement;
  let stage: HTMLElement;
  let air: WaspAir | null = null;
  let wasps: Wasp[] = [];
  let leans: ReadonlyMap<number, number> = new Map();
  let now = 0;
  let reduced = false;

  $: shown = wasps.flatMap((w) => {
    const view = waspView(w, PLACES, now, reduced);
    return view ? [{ w, view }] : [];
  });
  const rigOf = (w: Wasp, view: WaspView) => waspRig({
    pose: view.pose, seed: w.seed, walked: view.walked / SCALE, speed: view.pose === 'cruise' ? CRUISE : 0,
    lean: leans.get(w.id) ?? 0, wings: view.pose === 'standing' || view.pose === 'feed' ? 0 : 1,
  }, { now, still: reduced });

  // The air in the stage's coordinates; none while the shelf is hidden.
  const measure = () => {
    const at = stage?.getBoundingClientRect();
    air = at ? waspAir(measureRailAir(root), { left: at.left, top: at.top }) : null;
  };

  onMount(() => {
    // The cursor in the stage's coordinates, and how fast it was going.
    let cursor: Pointer | null = null;
    let last = performance.now();
    let cued = CUE !== 'land';
    const forget = () => { cursor = null; };
    const settle = (time: number) => {
      if (!air) { wasps = []; return; }
      const world = { air, places: PLACES, now: time, rand: Math.random };
      if (reduced) { wasps = placeWasps(world, true); return; }
      wasps = wasps.length ? reconcileWasps(wasps, { ...world, cursor: null }) : placeWasps(world);
    };
    measure();
    const loop = sceneLoop((time, still) => {
      const dt = Math.min(100, time - last);
      last = time;
      now = time;
      if (still !== reduced || (!wasps.length && air)) { reduced = still; wasps = []; settle(time); }
      if (still || !air) return;
      const world = { air, places: PLACES, now: time, rand: Math.random, cursor };
      if (!cued && wasps.length) { wasps = inspectNow(wasps, world); cued = true; }
      wasps = stepWasps(wasps, world, dt);
      leans = new Map(wasps.map((w) => {
        const at = waspView(w, PLACES, time);
        const toward = at && cursor ? gaze(at.face >= 0 ? 1 : -1, at, cursor) : 0;
        return [w.id, easeTo(leans.get(w.id) ?? 0, toward, dt, GAZE_EASE)];
      }));
    }, () => { forget(); last = performance.now(); });
    const stopWatching = watchRailSky(root, () => { measure(); settle(performance.now()); loop.invalidate(); });
    const stopPointer = observePointer((e) => {
      if (reduced || document.hidden || !hovering(e) || !stage) { forget(); return; }
      const at = stage.getBoundingClientRect();
      const t = performance.now();
      const p = { x: e.clientX - at.left, y: e.clientY - at.top };
      const speed = cursor ? (Math.hypot(p.x - cursor.x, p.y - cursor.y) * 1000) / Math.max(1, t - cursor.at) : 0;
      cursor = { ...p, at: t, speed };
    }, forget);
    return () => { loop.stop(); stopWatching(); stopPointer(); };
  });
</script>

<div class="theme-shelf fete-shelf" aria-hidden="true" bind:this={root}>
  <div class="stage" bind:this={stage}>
    <svg class="cloth" width={STAGE.width} height={STAGE.height} viewBox="0 0 {STAGE.width} {STAGE.height}">
      <path d={HEM} fill="#f4ecd8" />
      <path d="M0 {CLOTH + 0.6}H{STAGE.width}" stroke="#d8ccb0" stroke-width="1.2" />
    </svg>
    <img class="table" src={table} alt="" width={ART.width} height={ART.height} style="left: {ART.left}px; top: {ART.top}px" />
    {#each shown as { w, view } (w.id)}
      <!-- Turning about, she is mirrored through edge-on rather than flipped. -->
      <div class="wasp" style="left: {view.x}px; top: {view.y}px; transform: scale({view.face * view.scale}, {view.scale})">
        <Rig pose={rigOf(w, view)} x={0} y={0} data-wasp={w.mode} data-pose={view.pose} data-id={w.id} />
      </div>
    {/each}
  </div>
</div>

<style>
  .fete-shelf { position: relative; display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .stage { position: relative; width: 168px; height: 72px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .cloth { position: absolute; left: 0; top: 0; }
  .wasp { position: absolute; width: 0; height: 0; transform-origin: 0 0; }
</style>
