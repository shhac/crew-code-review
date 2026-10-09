<script lang="ts">
  // The animals drawn from parts, large, on a floor, with the dials that
  // matter for judging them: what each is doing, speed, zoom, and a pause to
  // inspect a single pose. The cursor over the big stage is passed on, so a
  // head turning toward it can be checked.
  import { onMount } from 'svelte';
  import type { Point } from '../lib/theme/pointer';
  import { moving, type Hog, type Mode } from '../lib/theme/bonfire/hedgehog';
  import { hogRig } from '../lib/theme/bonfire/hedgehog-rig';
  import Rig from '../lib/theme/rig/Rig.svelte';

  const MODES: Mode[] = ['walk', 'flee', 'sniff', 'peek', 'curled'];
  let mode: Mode = 'walk';
  let speed = 16;
  let zoom = 6;
  let playing = true;
  let still = false;
  let dir: 1 | -1 = 1;
  let walked = 0;
  let now = 0;
  let cursor: Point | null = null;
  let stage: HTMLDivElement;

  $: hog = { id: 0, seed: 1, x: 0, dir, mode, target: 0, until: 0, out: 0, walked } satisfies Hog;
  // The big drawing stands at the stage's floor, centred; the cursor is
  // handed over in the drawing's own scale.
  $: pose = hogRig(hog, { now, at: { x: 0, y: 0 }, cursor, still });
  $: small = hogRig(hog, { now, at: { x: 0, y: 0 }, cursor: null, still });

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
        if (moving(mode)) walked += speed * (mode === 'flee' ? 34 / 16 : 1) * dt;
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
    {#each MODES as m}
      <button type="button" class:on={mode === m} on:click={() => (mode = m)}>{m}</button>
    {/each}
    <label>speed {speed}px/s <input type="range" min="0" max="60" bind:value={speed} /></label>
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
      <Rig {pose} x={0} y={0} {dir} data-critter={mode} />
    </div>
  </div>

  <p>At page size, on a card top:</p>
  <div class="row">
    {#each [1, -1] as const as d}
      <div class="spot"><Rig pose={small} x={0} y={0} dir={d} /></div>
    {/each}
  </div>
</div>

<style>
  .lab { padding: 24px; display: grid; gap: 18px; }
  .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .controls .on { outline: 2px solid var(--accent); }
  .stage { position: relative; height: 360px; background: var(--paper-2); border-radius: 12px; overflow: hidden; }
  .floor { position: absolute; left: 0; right: 0; bottom: 60px; border-top: 2px solid var(--line-strong); }
  .big { position: absolute; left: 50%; bottom: 60px; width: 0; height: 0; transform-origin: 0 0; }
  .row { display: flex; align-items: flex-end; gap: 60px; padding: 30px 40px 0; border-bottom: 2px solid var(--line-strong); }
  .spot { position: relative; width: 40px; height: 0; }
</style>
