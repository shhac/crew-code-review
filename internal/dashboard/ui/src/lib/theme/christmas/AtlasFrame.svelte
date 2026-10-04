<script lang="ts">
  import perch from './robin-perch.webp';
  import type { Frame } from './manifest';

  export let sheet: string | null = null;
  export let rectangle: Frame | null = null;
  export let frame = 'I0';
  let failed = false;
  $: if (sheet) failed = false;
  $: usable = !!sheet && !!rectangle && !failed;
</script>

<!-- One absolute rectangle, no transform tween or crossfade. Parent owns facing. -->
<div class="robin-art" data-atlas-frame={usable ? frame : 'I0'}>
  <div class="art-cell">
    {#if sheet && rectangle && usable}
      <div class="frame-window">
        <img class="bird-body atlas-sheet" src={sheet} alt="" on:error={() => failed = true}
          style="left: {-rectangle.x}px; top: {-rectangle.y}px" />
      </div>
    {:else}
      <img class="bird-body fallback" src={perch} alt="" width="128" height="112" />
    {/if}
  </div>
</div>

<style>
  .robin-art { position: relative; width: 44.8px; height: 39.2px; pointer-events: none; }
  .art-cell { position: absolute; width: 128px; height: 112px; transform: scale(.35); transform-origin: 0 0; }
  .frame-window { position: relative; width: 128px; height: 112px; overflow: hidden; }
  img { position: absolute; display: block; max-width: none; }
  .fallback { inset: 0; width: 128px; height: 112px; }
</style>
