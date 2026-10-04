<script lang="ts">
  import { onMount } from 'svelte';
  import RobinArt from '../lib/theme/christmas/RobinArt.svelte';
  import reference from '../lib/theme/christmas/robin-perch.webp';
  import { selectFrame, type Clip } from '../lib/theme/christmas/animation';
  import { idleClips } from '../lib/theme/christmas/idle-inventory';

  const ids = ['I0', 'I1', 'I2', 'I3', 'B1', 'B2'];
  const clips: Record<string, Clip> = idleClips();
  let name = 'breathing', elapsed = 0, reduced = false, overlay = false, mirrored = false;
  let error = '';
  let files: Record<string, string> = {};
  $: selected = reduced ? 'I0' : selectFrame(clips[name], elapsed).frame;
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  onMount(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch('/lab/robin-rig-evidence/complete.json', { signal: abort.signal });
        if (!response.ok) throw new Error('Missing accepted evidence pointer');
        const pointer: unknown = await response.json();
        if (!record(pointer) || typeof pointer.file !== 'string' || typeof pointer.sha256 !== 'string'
          || !/^[a-f0-9]{64}-inventory\.json$/.test(pointer.file) || !pointer.file.startsWith(pointer.sha256 + '-')) throw new Error('Invalid evidence pointer');
        const inventory = await fetch('/lab/robin-rig-evidence/' + pointer.file, { signal: abort.signal });
        if (!inventory.ok) throw new Error('Missing accepted inventory');
        const bytes = await inventory.arrayBuffer();
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
        if (digest !== pointer.sha256) throw new Error('Evidence hash mismatch');
        const evidence: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (!record(evidence) || !record(evidence.frames) || !record(evidence.previews)) throw new Error('Invalid accepted evidence');
        const next: Record<string, string> = {};
        const add = (key: string, file: unknown) => {
          if (typeof file !== 'string' || !/^[a-f0-9]{64}-[a-zA-Z0-9-]+\.(webp|png|gif)$/.test(file)) throw new Error('Invalid evidence filename');
          next[key] = '/lab/robin-rig-evidence/' + file;
        };
        for (const id of ids) {
          const entry = evidence.frames[id];
          if (!record(entry)) throw new Error('Missing accepted frame');
          add(id + '.webp', entry.file);
        }
        for (const [clipName, entry] of Object.entries(evidence.previews)) {
          if (!record(entry)) throw new Error('Missing accepted preview');
          add(clipName + '-contact.png', entry.contact);
          add(clipName + '.gif', entry.gif);
        }
        if (!abort.signal.aborted) files = next;
      } catch (failure) {
        if (!abort.signal.aborted) error = failure instanceof Error ? failure.message : 'Failed to load evidence';
      }
    }
    void load();
    return () => abort.abort();
  });
</script>

<main>
  <h1>Robin reference rig</h1>
  <p>Production reference-rig idle and blink. Tilt and new articulation are deferred.</p>
  {#if error}<p role="alert">{error}; evidence previews unavailable.</p>{/if}
  <label>Clip <select bind:value={name}>{#each Object.keys(clips) as clip}<option>{clip}</option>{/each}</select></label>
  <label>Elapsed (ms) <input type="number" min="0" bind:value={elapsed} /></label>
  <label><input type="checkbox" bind:checked={reduced} /> Reduced motion</label>
  <label><input type="checkbox" bind:checked={mirrored} /> Mirror</label>
  <label><input type="checkbox" bind:checked={overlay} /> Reference overlay</label>
  <output data-rig-frame>{selected}</output>
  <div class="preview" style="transform: scaleX({mirrored ? -1 : 1})">
    <div class="zoom"><RobinArt frame={selected} {reduced} />
      {#if overlay}<img class="reference" src={reference} alt="Reference overlay" width="128" height="112" />{/if}
    </div>
  </div>
  <h2>Accepted native cells</h2>
  {#each ids as id}<figure><figcaption>{id} — reference preserved</figcaption>{#if files[id + '.webp']}<img src={files[id + '.webp']} alt={id} width="128" height="112" />{/if}</figure>{/each}
  {#if files['masks.png']}<img src={files['masks.png']} alt="Draft cut-out ownership masks" width="128" height="112" />{/if}
  <h2>Contact sheets and previews</h2>
  {#each Object.entries(clips) as [clipName, clip]}
    <p>{clipName}: {clip.frames.join(' → ')} ({clip.durations.join('/')} ms)</p>
    {#if files[clipName + '-contact.png']}<img src={files[clipName + '-contact.png']} alt={clipName + ' ordered contact sheet'} />{/if}
    {#if files[clipName + '.gif']}<img src={files[clipName + '.gif']} alt={clipName + ' preview'} />{/if}
  {/each}
</main>

<style>
  main { padding: 24px; }
  label { display: block; margin: 12px 0; }
  output { display: block; font: 24px monospace; }
  figure { display: inline-block; margin: 8px; }
  img { max-width: none; }
  .preview { width: 180px; height: 160px; background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 / 16px 16px; }
  .zoom { position: relative; transform: scale(4); transform-origin: 0 0; }
  .reference { position: absolute; top: 0; left: 0; width: 44.8px; height: 39.2px; opacity: .5; pointer-events: none; }
</style>
