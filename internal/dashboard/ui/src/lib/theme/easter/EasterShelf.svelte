<script lang="ts">
  // A wicker basket of painted eggs and three chicks on a strip of spring
  // grass, on the rail's empty stretch above the identity chip. Still art:
  // the hunt and the rabbits are on the page.
  import basket from './basket.webp';

  // Blades along the strip, seeded by position so they never reshuffle.
  const BLADES = Array.from({ length: 22 }, (_, i) => {
    const x = 6 + i * 7.4 + 3 * Math.sin(i * 2.3);
    const tall = 4 + 3 * Math.abs(Math.sin(i * 1.7));
    return `M${x.toFixed(1)} 10q${(1.5 * Math.sin(i)).toFixed(1)} ${(-tall / 2).toFixed(1)} ${(2 * Math.sin(i * 3)).toFixed(1)} ${(-tall).toFixed(1)}`;
  });
</script>

<div class="theme-shelf easter-shelf" aria-hidden="true">
  <div class="stage">
    <svg class="grass" width="168" height="12" viewBox="0 0 168 12">
      <path d="M2 12C16 7 40 7 60 8S110 6 130 8 162 9 166 12Z" fill="#5f9b3a" />
      <path class="blades" d={BLADES.join('')} />
    </svg>
    <img class="basket" src={basket} alt="" width="141" height="64" />
  </div>
</div>

<style>
  .easter-shelf { position: relative; display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .stage { position: relative; width: 168px; height: 72px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .basket { left: 14px; top: 0; }
  .grass { position: absolute; left: 0; bottom: 0; }
  .blades { fill: none; stroke: #79b84a; stroke-width: 1.2; stroke-linecap: round; }
</style>
