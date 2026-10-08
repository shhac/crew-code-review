<script lang="ts">
  // The northern lights over the page: frost along the ledges, tinted by the
  // aurora in the rail's sky, and an Arctic fox asleep on one of them. The
  // layer takes no pointer events.
  import { onMount } from 'svelte';
  import { measurePage, samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { watchPage } from '../layout';
  import { sceneLoop } from '../lifecycle';
  import { observePointer, pointerTracker } from '../pointer';
  import { STILL } from './aurora';
  import { createFox, foxView, POSES, reconcileFox, restingFox, stepFox, type Cursor, type Fox, type Pose } from './fox';
  import foxAlert from './fox-alert.webp';
  import foxBow from './fox-bow.webp';
  import foxCurled from './fox-curled.webp';
  import foxPounce from './fox-pounce.webp';
  import foxTrot from './fox-trot.webp';
  import { catchLight, frostColour, reconcileRime, shine, type Rime } from './frost';

  const ART: Record<Pose, string> = { curled: foxCurled, alert: foxAlert, trot: foxTrot, bow: foxBow, pounce: foxPounce };
  const debug = new URLSearchParams(location.search).get('theme-debug') === '1';
  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let rime: ReadonlyMap<number, Rime> = new Map();
  let fox: Fox | null = null;
  let now = 0;
  let reduced = false;
  // Distance trotted, for the bob of its stride.
  let trotted = 0;

  $: view = fox && foxView(fox, scene, now);
  $: art = view && { src: ART[view.pose], ...POSES[view.pose] };
  $: bob = view?.pose === 'trot' && fox?.mode !== 'settle' ? -Math.abs(Math.sin(trotted / 4)) * 1.5 : 0;
  $: colour = frostColour(reduced ? STILL : now);

  // Reduced motion draws a still frame only after a measurement, so the
  // sleeping fox is placed here with everything else.
  function placeFox(current: Fox | null, previous: PageMap, time: number): Fox | null {
    if (reduced) return restingFox(scene, current);
    if (!current) return createFox(scene, time, Math.random);
    return samePage(scene, previous) ? current : reconcileFox(current, scene, time, Math.random);
  }

  onMount(() => {
    const pointer = pointerTracker();
    let cursor: Cursor | null = null;
    let dirty = true, measuredAt = -Infinity, last = performance.now();
    const measure = (time: number) => {
      const previous = scene;
      scene = measurePage();
      floors = scene.floors;
      rime = reconcileRime(floors, scene.obstacles, rime);
      fox = placeFox(fox, previous, time);
      dirty = false; measuredAt = performance.now();
    };
    // A cursor that left, or a page that was hidden, is no longer lingering.
    const forget = () => { pointer.reset(); cursor = null; };
    const loop = sceneLoop((time, still) => {
      if (still !== reduced) { reduced = still; fox = reduced ? restingFox(scene, fox) : null; dirty = true; }
      now = time;
      if (dirty) measure(time);
      if (still) return;
      const dt = Math.min(100, time - last);
      last = time;
      const before = fox?.x ?? 0;
      fox = fox && stepFox(fox, scene, time, dt, Math.random, cursor);
      trotted += Math.abs((fox?.x ?? 0) - before);
    }, () => { forget(); dirty = true; last = performance.now(); });
    const changed = () => { pointer.reset(); dirty = true; loop.invalidate(); };
    const stopWatching = watchPage(changed, () => ({ scene, at: measuredAt }));
    const stopPointer = observePointer((e) => {
      if (reduced || document.hidden) { forget(); return; }
      cursor = { x: e.clientX, y: e.clientY, at: performance.now() };
      if (dirty) { pointer.reset(); return; }
      const stroke = pointer.move(e, performance.now());
      if (stroke) rime = catchLight(rime, floors, stroke);
    }, forget);
    return () => { loop.stop(); stopPointer(); stopWatching(); };
  });
</script>

<div class="seasonal-overlay" aria-hidden="true" data-aurora>
  {#if debug}<Geometry {floors} />{/if}
  <svg width="100%" height="100%">
    {#each [...rime] as [id, r] (id)}
      {@const f = floors.get(id)}
      {#if f && r.d}
        <g transform="translate({f.left} {f.y})">
          <path class="rime" d={r.d} stroke={colour} />
          {#if !reduced}
            {#each r.glints as g (g.key)}
              {@const s = g.size}
              <path class="glint" transform="translate({g.x} -2)" opacity={shine(g, now)}
                d="M0 {-s}L{s * .22} {-s * .22}L{s} 0L{s * .22} {s * .22}L0 {s}L{-s * .22} {s * .22}L{-s} 0L{-s * .22} {-s * .22}Z" />
            {/each}
          {/if}
        </g>
      {/if}
    {/each}
  </svg>
  {#if view && art && fox}
    <img
      class="fox"
      data-fox={fox.mode}
      data-pose={view.pose}
      src={art.src}
      alt=""
      width={art.width}
      height={art.height}
      style="left: {view.x - art.width / 2}px; top: {view.y - art.height + bob}px; opacity: {view.opacity}; transform: scaleX({view.dir})"
    />
  {/if}
</div>

<style>
  svg { position: absolute; inset: 0; }
  img { position: absolute; display: block; max-width: none; }
  .rime { fill: none; stroke-width: 1; stroke-linecap: round; opacity: .75; }
  .glint { fill: #fff; }
  .fox { transform-origin: 50% 100%; }
</style>
