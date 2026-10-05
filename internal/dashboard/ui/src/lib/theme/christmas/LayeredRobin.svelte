<script lang="ts">
  import manifest from './robin-parts/manifest.json' with { type: 'json' };
  import { partsPose, partsLayers, partsViewport, type PartsPose } from './parts-pose';

  export let elapsed = 0;
  export let mode = 'alive';
  export let reduced = false;
  export let mirrored = false;
  export let exploded = false;
  export let showNeck = true;
  export let guides = false;
  export let hidden: string[] = [];
  export let fitted = true;
  export let poseOverride: PartsPose | null = null;
  const assets = import.meta.glob<string>('./robin-parts/*.webp', { eager: true, query: '?url', import: 'default' });
  const urls = Object.fromEntries(Object.entries(manifest.parts).map(([id, p]) => [id, assets['./robin-parts/' + p.file]]));
  const parts = manifest.parts;
  $: pose = reduced ? partsPose(0, 'still') : poseOverride ?? partsPose(elapsed, mode);
  $: layers = partsLayers(pose, exploded, showNeck);
  $: viewport = fitted ? partsViewport(mode, reduced) : [0, 0, 128, 112];
</script>

{#snippet part(id: keyof typeof parts)}
  {#if !hidden.includes(id)}
    <image data-part={id} href={urls[id]} x={parts[id].x} y={parts[id].y} width={parts[id].width} height={parts[id].height} />
  {/if}
{/snippet}

<svg viewBox={viewport.join(' ')} role="img" aria-label="Robin" data-layered-robin data-closed={pose.closed} data-head-angle={pose.headAngle} data-mode={mode} data-flight-weight={pose.flightMix} data-peck-weight={pose.peckMix}>
  <g transform={mirrored ? 'translate(128 0) scale(-1 1)' : ''}>
    {#each layers as layer}
      <g transform={layer.transform} opacity={layer.opacity ?? 1}>
        {#if layer.nextId && layer.blend && !hidden.includes(layer.id) && !hidden.includes(layer.nextId)}
          <g style="isolation: isolate">
            <g opacity={1 - layer.blend} style="mix-blend-mode: plus-lighter">{@render part(layer.id)}</g>
            <g transform={layer.nextAdjustment} opacity={layer.blend} style="mix-blend-mode: plus-lighter">{@render part(layer.nextId)}</g>
          </g>
        {:else}
          {@render part(layer.id)}
        {/if}
      </g>
    {/each}
    {#if guides}
      <path d="M0 100H128" stroke="#41acb4" stroke-width=".4" />
      {#each Object.entries(parts) as [id, p]}
        <circle cx={p.pivot[0]} cy={p.pivot[1]} r="1" fill="#d32a93"><title>{id} pivot</title></circle>
      {/each}
    {/if}
  </g>
</svg>

<style>
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
</style>
