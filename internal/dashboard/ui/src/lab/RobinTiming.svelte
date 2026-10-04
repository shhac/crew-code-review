<script lang="ts">
  import { alertEntry, alertReturn, blink, breathing, flap, movementClip, selectFrame, tilt, type Clip } from '../lib/theme/christmas/animation';
  import { createPlayback } from '../lib/theme/christmas/playback';
  import { createBird, type Scene } from '../lib/theme/christmas/robin';

  let clipName = 'breathing';
  let elapsed = 0;
  let duration = 451;
  let reduced = false;
  const clips: Record<string, Clip> = { breathing, blink, tilt, flap, alertEntry, alertReturn };
  $: clip = clipName === 'hop' || clipName === 'flight' ? movementClip(clipName, duration) : clips[clipName];
  $: selected = selectFrame(clip, elapsed);

  const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [], width: 800, height: 600 };
  const bird = createBird(scene, 0, () => .5);
  const player = createPlayback(() => 0);
  let controllerTime = 0;
  let alert = false;
  let controllerFrame = 'I0';
  function sample() { controllerFrame = player.frame({ ...bird, alert }, controllerTime, reduced); }
  function reset() { player.reset(); controllerTime = 0; alert = false; sample(); }
</script>

<main>
  <h1>Robin timing diagnostic</h1>
  <p>Deferred full-articulation timing diagnostic: frame IDs only. Shipped idle and blink artwork is available in the robin-rig and scene labs.</p>
  <section>
    <h2>Discrete timeline</h2>
    <label>Clip <select bind:value={clipName}>{#each [...Object.keys(clips), 'hop', 'flight'] as name}<option>{name}</option>{/each}</select></label>
    <label>Route duration (ms) <input type="number" min="220" max="750" step=".001" bind:value={duration} /></label>
    <label>Elapsed (ms) <input type="number" min="0" step="1" bind:value={elapsed} /></label>
    <output data-timing-frame>{selected.frame}</output>
    <p data-timing-complete>{selected.complete ? 'complete' : 'playing'}</p>
    <table><thead><tr><th>Phase</th><th>Frame</th><th>Duration (ms)</th></tr></thead><tbody>
      {#each clip.frames as frame, index}<tr><td>{index}</td><td>{frame}</td><td>{clip.durations[index]}</td></tr>{/each}
    </tbody></table>
  </section>
  <section>
    <h2>Controller epochs</h2>
    <p>Samples preserve history until reset. Repeated alert samples preserve entry; clearing alert starts return. A backwards clock starts a new epoch.</p>
    <label>Clock (ms) <input type="number" min="0" bind:value={controllerTime} /></label>
    <label><input type="checkbox" bind:checked={alert} /> Alert</label>
    <label><input type="checkbox" bind:checked={reduced} /> Reduced motion</label>
    <button on:click={sample}>Sample</button><button on:click={reset}>Reset epochs</button>
    <output data-controller-frame>{controllerFrame}</output>
  </section>
</main>

<style>
  main { padding: 24px; }
  section { margin: 24px 0; }
  label { display: block; margin: 12px 0; }
  output { display: block; margin: 16px 0; font: 24px monospace; }
  th, td { padding: 4px 12px; text-align: left; }
</style>
