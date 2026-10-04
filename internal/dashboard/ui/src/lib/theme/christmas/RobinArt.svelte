<script lang="ts">
  import { onMount } from 'svelte';
  import alert from './robin-alert.webp';
  import flight from './robin-flight.webp';
  import wing from './robin-flight-wing.webp';
  import AtlasFrame from './AtlasFrame.svelte';
  import { loadIdleAssets, type IdleAssets } from './idle-assets';
  import { idleManifestText, idleAssetUrls } from './idle-inventory';

  export let pose: 'perch' | 'alert' | 'flight' = 'perch';
  export let frame = 'I0';
  export let reduced = false;
  let assets: IdleAssets | null = null;
  let status = 'loading';
  let legacyFailed = false;
  $: if (pose) legacyFailed = false;
  $: selected = reduced ? 'I0' : frame;
  $: rectangle = assets && Object.hasOwn(assets.manifest.frames, selected) ? assets.manifest.frames[selected] : null;
  $: sheet = rectangle ? assets?.urls[rectangle.sheet] ?? null : null;
  onMount(() => {
    const abort = new AbortController();
    let loaded: IdleAssets | null = null;
    void loadIdleAssets(idleManifestText, idleAssetUrls, abort.signal).then(result => {
      if (abort.signal.aborted) { result.release(); return; }
      loaded = result; assets = result; status = 'ready';
    }).catch(() => { if (!abort.signal.aborted) status = 'fallback'; });
    return () => { abort.abort(); loaded?.release(); };
  });
</script>

<!-- Native art cells keep a shared foot anchor; the parent mirrors the assembly. -->
<div class="robin-art" data-robin-assets={status}>
  {#if pose !== 'perch' && !reduced && !legacyFailed}
    <div class="art-cell">
      <img class="bird-body" src={pose === 'flight' ? flight : alert} alt="" width="128" height="112" on:error={() => legacyFailed = true} />
      {#if pose === 'flight'}
        <img class="raised-wing" src={wing} alt="" width="128" height="112" on:error={() => legacyFailed = true} />
      {/if}
    </div>
  {:else}
    <AtlasFrame {sheet} {rectangle} frame={selected} />
  {/if}
</div>

<style>
  .robin-art { position: relative; width: 44.8px; height: 39.2px; }
  .art-cell { position: absolute; width: 128px; height: 112px; transform: scale(.35); transform-origin: 0 0; }
  img { position: absolute; inset: 0; display: block; width: 128px; height: 112px; max-width: none; }
  .raised-wing { transform: rotate(var(--wing, 0deg)); transform-origin: 64px 57px; transform-box: border-box; }
</style>
