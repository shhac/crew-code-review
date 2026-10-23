<script lang="ts">
  // The skeleton's codes and what each is, part by part: a row for every
  // joint and bone, pointed at or clicked just as on the stage, and lit
  // when the stage lights it.
  import { legendOf, litBy, type Skeleton } from './skeleton';

  export let skeleton: Skeleton;
  export let selected: string | null;
  export let pinned: string | null;
  export let hover: (code: string | null) => void;
  export let pick: (code: string) => void;

  $: parts = legendOf(skeleton);
  $: lit = litBy(skeleton, selected);
</script>

<section class="legend" data-legend aria-label="skeleton legend">
  {#each parts as { group, rows }}
    <div class="part">
      <h4><code>{group.code}</code> {group.title}</h4>
      {#each rows as row}
        <button type="button" data-row={row.code} class:lit={lit.has(row.code)} aria-pressed={pinned === row.code}
          on:mouseenter={() => hover(row.code)} on:mouseleave={() => hover(null)}
          on:focus={() => hover(row.code)} on:blur={() => hover(null)} on:click={() => pick(row.code)}>
          <code>{row.code}</code> {row.name}
        </button>
      {/each}
    </div>
  {/each}
</section>

<style>
  .legend { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px 18px; font-size: 12px; }
  .part { display: grid; gap: 1px; align-content: start; }
  h4 { margin: 0 0 3px; font-size: 12px; font-weight: 600; }
  button { all: unset; cursor: pointer; padding: 1px 6px; border-radius: 4px; }
  button:focus-visible { outline: 2px solid var(--accent); }
  button.lit { background: #ffe06633; }
  button[aria-pressed='true'] { background: #ffe06666; font-weight: 600; }
  code { display: inline-block; min-width: 3.6em; font-weight: 600; }
</style>
