<script lang="ts">
  // One level of a rig's layers, in order; a group draws its own inside it.
  import Layers from './Layers.svelte';
  import { bone, footBox, footOf, piecesOf, transformOf, type Layer } from './rig';

  export let layers: readonly Layer[];
</script>

{#each layers as layer}
  {#if layer.kind === 'image'}
    <image href={layer.src} x={layer.x} y={layer.y} width={layer.width} height={layer.height} />
  {:else if layer.kind === 'legs'}
    <g data-legs={layer.fur ? 'fur' : 'outlined'} class:far={layer.far}>
      {#each layer.legs as leg}
        {#each piecesOf(leg, layer.art, layer.width) as piece, i}
          <image href={layer.fur ? piece.fur : piece.src} preserveAspectRatio="none" {...bone(piece.from, piece.to, piece.width, layer.fur && i === 0)} />
        {/each}
        <image href={layer.fur ? footOf(leg, layer.art).fur : footOf(leg, layer.art).src} {...footBox(leg, layer.art)} />
      {/each}
    </g>
  {:else if layer.kind === 'patch'}
    <ellipse cx={layer.at.x} cy={layer.at.y} rx={layer.rx} ry={layer.ry} fill={layer.fill} />
  {:else if layer.kind === 'lid'}
    <circle data-lid cx={layer.at.x} cy={layer.at.y} r={layer.r} fill={layer.fur.fill} />
    <path d="M{layer.at.x - layer.r} {layer.at.y}h{2 * layer.r}" stroke={layer.fur.outline} stroke-width={layer.r * 0.6} />
  {:else}
    <g transform={transformOf(layer.turn, layer.scaleY)}><Layers layers={layer.layers} /></g>
  {/if}
{/each}

<style>
  path { fill: none; stroke-linecap: round; }
  /* The far pair, seen past the body, in its shadow. */
  .far { filter: brightness(.9); }
</style>
