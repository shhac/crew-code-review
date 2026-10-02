<script lang="ts">
  // One spider, two ways. Walking: a generated body on legs drawn here, side
  // on and facing right, feet on the floor at y = 38 of a 78x40 box. Hanging:
  // a strip of four generated frames, head down, the silk tied at (31, 4) of
  // a 62x52 box. The caller places and flips it.
  //
  // The walking legs are code rather than art because a walk is eight legs
  // stepping in turn, and generated frames could not keep them in step.
  import { crouched, cycleLength, legsAt, restingLeg, tucked, type LegSpec } from '../spidergait';
  import Limb from './Limb.svelte';
  import body from './spider-body.webp';
  import hangingStrip from './spider-hanging.webp';

  export let moving = false;
  export let hanging = false;
  // Distance walked, in this drawing's pixels: it, not time, drives the step.
  export let walked = 0;
  // Gathering for a jump (0 to 1): the body sinks on bending legs.
  export let crouch = 0;
  // Mid-jump (0 to 1): the legs drawn in under the body.
  export let tuck = 0;

  const GROUND = 38;
  const STRIDE = 10;
  const LIFT = 5;

  // The far side arches high behind the body, back pair past the abdomen and
  // front pair past the fangs; lengths are chosen so each knee rests above
  // the body. The near side is drawn in front, as in the art, and kept low:
  // knees around the bottom of the body, so it frames the hourglass and the
  // face instead of crossing them. The two sides step on opposite beats.
  const farSide: LegSpec[] = [
    { hip: { x: 37, y: 25.5 }, reach: -27, thigh: 24.8, shin: 32, beat: 0.5 },
    { hip: { x: 39, y: 26.5 }, reach: -15, thigh: 20.7, shin: 28.2, beat: 0 },
    { hip: { x: 41, y: 26.5 }, reach: 15, thigh: 18.1, shin: 26.3, beat: 0.5 },
    { hip: { x: 43, y: 25.5 }, reach: 25, thigh: 18.9, shin: 25.1, beat: 0 },
  ];
  const nearSide: LegSpec[] = [
    { hip: { x: 36, y: 32 }, reach: -26, thigh: 16.1, shin: 18.4, beat: 0 },
    { hip: { x: 40, y: 33 }, reach: -14, thigh: 11.3, shin: 14.3, beat: 0.5 },
    { hip: { x: 48, y: 33 }, reach: 12, thigh: 10.6, shin: 12.6, beat: 0 },
    { hip: { x: 51, y: 32 }, reach: 21, thigh: 15.3, shin: 16.1, beat: 0.5 },
  ];

  const farRest = farSide.map((l) => restingLeg(l, GROUND));
  const nearRest = nearSide.map((l) => restingLeg(l, GROUND));

  $: phase = walked / cycleLength(STRIDE);
  const CROUCH = 4.5;
  $: sink = crouch * CROUCH;
  $: near = tucked(legsAt(crouched(nearSide, sink), phase, GROUND, STRIDE, LIFT), nearSide, tuck);
  $: far = tucked(legsAt(crouched(farSide, sink), phase, GROUND, STRIDE, LIFT), farSide, tuck);
  // The body dips a touch each time a set of feet takes its weight.
  $: bob = moving ? -0.5 * Math.abs(Math.sin(2 * Math.PI * phase)) : 0;

  // Each spider needs its own filter id; two on a page must not share one.
  const dim = `spider-far-${Math.random().toString(36).slice(2)}`;
</script>

{#if hanging}
  <span class="hang" class:moving style="background-image: url({hangingStrip})"></span>
{:else}
  <svg class="walker" viewBox="0 0 78 40" width="78" height="40">
    <!-- The far side is the same art in shadow, so it reads as behind. -->
    <filter id={dim}><feColorMatrix values=".55 0 0 0 0  0 .55 0 0 0  0 0 .6 0 0  0 0 0 1 0" /></filter>
    <g filter="url(#{dim})">
      {#each far as leg, i}<Limb {leg} rest={farRest[i]} />{/each}
    </g>
    <image href={body} x="16" y={11 + bob + sink} width="38" height="22.3" />
    {#each near as leg, i}<Limb {leg} rest={nearRest[i]} />{/each}
  </svg>
{/if}

<style>
  /* A faint pale rim keeps a black spider visible on a near-black page. */
  .walker, .hang { display: block; overflow: visible; filter: drop-shadow(0 0 .8px rgba(236, 240, 232, .55)); }

  /* Never still on the silk: idling paddles slowly, travelling paddles fast. */
  .hang {
    width: 62px; height: 52px; background-size: 248px 52px; background-repeat: no-repeat;
    animation: paddle 1.6s steps(4) infinite;
  }
  .hang.moving { animation-duration: .5s; }
  @keyframes paddle { to { background-position-x: -248px; } }
  @media (prefers-reduced-motion: reduce) {
    .hang { animation: none; }
  }
</style>
