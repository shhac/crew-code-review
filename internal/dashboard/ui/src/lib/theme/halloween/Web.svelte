<script lang="ts">
  // A corner web, strung from the corner at (0, 0) out into the page. Drawn
  // for the top-left; the caller mirrors it into whichever corner it sits in.
  export let size = 150;

  const SPOKES = [5, 19, 33, 47, 61, 75, 87].map((deg) => (deg * Math.PI) / 180);
  // Uneven on purpose: a perfectly regular web looks printed.
  const REACH = [0.98, 0.9, 1, 0.94, 0.99, 0.88, 0.96];
  const RINGS = [0.17, 0.31, 0.45, 0.59, 0.73, 0.86];
  // How far a strand sags toward the hub between two spokes.
  const SAG = 0.84;

  const at = (r: number, a: number) => `${(r * size * Math.cos(a)).toFixed(1)} ${(r * size * Math.sin(a)).toFixed(1)}`;

  $: spokes = SPOKES.map((a, i) => `M0 0 L${at(REACH[i], a)}`).join(' ');
  $: rings = RINGS.map((r) =>
    SPOKES.slice(1)
      .map((a, i) => {
        const prev = SPOKES[i];
        return `M${at(r, prev)} Q${at(r * SAG, (prev + a) / 2)} ${at(r, a)}`;
      })
      .join(' '),
  ).join(' ');
  // One snapped strand drifting loose, so it reads as old.
  $: loose = `M${at(0.73, SPOKES[3])} q${(size * 0.05).toFixed(1)} ${(size * 0.12).toFixed(1)} ${(size * 0.02).toFixed(1)} ${(size * 0.22).toFixed(1)}`;
</script>

<svg class="web" viewBox="0 0 {size} {size}" width={size} height={size}>
  <path d={spokes} />
  <path d={rings} />
  <path class="loose" d={loose} />
</svg>

<style>
  .web { display: block; overflow: visible; }
  path { fill: none; stroke: rgba(226, 232, 226, .34); stroke-width: 1; stroke-linecap: round; }
  .loose { stroke: rgba(226, 232, 226, .22); }
</style>
