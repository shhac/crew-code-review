<script lang="ts">
  import { onMount } from 'svelte';
  import RobinArt from '../lib/theme/christmas/RobinArt.svelte';
  import { atlasManifestText } from '../lib/theme/christmas/atlas-inventory';
  import { flyingFrame, flyingLoopFrame } from '../lib/theme/christmas/flying-playback';
  import { birdPose, createBird, type Scene } from '../lib/theme/christmas/robin';

  const candidate = JSON.parse(atlasManifestText);
  const count = candidate.rows.flying.count;
  // Lab-only acceptance override: inspect pending art through the real renderer.
  // This is never imported by the dashboard and never writes the manifest.
  if (count) candidate.rows.flying = { ...candidate.rows.flying, available: true, acceptance: 'accepted', joins: 'accepted' };
  const atlasSource = JSON.stringify(candidate);
  const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [], width: 800, height: 600 };
  const resting = createBird(scene, 0, () => .5);
  let elapsed = 0, duration = 450, mode = 'joins', playing = false, reduced = false, enabled = true;
  $: bird = { ...resting, action: { kind: 'flight' as const, start: 0, duration, from: { x: 124, y: 200 }, to: { x: 400, y: 200 }, target: { ...resting.perch!, x: 300 }, rise: 24 } };
  $: inFlight = mode !== 'joins' || elapsed >= 0 && elapsed < duration;
  $: flightFrame = !count || !enabled ? null : mode === 'joins' ? flyingFrame(bird, elapsed, count, reduced)
    : reduced ? null : flyingLoopFrame(count, elapsed, mode === 'comparison' ? count * 140 : 200);
  $: wing = mode === 'joins' ? birdPose(bird, scene, elapsed)?.wing ?? 0 : 0;
  onMount(() => {
    let request = 0, last = performance.now();
    const tick = (now: number) => {
      if (playing && !document.hidden) {
        const period = mode === 'joins' ? duration + 400 : mode === 'comparison' ? (count || 4) * 140 : 200;
        elapsed = ((elapsed + (mode === 'joins' ? 200 : 0) + now - last) % period) - (mode === 'joins' ? 200 : 0);
      }
      last = now; request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  });
</script>

<section>
  <h2>Flying candidate review</h2>
  <p>Pending visual acceptance; production keeps legacy flight. These views deliberately enable candidate cells only in this lab. Joins use the actual shipped wing angles and unchanged action clock.</p>
  <label>Flying mode <select bind:value={mode}><option value="joins">Actual departure and arrival joins</option><option value="exact">Exact 200ms loop</option><option value="comparison">140ms per cell comparison</option></select></label>
  <label>Flying duration (ms) <input type="number" bind:value={duration} min="450" max="750" step=".001" /></label>
  <label>Flying elapsed (ms) <input type="number" bind:value={elapsed} step=".001" /></label>
  <label><input type="checkbox" bind:checked={playing} /> Play flying preview</label>
  <label><input type="checkbox" bind:checked={enabled} /> Inspect candidate flying</label>
  <label><input type="checkbox" bind:checked={reduced} /> Flying reduced motion</label>
  <output data-flying-phase>{flightFrame ?? 'legacy'}</output>
  <div class="views">
    {#each ['light', 'dark'] as background}
      {#each [1, -1] as facing}
        {#each [1, .35] as scale}
          <div class:dark={background === 'dark'} class="view" data-flying-view="{background}-{facing}-{scale}">
            <div class="mirror" style="transform: scaleX({facing})">
              <div class="size" style="transform: scale({scale / .35}); --wing: {wing}deg">
                <RobinArt pose={inFlight ? 'flight' : 'perch'} {flightFrame} {reduced} {atlasSource} />
              </div>
            </div>
          </div>
        {/each}
      {/each}
    {/each}
  </div>
</section>

<style>
  label { display: block; margin: 12px 0; }
  .views { display: flex; flex-wrap: wrap; gap: 8px; }
  .view { width: 180px; height: 180px; background: #eee; position: relative; }
  .dark { background: #20252b; }
  .mirror { position: absolute; left: 24px; top: 48px; width: 128px; height: 112px; }
  .size { transform-origin: 0 0; }
</style>
