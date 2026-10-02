<script lang="ts">
  // A candle flame with its glow, standing on the point its parent puts it
  // at: the parent positions a zero-size box on the wick tip and this sits on
  // top of it. Beat and delay keep neighbouring flames out of step.
  export let width = 10;
  export let beat = 1.3;
  export let delay = 0;
</script>

<span class="flame" style="--w: {width}px; --beat: {beat}s; --delay: {delay}s">
  <span class="halo"></span>
  <svg viewBox="0 0 12 20" width={width} height={width * 1.7}>
    <path d="M6 0C8.6 5.4 12 9.4 12 13.8A6 6 0 0 1 0 13.8C0 9.4 3.4 5.4 6 0Z" fill="#ff9324" />
    <path d="M6 7C7.6 10 9 11.8 9 14.4A3 3 0 0 1 3 14.4C3 11.8 4.4 10 6 7Z" fill="#ffe46a" />
  </svg>
</span>

<style>
  .flame { position: absolute; left: 0; top: 0; transform: translate(-50%, -88%); }
  svg {
    display: block; position: relative; transform-origin: 50% 100%;
    animation: flicker var(--beat) ease-in-out var(--delay) infinite alternate;
  }
  .halo {
    position: absolute; left: 50%; top: 60%; width: calc(var(--w) * 3.4); aspect-ratio: 1;
    transform: translate(-50%, -50%); border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 170, 60, .45), rgba(255, 140, 30, 0) 70%);
    animation: breathe var(--beat) ease-in-out var(--delay) infinite alternate;
  }
  @keyframes flicker {
    0% { transform: scale(1, 1) skewX(0deg); }
    30% { transform: scale(.94, 1.1) skewX(-4deg); }
    60% { transform: scale(1.04, .93) skewX(3deg); }
    100% { transform: scale(.97, 1.06) skewX(-2deg); }
  }
  @keyframes breathe { from { opacity: .65; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    svg, .halo { animation: none; }
  }
</style>
