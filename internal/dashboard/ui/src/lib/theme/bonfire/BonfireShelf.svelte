<script lang="ts">
  // A bonfire with its guy and a plate of toffee apples on the rail's empty
  // stretch above the identity chip, and fireworks in the dark rail above
  // them. The art is unlit; the flames, sparks and fireworks are drawn here.
  // Fireworks stay inside the rail's free space, never over the page.
  import { onMount } from 'svelte';
  import { sceneLoop } from '../lifecycle';
  import bonfire from './bonfire.webp';
  import toffeeApples from './toffee-apples.webp';
  import { LIFE, nextBurst, rocket, roomy, sparks, stillBurst, type Burst, type Sky, type Spark } from './fireworks';

  // Flame tongues along the base of the stack, in the stage's pixels: x, the
  // tongue's height, its beat and delay. Measured against bonfire.webp's
  // logs; regenerated art means placing them again.
  const tongues = [
    [24, 18, 1.1, 0], [33, 26, 1.4, -0.5], [42, 30, 1.2, -0.2], [51, 24, 1.5, -0.8], [60, 16, 1.0, -0.3],
  ];
  const embers = [[30, 0], [40, -1.3], [48, -0.6], [36, -2.1], [55, -1.7]];

  let root: HTMLElement;
  let sky: Sky = { width: 0, height: 0 };
  let shown: Spark[] = [];
  let colour = '#f4c25b';
  let trail: ReturnType<typeof rocket> = null;

  // The free space between the nav and this shelf; none when the shelf is
  // hidden on a cramped rail.
  function measure() {
    const nav = root?.previousElementSibling;
    if (!root || !nav || root.offsetParent === null) { sky = { width: 0, height: 0 }; return; }
    const room = root.getBoundingClientRect().top - nav.getBoundingClientRect().bottom - 16;
    sky = { width: root.clientWidth, height: Math.max(0, Math.min(240, room)) };
  }

  onMount(() => {
    let burst: Burst | null = null;
    measure();
    const loop = sceneLoop((now, reduced) => {
      if (!roomy(sky)) { shown = []; trail = null; burst = null; return; }
      if (reduced) { shown = stillBurst(sky); colour = '#f4c25b'; trail = null; return; }
      if (!burst || now > burst.at + LIFE) burst = nextBurst(now, sky, Math.random);
      const next = sparks(burst, now);
      // Nothing to redraw for most of the wait between bursts.
      if (next.length || shown.length) shown = next;
      colour = burst.colour;
      trail = rocket(burst, sky, now);
    }, () => { burst = null; });
    const resized = () => { measure(); loop.invalidate(); };
    // In a full-height rail, the brand settling or the nav gaining its
    // leaderboard link moves the sky's top edge without resizing the rail,
    // so watch everything in it.
    const observer = new ResizeObserver(resized);
    [root.parentElement, ...(root.parentElement?.children ?? [])].forEach((el) => el && observer.observe(el));
    addEventListener('resize', resized);
    return () => { loop.stop(); observer.disconnect(); removeEventListener('resize', resized); };
  });
</script>

<div class="theme-shelf bonfire-shelf" aria-hidden="true" bind:this={root}>
  {#if roomy(sky)}
    <svg class="sky" width={sky.width} height={sky.height} viewBox="0 0 {sky.width} {sky.height}">
      {#if trail}
        <line x1={trail.x} y1={trail.y1} x2={trail.x} y2={trail.y2} stroke="#ffd9a0" stroke-width="1.2" stroke-linecap="round" opacity={trail.opacity} />
      {/if}
      {#each shown as s}
        <line x1={s.tx} y1={s.ty} x2={s.x} y2={s.y} stroke={colour} stroke-width={s.r * 2} stroke-linecap="round" opacity={s.opacity} />
      {/each}
    </svg>
  {/if}
  <div class="stage">
    <span class="glow"></span>
    <img class="bonfire" src={bonfire} alt="" width="80" height="92" />
    <svg class="flames" width="88" height="40" viewBox="0 0 88 40">
      {#each tongues as [x, h, beat, delay]}
        <g class="tongue" style="--beat: {beat}s; --delay: {delay}s; transform-origin: {x}px 40px">
          <path d="M{x} {40 - h}C{x + 3} {40 - h * 0.6} {x + 7} {40 - h * 0.35} {x + 7} 34A7 6 0 0 1 {x - 7} 34C{x - 7} {40 - h * 0.35} {x - 3} {40 - h * 0.6} {x} {40 - h}Z" fill="#ff8a2a" />
          <path d="M{x} {40 - h * 0.55}C{x + 2} {40 - h * 0.35} {x + 4} {40 - h * 0.2} {x + 4} 35A4 4 0 0 1 {x - 4} 35C{x - 4} {40 - h * 0.2} {x - 2} {40 - h * 0.35} {x} {40 - h * 0.55}Z" fill="#ffe27a" />
        </g>
      {/each}
    </svg>
    {#each embers as [x, delay]}
      <span class="spark" style="left: {x}px; --delay: {delay}s"></span>
    {/each}
    <img class="apples" src={toffeeApples} alt="" width="54" height="34" />
  </div>
</div>

<style>
  .bonfire-shelf { position: relative; display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .sky { position: absolute; left: 0; bottom: 100%; overflow: hidden; }
  .stage { position: relative; width: 168px; height: 92px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .bonfire { left: 4px; top: 0; }
  .apples { left: 108px; bottom: 0; }
  .flames { position: absolute; left: 0; top: 54px; overflow: visible; }
  .tongue { animation: lick var(--beat) ease-in-out var(--delay) infinite alternate; }
  .glow {
    position: absolute; left: -24px; top: 30px; width: 136px; height: 76px; border-radius: 50%;
    background: radial-gradient(ellipse at 50% 70%, rgba(255, 140, 40, .3), rgba(255, 110, 20, 0) 70%);
    animation: breathe 2.2s ease-in-out infinite alternate;
  }
  .spark {
    position: absolute; top: 70px; width: 2px; height: 2px; border-radius: 50%; opacity: 0;
    background: #ffd27a; box-shadow: 0 0 3px rgba(255, 190, 90, .8);
    animation: rise 2.6s ease-out var(--delay) infinite;
  }
  @keyframes lick {
    0% { transform: scale(1, 1) skewX(0deg); }
    40% { transform: scale(.92, 1.12) skewX(-5deg); }
    100% { transform: scale(1.05, .9) skewX(4deg); }
  }
  @keyframes breathe { from { opacity: .7; } to { opacity: 1; } }
  @keyframes rise {
    0% { transform: translate(0, 0); opacity: 0; }
    15% { opacity: .9; }
    100% { transform: translate(6px, -64px); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tongue, .glow { animation: none; }
    .spark { display: none; }
  }
</style>
