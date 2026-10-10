<script lang="ts">
  // The Easter egg hunt over the page: painted eggs tucked into the ledges'
  // ends, found by passing the cursor close, a found/total counter by the
  // brand, and rabbits hopping on the ledges. The layer takes no pointer
  // events, and the hunt is never stored: a reload starts a new one.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { ledgeScene, placeTroupe } from '../layout';
  import type { Cursor, Point } from '../pointer';
  import { easeTo } from '../rig/life';
  import Rig from '../rig/Rig.svelte';
  import { rabbitView, poseOf, type Rabbit } from './rabbit';
  import { gazeAt, rabbitRig } from './rabbit-rig';
  import { createRabbits, reconcileRabbits, restingRabbits, stepRabbits, takeEggs, type Rabbits } from './rabbits';
  import egg0 from './egg-0.webp';
  import egg1 from './egg-1.webp';
  import egg2 from './egg-2.webp';
  import egg3 from './egg-3.webp';
  import egg4 from './egg-4.webp';
  import egg5 from './egg-5.webp';
  import { eggView } from './eggs';
  import { canLeave, EGG, findEggs, hideEggs, leaveEgg, NO_HUNT, tally, tallySpot, TALLY, type Hunt } from './hunt';

  const DESIGNS = [egg0, egg1, egg2, egg3, egg4, egg5];
  const GAZE_EASE = 220;

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let scene: PageMap = { floors, obstacles: [], width: 0, height: 0 };
  let hunt: Hunt = NO_HUNT;
  let group: Rabbits | null = null;
  let gazes: ReadonlyMap<number, number> = new Map();
  let spot: Point | null = null;
  let now = 0;
  let reduced = false;

  $: eggs = hunt.eggs.flatMap((egg) => {
    const f = floors.get(egg.floor);
    return f ? [{ egg, view: eggView(egg, f, now, reduced) }] : [];
  });
  $: score = tally(hunt);
  $: shown = (group?.rabbits ?? []).flatMap((rabbit) => {
    const view = rabbitView(rabbit, scene);
    if (!view) return [];
    const drawn = { pose: view.pose, walked: rabbit.walked, since: now - rabbit.since, seed: rabbit.seed, bolting: rabbit.mode === 'bolt', was: poseOf({ mode: rabbit.was, tall: rabbit.tall }) };
    return [{ rabbit, view, pose: rabbitRig(drawn, { now, gaze: gazes.get(rabbit.id) ?? 0, still: reduced }) }];
  });

  // Leaving reduced motion lets fresh rabbits loose; entering it sits these
  // ones where they are.
  const troupe = placeTroupe({ create: createRabbits, reconcile: reconcileRabbits, resting: restingRabbits });

  // Each head turns toward a cursor close by, eased so it never snaps.
  function look(rabbits: readonly Rabbit[], cursor: Cursor | null, dt: number): ReadonlyMap<number, number> {
    return new Map(rabbits.map((r) => {
      const view = rabbitView(r, scene);
      const target = view && view.pose === 'sit' ? gazeAt(r.dir, view, cursor) : 0;
      return [r.id, easeTo(gazes.get(r.id) ?? 0, target, dt, GAZE_EASE)];
    }));
  }

  function step(time: number, dt: number, cursor: Cursor | null) {
    if (!group) return;
    const moved = stepRabbits(group, scene, time, dt, Math.random, cursor, (floor, end) => canLeave(hunt, scene, floor, end));
    const { group: next, eggs: left } = takeEggs(moved);
    group = next;
    hunt = left.reduce((h, e) => leaveEgg(h, scene, e.floor, e.end, time, e.seed), hunt);
    gazes = look(next.rabbits, cursor, dt);
  }

  // The brand's box and its words', for the counter to sit beside them.
  function measureBrand(): Point | null {
    const brand = document.querySelector('.rail .brand');
    const words = brand?.querySelector('span');
    if (!brand || !words) return null;
    const box = brand.getBoundingClientRect();
    return box.width > 0 ? tallySpot(box, words.getBoundingClientRect()) : null;
  }

  onMount(() => ledgeScene({
    motion(still) { reduced = still; group = troupe.motion(group, still); },
    measured(page, previous, time) {
      scene = page;
      floors = page.floors;
      hunt = hideEggs(hunt, page);
      group = troupe.place(group, page, samePage(page, previous), time, reduced);
      spot = measureBrand();
    },
    frame(time, moving) {
      now = time;
      if (moving) step(time, moving.dt, moving.cursor);
    },
    stroke(segment) { hunt = findEggs(hunt, scene, segment); },
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-easter>
  <Geometry {floors} />
  <svg class="eggs" width="100%" height="100%">
    <defs>
      {#each eggs as { egg, view } (egg.key)}
        <clipPath id="egg-ledge-{egg.key.replace(':', '-')}">
          <rect x={view.x - 20} y={view.ledge - 40} width="40" height="40" />
        </clipPath>
      {/each}
    </defs>
    {#each eggs as { egg, view } (egg.key)}
      <g data-egg={egg.found === null ? 'hidden' : 'found'} data-id="egg {egg.key}" clip-path="url(#egg-ledge-{egg.key.replace(':', '-')})">
        <image
          href={DESIGNS[egg.design]}
          x={view.x - EGG.width / 2}
          y={view.y + view.sunk - EGG.height}
          width={EGG.width}
          height={EGG.height}
          transform="rotate({view.tilt} {view.x} {view.ledge})"
        />
      </g>
      {#if view.glint > 0}
        <path class="glint" opacity={view.glint} transform="translate({view.x + 5} {view.y - EGG.height + 1})" d="M0 -3.5L.8 -.8 3.5 0 .8 .8 0 3.5 -.8 .8 -3.5 0 -.8 -.8Z" />
      {/if}
    {/each}
  </svg>
  {#each shown as { rabbit, view, pose } (rabbit.id)}
    <Rig {pose} x={view.x} y={view.y} dir={view.dir} opacity={view.opacity} data-rabbit={rabbit.mode} data-pose={view.pose} data-id={rabbit.id} />
  {/each}
  {#if spot && score.total > 0}
    <div class="tally" data-tally="{score.found}/{score.total}" style="left: {spot.x}px; top: {spot.y}px; width: {TALLY.width}px; height: {TALLY.height}px">
      {#key score.found}
        <img class:bump={!reduced && score.found > 0} src={egg0} alt="" width="9" height="12" />
      {/key}
      <span>{score.found}/{score.total}</span>
    </div>
  {/if}
</div>

<style>
  .eggs { position: absolute; inset: 0; overflow: visible; }
  .glint { fill: #fffbe6; }
  .tally {
    position: absolute; display: flex; align-items: center; justify-content: flex-end; gap: 4px;
    color: #f0f0f0; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1;
  }
  .tally img { display: block; }
  .bump { animation: bump .45s ease-out; transform-origin: 50% 100%; }
  @keyframes bump { 30% { transform: translateY(-3px) rotate(-10deg); } 60% { transform: translateY(0) rotate(6deg); } }
</style>
