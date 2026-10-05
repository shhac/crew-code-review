import { snowPath } from './snow';
import { renderSnow, type Snow } from './wipe';

// One cached drawing per mounted ledge. Resting snow does no per-frame path
// work; wiped snow recovers at 10 Hz until its remaining change is < .001 px.
export function createSnowDrawing() {
  let previous: readonly Snow[] | undefined;
  let previousFeet: readonly number[] = [];
  let previousTick = NaN;
  let recoveringUntil = -Infinity;
  let drawing = { cover: '', shadow: '' };
  return (samples: readonly Snow[], now: number, feet: readonly number[], reduced: boolean) => {
    if (samples !== previous) {
      recoveringUntil = samples.reduce((until, s) => s.wiped === s.seed ? until : Math.max(until, s.at + 61500), -Infinity);
    }
    const tick = reduced || now >= recoveringUntil ? Infinity : Math.floor(now / 100) * 100;
    if (samples === previous && tick === previousTick
      && feet.length === previousFeet.length && feet.every((x, i) => x === previousFeet[i])) return drawing;
    const rendered = renderSnow(samples, tick, feet);
    drawing = { cover: snowPath(rendered), shadow: snowPath(rendered.map(s => ({ x: s.x, depth: Math.min(.65, s.depth) }))) };
    previous = samples;
    previousFeet = [...feet];
    previousTick = tick;
    return drawing;
  };
}
