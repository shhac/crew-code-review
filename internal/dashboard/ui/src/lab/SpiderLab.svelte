<script lang="ts">
  // One spider, large, on a floor, with the dials that matter for judging a
  // walk: speed, zoom, and a pause to inspect a single pose.
  import { onMount } from 'svelte';
  import Spider from '../lib/theme/halloween/Spider.svelte';

  let speed = 26;
  let zoom = 6;
  let playing = true;
  let hanging = false;
  let walked = 0;

  onMount(() => {
    const loop = { frame: 0, last: performance.now() };
    const tick = (now: number) => {
      if (playing && !hanging) walked += (speed * Math.min(0.1, (now - loop.last) / 1000));
      loop.last = now;
      loop.frame = requestAnimationFrame(tick);
    };
    loop.frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loop.frame);
  });
</script>

<div class="lab">
  <div class="controls">
    <label>speed {speed}px/s <input type="range" min="0" max="80" bind:value={speed} /></label>
    <label>zoom {zoom}x <input type="range" min="1" max="10" bind:value={zoom} /></label>
    <label>step <input type="range" min="0" max="40" step="0.25" bind:value={walked} disabled={playing} /></label>
    <button type="button" on:click={() => (playing = !playing)}>{playing ? 'pause' : 'play'}</button>
    <button type="button" on:click={() => (hanging = !hanging)}>{hanging ? 'walk' : 'hang'}</button>
  </div>

  <div class="stage">
    <div class="floor"></div>
    <div class="big" style="scale: {zoom}">
      <Spider moving={playing} {hanging} {walked} />
    </div>
  </div>

  <p>At page size, both ways round:</p>
  <div class="row">
    <Spider moving={playing} {hanging} {walked} />
    <div style="transform: scaleX(-1)"><Spider moving={playing} {hanging} {walked} /></div>
    <div style="scale: .7"><Spider moving={playing} {hanging} {walked} /></div>
  </div>
</div>

<style>
  .lab { padding: 24px; display: grid; gap: 18px; }
  .controls { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .stage { position: relative; height: 340px; background: var(--paper-2); border-radius: 12px; overflow: hidden; }
  .floor { position: absolute; left: 0; right: 0; bottom: 60px; border-top: 2px solid var(--line-strong); }
  .big { position: absolute; left: 50%; bottom: 60px; transform-origin: 50% 100%; translate: -50% 0; }
  .row { display: flex; gap: 40px; align-items: flex-end; padding: 20px; border-bottom: 2px solid var(--line-strong); }
</style>
