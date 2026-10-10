<script lang="ts">
  // A scarecrow on its post beside a wheat sheaf, marrows and apples on the
  // rail's empty stretch above the identity chip. Its sleeves stir in the
  // wind; a moving cursor passing near makes it flap them, which scatters
  // every crow on the page (the alarm). Nothing moves, and no alarm is sent,
  // under reduced motion or while the shelf is hidden on a cramped rail.
  import { onMount } from 'svelte';
  import { sceneLoop } from '../lifecycle';
  import { observePointer, pointerTracker } from '../pointer';
  import { alarm } from './alarm';
  import stillLife from './harvest-still-life.webp';
  import { armAngle, endOf, hatLift, RESTING, stir, type Scarecrow } from './scarecrow';
  import body from './scarecrow-body.webp';
  import hat from './scarecrow-hat.webp';
  import leftArm from './scarecrow-left-arm.webp';
  import rightArm from './scarecrow-right-arm.webp';

  let figure: HTMLElement;
  let scarecrow: Scarecrow = RESTING;
  let left = 0;
  let right = 0;
  let lift = 0;

  onMount(() => {
    const pointer = pointerTracker();
    let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loop = sceneLoop((now, still) => {
      reduced = still;
      if (still) scarecrow = RESTING;
      left = armAngle(scarecrow, 'left', now, still);
      right = armAngle(scarecrow, 'right', now, still);
      lift = hatLift(scarecrow, now, still);
    }, () => pointer.reset());
    const stopPointer = observePointer((e) => {
      if (reduced || document.hidden || !figure?.offsetParent) { pointer.reset(); return; }
      const stroke = pointer.move(e, performance.now());
      if (!stroke) return;
      const box = figure.getBoundingClientRect();
      const { scarecrow: next, started } = stir(scarecrow, stroke, box);
      if (next === scarecrow) return;
      const until = endOf(next);
      scarecrow = next;
      const middle = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
      alarm.update((sent) => (started || !sent ? { at: next.start, until, ...middle } : { ...sent, until }));
    }, () => pointer.reset());
    return () => { loop.stop(); stopPointer(); };
  });
</script>

<div class="theme-shelf harvest-shelf" aria-hidden="true">
  <div class="stage">
    <div class="scarecrow" bind:this={figure} data-scarecrow>
      <img class="arm left" src={leftArm} alt="" style="rotate: {left}deg" />
      <img class="arm right" src={rightArm} alt="" style="rotate: {-right}deg" />
      <img class="body" src={body} alt="" width="26" height="55" />
      <img class="hat" src={hat} alt="" style="translate: 0 {-lift}px" />
    </div>
    <img class="still-life" src={stillLife} alt="" width="72" height="42" />
  </div>
</div>

<style>
  .harvest-shelf { display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  /* Room above the scarecrow for its hat's jolt. */
  .stage { position: relative; width: 168px; height: 66px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  /* The scarecrow's box at rest, sleeves out: what a stroke is measured to. */
  .scarecrow { position: absolute; left: 6px; bottom: 0; width: 66.8px; height: 64px; }
  .body { left: 19.9px; top: 8.8px; }
  .hat { left: 18.1px; top: 0; width: 29.5px; height: 15.5px; }
  /* Each sleeve hangs from its own shoulder, under the jacket's edge. */
  .arm { top: 22.5px; width: 23.5px; height: 12px; }
  .left { left: 0; transform-origin: 23.5px 6px; }
  .right { left: 43.4px; transform-origin: -0.3px 6px; }
  .still-life { right: 6px; bottom: 0; }
</style>
