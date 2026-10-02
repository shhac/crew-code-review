<script lang="ts">
  // Candles and pumpkins on the rail's empty stretch above the identity chip.
  // The art is static; the flames and the pumpkins' glow are what move.
  import candles from './candles.webp';
  import Flame from './Flame.svelte';
  import pumpkins from './pumpkins.webp';

  // Wick tips as fractions of candles.webp, measured from the art. Regenerate
  // the art and these must be measured again.
  const wicks = [
    { x: 0.188, y: 0.0, beat: 1.3, delay: 0 },
    { x: 0.487, y: 0.225, beat: 1.05, delay: -0.4 },
    { x: 0.825, y: 0.474, beat: 1.6, delay: -0.9 },
  ];
</script>

<div class="theme-shelf" aria-hidden="true">
  <div class="candles">
    <img src={candles} alt="" width="76" height="67" />
    {#each wicks as w}
      <span class="wick" style="left: {w.x * 100}%; top: {w.y * 100}%"><Flame beat={w.beat} delay={w.delay} /></span>
    {/each}
  </div>
  <div class="pumpkins">
    <span class="glow"></span>
    <img src={pumpkins} alt="" width="124" height="83" />
  </div>
</div>

<style>
  .theme-shelf {
    display: flex; align-items: flex-end; justify-content: center;
    padding-top: 22px; pointer-events: none; user-select: none;
  }
  img { display: block; position: relative; }
  .candles { position: relative; margin-right: -8px; }
  .pumpkins { position: relative; }

  .wick { position: absolute; width: 0; height: 0; }
  .glow {
    position: absolute; inset: 8% 4% -6%; border-radius: 50%;
    background: radial-gradient(ellipse at 50% 60%, rgba(255, 150, 40, .32), rgba(255, 120, 20, 0) 68%);
    animation: breathe 2.4s ease-in-out infinite alternate;
  }
  .pumpkins img { animation: candlelit 3.1s ease-in-out infinite alternate; }

  @keyframes breathe { from { opacity: .65; } to { opacity: 1; } }
  @keyframes candlelit { from { filter: brightness(.96); } to { filter: brightness(1.07); } }

  @media (prefers-reduced-motion: reduce) {
    .glow, .pumpkins img { animation: none; }
  }
</style>
