<script lang="ts">
  // Chips in their paper, a bucket and spade and a 99 on a low drift of sand
  // on the rail's empty stretch above the identity chip, with a cockle
  // washed up beside them. The rail's sky stays empty this month: the gulls
  // are on the page. Nothing here moves.
  import { driftPath, shellPaths } from './drifts';
  import seasideKit from './seaside-kit.webp';

  // One long low drift under the kit, its crest under the bucket, drawn as
  // the ledges' drifts are.
  const drift = driftPath({ lo: 2, crest: 104, hi: 166, height: 9, grains: [] });
  const cockle = shellPaths('cockle', 7);
  const grains = [[30, 1], [52, 2], [71, 3.5], [128, 3], [146, 1.5]];
</script>

<div class="theme-shelf seaside-shelf" aria-hidden="true">
  <div class="stage">
    <svg class="drift" width="168" height="12" viewBox="0 -11 168 12">
      <path d={drift} fill="#d8bf8a" />
      <path d="M60 -5.6Q84 -8.6 104 -8.4" stroke="#ecd9a8" stroke-width="1.2" stroke-linecap="round" fill="none" />
      {#each grains as [x, y]}<rect x={x} y={-y} width="1" height="1" fill="#b49a66" />{/each}
      <g transform="translate(150 -1.2) rotate(-8)">
        <path d={cockle.body} fill="#f2e2cc" stroke="#9a7656" stroke-width=".8" stroke-linejoin="round" />
        <path d={cockle.lines} fill="none" stroke="#b8936c" stroke-width=".7" stroke-linecap="round" />
      </g>
    </svg>
    <img class="kit" src={seasideKit} alt="" width="114" height="64" />
  </div>
</div>

<style>
  .seaside-shelf { display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .stage { position: relative; width: 168px; height: 70px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .kit { left: 22px; top: 0; }
  .drift { position: absolute; left: 0; bottom: 0; overflow: visible; }
</style>
