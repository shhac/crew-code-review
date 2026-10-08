<script lang="ts">
  // A thermos, a bobble hat, mittens and a mug of cocoa on a snow drift on
  // the rail's empty stretch above the identity chip, and the northern lights
  // in the rail's sky above them. The aurora stays inside the sky, never over
  // the page.
  import { onMount } from 'svelte';
  import { sceneLoop } from '../lifecycle';
  import { hash } from '../seed';
  import { measureRailSky, watchRailSky } from '../sky';
  import { curtains, rays, roomy, STILL, type Curtain, type Ray, type Sky } from './aurora';
  import winterKit from './winter-kit.webp';

  const STARS = Array.from({ length: 14 }, (_, i) => ({ x: hash(i * 7 + 1), y: hash(i * 13 + 2), r: 0.6 + 0.5 * hash(i * 3 + 5), delay: -6 * hash(i + 9) }));

  let root: HTMLElement;
  let sky: Sky = { width: 0, height: 0 };
  let shown: Curtain[] = [];
  let shimmer: Ray[] = [];

  const measure = () => { sky = measureRailSky(root) ?? { width: 0, height: 0 }; };

  onMount(() => {
    measure();
    const loop = sceneLoop((now, reduced) => {
      if (!roomy(sky)) { shown = []; shimmer = []; return; }
      shown = curtains(sky, reduced ? STILL : now);
      shimmer = rays(sky, reduced ? STILL : now);
    }, () => {});
    const stopWatching = watchRailSky(root, () => { measure(); loop.invalidate(); });
    return () => { loop.stop(); stopWatching(); };
  });
</script>

<div class="theme-shelf aurora-shelf" aria-hidden="true" bind:this={root}>
  {#if roomy(sky)}
    <svg class="sky" width={sky.width} height={sky.height} viewBox="0 0 {sky.width} {sky.height}">
      <defs>
        <mask id="aurora-mask">
          <rect width={sky.width} height={sky.height} fill="#fff" opacity=".5" />
          {#each shimmer as r}<rect x={r.x} width={r.width} height={sky.height} fill="#fff" opacity={r.opacity} />{/each}
        </mask>
        <!-- The curtains thin out toward the rail's edges rather than stop at them. -->
        <linearGradient id="aurora-fade">
          <stop offset="0" stop-color="#fff" stop-opacity="0" />
          <stop offset=".2" stop-color="#fff" stop-opacity="1" />
          <stop offset=".8" stop-color="#fff" stop-opacity="1" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <mask id="aurora-edges"><rect width={sky.width} height={sky.height} fill="url(#aurora-fade)" /></mask>
        <filter id="aurora-soft"><feGaussianBlur stdDeviation="1.5" /></filter>
        {#each shown as c, i}
          <linearGradient id="aurora-curtain-{i}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color={c.colour} stop-opacity="0" />
            <stop offset=".6" stop-color={c.colour} stop-opacity=".6" />
            <stop offset="1" stop-color={c.colour} stop-opacity="1" />
          </linearGradient>
        {/each}
      </defs>
      {#each STARS as s}
        <circle class="star" cx={s.x * sky.width} cy={s.y * sky.height * 0.7} r={s.r} style="animation-delay: {s.delay}s" />
      {/each}
      <g mask="url(#aurora-edges)">
        <g mask="url(#aurora-mask)" filter="url(#aurora-soft)">
          {#each shown as c, i}
            <path class="curtain" d={c.d} fill="url(#aurora-curtain-{i})" opacity={c.opacity} />
          {/each}
        </g>
      </g>
    </svg>
  {/if}
  <div class="stage">
    <svg class="drift" width="168" height="14" viewBox="0 0 168 14">
      <path d="M4 14C14 6 30 5 46 7S78 3 98 5 136 4 150 7 166 11 166 14Z" fill="#e6f1f7" />
      <path d="M22 8C34 5 46 6 56 7" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".8" />
    </svg>
    <img class="kit" src={winterKit} alt="" width="124" height="62" />
  </div>
</div>

<style>
  .aurora-shelf { position: relative; display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .sky { position: absolute; left: 0; bottom: 100%; overflow: hidden; }
  .stage { position: relative; width: 168px; height: 72px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .kit { left: 22px; top: 0; }
  .drift { position: absolute; left: 0; bottom: 0; }
  .star { fill: #e8f6ff; opacity: .5; animation: twinkle 3.2s ease-in-out infinite alternate; }
  @keyframes twinkle { from { opacity: .2; } to { opacity: .6; } }
  @media (prefers-reduced-motion: reduce) {
    .star { animation: none; opacity: .4; }
  }
</style>
