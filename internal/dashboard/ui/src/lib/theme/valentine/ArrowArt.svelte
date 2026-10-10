<script lang="ts">
  // One of the cupids' arrows, in page pixels: its tip at (x, y), pointing
  // `angle` degrees (0 is right, 90 down). In flight it has its heart head;
  // stuck in a ledge the head is buried, so only the shaft and its heart
  // fletching show.
  import { HEART_PATH } from './arrows';

  export let x: number;
  export let y: number;
  export let angle: number;
  export let length: number;
  export let head = false;
  export let opacity = 1;
</script>

<g transform="translate({x} {y}) rotate({angle})" {opacity}>
  <path class="shaft-edge" d="M{-length} 0H{head ? -2 : 0}" />
  <path class="shaft" d="M{-length} 0H{head ? -2 : 0}" />
  <path class="heart" transform="translate({-length + 1.4} 0) rotate(-90) scale(.55)" d={HEART_PATH} />
  {#if head}
    <path class="heart" transform="translate(-1.2 0) rotate(-90) scale(.6)" d={HEART_PATH} />
  {/if}
</g>

<style>
  path { stroke-linecap: round; }
  .shaft-edge { stroke: #3a2208; stroke-width: 1.7; fill: none; }
  .shaft { stroke: #f2c14e; stroke-width: .8; fill: none; }
  .heart { fill: #e8436b; stroke: #3a2208; stroke-width: 1; }
</style>
