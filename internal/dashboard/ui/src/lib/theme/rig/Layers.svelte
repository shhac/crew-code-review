<script lang="ts">
  // One level of a rig's layers, in order; a group draws its own inside it.
  import Layers from './Layers.svelte';
  import { legPath, OUTLINE, transformOf, type Layer } from './rig';

  export let layers: readonly Layer[];
</script>

{#each layers as layer}
  {#if layer.kind === 'image'}
    <image href={layer.src} x={layer.x} y={layer.y} width={layer.width} height={layer.height} />
  {:else if layer.kind === 'legs'}
    <g data-legs>
      {#each layer.legs as leg}
        {@const d = legPath(leg, layer.paw)}
        <path {d} stroke={layer.fur.outline} stroke-width={layer.width + 2 * OUTLINE} />
        <path {d} stroke={layer.fur.fill} stroke-width={layer.width} />
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
  path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
</style>
