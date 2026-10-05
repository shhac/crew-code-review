<script lang="ts">
  import RobinArt from '../lib/theme/christmas/RobinArt.svelte';
  import holly from '../lib/theme/christmas/holly.webp';
  import pumpkins from '../lib/theme/halloween/pumpkins.webp';
  import candles from '../lib/theme/halloween/candles.webp';
  import spider from '../lib/theme/halloween/spider-body.webp';
  import ChristmasShelf from '../lib/theme/christmas/ChristmasShelf.svelte';
  import HalloweenShelf from '../lib/theme/halloween/HalloweenShelf.svelte';

  const poses = ['perch', 'alert', 'flight'] as const;
  const backgrounds = ['dark', 'white', 'checker'] as const;
</script>

<main>
  <h1>Christmas / Halloween artwork</h1>
  <p>Production layered robin, both directions and three flight stages. Each pair uses the same background and magnification.</p>
  {#each backgrounds as background}
    {#each [1, 4] as zoom}
      <section class={background} aria-label="{background}, {zoom}×">
        <h2>{background}, {zoom}×</h2>
        <div class="shelf-comparison" style="height: {105 * zoom}px; grid-template-columns: repeat(2, {192 * zoom}px)">
          <div style="transform: scale({zoom}); transform-origin: 0 0"><ChristmasShelf /></div>
          <div style="transform: scale({zoom}); transform-origin: 0 0"><HalloweenShelf /></div>
        </div>
        <div class="comparison">
          <div>
            {#each poses as pose}
              {#each [1, -1] as direction}
                {#each pose === 'flight' ? [0, 150, 300] : [0] as elapsed}
                  <figure>
                    <figcaption>{pose}, {direction}, {elapsed}ms</figcaption>
                    <div class="sample" style="width: {44.8 * zoom}px; height: {39.2 * zoom}px">
                      <div class="bird" data-art-pose={pose} data-direction={direction} data-elapsed={elapsed} data-zoom={zoom}
                        style="transform: scale({zoom}); transform-origin: 0 0">
                        <div class="facing" style="transform: scaleX({direction}); transform-origin: 22.4px 35.735px"><RobinArt {pose} {elapsed} /></div>
                      </div>
                    </div>
                  </figure>
                {/each}
              {/each}
            {/each}
            <figure><figcaption>holly, 48×32</figcaption><img class="holly" src={holly} alt="" width="48" height="32" style="width: {48 * zoom}px; height: {32 * zoom}px" /></figure>
          </div>
          <div class="halloween">
            <figure><figcaption>pumpkins</figcaption><img src={pumpkins} alt="" width="124" height="83" style="width: {124 * zoom}px; height: {83 * zoom}px" /></figure>
            <figure><figcaption>candles</figcaption><img src={candles} alt="" width="76" height="67" style="width: {76 * zoom}px; height: {67 * zoom}px" /></figure>
            <figure><figcaption>spider body (40px study)</figcaption><img src={spider} alt="" width="40" style="width: {40 * zoom}px" /></figure>
          </div>
        </div>
      </section>
    {/each}
  {/each}
</main>

<style>
  main { padding: 16px; max-width: none; }
  section { padding: 12px; margin: 16px 0; overflow: auto; }
  h2, figcaption { color: inherit; }
  .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; min-width: 400px; }
  .shelf-comparison { display: grid; gap: 24px; width: max-content; }
  .shelf-comparison > div { width: 192px; }
  figure { margin: 12px 0; }
  figcaption { font: 12px monospace; margin-bottom: 8px; }
  .sample { position: relative; }
  .bird { position: absolute; width: 44.8px; height: 39.2px; }
  img { display: block; max-width: none; }
  .dark { background: #171b1b; color: #eee; }
  .white { background: white; color: #222; }
  .checker { background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 / 16px 16px; color: #222; }
</style>
