<script lang="ts">
  // Summer tennis over the page: chalk court lines along the ledges,
  // pigeons wandering them, now and then a Harris's hawk sweeping low along
  // their row as they fly off ahead of it, and a ball rallying between two
  // cards side by side. The layer takes no pointer events: a hovering
  // cursor volleys the ball and startles the birds, a click never does.
  import { onMount } from 'svelte';
  import { samePage, type Ledge, type PageMap } from '../floors';
  import Geometry from '../Geometry.svelte';
  import { cueOf } from '../cue';
  import { ledgeScene, placeTroupe } from '../layout';
  import type { Point, Segment } from '../pointer';
  import Rig from '../rig/Rig.svelte';
  import { hawkView } from './hawk';
  import { BEATS as HAWK_BEATS, hawkRig } from './hawk-rig';
  import { chalkLines, LINE, linesPath, specksOf, wornOf, wornPath, type Lines } from './lines';
  import { rigPigeon, viewOf } from './pigeon';
  import { pigeonRig } from './pigeon-rig';
  import { ballOf } from './rally';
  import { createPlay, reconcilePlay, restingPlay, stepPlay, summerOf, type Play, type Summer } from './summer';

  const CUE = cueOf(['sweep', 'rally'] as const);

  let floors: ReadonlyMap<number, Ledge> = new Map();
  let lines: ReadonlyMap<number, Lines> = new Map();
  let summer: Summer | null = null;
  let play: Play | null = null;
  let now = 0;
  let last = 0;
  let reduced = false;
  // The cursor's last stroke, and how fast it moved along it (px/s).
  let stroke: Segment | null = null;
  let speed = 0;

  const troupe = placeTroupe<Play, Summer>({
    create: (s, time, rand) => createPlay(s, time, rand, CUE),
    reconcile: (p, s, time, rand) => reconcilePlay(p, s, time, rand),
    resting: (s, previous) => restingPlay(s, previous, now),
  });

  $: page = summer?.page ?? null;
  $: pigeons = play && page ? play.flock.pigeons.flatMap((p) => {
    const view = viewOf(p, page!, now);
    return view ? [{ view, pose: pigeonRig(rigPigeon(view, now), { now, still: reduced }) }] : [];
  }) : [];
  $: hawk = play && page ? hawkView(play.flock.hawk, page, now) : null;
  $: hawkPose = hawk ? hawkRig({ pose: 'glide', seed: 2, beat: (HAWK_BEATS * now) / 1000, gaze: 0 }, { now, still: reduced }) : null;
  $: ball = play && page ? ballOf(play.rally, page, now) : null;
  $: chalk = play ? play.chalk.flatMap((c) => {
    const f = floors.get(c.floor);
    return f ? specksOf(c, now).map((s) => ({ ...s, x: f.left + s.x, y: f.y + s.y })) : [];
  }) : [];

  const measure = (measured: PageMap) => {
    floors = measured.floors;
    lines = chalkLines(floors, measured.obstacles);
    summer = summerOf(measured);
  };

  onMount(() => ledgeScene({
    motion(still) { reduced = still; play = troupe.motion(play, still); },
    measured(measured, previous, time) {
      measure(measured);
      play = summer && troupe.place(play, summer, samePage(measured, previous), time, reduced);
    },
    frame(time, step) {
      now = time;
      const from = last;
      last = time;
      if (!step || !summer || !play) return;
      const cursor: Point | null = step.cursor;
      const moved = stroke && stroke.at > from ? stroke : null;
      play = stepPlay(play, summer, lines, time, from, Math.random, { cursor, stroke: moved, speed: moved ? speed : 0 });
    },
    stroke(segment) {
      speed = (Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y) * 1000) / Math.max(1, segment.at - (stroke?.at ?? -Infinity));
      stroke = segment;
    },
  }));
</script>

<div class="seasonal-overlay" aria-hidden="true" data-wimbledon>
  <Geometry {floors} />
  <svg width="100%" height="100%">
    {#each [...lines] as [id, chalkLine] (id)}
      {@const f = floors.get(id)}
      {#if f && chalkLine.length}
        <g class="court-lines" data-lines={id} transform="translate({f.left} {f.y})">
          <path class="chalk" d={linesPath(chalkLine)} stroke-width={LINE} />
          {#each wornOf(chalkLine) as s (s.key)}
            <path class="chalk worn" d={wornPath(s)} stroke-width={LINE} style="opacity: {0.15 + 0.2 * s.tone}" />
          {/each}
        </g>
      {/if}
    {/each}
    {#each chalk as s}
      <circle class="speck" data-chalk cx={s.x} cy={s.y} r={s.r} opacity={s.opacity} />
    {/each}
    {#if ball}
      <g data-ball transform="translate({ball.x} {ball.y}) scale({2 - ball.squash} {ball.squash})" opacity={ball.opacity}>
        <circle class="ball" r="3" />
        <path class="seam" d="M-2.2 -2C-0.6 -0.8 -0.6 0.8 -2.2 2M2.2 -2C0.6 -0.8 0.6 0.8 2.2 2" transform="rotate({ball.spin})" />
      </g>
    {/if}
  </svg>
  {#each pigeons as { view, pose } (view.pigeon.id)}
    <Rig {pose} x={view.x} y={view.y} dir={view.dir} data-pigeon={view.pigeon.mode} data-pose={view.pose} data-id={view.pigeon.id} />
  {/each}
  {#if hawk && hawkPose}
    <Rig pose={hawkPose} x={hawk.x} y={hawk.y} dir={hawk.dir} data-hawk="sweep" />
  {/if}
</div>

<style>
  svg { position: absolute; inset: 0; }
  .chalk { fill: none; stroke: #f4f4ec; opacity: .7; }
  .speck { fill: #f4f4ec; }
  .ball { fill: #dde85a; stroke: #3d3d1c; stroke-width: .6; }
  .seam { fill: none; stroke: #fbfbf2; stroke-width: .6; stroke-linecap: round; }
</style>
