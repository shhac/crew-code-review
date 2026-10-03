<script lang="ts">
  import tree from './tree.webp';
  import presents from './presents.webp';

  // Bright-core centroids measured on the canonical 176×166 tree (see shelf evidence).
  const lights = [
    [54.85, 71.21, 2.7, 0], [79.47, 66.83, 3.4, -1.1],
    [102.54, 55.92, 2.9, -2], [68.32, 94.95, 3.8, -.6],
    [101.25, 102.75, 3.1, -2.5], [127.55, 103.67, 4.1, -1.7],
    [79.79, 127.36, 3.6, -3],
  ];
</script>

<div class="theme-shelf christmas-shelf" aria-hidden="true">
  <div class="shelf-stage">
    <img class="tree" src={tree} alt="" width="88" height="83" />
    {#each lights as [x, y, beat, delay]}
      <span class="fairy-light" style="left: {x / 2}px; top: {y / 2}px; --beat: {beat}s; --delay: {delay}s"></span>
    {/each}
    <img class="presents" src={presents} alt="" width="124" height="66" />
  </div>
</div>

<style>
  .christmas-shelf { display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .shelf-stage { position: relative; width: 192px; height: 83px; flex: none; }
  img { display: block; position: absolute; }
  .tree { left: 0; top: 0; }
  .presents { left: 68px; top: 17px; }
  .fairy-light {
    position: absolute; width: 8px; height: 8px; border-radius: 50%;
    transform: translate(-50%, -50%); pointer-events: none;
    background: radial-gradient(circle, #fff0bf 0%, rgba(255, 202, 100, .8) 20%, rgba(255, 180, 60, 0) 70%);
    animation: twinkle var(--beat) ease-in-out var(--delay) infinite alternate;
  }
  @keyframes twinkle { from { opacity: .35; } to { opacity: .70; } }
  @media (prefers-reduced-motion: reduce) {
    .fairy-light { animation: none; opacity: .5; }
  }
</style>
