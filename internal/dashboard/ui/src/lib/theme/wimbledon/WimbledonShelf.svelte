<script lang="ts">
  // A bowl of strawberries and cream, a jug of fruit cup and an old wooden
  // racquet with a ball, on a strip of mown lawn, on the rail's empty stretch
  // above the identity chip. Still art: the pigeons, the hawk and the rally
  // are on the page, and the rail's sky stays empty this month.
  import kit from './summer-kit.webp';

  // The lawn's mown stripes, light and dark in turn, as a striped court
  // looks from the side, with a baseline chalked along the front.
  const STRIPES = Array.from({ length: 7 }, (_, i) => ({ x: 4 + i * 23, light: i % 2 === 0 }));
</script>

<div class="theme-shelf wimbledon-shelf" aria-hidden="true">
  <div class="stage">
    <svg class="lawn" width="168" height="12" viewBox="0 0 168 12">
      <defs><clipPath id="wimbledon-lawn"><path d="M2 12C10 6 30 5 84 5S158 6 166 12Z" /></clipPath></defs>
      <g clip-path="url(#wimbledon-lawn)">
        <rect width="168" height="12" fill="#4f8f3a" />
        {#each STRIPES as s}{#if s.light}<rect x={s.x} width="23" height="12" fill="#67a84a" />{/if}{/each}
        <path class="chalk" d="M10 9.6H158" />
      </g>
    </svg>
    <img class="kit" src={kit} alt="" width="140" height="55" />
  </div>
</div>

<style>
  .wimbledon-shelf { position: relative; display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .stage { position: relative; width: 168px; height: 64px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .kit { left: 14px; top: 5px; }
  .lawn { position: absolute; left: 0; bottom: 0; }
  .chalk { stroke: #f4f4ec; stroke-width: 1.2; opacity: .75; }
</style>
