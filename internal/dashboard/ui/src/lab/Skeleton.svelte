<script lang="ts">
  // An animal's skeleton (skeleton.ts) over or instead of its drawing, its
  // anchor at (0, y) on the lab's stage and facing dir: a line for each bone,
  // the far side's dashed, and every joint and bone named. Sizes are in page
  // pixels at the lab's zoom, so the names read the same however close.
  import type { Point } from '../lib/theme/pointer';
  import { layLabels, type Bone, type Placed } from './skeleton';

  export let placed: Placed;
  export let y: number;
  export let dir: 1 | -1;
  export let zoom: number;

  const JOINT_PX = 11;
  const BONE_PX = 10;

  $: ({ skeleton, view, anchor, scale } = placed);
  $: u = 1 / (scale * zoom);
  // Mirrored point by point rather than as a picture, so the names still
  // read left to right.
  $: flip = (p: Point): Point => (dir === 1 ? p : { x: 2 * anchor.x - p.x, y: p.y });
  $: bones = skeleton.bones.map((b) => ({ ...b, from: flip(b.from), to: flip(b.to) }));
  $: joints = skeleton.joints.map((j) => ({ ...j, at: flip(j.at) }));

  const middle = (b: Bone): Point => ({ x: (b.from.x + b.to.x) / 2, y: (b.from.y + b.to.y) / 2 });
  // Square to the bone: a near one's name to its right (or below it), a far
  // one's to its left, so twins either side of the body keep apart.
  function side(b: Bone): Point {
    const dx = b.to.x - b.from.x, dy = b.to.y - b.from.y;
    const length = Math.hypot(dx, dy) || 1;
    const n = { x: -dy / length, y: dx / length };
    const right = n.x > 0 || (n.x === 0 && n.y > 0) ? n : { x: -n.x, y: -n.y };
    return b.far ? { x: -right.x, y: -right.y } : right;
  }
  $: labels = layLabels([
    ...joints.map((j) => ({ text: j.name, at: j.at, toward: { x: j.far ? -1 : 1, y: 0 }, px: JOINT_PX, far: j.far, joint: true })),
    ...bones.filter((b) => b.name).map((b) => ({ text: b.name, at: middle(b), toward: side(b), px: BONE_PX, far: b.far, joint: false })),
  ], u, joints.map((j) => j.at));
</script>

<svg
  class="skeleton"
  data-skeleton
  viewBox="{view.x} {view.y} {view.width} {view.height}"
  width={view.width * scale}
  height={view.height * scale}
  style="left: {-(anchor.x - view.x) * scale}px; top: {y - (anchor.y - view.y) * scale}px"
>
  {#each bones as b}
    <line class="bone" class:far={b.far} x1={b.from.x} y1={b.from.y} x2={b.to.x} y2={b.to.y} stroke-width={2.5 * u} stroke-dasharray={b.far ? `${4 * u} ${3 * u}` : undefined} />
  {/each}
  {#each bones as b}
    {#each [b.from, b.to] as end}<circle class="end" class:far={b.far} cx={end.x} cy={end.y} r={1.6 * u} />{/each}
  {/each}
  {#each joints as j}
    <circle class="joint" class:far={j.far} cx={j.at.x} cy={j.at.y} r={3.2 * u} stroke-width={1.2 * u} />
  {/each}
  {#each labels as l}
    {#if l.moved}<line class="leader" x1={l.at.x} y1={l.at.y} x2={l.x} y2={l.y} stroke-width={0.8 * u} />{/if}
  {/each}
  {#each labels as l}
    <text
      class:joint={l.joint}
      class:bone={!l.joint}
      class:far={l.far}
      data-joint={l.joint ? l.text : undefined}
      data-bone={l.joint ? undefined : l.text}
      x={l.x}
      y={l.y}
      font-size={l.px * u}
      stroke-width={3 * u}
      text-anchor={l.anchor}
    >{l.text}</text>
  {/each}
</svg>

<style>
  .skeleton { position: absolute; display: block; overflow: visible; pointer-events: none; }
  line.bone { stroke: #19c3d6; stroke-linecap: round; }
  line.bone.far { stroke: #8fdbe4; opacity: .75; }
  .end { fill: #19c3d6; }
  line.leader { stroke: #a8f2fa; opacity: .5; }
  .end.far { fill: #8fdbe4; }
  circle.joint { fill: #ff3d7f; stroke: #14161a; }
  circle.joint.far { fill: #ffd1e0; }
  /* A dark halo behind each name keeps it legible over art and lines. */
  text { font-family: system-ui, sans-serif; dominant-baseline: middle; paint-order: stroke; stroke: #14161a; stroke-linejoin: round; }
  text.joint { fill: #fff; font-weight: 600; }
  text.bone { fill: #a8f2fa; font-style: italic; }
  text.far { opacity: .8; }
</style>
