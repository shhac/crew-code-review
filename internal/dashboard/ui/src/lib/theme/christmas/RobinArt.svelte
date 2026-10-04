<script lang="ts">
  import { onMount } from 'svelte';
  import alert from './robin-alert.webp';
  import flight from './robin-flight.webp';
  import wing from './robin-flight-wing.webp';
  import AtlasFrame from './AtlasFrame.svelte';
  import { loadIdleAssets, type IdleAssets } from './idle-assets';
  import { idleManifestText, idleAssetUrls } from './idle-inventory';
  import { atlasManifestText, atlasAssetUrls, atlasFallbackUrl } from './atlas-inventory';

  export let pose: 'perch' | 'alert' | 'flight' = 'perch';
  export let frame = 'I0';
  export let atlasFrame = 'I0';
  export let reduced = false;
  const stillFallback = atlasFallbackUrl();
  let assets: IdleAssets | null = null;
  let atlas: IdleAssets | null = null;
  let atlasStatus = 'loading';
  let status = 'loading';
  let legacyFailed = false;
  $: if (pose) legacyFailed = false;
  $: active = atlas ?? assets;
  $: selected = reduced ? 'I0' : atlas ? atlasFrame : frame;
  $: rectangle = active && Object.hasOwn(active.manifest.frames, selected) ? active.manifest.frames[selected] : null;
  $: sheet = rectangle ? active?.urls[rectangle.sheet] ?? null : null;
  const failedSheet = () => {
    if (atlas) { atlas.release(); atlas = null; atlasStatus = 'fallback'; }
    else if (assets) { assets.release(); assets = null; status = 'fallback'; }
  };
  onMount(() => {
    const abort = new AbortController();
    let loaded: IdleAssets | null = null;
    let loadedAtlas: IdleAssets | null = null;
    void loadIdleAssets(idleManifestText, idleAssetUrls, abort.signal).then(result => {
      if (abort.signal.aborted) { result.release(); return; }
      loaded = result; assets = result; status = 'ready';
    }).catch(() => { if (!abort.signal.aborted) status = 'fallback'; });
    void loadIdleAssets(atlasManifestText, atlasAssetUrls, abort.signal).then(result => {
      if (abort.signal.aborted) { result.release(); return; }
      loadedAtlas = result; atlas = result; atlasStatus = 'ready';
    }).catch(() => { if (!abort.signal.aborted) atlasStatus = 'fallback'; });
    return () => { abort.abort(); loaded?.release(); loadedAtlas?.release(); };
  });
</script>

<!-- Native art cells keep a shared foot anchor; the parent mirrors the assembly. -->
<div class="robin-art" data-robin-assets={status} data-robin-atlas={atlasStatus}>
  {#if pose !== 'perch' && !reduced && !legacyFailed}
    <div class="art-cell">
      <img class="bird-body" src={pose === 'flight' ? flight : alert} alt="" width="128" height="112" on:error={() => legacyFailed = true} />
      {#if pose === 'flight'}
        <img class="raised-wing" src={wing} alt="" width="128" height="112" on:error={() => legacyFailed = true} />
      {/if}
    </div>
  {:else}
    <AtlasFrame {sheet} {rectangle} frame={selected} fallback={stillFallback} onFailure={failedSheet} />
  {/if}
</div>

<style>
  .robin-art { position: relative; width: 44.8px; height: 39.2px; }
  .art-cell { position: absolute; width: 128px; height: 112px; transform: scale(.35); transform-origin: 0 0; }
  img { position: absolute; inset: 0; display: block; width: 128px; height: 112px; max-width: none; }
  .raised-wing { transform: rotate(var(--wing, 0deg)); transform-origin: 64px 57px; transform-box: border-box; }
</style>
