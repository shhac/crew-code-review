<script lang="ts">
  import manifest from './robin-parts/manifest.json' with { type: 'json' };
  import { partsPose, partsSlotLayers, partsViewport, type PartId, type PartsPose } from './parts-pose';

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
  $: slots = partsSlotLayers(pose, exploded, showNeck, hidden);
  $: viewport = fitted ? partsViewport(mode, reduced) : [0, 0, 128, 112];
</script>

{#snippet part(id: PartId, weight: number)}
  {#if !hidden.includes(id)}
    <image data-part={id} href={urls[id]} x={parts[id].x} y={parts[id].y} width={parts[id].width} height={parts[id].height} visibility={weight > 0 ? null : 'hidden'} />
  {/if}
{/snippet}

<svg viewBox={viewport.join(' ')} role="img" aria-label="Robin" data-layered-robin data-closed={pose.closed} data-head-angle={pose.headAngle} data-mode={mode} data-flight-weight={pose.flightMix} data-peck-weight={pose.peckMix}>
  <g transform={mirrored ? 'translate(128 0) scale(-1 1)' : ''}>
    {#each slots as slot}
      <g data-slot transform={slot.transform} opacity={slot.opacity}>
        {#if slot.drawings.length === 1}
          {@render part(slot.drawings[0].id, slot.drawings[0].weight)}
        {:else}
          <!-- Composited only mid cross-fade, so a lone drawing paints as it would by itself. -->
          <g style={slot.blend ? 'isolation: isolate' : null}>
            {#each slot.drawings as drawing}
              <g transform={drawing.adjustment} opacity={drawing.weight} style={slot.blend ? 'mix-blend-mode: plus-lighter' : null}>{@render part(drawing.id, drawing.weight)}</g>
            {/each}
          </g>
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
