<script lang="ts">
  // A stand-in dashboard with every kind of ledge the spiders can use: a
  // heading rule, a stack of cards (wall climbs between them), cards side by
  // side across a narrow gap (jumps), one sitting higher than its neighbour
  // (a jump up), and one running past the bottom of the window (a way out).
  import ChristmasLayer from '../lib/theme/christmas/ChristmasLayer.svelte';
  import LegacyChristmasShelf from './LegacyChristmasShelf.svelte';
  import ViewerChip from '../lib/ViewerChip.svelte';
  import { sceneOf } from '../lib/theme/scenes';
  import { markTheme, resolveTheme, THEMES } from '../lib/theme/theme';
  let theme = resolveTheme('halloween');
  const legacyShelf = new URLSearchParams(location.search).get('shelf') === 'holly';
  let empty = false;
  let clicks = 0;
  // Lab-only deterministic simulation; no daemon or API is involved.
  let manual = new URLSearchParams(location.search).get('clock') === 'manual';
  let elapsed = 0;
  let randomValue = .5;
  let blocked = false;
  $: markTheme(theme);
  $: scene = sceneOf(theme);
  import type { Ledge } from '../lib/theme/floors';
  import HalloweenLayer from '../lib/theme/halloween/HalloweenLayer.svelte';
  import { away, pose, type Choice, type Spider, type World } from '../lib/theme/spiderwalk';

  // Slow motion to judge a tween; a route to force wherever it can be taken;
  // the floors and each spider's state drawn over the page.
  let timeScale = 1;
  let prefer: Choice | '' = '';
  let debug = true;
  const routes: (Choice | '')[] = ['', 'drop', 'jump', 'wall', 'web', 'side', 'leave', 'line', 'turn'];

  // The layer's own world and floors, bound out of it to draw over.
  let world: World = { spiders: [away(Math.random, 2, 5), away(Math.random, 12, 20)], lines: [], nextLine: 1 };
  let floors: ReadonlyMap<number, Ledge> = new Map();

  const describe = (s: Spider) => {
    if (s.kind === 'climb') return `climb ${s.route.via}`;
    if (s.kind === 'act') return `${s.tween.name}${s.next.kind === 'climb' ? ` ${s.next.route.via}` : ''}`;
    if (s.kind === 'dangle') return `dangle ${s.phase}${s.out ? ' out' : ''}`;
    return s.kind;
  };
  const label = (s: Spider) => `${describe(s)}${'hurry' in s && s.hurry ? ' (fleeing)' : ''}`;
  $: frame = { width: innerWidth, height: innerHeight, bottomWeb: innerWidth > 760 };
  $: tags = world.spiders.map((s, i) => ({ i, text: label(s), at: pose(s, floors, frame) }));

  // Laid out for a 1440px window. The tower stands just beside the stack,
  // taller than both its cards (a wall to climb from either); the narrow card
  // and the step sit across jumpable gaps; the stack's foot and the wide card
  // run off the bottom (out, and into the bottom-right web).
  const cards = [
    { left: 0, top: 70, width: 46, height: 150, label: 'stack top' },
    { left: 0, top: 236, width: 46, height: 150, label: 'stack bottom' },
    { left: 47.5, top: 20, width: 20, height: 380, label: 'tower' },
    { left: 72, top: 50, width: 14, height: 200, label: 'jump across' },
    { left: 88, top: 20, width: 12, height: 160, label: 'step up' },
    { left: 72, top: 300, width: 28, height: 900, label: 'wide, into the web' },
    { left: 0, top: 420, width: 46, height: 900, label: 'runs off the bottom' },
  ];
</script>

<div class="shell scene">
  <!-- Use the dashboard's footer stack and CSS, not independently placed art. -->
  <aside class="rail">
    <button class="brand" type="button">
      <img src="/mascot.webp" alt="" width="64" height="64" />
      <span><strong>agent</strong><em>code review</em></span>
    </button>
    <nav aria-label="Dashboard">
      {#each ['Overview', 'History', 'Metrics', 'Leaderboard', 'Config', 'Prompt', 'Logs'] as label}
        <a href="#lab">{label}</a>
      {/each}
    </nav>
    {#if theme === 'christmas' && legacyShelf}
      <LegacyChristmasShelf />
    {:else}
      <svelte:component this={scene.Shelf} />
    {/if}
    <ViewerChip />
    <div class="feed"><span class="signal"></span><span>synthetic</span><small>no daemon connection</small></div>
  </aside>
  <main>
    <header class="hero" style:display={empty ? 'none' : undefined}>
      <div>
        <p class="eyebrow">spider lab</p>
        <h1>Scene</h1>
      </div>
    </header>
    <div class="board">
      {#if blocked && !empty}
        {#each cards as c}
          <svg class="route-blocker" aria-label="synthetic chart obstacle" width="12" height="60"
            style="left: calc({c.left + c.width / 2}% - 6px); top: {c.top - 60}px"><text x="0" y="25">Chart</text></svg>
        {/each}
      {/if}
      {#each empty ? [] : cards as c}
        <section class="surface card" style="left: {c.left}%; top: {c.top}px; width: {c.width}%; height: {c.height}px">
          <h3>{c.label}</h3><button on:click={() => clicks++}>Click through {clicks}</button>
        </section>
      {/each}
    </div>
  </main>
</div>
<div class="controls">
  <label>theme <select bind:value={theme}>{#each THEMES as t}<option>{t}</option>{/each}</select></label>
  <label><input type="checkbox" bind:checked={empty} /> empty</label>
  <label><input type="checkbox" bind:checked={blocked} /> blocked routes</label>
  <label><input type="checkbox" bind:checked={manual} /> manual clock</label>
  {#if manual}
    <output data-scene-time>{elapsed}</output>
    <label>Scene elapsed (ms) <input type="number" min="0" bind:value={elapsed} /></label>
    <button on:click={() => elapsed += 1000}>Advance 1s</button>
    <button on:click={() => elapsed += 100}>Advance 100ms</button>
    <button on:click={() => elapsed += 16000}>Advance 16s</button>
    <label>random <input aria-label="random" type="number" min="0" max="1" step=".5" bind:value={randomValue} /></label>
  {/if}
  <label>speed {timeScale}x <input type="range" min="0.1" max="2" step="0.1" bind:value={timeScale} /></label>
  <label>route
    <select bind:value={prefer}>
      {#each routes as r}<option value={r}>{r || 'any'}</option>{/each}
    </select>
  </label>
  <label><input type="checkbox" bind:checked={debug} /> debug</label>
</div>
<!-- The spiders and the manual clock are wired to the controls above, so those
     two layers are mounted here by hand; every other set comes from its scene. -->
{#if theme === 'halloween'}
<HalloweenLayer {timeScale} prefer={prefer || undefined} bind:world bind:floors />
{:else if theme === 'christmas' && manual}
<ChristmasLayer clock={() => elapsed} random={() => randomValue} />
{:else}
<svelte:component this={scene.Layer} />
{/if}
{#if debug && theme === 'halloween'}
  <svg class="debug" width="100%" height="100%" aria-hidden="true">
    {#each [...floors] as [id, f] (id)}
      <line x1={f.left} y1={f.y} x2={f.right} y2={f.y} />
      <text x={f.left + 4} y={f.y - 4}>floor {id}</text>
    {/each}
  </svg>
  {#each tags as t (t.i)}
    {#if t.at}
      <span class="debug-label" data-spider={t.i} style="transform: translate({t.at.x + 18}px, {t.at.y - 52}px)">{t.text}</span>
    {/if}
  {/each}
{/if}

<style>
  .scene { min-height: 100vh; }
  main { padding: 30px 60px; }
  .board { position: relative; height: 1100px; margin-top: 40px; }
  .card { position: absolute; background: var(--surface); padding: 14px 18px; box-sizing: border-box; }
  .route-blocker { position: absolute; }
  .debug { position: fixed; inset: 0; z-index: 45; pointer-events: none; }
  .debug line { stroke: rgba(120, 200, 255, .7); stroke-dasharray: 4 3; }
  .debug text { fill: rgba(120, 200, 255, .9); font: 10px ui-monospace, monospace; }
  .debug-label {
    position: fixed; top: 0; left: 0; z-index: 46; padding: 1px 4px; border-radius: 3px; white-space: nowrap; pointer-events: none;
    background: rgba(0, 0, 0, .7); color: #9fd8ff; font: 10px ui-monospace, monospace;
  }
  .controls {
    position: fixed; left: 60px; bottom: 16px; z-index: 60; display: flex; gap: 16px; align-items: center;
    padding: 8px 12px; border-radius: 8px; background: rgba(0, 0, 0, .75); font-size: 12px;
    max-width: calc(100vw - 120px); flex-wrap: wrap;
  }
</style>
