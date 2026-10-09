<script lang="ts">
  // The animals drawn from parts, large, on a floor, with the dials that
  // matter for judging them: which animal and what it is doing, speed, zoom,
  // and a pause to inspect a single pose. The cursor over the big stage is
  // passed on, so a head turning toward it can be checked.
  import { onMount } from 'svelte';
  import { LEAP, POSES, poseOf, SPEED as FOX_SPEED, type Mode as FoxMode } from '../lib/theme/aurora/fox';
  import { foxRig, type RigFox } from '../lib/theme/aurora/fox-rig';
  import { HURRY, moving, SPEED as HOG_SPEED, type Hog, type Mode as HogMode } from '../lib/theme/bonfire/hedgehog';
  import { hogRig } from '../lib/theme/bonfire/hedgehog-rig';
  import type { Point } from '../lib/theme/pointer';
  import Rig from '../lib/theme/rig/Rig.svelte';

  type Animal = 'hedgehog' | 'fox';
  // What each can be shown doing. The fox's alert is asleep but looking up.
  const HOG_MODES: HogMode[] = ['walk', 'flee', 'sniff', 'peek', 'curled'];
  const FOX_MODES: { label: string; mode: FoxMode; look?: number }[] = [
    { label: 'trot', mode: 'trot' }, { label: 'stand', mode: 'settle' }, { label: 'stretch', mode: 'stretch' }, { label: 'crouch', mode: 'crouch' },
    { label: 'leap', mode: 'leap' }, { label: 'dig', mode: 'dig' }, { label: 'asleep', mode: 'asleep' }, { label: 'alert', mode: 'asleep', look: Infinity },
  ];
  let animal: Animal = 'hedgehog';
  let hogMode: HogMode = 'walk';
  let foxMode = FOX_MODES[0];
  let speed = HOG_SPEED;
  let zoom = 6;
  let playing = true;
  let still = false;
  let dir: 1 | -1 = 1;
  let walked = 0;
  let now = 0;
  let cursor: Point | null = null;
  let stage: HTMLDivElement;

  $: modes = animal === 'hedgehog' ? HOG_MODES : FOX_MODES.map((m) => m.label);
  $: label = animal === 'hedgehog' ? hogMode : foxMode.label;
  $: walking = animal === 'hedgehog' ? moving(hogMode) : foxMode.mode === 'trot';
  // A leap replays every 0.9s: its 0.6s flight, then a moment landed.
  $: leapEnds = now - (now % 900) + LEAP;
  $: hog = { id: 0, seed: 1, x: 0, dir, mode: hogMode, target: 0, until: 0, out: 0, walked } satisfies Hog;
  $: fox = { mode: foxMode.mode, walked, seed: 1, until: leapEnds, ear: 0, look: foxMode.look ?? 0 } satisfies RigFox;
  // The big drawing hears the cursor; the small ones do not.
  $: pose = animal === 'hedgehog' ? hogRig(hog, { now, at: { x: 0, y: 0 }, cursor, still }) : foxRig(fox, { now, still });
  $: small = animal === 'hedgehog' ? hogRig(hog, { now, at: { x: 0, y: 0 }, cursor: null, still }) : pose;
  // The footprint placement allows the fox in this pose, drawn as a box.
  $: box = animal === 'fox' ? POSES[poseOf(fox, now)] : null;

  function choose(m: string) {
    if (animal === 'hedgehog') hogMode = HOG_MODES.find((h) => h === m) ?? hogMode;
    else foxMode = FOX_MODES.find((f) => f.label === m) ?? foxMode;
  }
  function switchTo(a: Animal) {
    animal = a;
    speed = a === 'hedgehog' ? HOG_SPEED : FOX_SPEED;
  }
  function track(e: PointerEvent) {
    const r = stage.getBoundingClientRect();
    cursor = { x: (e.clientX - (r.left + r.width / 2)) / zoom, y: (e.clientY - (r.bottom - 60)) / zoom };
  }

  onMount(() => {
    const loop = { frame: 0, last: performance.now() };
    const tick = (time: number) => {
      const dt = Math.min(0.1, (time - loop.last) / 1000);
      if (playing) {
        now += dt * 1000;
        if (walking) walked += speed * (hogMode === 'flee' && animal === 'hedgehog' ? HURRY / HOG_SPEED : 1) * dt;
      }
      loop.last = time;
      loop.frame = requestAnimationFrame(tick);
    };
    loop.frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loop.frame);
  });
</script>

<div class="lab">
  <div class="controls">
    {#each ['hedgehog', 'fox'] as const as a}
      <button type="button" class:on={animal === a} on:click={() => switchTo(a)}>{a}</button>
    {/each}
    <span class="sep"></span>
    {#each modes as m}
      <button type="button" class:on={label === m} on:click={() => choose(m)}>{m}</button>
    {/each}
  </div>
  <div class="controls">
    <label>speed {speed}px/s <input type="range" min="0" max="80" bind:value={speed} /></label>
    <label>zoom {zoom}x <input type="range" min="1" max="12" bind:value={zoom} /></label>
    <label>step <input type="range" min="0" max="40" step="0.1" bind:value={walked} disabled={playing} /></label>
    <button type="button" on:click={() => (playing = !playing)}>{playing ? 'pause' : 'play'}</button>
    <button type="button" on:click={() => (dir = dir === 1 ? -1 : 1)}>face {dir === 1 ? 'left' : 'right'}</button>
    <label><input type="checkbox" bind:checked={still} /> reduced motion</label>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="stage" bind:this={stage} on:pointermove={track} on:pointerleave={() => (cursor = null)} data-stage>
    <div class="floor"></div>
    <div class="big" style="scale: {zoom}">
      {#if box}
        <span class="footprint" style="left: {-box.width / 2}px; top: {-box.height}px; width: {box.width}px; height: {box.height}px"></span>
      {/if}
      <Rig {pose} x={0} y={0} {dir} data-critter={label} />
    </div>
  </div>

  <p>At page size, on a card top, both ways round:</p>
  <div class="row">
    {#each [1, -1] as const as d}
      <div class="spot"><Rig pose={small} x={0} y={0} dir={d} /></div>
    {/each}
  </div>
</div>

<style>
  .lab { padding: 24px; display: grid; gap: 14px; }
  .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .controls .on { outline: 2px solid var(--accent); }
  .sep { width: 12px; }
  .stage { position: relative; height: 360px; background: var(--paper-2); border-radius: 12px; overflow: hidden; }
  .floor { position: absolute; left: 0; right: 0; bottom: 60px; border-top: 2px solid var(--line-strong); }
  .big { position: absolute; left: 50%; bottom: 60px; width: 0; height: 0; transform-origin: 0 0; }
  .footprint { position: absolute; outline: .2px dashed var(--accent); opacity: .6; }
  .row { display: flex; align-items: flex-end; gap: 60px; padding: 30px 40px 0; border-bottom: 2px solid var(--line-strong); }
  .spot { position: relative; width: 40px; height: 0; }
</style>
