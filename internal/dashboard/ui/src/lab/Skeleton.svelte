<script lang="ts">
  // An animal's skeleton (skeleton.ts) over or instead of its drawing, its
  // anchor at (0, y) on the lab's stage and facing dir: a line for each bone,
  // the far side's dashed, each joint and bone marked by its code alone so
  // the stage stays readable. Pointing at one names it in full and lights it
  // (a bone with its two joints), dimming the rest; clicking pins it. Sizes
  // are in page pixels at the lab's zoom, so they read the same however
  // close.
  import type { Point } from '../lib/theme/pointer';
  import { layLabels, litBy, type Placed } from './skeleton';

  export let placed: Placed;
  export let y: number;
  export let dir: 1 | -1;
  export let zoom: number;
  // What is lit: the code pointed at, or else the one pinned.
  export let selected: string | null;
  export let hover: (code: string | null) => void;
  export let pick: (code: string) => void;

  const CODE_PX = 9;
  const NAME_PX = 12;

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

  // Square to the bone: a near one's code to its right (or below it), a far
  // one's to its left, so twins either side of the body keep apart.
  function side(a: Point, b: Point, far: boolean): Point {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const n = { x: -dy / length, y: dx / length };
    const right = n.x > 0 || (n.x === 0 && n.y > 0) ? n : { x: -n.x, y: -n.y };
    return far ? { x: -right.x, y: -right.y } : right;
  }
  $: labels = layLabels([
    ...joints.map((j) => ({ text: j.code, at: j.at, toward: { x: j.far ? -1 : 1, y: 0 }, px: CODE_PX, far: j.far, joint: true })),
    ...bones.map((b) => ({ text: b.code, at: b.middle, toward: side(b.a, b.b, b.far), px: CODE_PX, far: b.far, joint: false })),
  ], u, joints.map((j) => j.at));

  // The selected one's full name, beside it.
  $: chosen = (() => {
    const joint = joints.find((j) => j.code === selected);
    if (joint) return { text: `${joint.code} ${joint.name}`, at: joint.at };
    const bone = bones.find((b) => b.code === selected);
    return bone ? { text: `${bone.code} ${bone.name}`, at: bone.middle } : null;
  })();
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
    {#if l.moved}<line class="leader" class:dim={dim(l.text)} x1={l.at.x} y1={l.at.y} x2={l.x} y2={l.y} stroke-width={0.8 * u} />{/if}
  {/each}
  {#each labels as l}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <text class="code" class:joint={l.joint} class:far={l.far} class:lit={lit.has(l.text)} class:dim={dim(l.text)} data-code={l.text}
      x={l.x} y={l.y} font-size={l.px * u} stroke-width={3 * u} text-anchor={l.anchor}
      on:mouseenter={() => hover(l.text)} on:mouseleave={() => hover(null)} on:click|stopPropagation={() => pick(l.text)}>{l.text}</text>
  {/each}
  {#if chosen}
    <text class="name" data-name={chosen.text} x={chosen.at.x + 10 * u} y={chosen.at.y - 12 * u} font-size={NAME_PX * u} stroke-width={4 * u}>{chosen.text}</text>
  {/if}
</svg>

<style>
  .skeleton { position: absolute; display: block; overflow: visible; pointer-events: none; }
  line.bone { stroke: #19c3d6; stroke-linecap: round; }
  line.bone.far { stroke: #8fdbe4; opacity: .75; }
  line.hit { stroke: transparent; stroke-linecap: round; pointer-events: stroke; cursor: pointer; }
  line.leader { stroke: #a8f2fa; opacity: .5; }
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
  text.name { fill: #ffe066; font-weight: 700; }
</style>
