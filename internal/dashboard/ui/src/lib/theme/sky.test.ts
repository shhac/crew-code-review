import { describe, expect, it } from 'vitest';
import { measureRailAir, measureRailSky } from './sky';

const rect = (top: number, bottom: number) => ({ getBoundingClientRect: () => ({ left: 10, top, bottom }) });
const shelf = (top: number, navBottom: number, shown = true) => ({
  ...rect(top, top + 100), clientWidth: 220, offsetParent: shown ? {} : null, previousElementSibling: rect(0, navBottom),
});

describe('measureRailSky', () => {
  it('spans from the nav, less a gap, down to the shelf', () => {
    expect(measureRailSky(shelf(600, 400))).toEqual({ left: 10, top: 416, width: 220, height: 184 });
  });

  it('caps a tall rail and never goes negative', () => {
    expect(measureRailSky(shelf(900, 100))).toMatchObject({ top: 660, height: 240 });
    expect(measureRailSky(shelf(400, 395))).toMatchObject({ height: 0 });
  });

  it('is absent while the shelf is hidden or has nothing above it', () => {
    expect(measureRailSky(shelf(600, 400, false))).toBeNull();
    expect(measureRailSky({ ...shelf(600, 400), previousElementSibling: null })).toBeNull();
    expect(measureRailSky(null)).toBeNull();
  });
});

describe('measureRailAir', () => {
  it('stretches the sky down through the shelf to its bottom edge', () => {
    expect(measureRailAir(shelf(600, 400))).toEqual({ left: 10, top: 416, width: 220, height: 284 });
  });

  it('is the shelf alone when the sky has no height, and capped as the sky is', () => {
    expect(measureRailAir(shelf(400, 395))).toEqual({ left: 10, top: 400, width: 220, height: 100 });
    expect(measureRailAir(shelf(900, 100))).toMatchObject({ top: 660, height: 340 });
  });

  it('is absent whenever the sky is', () => {
    expect(measureRailAir(shelf(600, 400, false))).toBeNull();
    expect(measureRailAir({ ...shelf(600, 400), previousElementSibling: null })).toBeNull();
    expect(measureRailAir(null)).toBeNull();
  });
});
