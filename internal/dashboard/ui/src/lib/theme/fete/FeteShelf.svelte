<script lang="ts">
  // The fête's cake stall on the rail's empty stretch above the identity
  // chip: a coconut shy, a prize-winning Victoria sandwich on its stand and
  // three jars of jam, on a white tablecloth. The wasps that come to the
  // cake keep to the rail's air above it.
  import table from './fete-table.webp';
  import { ART, CLOTH, STAGE } from './table';

  // The cloth's scalloped hem, one scallop every 7px.
  const HEM = `M0 ${CLOTH}H${STAGE.width}V${STAGE.height - 3}`
    + Array.from({ length: 24 }, () => 'q-3.5 4 -7 0').join('')
    + 'Z';
</script>

<div class="theme-shelf fete-shelf" aria-hidden="true">
  <div class="stage">
    <svg class="cloth" width={STAGE.width} height={STAGE.height} viewBox="0 0 {STAGE.width} {STAGE.height}">
      <path d={HEM} fill="#f4ecd8" />
      <path d="M0 {CLOTH + 0.6}H{STAGE.width}" stroke="#d8ccb0" stroke-width="1.2" />
    </svg>
    <img class="table" src={table} alt="" width={ART.width} height={ART.height} style="left: {ART.left}px; top: {ART.top}px" />
  </div>
</div>

<style>
  .fete-shelf { position: relative; display: flex; justify-content: center; padding-top: 22px; pointer-events: none; user-select: none; }
  .stage { position: relative; width: 168px; height: 72px; flex: none; }
  img { display: block; position: absolute; max-width: none; }
  .cloth { position: absolute; left: 0; top: 0; }
</style>
