<script lang="ts">
  // Every seasonal animal, large, on a floor, with the dials that matter for
  // judging them: what each is doing, speed, zoom, a pause and scrub to
  // inspect a single pose, and for those drawn from parts, the parts: hide
  // any, see each alone, mark the joints and the footprint placement allows.
  // The cursor over the big stage is passed on, so heads turning toward it
  // can be checked. Each animal keeps its own lab too (spider.html,
  // robin-parts.html).
  import { onMount } from 'svelte';
  import { LEAP, POSES, poseOf, SPEED as FOX_SPEED, type Mode as FoxMode } from '../lib/theme/aurora/fox';
  import { foxRig, REFERENCE, type RigFox } from '../lib/theme/aurora/fox-rig';
  import foxReference from './fox-reference.webp';
  import { HOG, HURRY, moving, SPEED as HOG_SPEED, type Hog, type Mode as HogMode } from '../lib/theme/bonfire/hedgehog';
  import { gazeAt, hogRig } from '../lib/theme/bonfire/hedgehog-rig';
  import LayeredRobin from '../lib/theme/christmas/LayeredRobin.svelte';
  import { partsModes, partsViewport } from '../lib/theme/christmas/parts-pose';
  import robinManifest from '../lib/theme/christmas/robin-parts/manifest.json' with { type: 'json' };
  import Spider from '../lib/theme/halloween/Spider.svelte';
  import spiderBody from '../lib/theme/halloween/spider-body.webp';
  import spiderHanging from '../lib/theme/halloween/spider-hanging.webp';
  import spiderShin from '../lib/theme/halloween/leg-shin.webp';
  import spiderThigh from '../lib/theme/halloween/leg-thigh.webp';
  import type { Point } from '../lib/theme/pointer';
  import { easeTo } from '../lib/theme/rig/life';
  import type { RigPose } from '../lib/theme/rig/rig';
  import Rig from '../lib/theme/rig/Rig.svelte';
  import { allPartNames, keepParts, partArt } from './rig-parts';

  type Animal = 'hedgehog' | 'fox' | 'spider' | 'robin';
  const ANIMALS: Animal[] = ['hedgehog', 'fox', 'spider', 'robin'];
  // What each can be shown doing. The fox's alert is asleep but looking up.
  const HOG_MODES: HogMode[] = ['walk', 'flee', 'sniff', 'peek', 'curled'];
  const FOX_MODES: { label: string; mode: FoxMode; look?: number }[] = [
    { label: 'trot', mode: 'trot' }, { label: 'stand', mode: 'settle' }, { label: 'stretch', mode: 'stretch' }, { label: 'crouch', mode: 'crouch' },
    { label: 'leap', mode: 'leap' }, { label: 'dig', mode: 'dig' }, { label: 'asleep', mode: 'asleep' }, { label: 'alert', mode: 'asleep', look: Infinity },
  ];
  const SPIDER_MODES = ['walk', 'hang', 'crouch', 'jump'];
  const MODES: Record<Animal, string[]> = { hedgehog: HOG_MODES, fox: FOX_MODES.map((m) => m.label), spider: SPIDER_MODES, robin: partsModes };
  const SPEEDS: Record<Animal, number> = { hedgehog: HOG_SPEED, fox: FOX_SPEED, spider: 26, robin: 0 };
  // The robin's drawing is 128x112 at 0.35 on the page, standing at (64, 100).
  const ROBIN = { scale: 0.35, x: 64, y: 100 };
  const robinArt = import.meta.glob<string>('../lib/theme/christmas/robin-parts/*.webp', { eager: true, query: '?url', import: 'default' });
  // The spider's layers, as Spider.svelte names them, and its art.
  const SPIDER_PARTS = ['far legs', 'body', 'near legs'];
  const SPIDER_ART = [{ name: 'body', src: spiderBody }, { name: 'thigh', src: spiderThigh }, { name: 'shin', src: spiderShin }, { name: 'hanging', src: spiderHanging }];
  const ROBIN_PARTS = Object.keys(robinManifest.parts);
  const ROBIN_ART = Object.entries(robinManifest.parts).map(([name, part]) => ({ name, src: robinArt[`../lib/theme/christmas/robin-parts/${part.file}`] }));
  const GAZE_EASE = 220;

  let animal: Animal = 'hedgehog';
  let mode = 'walk';
  let speed = HOG_SPEED;
  let zoom = 6;
  let playing = true;
  let still = false;
  let dir: 1 | -1 = 1;
  let walked = 0;
  let now = 0;
  let cursor: Point | null = null;
  let gaze = 0;
  let hidden: string[] = [];
  let separate = false;
  let guides = false;
  let footprint = true;
  // The fox's standing drawing laid over it, which its parts and legs were
  // measured from.
  let reference = false;
  let stage: HTMLDivElement;

  const hogFor = (m: string, w: number): Hog => ({ id: 0, seed: 1, x: 0, dir, mode: HOG_MODES.find((h) => h === m) ?? 'walk', target: 0, until: 0, out: 0, walked: w });
  const foxFor = (m: string, w: number, t: number): RigFox => {
    const pick = FOX_MODES.find((f) => f.label === m) ?? FOX_MODES[0];
    // A leap replays every 0.9s: its flight, then a moment landed.
    return { mode: pick.mode, walked: w, seed: 1, until: t - (t % 900) + LEAP, ear: 0, look: pick.look ?? 0 };
  };
  const rigFor = (a: Animal, m: string, t: number, w: number, g: number): RigPose | null => {
    if (a === 'hedgehog') return hogRig(hogFor(m, w), { now: t, gaze: g, still });
    if (a === 'fox') return foxRig(foxFor(m, w, t), { now: t, still });
    return null;
  };

  $: hog = hogFor(mode, walked);
  $: walking = animal === 'hedgehog' ? moving(hog.mode) : animal === 'fox' ? mode === 'trot' : animal === 'spider' && mode === 'walk';
  $: pose = rigFor(animal, mode, now, walked, gaze);
  $: shown = pose && keepParts(pose, (name) => !hidden.includes(name));
  // Every layer the animal ever draws, whatever it is doing, so the list
  // holds still while a part comes and goes (an eyelid, mid-blink).
  const posesOf = (a: Animal): RigPose[] => MODES[a].flatMap((m) => Array.from({ length: 120 }, (_, i) => i).flatMap((i) => {
    const each = rigFor(a, m, i * 40, i * 0.5, 0);
    return each ? [each] : [];
  }));
  $: everyPose = posesOf(animal);
  $: parts = animal === 'spider' ? SPIDER_PARTS : animal === 'robin' ? ROBIN_PARTS : allPartNames(everyPose);
  $: art = animal === 'spider' ? SPIDER_ART : animal === 'robin' ? ROBIN_ART : [...new Map(everyPose.flatMap(partArt).map((a) => [a.name, a])).values()];
  // The box placement allows this pose on the page.
  $: box = animal === 'fox' ? POSES[poseOf(foxFor(mode, walked, now), now)] : animal === 'hedgehog' ? HOG : null;
  $: viewport = partsViewport(mode, still);

  function choose(a: Animal) {
    animal = a;
    mode = MODES[a][0];
    speed = SPEEDS[a];
    hidden = [];
  }
  function track(e: PointerEvent) {
    const r = stage.getBoundingClientRect();
    cursor = { x: (e.clientX - (r.left + r.width / 2)) / zoom, y: (e.clientY - (r.bottom - 60)) / zoom };
  }

  onMount(() => {
    const loop = { frame: 0, last: performance.now() };
    const tick = (time: number) => {
      const dt = Math.min(100, time - loop.last);
      if (playing) {
        now += dt;
        if (walking) walked += speed * (hog.mode === 'flee' && animal === 'hedgehog' ? HURRY / HOG_SPEED : 1) * dt / 1000;
      }
      gaze = easeTo(gaze, still ? 0 : gazeAt(hog, { x: 0, y: 0 }, cursor), dt, GAZE_EASE);
      loop.last = time;
      loop.frame = requestAnimationFrame(tick);
    };
    loop.frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loop.frame);
  });
</script>

<div class="lab">
  <div class="controls">
    {#each ANIMALS as a}
      <button type="button" class:on={animal === a} on:click={() => choose(a)}>{a}</button>
    {/each}
    <span class="sep"></span>
    {#each MODES[animal] as m}
      <button type="button" class:on={mode === m} on:click={() => (mode = m)}>{m}</button>
    {/each}
  </div>
  <div class="controls">
    <label>speed {speed}px/s <input type="range" min="0" max="80" bind:value={speed} /></label>
    <label>zoom {zoom}x <input type="range" min="1" max="12" bind:value={zoom} /></label>
    <!-- Showing where in a loop it is, never writing back while it plays: a
         bound slider would clamp the clock at its maximum. -->
    <label>step <input type="range" min="0" max="40" step="0.1" value={walked % 40} disabled={playing} on:input={(e) => (walked = Number(e.currentTarget.value))} /></label>
    <label>time <input type="range" min="0" max="12000" step="10" value={now % 12000} disabled={playing} on:input={(e) => (now = Number(e.currentTarget.value))} /></label>
    <button type="button" on:click={() => (playing = !playing)}>{playing ? 'pause' : 'play'}</button>
    <button type="button" on:click={() => (dir = dir === 1 ? -1 : 1)}>face {dir === 1 ? 'left' : 'right'}</button>
    <label><input type="checkbox" bind:checked={still} /> reduced motion</label>
    <label><input type="checkbox" bind:checked={guides} /> joints</label>
    <label><input type="checkbox" bind:checked={separate} /> separate pieces</label>
    {#if box}<label><input type="checkbox" bind:checked={footprint} /> footprint</label>{/if}
    {#if animal === 'fox'}<label><input type="checkbox" bind:checked={reference} /> reference</label>{/if}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="stage" bind:this={stage} on:pointermove={track} on:pointerleave={() => (cursor = null)} data-stage>
    <div class="floor"></div>
    <div class="big" style="scale: {zoom}">
      {#if box && footprint && pose}
        <span class="footprint" style="left: {-box.width / 2}px; top: {-box.height}px; width: {box.width}px; height: {box.height}px"></span>
      {/if}
      {#if shown}
        <Rig pose={shown} x={0} y={0} {dir} {guides} data-critter={mode} />
        {#if reference && animal === 'fox'}
          <Rig pose={{ ...shown, layers: [{ kind: 'image', name: 'reference', src: foxReference, ...REFERENCE }] }} x={0} y={0} {dir} opacity={0.45} />
        {/if}
      {:else if animal === 'spider'}
        <div class="spider" class:hanging={mode === 'hang'} style="transform: scaleX({dir})" data-critter={mode}>
          <Spider moving={playing && mode === 'walk'} hanging={mode === 'hang'} walked={walked} crouch={mode === 'crouch' ? 1 : 0} tuck={mode === 'jump' ? 1 : 0} {hidden} />
        </div>
      {:else}
        <div class="robin" data-critter={mode} style="left: {(viewport[0] - ROBIN.x) * ROBIN.scale}px; top: {(viewport[1] - ROBIN.y) * ROBIN.scale}px; width: {viewport[2] * ROBIN.scale}px; height: {viewport[3] * ROBIN.scale}px">
          <LayeredRobin elapsed={now % 12000} {mode} reduced={still} mirrored={dir === -1} exploded={separate} {guides} {hidden} />
        </div>
      {/if}
    </div>
  </div>

  <section class="parts">
    <p>Layers, back to front (untick to hide):</p>
    <div class="controls">
      {#each parts as name}
        <label><input type="checkbox" checked={!hidden.includes(name)} on:change={() => (hidden = hidden.includes(name) ? hidden.filter((h) => h !== name) : [...hidden, name])} /> {name}</label>
      {/each}
    </div>
    {#if separate && pose}
      <div class="row pieces">
        {#each parts as name}
          <figure>
            <div class="spot" style="scale: {Math.max(2, zoom / 2)}"><Rig pose={keepParts(pose, (n) => n === name)} x={0} y={0} {dir} /></div>
            <figcaption>{name}</figcaption>
          </figure>
        {/each}
      </div>
    {:else if separate && animal === 'spider' && mode !== 'hang'}
      <div class="row pieces">
        {#each parts as name}
          <figure>
            <div class="spot" style="scale: {Math.max(2, zoom / 2)}">
              <div class="spider"><Spider walked={walked} crouch={mode === 'crouch' ? 1 : 0} tuck={mode === 'jump' ? 1 : 0} hidden={parts.filter((n) => n !== name)} /></div>
            </div>
            <figcaption>{name}</figcaption>
          </figure>
        {/each}
      </div>
    {/if}
    {#if separate && animal === 'robin'}<p>The robin's pieces are pulled apart on the stage above.</p>{/if}
    <p>The art each part is drawn from, at its file's own size:</p>
    <div class="art">
      {#each art as { name, src }}
        <figure><img {src} alt="" /><figcaption>{name}</figcaption></figure>
      {/each}
    </div>
    {#if pose}
      <p>Every pose at the same scale, three times page size, so the animal stays the same size whatever it does:</p>
      <div class="row lineup">
        {#each MODES[animal] as m}
          {@const each = rigFor(animal, m, 1300, 1.3, 0)}
          {#if each}
            <figure><div class="spot" style="scale: 3"><Rig pose={each} x={0} y={0} /></div><figcaption>{m}</figcaption></figure>
          {/if}
        {/each}
      </div>
    {/if}
  </section>

  <p>At page size, on a card top, both ways round:</p>
  <div class="row">
    {#each [1, -1] as const as d}
      <div class="spot">
        {#if pose}
          <Rig pose={rigFor(animal, mode, now, walked, 0) ?? pose} x={0} y={0} dir={d} />
        {:else if animal === 'spider'}
          <div class="spider" class:hanging={mode === 'hang'} style="transform: scaleX({d})">
            <Spider moving={playing && mode === 'walk'} hanging={mode === 'hang'} walked={walked} crouch={mode === 'crouch' ? 1 : 0} tuck={mode === 'jump' ? 1 : 0} />
          </div>
        {:else}
          <div class="robin" style="left: {(viewport[0] - ROBIN.x) * ROBIN.scale}px; top: {(viewport[1] - ROBIN.y) * ROBIN.scale}px; width: {viewport[2] * ROBIN.scale}px; height: {viewport[3] * ROBIN.scale}px">
            <LayeredRobin elapsed={now % 12000} {mode} reduced={still} mirrored={d === -1} />
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .lab { padding: 24px; display: grid; gap: 14px; }
  .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .controls .on { outline: 2px solid var(--accent); }
  .sep { width: 12px; }
  .stage { position: relative; height: 380px; background: var(--paper-2); border-radius: 12px; overflow: hidden; }
  .floor { position: absolute; left: 0; right: 0; bottom: 60px; border-top: 2px solid var(--line-strong); }
  .big { position: absolute; left: 50%; bottom: 60px; width: 0; height: 0; transform-origin: 0 0; }
  .footprint { position: absolute; outline: .2px dashed var(--accent); opacity: .6; }
  /* The spider's walking box has its feet at y 38 of 40; hanging, its silk is
     tied 4px down its strip, here hung from 60px up. */
  .spider { position: absolute; left: -39px; top: -38px; transform-origin: 39px 0; }
  .spider.hanging { left: -31px; top: -60px; transform-origin: 31px 0; }
  .robin { position: absolute; }
  .robin :global(svg) { width: 100%; height: 100%; display: block; }
  .row { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 60px; padding: 30px 40px 0; border-bottom: 2px solid var(--line-strong); }
  .pieces, .lineup { gap: 24px 90px; padding-top: 70px; }
  .spot { position: relative; width: 40px; height: 0; transform-origin: 0 0; }
  figure { margin: 0; display: grid; gap: 6px; justify-items: start; }
  figcaption { font-size: 12px; opacity: .7; }
  .lineup figure, .pieces figure { height: 90px; align-content: end; }
  .art { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; }
  .art img { display: block; background: repeating-conic-gradient(#0001 0% 25%, #0000 0% 50%) 0 / 12px 12px; }
  .parts p, .lab > p { margin: 8px 0 0; font-size: 13px; }
</style>
