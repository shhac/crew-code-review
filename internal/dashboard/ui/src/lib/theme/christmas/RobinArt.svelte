<script lang="ts">
  import perch from './robin-perch.webp';
  import alert from './robin-alert.webp';
  import flight from './robin-flight.webp';
  import wing from './robin-flight-wing.webp';

  export let pose: 'perch' | 'alert' | 'flight' = 'perch';
</script>

<!-- Native art cells keep a shared foot anchor; the parent mirrors the assembly. -->
<div class="robin-art">
  <div class="art-cell">
    <img class="bird-body" src={pose === 'flight' ? flight : pose === 'alert' ? alert : perch} alt="" width="128" height="112" />
    {#if pose === 'flight'}
      <img class="raised-wing" src={wing} alt="" width="128" height="112" />
    {/if}
  </div>
</div>

<style>
  .robin-art { position: relative; width: 44.8px; height: 39.2px; }
  .art-cell { position: absolute; width: 128px; height: 112px; transform: scale(.35); transform-origin: 0 0; }
  img { position: absolute; inset: 0; display: block; width: 128px; height: 112px; max-width: none; }
  .raised-wing { transform: rotate(var(--wing, 0deg)); transform-origin: 64px 57px; transform-box: border-box; }
</style>
