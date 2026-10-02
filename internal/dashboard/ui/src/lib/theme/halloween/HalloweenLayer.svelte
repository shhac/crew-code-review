<script lang="ts">
  // Everything Halloween that floats over the page: corner webs, a spider
  // hanging from one, two more that roam the tops of the cards, and candle
  // stubs left burning on those same floors. The layer
  // takes no pointer events, so nothing here can stand between a person and a
  // button.
  import { onMount } from 'svelte';
  import { candleSpots, type CandleSpot } from '../candles';
  import { measureFloors } from '../floors';
  import { away, pose, step, type Pose, type Spider as Walker } from '../spiderwalk';
  import squatStub from './candle-stub-0.webp';
  import tallStub from './candle-stub-1.webp';
  import meltedStub from './candle-stub-2.webp';
  import Flame from './Flame.svelte';
  import Spider from './Spider.svelte';
  import Web from './Web.svelte';

  // walked is the distance its feet have covered, in the drawing's own
  // pixels: the legs step by it, so they never slide over the floor.
  type Crawler = { walker: Walker; scale: number; pose: Pose | null; walked: number };

  // Staggered so they do not arrive together, and the second is smaller so
  // the pair reads as two spiders rather than one twice.
  let crawlers: Crawler[] = [
    { walker: away(Math.random, 2, 5), scale: 1, pose: null, walked: 0 },
    { walker: away(Math.random, 12, 20), scale: 0.7, pose: null, walked: 0 },
  ];

  // Each stub's size on the page and its wick tip as a fraction across its
  // art: measured, so new art needs measuring too. The wick is the top edge.
  const STUBS = [
    { src: squatStub, width: 15, height: 13.75, wick: 0.5 },
    { src: tallStub, width: 13.5, height: 17.5, wick: 0.593 },
    { src: meltedStub, width: 19.75, height: 10, wick: 0.456 },
  ];

  let candles: CandleSpot[] = [];

  function measure() {
    const floors = measureFloors();
    candles = candleSpots(floors, STUBS.length);
    return floors;
  }

  // Only ground covered on foot counts; a landing or a re-measured floor can
  // move a spider further in one frame than any step, so that is capped.
  function stepped(from: Pose | null, to: Pose | null): number {
    if (!from || !to || from.hanging || to.hanging) return 0;
    return Math.min(4, Math.abs(to.x - from.x));
  }

  function advance(dt: number) {
    const floors = measure();
    const viewport = { width: innerWidth, height: innerHeight };
    crawlers = crawlers.map((c) => {
      const walker = step(c.walker, floors, viewport, dt, Math.random);
      const next = pose(walker, floors);
      return { ...c, walker, pose: next, walked: c.walked + stepped(c.pose, next) / c.scale };
    });
  }

  onMount(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const loop = { frame: 0, last: 0 };
    const tick = (now: number) => {
      // Capped so a backgrounded tab does not come back to one giant leap.
      advance(Math.min(0.1, (now - loop.last) / 1000));
      loop.last = now;
      loop.frame = requestAnimationFrame(tick);
    };
    // Without motion the spiders stay home, but the candles still have to
    // follow their floors as the page scrolls and changes.
    const still = { timer: 0 };
    const stopStill = () => {
      clearInterval(still.timer);
      removeEventListener('scroll', measure, true);
      removeEventListener('resize', measure);
    };
    const restart = () => {
      cancelAnimationFrame(loop.frame);
      stopStill();
      if (reduced.matches) {
        crawlers = crawlers.map((c) => ({ ...c, pose: null }));
        measure();
        addEventListener('scroll', measure, { capture: true, passive: true });
        addEventListener('resize', measure);
        still.timer = window.setInterval(measure, 1000);
        return;
      }
      loop.last = performance.now();
      loop.frame = requestAnimationFrame(tick);
    };
    reduced.addEventListener('change', restart);
    restart();
    return () => {
      cancelAnimationFrame(loop.frame);
      stopStill();
      reduced.removeEventListener('change', restart);
    };
  });
</script>

<div class="theme-layer" aria-hidden="true">
  <div class="web top-right"><div class="sway"><Web size={170} /></div></div>
  <div class="web bottom-right"><div class="sway"><Web size={120} /></div></div>

  <div class="resident">
    <span class="thread"></span>
    <div class="sprite hanging"><Spider hanging /></div>
  </div>

  {#each candles as c (c.key)}
    {@const stub = STUBS[c.stub]}
    <div class="candle" style="transform: translate({c.x}px, {c.y}px)">
      <img src={stub.src} alt="" width={stub.width} height={stub.height} style="left: {-stub.width / 2}px; top: {-stub.height}px" />
      <span class="wick" style="left: {(stub.wick - 0.5) * stub.width}px; top: {-stub.height + 1}px">
        <Flame width={6} beat={c.beat} delay={-c.beat / 2} />
      </span>
    </div>
  {/each}

  {#each crawlers as c, i}
    {#if c.pose?.hanging && c.pose.anchorY !== null}
      <!-- Thread and spider hang from one pivot, so they swing together. -->
      <div class="dangle" class:extra={i > 0} style="left: {c.pose.x}px; top: {c.pose.anchorY}px">
        <span class="thread" style="height: {c.pose.y - c.pose.anchorY}px"></span>
        <div class="crawler" style="transform: translate(0, {c.pose.y - c.pose.anchorY}px) scale({c.scale})">
          <div class="sprite hanging"><Spider moving={c.pose.moving} hanging /></div>
        </div>
      </div>
    {:else if c.pose}
      <div class="crawler" class:extra={i > 0} style="transform: translate({c.pose.x}px, {c.pose.y}px) scale({c.scale})">
        <div class="sprite" style="--dir: {c.pose.dir}">
          <Spider moving={c.pose.moving} walked={c.walked} />
        </div>
      </div>
    {/if}
  {/each}
</div>

<style>
  /* Below Modal (50), so a dialog is never decorated over. */
  .theme-layer { position: fixed; inset: 0; z-index: 40; pointer-events: none; overflow: hidden; }

  /* Web.svelte draws a top-left web; mirroring about the box centre moves it
     into the other corners. The sway pivots on the web's own corner. */
  .web { position: absolute; }
  .top-right { top: 0; right: 0; transform: scaleX(-1); }
  .bottom-right { bottom: 0; right: 0; transform: scale(-1, -1); }
  .sway { transform-origin: 0 0; animation: sway 7s ease-in-out infinite alternate; }
  @keyframes sway {
    from { transform: rotate(0deg); }
    to { transform: rotate(1.4deg); }
  }

  /* A candle is a point on its floor; the stub stands on it. */
  .candle { position: absolute; top: 0; left: 0; width: 0; height: 0; }
  .candle img { position: absolute; display: block; max-width: none; }
  .candle .wick { position: absolute; width: 0; height: 0; }

  /* The crawler is a point: the spider's feet when standing, the end of its
     thread when hanging. The sprite is placed around that point. */
  .crawler { position: absolute; top: 0; left: 0; width: 0; height: 0; transform-origin: 0 0; }
  .sprite { position: absolute; left: -39px; top: -38px; transform: scaleX(var(--dir, 1)); }
  /* Changing between the two drawings would jump, so each one arrives with
     a short turn from the other's angle: landing tumbles from head-down to
     upright (which way depends on which way it faces), letting go swings
     from upright to head-down. Both play as the drawing is put in place. */
  .crawler .sprite { transform-origin: 39px 24px; animation: land .42s cubic-bezier(.3, 1.5, .55, 1); }
  .dangle .sprite.hanging { transform-origin: 31px 4px; animation: let-go .38s ease-out; }
  @keyframes land {
    from { rotate: calc(var(--dir, 1) * 80deg); translate: 0 -10px; }
    to { rotate: 0deg; translate: 0 0; }
  }
  @keyframes let-go {
    from { rotate: -75deg; }
    to { rotate: 0deg; }
  }

  /* Hung by the silk tied at the top of the drawing. */
  .sprite.hanging { left: -31px; top: -4px; transform: none; }

  /* Silk: barely there where it is tied, catching the light toward the
     spider, with a glint running down it now and then. */
  .dangle { position: absolute; width: 0; height: 0; animation: swing 3.4s ease-in-out infinite alternate; }
  @keyframes swing {
    from { rotate: -2.2deg; }
    to { rotate: 2.2deg; }
  }
  .thread {
    position: absolute; top: 0; left: 0; width: 1px; margin-left: -.5px; overflow: hidden;
    background: linear-gradient(to bottom, rgba(230, 234, 230, 0), rgba(230, 234, 230, .3) 28px, rgba(255, 226, 190, .62));
    box-shadow: 0 0 3px rgba(255, 220, 180, .16);
  }
  .thread::after {
    content: ''; position: absolute; left: 0; top: -22px; width: 1px; height: 22px;
    background: linear-gradient(to bottom, transparent, rgba(255, 248, 228, .95), transparent);
    animation: glint 3.2s ease-in infinite;
  }
  @keyframes glint {
    0% { top: -22px; }
    55%, 100% { top: 100%; }
  }

  .resident {
    position: absolute; top: 0; right: 26px; width: 0; height: 64px;
    animation: bounce 5s ease-in-out infinite alternate, swing 4.1s ease-in-out infinite alternate;
  }
  .resident .thread { top: 0; height: 100%; }
  .resident .sprite { top: calc(100% - 4px); scale: .6; transform-origin: 31px 4px; }
  @keyframes bounce {
    from { height: 54px; }
    to { height: 88px; }
  }

  @media (max-width: 760px) {
    .top-right .sway { scale: .7; }
    .web.bottom-right, .extra { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sway, .resident, .dangle, .thread::after, .crawler .sprite, .dangle .sprite.hanging { animation: none; }
  }
</style>
