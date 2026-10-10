import { boundsOf, envelopeOf, fits, GAP, sweptPath, type Air, type Envelope } from '../air';
import type { Box, Obstacle, PageMap } from '../floors';
import type { Point } from '../pointer';
import type { Chaff } from './chaff';
import { FOOTPRINTS, LOW_FOOTPRINTS, type Footprint } from './crow-rig';
import type { Field } from './crows';
import type { Leg, Piece, Route } from './flight';

// The crows' air (the note's airspace contract): the page's open air, open
// past its top and right edges (the surfaces kit's exits), minus every
// text, control and chart and each card's box shrunk by 6px on every side,
// since a crow may overlap a card's empty edge by as much as a standing
// animal may, never its inside. Each piece of a route is swept with its own
// envelope: taking off or flaring to land at the ledge, skimming its band,
// or flapping in open air.

// How far into a card's empty edge a crow may reach.
const EDGE = 6;

// The box every flying pose stays inside, for the bird kit's sweep.
const largest = (...boxes: Footprint[]): Footprint => ({
  width: Math.max(...boxes.map((b) => b.width)), height: Math.max(...boxes.map((b) => b.height)), down: Math.max(...boxes.map((b) => b.down ?? 0)),
});
// A skim's envelope holds a low take-off or landing too: each runs on past
// the short hop into the skim (the take-off two beats, the flare its last
// 0.6s).
const SKIMMING = envelopeOf(largest(FOOTPRINTS.skim, LOW_FOOTPRINTS.takeoff, LOW_FOOTPRINTS.flare));
export const ENVELOPES: Record<Leg, Record<Piece, Envelope>> = {
  depart: {
    hop: envelopeOf(largest(FOOTPRINTS.takeoff, FOOTPRINTS.flap)), lift: envelopeOf(largest(LOW_FOOTPRINTS.takeoff, FOOTPRINTS.skim)),
    skim: SKIMMING, climb: envelopeOf(FOOTPRINTS.flap),
  },
  arrive: {
    hop: envelopeOf(largest(FOOTPRINTS.flare, FOOTPRINTS.settle, FOOTPRINTS.flap)), lift: envelopeOf(largest(LOW_FOOTPRINTS.flare, LOW_FOOTPRINTS.settle, FOOTPRINTS.skim)),
    skim: SKIMMING, climb: envelopeOf(FOOTPRINTS.flap),
  },
};

// Cards shrunk so that, widened again by the air's GAP, a crow may reach
// EDGE into them.
const shrunk = (o: Obstacle): Obstacle => {
  if (!o.block) return o;
  const by = EDGE + GAP;
  return { ...o, left: o.left + by, right: o.right - by, top: o.top + by, bottom: o.bottom - by };
};

// No hover spots: crows never hover, and sampling the page for them on every
// scroll would cost a frame.
export const crowAir = (page: PageMap): Air => ({ page, ...boundsOf(page, ['top', 'right']), spots: [] });

// Whether a box is in the crows' air.
export function inCrowAir(air: Air): (box: Box) => boolean {
  const obstacles = air.page.obstacles.map(shrunk).filter((o) => o.right > o.left && o.bottom > o.top);
  return (box) => fits(air, box, [], obstacles);
}

// The route's pieces swept with their envelopes, the boxes for the debug
// overlay.
export function sweep(route: Route, leg: Leg, clear: (box: Box) => boolean) {
  const segments = route.curves.map((c, i) => ({ curve: { from: c.from, control1: c.c1, control2: c.c2, to: c.to }, envelope: ENVELOPES[leg][route.kinds[i]] }));
  return sweptPath(segments, clear);
}

// Everything the crows are placed against on this page.
export function fieldOf(page: PageMap, chaff: ReadonlyMap<number, Chaff>): Field {
  const air = crowAir(page);
  const inside = inCrowAir(air);
  const flap = FOOTPRINTS.flap;
  return {
    page, chaff,
    clear: (route, leg) => sweep(route, leg, inside).clear,
    envelope: (p: Point) => ({ left: p.x - flap.width / 2, right: p.x + flap.width / 2, top: p.y - flap.height, bottom: p.y + (flap.down ?? 0) }),
  };
}
