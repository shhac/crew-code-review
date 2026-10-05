<script lang="ts">
  import { onMount } from 'svelte';
  import RobinPartsArt from './RobinPartsArt.svelte';
  import reference from '../lib/theme/christmas/robin-atlas/19e5dead3fa5799417d06f5a8aa4598e3ddcfea81eb603aea0a0915e6e6ba969-neutral.webp';
  import manifest from './robin-parts/manifest.json';
  import { partsModes, partsViewport } from './robin-parts-pose';

  let elapsed = 0, playing = true, mode = 'alive', mirrored = false, exploded = false;
  let showNeck = true, guides = false, reduced = false, background = 'light';
  let hidden: string[] = [];
  const modes = partsModes;
  $: viewport = partsViewport(mode, reduced);
  const thumbnails = import.meta.glob<string>('./robin-parts/*.webp', { eager: true, query: '?url', import: 'default' });
  onMount(() => {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previous = performance.now(), request = 0;
    const tick = (now: number) => {
      if (playing && document.visibilityState === 'visible') elapsed = (elapsed + Math.min(100, now - previous)) % 12000;
      previous = now;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  });
</script>

<main class:dark={background === 'dark'} class:checker={background === 'checker'}>
  <header>
    <span class="eyebrow">CHRISTMAS ART LAB · EXPERIMENT 01</span>
    <h1>A robin, in pieces.</h1>
    <p>A layered robin with breathing, blinking, hopping, pecking and flight. Separate near/far wings and tucked feet keep the flight joints connected.</p>
  </header>
  <section class="controls" aria-label="Animation controls">
    <label><input type="checkbox" bind:checked={playing} /> Play</label>
    <label>Movement <select bind:value={mode}>{#each modes as name}<option>{name}</option>{/each}</select></label>
    <label>Surface <select bind:value={background}><option>light</option><option>dark</option><option>checker</option></select></label>
    <label><input type="checkbox" bind:checked={mirrored} /> Mirror</label>
    <label><input type="checkbox" bind:checked={exploded} /> Separate pieces</label>
    <label><input type="checkbox" bind:checked={showNeck} /> Neck transition</label>
    <label><input type="checkbox" bind:checked={guides} /> Attachment guides</label>
    <label><input type="checkbox" bind:checked={reduced} /> Reduced motion</label>
  </section>
  <label class="scrub">Time <input aria-label="Time" type="range" min="0" max="12000" step="10" bind:value={elapsed} /><output>{Math.round(elapsed)} ms</output></label>
  <section class="comparison">
    <figure><div class="large parts-view" style="--view-width: {viewport[2]}px; --view-height: {viewport[3]}px" data-preview="parts"><RobinPartsArt {elapsed} {mode} {mirrored} {exploded} {showNeck} {guides} {reduced} {hidden} /></div><figcaption>Layered prototype · same body scale in every pose</figcaption></figure>
    <figure><div class="large"><img src={reference} alt="Current canonical robin" /></div><figcaption>Current canonical reference · 3× native</figcaption></figure>
  </section>
  <section class="small-comparison">
    <figure><div class="actual parts-view" style="--view-width: {viewport[2]}px; --view-height: {viewport[3]}px" data-preview="actual"><RobinPartsArt {elapsed} {mode} {mirrored} {exploded} {showNeck} {guides} {reduced} {hidden} /></div><figcaption>Dashboard size</figcaption></figure>
    <figure><img class="actual" src={reference} alt="Current robin at dashboard size" /><figcaption>Current robin</figcaption></figure>
    <figure><div class="native parts-view" style="--view-width: {viewport[2]}px; --view-height: {viewport[3]}px"><RobinPartsArt {elapsed} {mode} {mirrored} {exploded} {showNeck} {guides} {reduced} {hidden} /></div><figcaption>Native size</figcaption></figure>
  </section>
  <details>
    <summary>Inspect the layers</summary>
    <div class="layer-controls">{#each Object.keys(manifest.parts) as id}<label><input type="checkbox" value={id} bind:group={hidden} /> Hide {id}</label>{/each}</div>
    <div class="parts-grid">{#each Object.entries(manifest.parts) as [id, part]}<figure><img src={thumbnails['./robin-parts/' + part.file]} alt={id + ' component'} /><figcaption>{id}</figcaption></figure>{/each}</div>
    <p>Every component is extracted from its measured alpha bounds and registered at an anatomical attachment. No generated grid positions are used.</p>
  </details>
  <footer>Choose hop, peck or flight to review each movement. Flight-up, flight-forward, flight-down and flight-recovery hold the principal wing profiles for attachment checks; the other flight modes hold their intermediates. Larger canvases give moving poses clearance at the same body scale.</footer>
</main>

<style>
  :global(body) { margin: 0; font-family: system-ui, sans-serif; background: #f5f0e7; }
  main { min-height: 100vh; box-sizing: border-box; padding: 36px max(24px, calc((100vw - 1040px) / 2)); background: #f5f0e7; color: #352e28; }
  main.dark { background: #20262b; color: #eee6d7; }
  main.checker { background: repeating-conic-gradient(#f3ede3 0% 25%, #ddd6cc 0% 50%) 0 / 24px 24px; }
  header { max-width: 720px; }
  .eyebrow { font-size: 11px; letter-spacing: .13em; opacity: .65; }
  h1 { font-family: Georgia, serif; font-size: clamp(32px, 5vw, 52px); margin: 10px 0; font-weight: 500; }
  p { font-size: 14px; line-height: 1.6; }
  .controls { display: flex; flex-wrap: wrap; gap: 16px; margin: 24px 0 18px; font-size: 13px; }
  label { display: inline-flex; align-items: center; gap: 6px; }
  select { font: inherit; padding: 5px; border-radius: 5px; border: 1px solid #b8ab99; }
  .scrub { display: flex; font-size: 12px; gap: 12px; }
  .scrub input { flex: 1; accent-color: #b46a38; }
  output { min-width: 72px; font-variant-numeric: tabular-nums; }
  .comparison { display: flex; flex-wrap: wrap; justify-content: center; gap: 40px; margin: 28px 0 0; }
  figure { margin: 0; }
  .large { --preview-scale: 3; width: 384px; height: 336px; }
  .large img { width: 100%; height: 100%; display: block; }
  figcaption { text-align: center; font-size: 12px; opacity: .7; margin: 8px 0; }
  .small-comparison { display: flex; justify-content: center; align-items: flex-end; gap: 64px; margin: 32px 0 40px; }
  .actual { --preview-scale: .35; width: 44.8px; height: 39.2px; display: block; margin: auto; }
  .native { --preview-scale: 1; width: 128px; height: 112px; }
  .parts-view { width: calc(var(--view-width) * var(--preview-scale)); height: calc(var(--view-height) * var(--preview-scale)); }
  details { border-top: 1px solid #a99b8340; padding: 20px 0; font-size: 13px; }
  summary { cursor: pointer; }
  .layer-controls { display: flex; flex-wrap: wrap; gap: 16px; margin: 20px 0; }
  .parts-grid { display: flex; flex-wrap: wrap; gap: 20px; }
  .parts-grid img { width: 80px; height: 80px; object-fit: contain; }
  footer { font-size: 12px; opacity: .65; padding: 12px 0; }
  @media (max-width: 600px) { main { padding: 24px 16px; } .large { --preview-scale: 2.25; } .large:not(.parts-view) { width: 288px; height: 252px; } .comparison { gap: 20px; overflow-x: auto; justify-content: flex-start; } .small-comparison { gap: 24px; } }
</style>
