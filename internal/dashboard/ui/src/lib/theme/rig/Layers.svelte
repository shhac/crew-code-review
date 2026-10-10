<script lang="ts">
  // One level of a rig's layers, in order; a group draws its own inside it.
  import Layers from './Layers.svelte';
  import { legImages, transformOf, type Layer } from './rig';

  export let layers: readonly Layer[];
</script>

{#each layers as layer}
  {#if layer.kind === 'image' && layer.far}
    <image class="far" href={layer.src} x={layer.x} y={layer.y} width={layer.width} height={layer.height} />
  {:else if layer.kind === 'image'}
    <image href={layer.src} x={layer.x} y={layer.y} width={layer.width} height={layer.height} />
  {:else if layer.kind === 'legs'}
    <g data-legs={layer.fur ? 'fur' : 'outlined'} class:far={layer.far}>
      {#each layer.legs as leg}
        {#each legImages(leg, layer.art, layer.width, layer.fur) as { href, stretch, ...box }}
          <image {href} preserveAspectRatio={stretch ? 'none' : undefined} {...box} />
        {/each}
      {/each}
    </g>
  {:else if layer.kind === 'lid'}
    <circle data-lid cx={layer.at.x} cy={layer.at.y} r={layer.r} fill={layer.fur.fill} />
    <path d="M{layer.at.x - layer.r} {layer.at.y}h{2 * layer.r}" stroke={layer.fur.outline} stroke-width={layer.r * 0.6} />
  {:else if layer.kind === 'stroke'}
    <path data-stroke={layer.name} d="M{layer.points.map((p) => `${p.x} ${p.y}`).join('L')}{layer.fill ? 'Z' : ''}" style:fill={layer.fill ?? 'none'} stroke={layer.colour} stroke-width={layer.width} stroke-linejoin="round" />
  {:else}
    <g transform={transformOf(layer.turn, layer.scaleY)}><Layers layers={layer.layers} /></g>
  {/if}
{/each}

<style>
  path { fill: none; stroke-linecap: round; }
  /* The far pair, seen past the body, in its shadow. */
  .far { filter: brightness(.9); }
</style>
