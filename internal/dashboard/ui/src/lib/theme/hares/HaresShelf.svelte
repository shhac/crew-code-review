<script lang="ts">
  // A pot of daffodils on the rail's empty stretch above the identity chip,
  // with a few tufts of the page's grass at its foot stirring in the breeze.
  // The art is still; only the grass moves, and not under reduced motion.
  import daffodils from './daffodils.webp';
  import { bladePath, type Blade } from './grass';

  // Tufts either side of the pot: x in the stage, and each blade as the
  // ledges' grass draws them, a little taller here beside the pot.
  const blade = (dx: number, lean: number, height: number, tone: number): Blade => ({ dx, lean, height, width: 1.8, tone });
  const tufts = [
    { x: 30, delay: -0.9, blades: [blade(-1.2, -16, 7, 0.6), blade(1.2, 12, 9, 0.2)] },
    { x: 41, delay: 0, blades: [blade(-1.6, -20, 9, 0.2), blade(-0.5, -6, 13, 0.7), blade(0.6, 6, 11, 0.4), blade(1.6, 22, 8, 0.9)] },
    { x: 52, delay: -1.3, blades: [blade(-1, -14, 8, 0.9), blade(1, 10, 10, 0.1)] },
    { x: 116, delay: -0.6, blades: [blade(-1.4, -14, 10, 0.5), blade(0, 4, 13, 0.3), blade(1.4, 20, 9, 0.8)] },
    { x: 127, delay: -2.1, blades: [blade(-1, -8, 8, 0.6), blade(1, 14, 7, 0.2)] },
    { x: 138, delay: -1.6, blades: [blade(-1.2, -18, 6, 0.3), blade(0, 2, 9, 0.8), blade(1.2, 16, 7, 0.5)] },
  ];
  // Two greens, so the blades of a tuft read as separate.
  const green = (tone: number) => (tone < 0.5 ? '#6fa83c' : '#8cc152');
</script>

<div class="theme-shelf hares-shelf" aria-hidden="true">
  <div class="stage">
    <img class="pot" src={daffodils} alt="" width="57" height="88" />
    <svg class="grass" width="168" height="16" viewBox="0 -14 168 16">
      {#each tufts as t}
        <g transform="translate({t.x} 0)">
          <g class="tuft" style="animation-delay: {t.delay}s">
            {#each t.blades as b}<path d={bladePath(b)} fill={green(b.tone)} />{/each}
          </g>
        </g>
      {/each}
    </svg>
  </div>
</div>

<style>
  .hares-shelf { display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .stage { position: relative; width: 168px; height: 88px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .pot { left: 56px; top: 0; }
  .grass { position: absolute; left: 0; bottom: 0; overflow: visible; }
  /* Swaying about the tuft's foot. */
  .tuft { transform-box: fill-box; transform-origin: 50% 100%; animation: breeze 4.2s ease-in-out infinite alternate; }
  @keyframes breeze { from { rotate: -4deg; } to { rotate: 4deg; } }
  @media (prefers-reduced-motion: reduce) {
    .tuft { animation: none; }
  }
</style>
