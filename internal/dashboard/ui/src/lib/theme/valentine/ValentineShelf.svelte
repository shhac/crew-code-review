<script lang="ts">
  // A box of chocolates, a single rose and a heart-shaped card on the rail's
  // empty stretch above the identity chip. The cupids keep to the page, so
  // the rail's sky stays empty this month.
  import kit from './valentine-kit.webp';
</script>

<div class="theme-shelf valentine-shelf" aria-hidden="true">
  <div class="stage">
    <img class="kit" src={kit} alt="" width="100" height="70" />
  </div>
</div>

<style>
  .valentine-shelf { position: relative; display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .stage { position: relative; width: 168px; height: 72px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .kit { left: 34px; bottom: 0; }
</style>
