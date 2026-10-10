<script lang="ts">
  // A clump of native bluebells growing out of a mossy mound, with oak
  // leaves, a twig and a fern unrolling, on the rail's empty stretch above
  // the identity chip. Growing, not picked. Still art: the bees come to it
  // through the rail's air, from the page.
  import { SHELF } from './art';
  import shelf from './bluebell-shelf.webp';
</script>

<div class="theme-shelf bluebells-shelf" aria-hidden="true">
  <div class="stage">
    <img class="flowers" data-bluebell-shelf src={shelf} alt="" style="width: {SHELF.width}px; height: {SHELF.height}px" />
  </div>
</div>

<style>
  .bluebells-shelf { position: relative; display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .stage { position: relative; width: 168px; height: 72px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .flowers { left: 26px; top: 0; }
</style>
