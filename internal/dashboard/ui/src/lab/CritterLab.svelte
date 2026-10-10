<script lang="ts">
  // Every seasonal animal, large, on a floor, with the dials that matter for
  // judging them: what each is doing, speed, zoom, a timeline of numbered
  // frames to inspect a single pose and talk about it, and for those drawn from parts, the parts: hide
  // any, see each alone, mark the joints and the footprint placement allows.
  // The cursor over the big stage is passed on, so heads turning toward it
  // can be checked. The animals are those in critters/registry.ts, each
  // known here only by what it says of itself there. Each keeps its own lab
  // too (spider.html, robin-parts.html).
  import { onMount } from 'svelte';
  import type { Point } from '../lib/theme/pointer';
  import { GAZE_EASE } from '../lib/theme/rig/gaze';
  import { easeTo } from '../lib/theme/rig/life';
  import Rig from '../lib/theme/rig/Rig.svelte';
  import { drawingsOf, gazeOf, paceOf, posesOf, type Critter } from './critters/critter';
  import { CRITTERS, critterNamed } from './critters/registry';
  import { drawingFor, overlay } from './drawings';
  import { allPartNames, keepParts, partArt } from './rig-parts';

  let critter: Critter = CRITTERS[0];
  let mode = critter.modes[0];
  let speed = critter.speed;
  let zoom = 6;
  let playing = true;
  let still = false;
  let dir: 1 | -1 = 1;
  // Time runs in whole frames, 60 a second, and everything drawn follows
  // from the frame number (with the animal, mode and speed), so one number
  // names one drawing exactly: the page's address carries it, to share.
  const FPS = 60;
  // The timeline shows at least a minute, and stretches to any later frame.
  const SPAN = 60 * FPS;
  let frame = 0;
  let cursor: Point | null = null;
  let gaze = 0;
  let hidden: string[] = [];
  let separate = false;
  let guides = false;
  let footprint = true;
  // The drawing laid over the animal to compare, by name; none is ''.
  let reference = '';
  function setMode(m: string) {
    mode = m;
    reference = drawingFor(drawingsOf(critter), m, reference);
  }
  $: drawings = drawingsOf(critter);
  $: rig = critter.kind === 'rig' ? critter : null;
  $: view = critter.kind === 'view' ? critter : null;
  let stage: HTMLDivElement;

  $: now = (frame * 1000) / FPS;
  $: walking = critter.walking.includes(mode);
  // Walking, its stride follows from the time, at its pace from frame 0.
  $: pace = paceOf(critter, mode, speed);
  $: walked = walking ? (pace * now) / 1000 : 0;
  $: moment = { mode, now, walked };
  $: pose = rig && rig.pose(moment, { gaze, still });
  $: shown = pose && keepParts(pose, (name) => !hidden.includes(name));
  // Every layer the animal ever draws, whatever it is doing, so the list
  // holds still while a part comes and goes (an eyelid, mid-blink).
  $: everyPose = rig ? posesOf(rig) : [];
  $: parts = view ? view.parts : allPartNames(everyPose);
  $: art = view ? view.art : [...new Map(everyPose.flatMap(partArt).map((a) => [a.name, a])).values()];
  // The box placement allows this pose on the page.
  $: box = rig && rig.box(moment);
  // A flier hovers above the floor; a walker stands on it.
  $: lift = rig?.lift ?? 0;
  $: apart = view ? view.apart(mode) : 'pieces';

  function choose(c: Critter) {
    critter = c;
    mode = c.modes[0];
    speed = c.speed;
    hidden = [];
    reference = '';
  }
  function track(e: PointerEvent) {
    const r = stage.getBoundingClientRect();
    cursor = { x: (e.clientX - (r.left + r.width / 2)) / zoom, y: (e.clientY - (r.bottom - 60)) / zoom };
  }

  const toFrame = (n: number) => {
    frame = Math.max(0, Math.round(n));
  };
  // Paused, the arrow keys step a frame (ten with shift).
  function key(e: KeyboardEvent) {
    if (playing || e.target instanceof HTMLInputElement) return;
    const by = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight') toFrame(frame + by);
    if (e.key === 'ArrowLeft') toFrame(frame - by);
  }

  // The view, in the page's address: what to share to point at a frame.
  const flags = ['still', 'guides', 'separate', 'footprint'] as const;
  let ready = false;
  $: state = new URLSearchParams({
    animal: critter.name, mode, frame: String(frame), speed: String(speed), zoom: String(zoom), dir: String(dir),
    ...Object.fromEntries(flags.flatMap((f) => ({ still, guides, separate, footprint }[f] ? [[f, '1']] : []))),
    ...(reference ? { ref: reference } : {}),
    ...(hidden.length ? { hide: hidden.join(',') } : {}),
  });
  // Written while paused, or as it plays without the ever-changing frame.
  $: if (ready && !playing) history.replaceState(null, '', `#${state}`);

  function restore(hash: string) {
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    const c = critterNamed(q.get('animal'));
    if (!c) return;
    choose(c);
    mode = c.modes.find((m) => m === q.get('mode')) ?? mode;
    toFrame(Number(q.get('frame') ?? 0));
    speed = Number(q.get('speed') ?? speed);
    zoom = Number(q.get('zoom') ?? zoom);
    dir = q.get('dir') === '-1' ? -1 : 1;
    still = q.has('still');
    guides = q.has('guides');
    separate = q.has('separate');
    footprint = q.has('footprint');
    reference = q.get('ref') ?? '';
    hidden = q.get('hide')?.split(',') ?? [];
    // Opened at a frame, it waits there.
    playing = !q.has('frame');
  }

  onMount(() => {
    restore(location.hash);
    ready = true;
    const loop = { request: 0, last: performance.now(), carry: 0 };
    const tick = (time: number) => {
      const dt = Math.min(100, time - loop.last);
      if (playing) {
        loop.carry += dt;
        const whole = Math.floor((loop.carry * FPS) / 1000);
        loop.carry -= (whole * 1000) / FPS;
        frame += whole;
      }
      gaze = easeTo(gaze, still ? 0 : gazeOf(critter, dir, cursor), dt, GAZE_EASE);
      loop.last = time;
      loop.request = requestAnimationFrame(tick);
    };
    loop.request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loop.request);
  });
</script>

<!-- A link pasted into an open lab changes only the address's # part. -->
<svelte:window on:keydown={key} on:hashchange={() => restore(location.hash)} />

<div class="lab">
  <div class="controls">
    {#each CRITTERS as c}
      <button type="button" class:on={critter === c} on:click={() => choose(c)}>{c.name}</button>
    {/each}
    <span class="sep"></span>
    {#each critter.modes as m}
      <button type="button" class:on={mode === m} on:click={() => setMode(m)}>{m}</button>
    {/each}
  </div>
  <div class="controls">
    <label>speed {speed}px/s <input type="range" min="0" max="80" bind:value={speed} /></label>
    <label>zoom {zoom}x <input type="range" min="1" max="12" bind:value={zoom} /></label>
    <button type="button" on:click={() => (dir = dir === 1 ? -1 : 1)}>face {dir === 1 ? 'left' : 'right'}</button>
    <label><input type="checkbox" bind:checked={still} /> reduced motion</label>
    <label><input type="checkbox" bind:checked={guides} /> joints</label>
    <label><input type="checkbox" bind:checked={separate} /> separate pieces</label>
    {#if box}<label><input type="checkbox" bind:checked={footprint} /> footprint</label>{/if}
    {#if Object.keys(drawings).length}
      <label>drawing
        <select bind:value={reference}>
          <option value="">none</option>
          {#each Object.keys(drawings) as name}<option value={name}>{name}</option>{/each}
        </select>
      </label>
    {/if}
  </div>
  <div class="controls timeline">
    <button type="button" aria-label="first frame" on:click={() => toFrame(0)}>|&lt;</button>
    <button type="button" aria-label="back a frame" on:click={() => { playing = false; toFrame(frame - 1); }}>&lt;</button>
    <button type="button" on:click={() => (playing = !playing)}>{playing ? 'pause' : 'play'}</button>
    <button type="button" aria-label="forward a frame" on:click={() => { playing = false; toFrame(frame + 1); }}>&gt;</button>
    <!-- Showing the frame, never writing it back as it plays: a bound
         slider would clamp it at the slider's end. -->
    <input class="scrub" type="range" min="0" max={Math.max(SPAN, frame)} step="1" value={frame} aria-label="frame" on:input={(e) => { playing = false; toFrame(Number(e.currentTarget.value)); }} />
    <label>frame <input class="number" type="number" min="0" step="1" value={frame} aria-label="frame number" on:change={(e) => { playing = false; toFrame(Number(e.currentTarget.value)); }} /></label>
    <output data-frame={frame}>{(now / 1000).toFixed(3)}s at {FPS} fps{#if walking}, stride {walked.toFixed(2)}px{/if}</output>
    {#if !playing}<span class="hint">paused: arrow keys step a frame, shift for ten; the address bar links here</span>{/if}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="stage" bind:this={stage} on:pointermove={track} on:pointerleave={() => (cursor = null)} data-stage>
    <div class="floor"></div>
    <div class="big" style="scale: {zoom}">
      {#if box && footprint && pose}
        <span class="footprint" style="left: {-box.width / 2}px; top: {-lift - box.height}px; width: {box.width}px; height: {box.height + (box.down ?? 0)}px"></span>
      {/if}
      {#if shown}
        <Rig pose={shown} x={0} y={-lift} {dir} {guides} data-critter={mode} />
        {#if drawings[reference]}
          <Rig pose={overlay(shown, drawings[reference])} x={0} y={-lift} {dir} opacity={0.45} />
        {/if}
      {:else if view}
        <svelte:component this={view.View} {mode} {now} {walked} {dir} {playing} {still} {guides} {separate} {hidden} marked />
      {/if}
    </div>
  </div>

  <section class="parts">
    <p>Layers, back to front (untick to hide):</p>
    <div class="controls">
      {#each parts as name}
        <label><input type="checkbox" checked={!hidden.includes(name)} on:change={() => (hidden = hidden.includes(name) ? hidden.filter((h) => h !== name) : [...hidden, name])} /> {name}</label>
      {/each}
    </div>
    {#if separate && pose}
      <div class="row pieces">
        {#each parts as name}
          <figure>
            <div class="spot" style="scale: {Math.max(2, zoom / 2)}"><Rig pose={keepParts(pose, (n) => n === name)} x={0} y={-lift} {dir} /></div>
            <figcaption>{name}</figcaption>
          </figure>
        {/each}
      </div>
    {:else if separate && view && apart === 'pieces'}
      <div class="row pieces">
        {#each parts as name}
          <figure>
            <div class="spot" style="scale: {Math.max(2, zoom / 2)}">
              <svelte:component this={view.View} {mode} {now} {walked} dir={1} playing={false} {still} guides={false} separate={false} hidden={parts.filter((n) => n !== name)} />
            </div>
            <figcaption>{name}</figcaption>
          </figure>
        {/each}
      </div>
    {/if}
    {#if separate && apart === 'stage'}<p>The {critter.name}'s pieces are pulled apart on the stage above.</p>{/if}
    <p>The art each part is drawn from, at its file's own size:</p>
    <div class="art">
      {#each art as { name, src }}
        <figure><img {src} alt="" /><figcaption>{name}</figcaption></figure>
      {/each}
    </div>
    {#if rig && pose}
      <p>Every pose at the same scale, three times page size, so the animal stays the same size whatever it does:</p>
      <div class="row lineup">
        {#each rig.modes as m}
          <figure><div class="spot" style="scale: 3"><Rig pose={rig.pose({ mode: m, now: 1300, walked: 1.3 }, { gaze: 0, still })} x={0} y={-lift} /></div><figcaption>{m}</figcaption></figure>
        {/each}
      </div>
    {/if}
  </section>

  <p>At page size, on a card top, both ways round:</p>
  <div class="row">
    {#each [1, -1] as const as d}
      <div class="spot">
        {#if rig && pose}
          <Rig pose={rig.pose(moment, { gaze: 0, still })} x={0} y={-lift} dir={d} />
        {:else if view}
          <svelte:component this={view.View} {mode} {now} {walked} dir={d} {playing} {still} guides={false} separate={false} hidden={[]} />
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .lab { padding: 24px; display: grid; gap: 14px; }
  .controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .controls .on { outline: 2px solid var(--accent); }
  .sep { width: 12px; }
  .timeline .scrub { flex: 1; min-width: 200px; }
  .timeline .number { width: 6em; }
  .timeline output { font-variant-numeric: tabular-nums; }
  .hint { font-size: 12px; opacity: .65; }
  .stage { position: relative; height: 380px; background: var(--paper-2); border-radius: 12px; overflow: hidden; }
  .floor { position: absolute; left: 0; right: 0; bottom: 60px; border-top: 2px solid var(--line-strong); }
  .big { position: absolute; left: 50%; bottom: 60px; width: 0; height: 0; transform-origin: 0 0; }
  .footprint { position: absolute; outline: .2px dashed var(--accent); opacity: .6; }
  .row { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 60px; padding: 30px 40px 0; border-bottom: 2px solid var(--line-strong); }
  .pieces, .lineup { gap: 24px 90px; padding-top: 70px; }
  .spot { position: relative; width: 40px; height: 0; transform-origin: 0 0; }
  figure { margin: 0; display: grid; gap: 6px; justify-items: start; }
  figcaption { font-size: 12px; opacity: .7; }
  .lineup figure, .pieces figure { height: 90px; align-content: end; }
  .art { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; }
  .art img { display: block; background: repeating-conic-gradient(#0001 0% 25%, #0000 0% 50%) 0 / 12px 12px; }
  .parts p, .lab > p { margin: 8px 0 0; font-size: 13px; }
</style>
