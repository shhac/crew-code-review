<script lang="ts">
  // Everything Halloween that floats over the page: corner webs, a spider
  // hanging from one, two more that roam the tops of the cards (and the
  // draglines they leave), and candle stubs left burning on those same
  // floors. The layer takes no pointer events, so nothing here can stand
  // between a person and a button.
  import { onMount } from 'svelte';
  import { observePointer } from "../pointer";
  import { sceneLoop } from "../lifecycle";
  import Geometry from '../Geometry.svelte';
  import { observeLayout } from '../layout';
  import { candleSpots, type CandleSpot } from '../candles';
  import { measurePage, type Ledge } from '../floors';
  import { advance, away, BOTTOM_WEB, pose, WEB, type Choice, type Frame, type Pose, type World } from '../spiderwalk';
  import { movingPointer, stepped, strandPath, strands, type Strand } from '../strands';
  import squatStub from './candle-stub-0.webp';
  import tallStub from './candle-stub-1.webp';
  import meltedStub from './candle-stub-2.webp';
  import Flame from './Flame.svelte';
  import Spider from './Spider.svelte';
  import Web from './Web.svelte';

  // The lab's dials: slow motion, and a route to make the spiders take. The
  // dashboard leaves both alone.
  export let timeScale = 1;
  export let prefer: Choice | undefined = undefined;
  // Read out (bound) by the lab to draw its debug view; nothing sets them.
  export let world: World = { spiders: [away(Math.random, 2, 5), away(Math.random, 12, 20)], lines: [], nextLine: 1 };
  export let floors: ReadonlyMap<number, Ledge> = new Map();

  // The second spider is smaller, so the pair reads as two spiders rather
  // than one twice. walked is the distance its feet have covered, in the
  // drawing's own pixels.
  type Crawler = { scale: number; pose: Pose | null; walked: number };
  let crawlers: Crawler[] = [
    { scale: 1, pose: null, walked: 0 },
    { scale: 0.7, pose: null, walked: 0 },
  ];

  // Each stub's size on the page and its wick tip as a fraction across its
  // art: measured, so new art needs measuring too. The wick is the top edge.
  const STUBS = [
    { src: squatStub, width: 15, height: 13.75, wick: 0.5 },
    { src: tallStub, width: 13.5, height: 17.5, wick: 0.593 },
    { src: meltedStub, width: 19.75, height: 10, wick: 0.456 },
  ];

  let candles: CandleSpot[] = [];
  let silk: Strand[] = [];
  let dirty = true;
  let measuredAt = -Infinity;

  // The corner webs are drawn only where CSS shows them; the spiders must
  // agree about where home is.
  const frameNow = (): Frame => ({ width: innerWidth, height: innerHeight, bottomWeb: innerWidth > 760 });

  // Listened to on the window, passively, since this layer never takes
  // pointer events itself.
  const pointer = { x: 0, y: 0, at: -Infinity };
  const moved = (e: PointerEvent) => Object.assign(pointer, { x: e.clientX, y: e.clientY, at: performance.now() });

  function measure() {
    floors = measurePage({ obstacles: false }).floors;
    candles = candleSpots(floors, STUBS.length, innerHeight);
    dirty = false;
    measuredAt = performance.now();
    return floors;
  }

  function advanceAll(dt: number) {
    // Animation keeps its full frame rate; layout reads happen when the page
    // changes. The occasional refresh also catches CSS-only layout changes.
    const here = dirty || performance.now() - measuredAt >= 250 ? measure() : floors;
    const frame = frameNow();
    world = advance(world, { floors: here, frame, dt: dt * timeScale, rand: Math.random, prefer, pointer: movingPointer(pointer, performance.now()) });
    crawlers = crawlers.map((c, i) => {
      const next = pose(world.spiders[i], here, frame);
      return { ...c, pose: next, walked: c.walked + stepped(c.pose, next) / c.scale };
    });
    silk = strands(world.lines, crawlers.map((c) => c.pose), here, performance.now() / 1000);
  }

  onMount(() => {
    let last = performance.now();
    const loop = sceneLoop((now, reduced) => {
      if (reduced) {
        crawlers = crawlers.map((c) => ({ ...c, pose: null }));
        silk = [];
        measure();
      } else advanceAll(Math.min(0.1, (now - last) / 1000));
      last = now;
    }, () => { dirty = true; pointer.at = -Infinity; last = performance.now(); });
    const changed = () => { dirty = true; pointer.at = -Infinity; loop.invalidate(); };
    const stopObserving = observeLayout(changed);
    const stopPointer = observePointer(moved, () => { pointer.at = -Infinity; });
    const timer = window.setInterval(() => { if (matchMedia("(prefers-reduced-motion: reduce)").matches) changed(); }, 1000);
    return () => { loop.stop(); stopPointer(); stopObserving(); clearInterval(timer); };
  });
</script>

<div class="theme-layer seasonal-overlay" aria-hidden="true">
  <div class="web top-right"><div class="sway"><Web size={WEB} /></div></div>
  <div class="web bottom-right"><div class="sway"><Web size={BOTTOM_WEB} /></div></div>

  <Geometry {floors} />

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

  <svg class="strands" width="100%" height="100%">
    <defs>
      {#each silk as s (s.key)}
        <linearGradient id="silk-{s.key}" gradientUnits="userSpaceOnUse" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}>
          <stop offset="0" stop-color="rgb(230, 234, 230)" stop-opacity=".08" />
          <stop offset=".25" stop-color="rgb(230, 234, 230)" stop-opacity=".3" />
          <stop offset="1" stop-color="rgb(255, 226, 190)" stop-opacity=".6" />
        </linearGradient>
      {/each}
    </defs>
    {#each silk as s (s.key)}
      {@const d = strandPath(s)}
      <g data-strand={s.key} style="opacity: {s.opacity}">
        <path class="strand" {d} stroke="url(#silk-{s.key})" />
        <path class="glint" {d} style="--length: {Math.hypot(s.x2 - s.x1, s.y2 - s.y1)}" />
      </g>
    {/each}
  </svg>

  {#each crawlers as c, i}
    {#if c.pose}
      {@const p = c.pose}
      <div
        class="crawler"
        class:extra={i > 0}
        data-dragline={p.dragline}
        style="transform: translate({p.x}px, {p.y}px) rotate({p.rotate}deg) scale({c.scale * (0.3 + 0.7 * p.fade)}); opacity: {p.fade}"
      >
        <div class="sprite" class:hanging={p.drawing === 'hang'} style="--dir: {p.dir}">
          <Spider moving={p.moving} hanging={p.drawing === 'hang'} walked={c.walked} crouch={p.crouch} tuck={p.tuck} />
        </div>
      </div>
    {/if}
  {/each}
</div>

<style>
  /* Below Modal (50), so a dialog is never decorated over. */



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

  /* The crawler is a point, turned about by the pose: the spider's feet when
     standing (and on a wall or a thread), the tie at the top of its body when
     hanging. The sprite is placed around that point. Every change between
     the two is tweened by the walker itself, so nothing here animates it. */
  .crawler { position: absolute; top: 0; left: 0; width: 0; height: 0; transform-origin: 0 0; }
  .sprite { position: absolute; left: -39px; top: -38px; transform: scaleX(var(--dir, 1)); }
  .sprite.hanging { left: -31px; top: -4px; transform: none; }

  /* The resident's silk (the roaming spiders' threads are strands, below):
     barely there where it is tied, catching the light toward the spider,
     with a glint running down it now and then. */
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

  /* Draglines and climbed threads: the same silk, as strands between two
     points, the glint a short dash run down each. */
  .strands { position: absolute; inset: 0; overflow: visible; }
  .strand { fill: none; stroke-width: 1; filter: drop-shadow(0 0 1.5px rgba(255, 220, 180, .2)); }
  .glint {
    fill: none; stroke: rgba(255, 248, 228, .9); stroke-width: 1; stroke-linecap: round;
    stroke-dasharray: 18 100000; animation: glint-run 3.6s ease-in infinite;
  }
  @keyframes glint-run {
    0% { stroke-dashoffset: 18; }
    55%, 100% { stroke-dashoffset: calc(-1px * var(--length)); }
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
    .sway, .resident, .thread::after, .glint { animation: none; }
  }
</style>
