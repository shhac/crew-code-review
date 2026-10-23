<script lang="ts">
  // An animal's skeleton (skeleton.ts) over or instead of its drawing, its
  // anchor at (0, y) on the lab's stage and facing dir: a line for each bone,
  // the far side's dashed, each joint and bone marked by its code alone, in
  // columns either side of it with a faint leader to each, so the skeleton
  // stays the clearest thing on the stage. Pointing at one names it in full
  // and lights it (a bone with its two joints, and their leaders), dimming
  // the rest; clicking pins it. Sizes are in page pixels at the lab's zoom,
  // so they read the same however close.
  import type { Point } from '../lib/theme/pointer';
  import { layColumns, litBy, type Placed } from './skeleton';

  export let placed: Placed;
  export let y: number;
  export let dir: 1 | -1;
  export let zoom: number;
  // How far the stage reaches below the anchor's floor, page px, which the
  // codes keep above.
  export let room = Infinity;
  // What is lit: the code pointed at, or else the one pinned.
  export let selected: string | null;
  export let hover: (code: string | null) => void;
  export let pick: (code: string) => void;

  const CODE_PX = 10;

  $: ({ skeleton, view, anchor, scale } = placed);
  $: u = 1 / (scale * zoom);
  // Mirrored point by point rather than as a picture, so the codes still
  // read left to right.
  $: flip = (p: Point): Point => (dir === 1 ? p : { x: 2 * anchor.x - p.x, y: p.y });
  $: joints = skeleton.joints.map((j) => ({ ...j, at: flip(j.at) }));
  $: atCode = new Map(joints.map((j) => [j.code, j.at]));
  $: bones = skeleton.bones.flatMap((b) => {
    const from = atCode.get(b.from), to = atCode.get(b.to);
    return from && to ? [{ ...b, a: from, b: to, middle: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } }] : [];
  });
  $: lit = litBy(skeleton, selected);
  $: dim = (code: string) => lit.size > 0 && !lit.has(code);

  $: names = new Map([...joints, ...bones].map((x) => [x.code, x.name]));
  $: labels = layColumns([
    ...joints.map((j) => ({ text: j.code, at: j.at, px: CODE_PX, far: j.far, joint: true })),
    ...bones.map((b) => ({ text: b.code, at: b.middle, px: CODE_PX, far: b.far, joint: false })),
  ], u, joints.map((j) => j.at), anchor.y + (room / zoom - y) / scale);
</script>

<!-- Pointing and clicking here is for the mouse; the legend's rows are the
     keyboard's way to the same. -->
<svg
  class="skeleton"
  data-skeleton
  viewBox="{view.x} {view.y} {view.width} {view.height}"
  width={view.width * scale}
  height={view.height * scale}
  style="left: {-(anchor.x - view.x) * scale}px; top: {y - (anchor.y - view.y) * scale}px"
>
  {#each bones as b}
    <line class="bone" class:far={b.far} class:lit={lit.has(b.code)} class:dim={dim(b.code)} x1={b.a.x} y1={b.a.y} x2={b.b.x} y2={b.b.y}
      stroke-width={(lit.has(b.code) ? 4.5 : 2.5) * u} stroke-dasharray={b.far ? `${4 * u} ${3 * u}` : undefined} />
  {/each}
  {#each bones as b}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <line class="hit" data-hit={b.code} x1={b.a.x} y1={b.a.y} x2={b.b.x} y2={b.b.y} stroke-width={10 * u}
      on:mouseenter={() => hover(b.code)} on:mouseleave={() => hover(null)} on:click|stopPropagation={() => pick(b.code)} />
  {/each}
  {#each joints as j}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <circle class="joint" class:far={j.far} class:lit={lit.has(j.code)} class:dim={dim(j.code)} data-hit={j.code} cx={j.at.x} cy={j.at.y}
      r={(lit.has(j.code) ? 4.5 : 3.2) * u} stroke-width={1.2 * u}
      on:mouseenter={() => hover(j.code)} on:mouseleave={() => hover(null)} on:click|stopPropagation={() => pick(j.code)} />
  {/each}
  {#each labels as l}
    <line class="leader" class:lit={lit.has(l.text)} x1={l.at.x} y1={l.at.y} x2={l.x + (l.anchor === 'start' ? -3 : 3) * u} y2={l.y}
      stroke-width={(lit.has(l.text) ? 1.2 : 0.6) * u} />
  {/each}
  {#each labels as l}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <text class="code" class:joint={l.joint} class:far={l.far} class:lit={lit.has(l.text)} class:dim={dim(l.text)} data-code={l.text}
      x={l.x} y={l.y} font-size={l.px * u} stroke-width={3 * u} text-anchor={l.anchor}
      data-name={l.text === selected ? `${l.text} ${names.get(l.text)}` : undefined}
      on:mouseenter={() => hover(l.text)} on:mouseleave={() => hover(null)} on:click|stopPropagation={() => pick(l.text)}
      >{l.text === selected ? `${l.text} ${names.get(l.text)}` : l.text}</text>
  {/each}
</svg>

<style>
  .skeleton { position: absolute; display: block; overflow: visible; pointer-events: none; }
  line.bone { stroke: #19c3d6; stroke-linecap: round; }
  line.bone.far { stroke: #8fdbe4; opacity: .75; }
  line.hit { stroke: transparent; stroke-linecap: round; pointer-events: stroke; cursor: pointer; }
  line.leader { stroke: #a8f2fa; opacity: .18; }
  line.leader.lit { stroke: #ffe066; opacity: .9; }
  circle.joint { fill: #ff3d7f; stroke: #14161a; pointer-events: all; cursor: pointer; }
  circle.joint.far { fill: #ffd1e0; }
  .lit { opacity: 1; }
  line.bone.lit { stroke: #ffe066; }
  circle.joint.lit { fill: #ffe066; }
  .dim { opacity: .22; }
  /* A dark halo behind each code and name keeps it legible over art and lines. */
  text { font-family: system-ui, sans-serif; dominant-baseline: middle; paint-order: stroke; stroke: #14161a; stroke-linejoin: round; }
  text.code { fill: #a8f2fa; font-weight: 600; letter-spacing: .02em; pointer-events: all; cursor: pointer; }
  text.code.joint { fill: #fff; }
  text.code.far:not(.lit):not(.dim) { opacity: .8; }
  text.code.lit { fill: #ffe066; }
</style>
