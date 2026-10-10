import type { PageMap } from '../floors';
import { pageAt, roomOver } from '../ledges';
import type { Point } from '../pointer';
import { hash } from '../seed';
import { PECK, SETTLE, WALKER, type Crow } from './crow';
import { FOOTPRINTS, type CrowPose, type RigCrow } from './crow-rig';
import { flightAt, type Piece } from './flight';

// What a crow looks like now: where it is drawn on the page, which way it
// faces, and what its rig is to draw, from its mode and its flight. Pure,
// so the layer only adds what it remembers between frames (how far each
// has walked, how deep its strokes are).

// Each crow beats its wings at its own rate, 3.6 to 4 a second (the note,
// after Pennycuick's hooded crow at 3.84).
export const beatRate = (id: number) => 3.6 + 0.4 * hash(id * 13 + 5);
// Taking off, the kit's take-off pose runs this many beats before the
// plain flap.
const TAKEOFF_BEATS = 2;
// Landing, it flares for this long before its feet touch (two braking
// strokes at its wingbeat, and the swing up).
const FLARE = 600;

export type CrowView = { at: Point; dir: 1 | -1; rig: RigCrow; flying: boolean };
// What the layer remembers of a crow: how far it has walked (its stride
// follows the distance) and how deep its strokes are, eased.
export type Memory = { walked: number; depth: number };

// The stroke depth a piece of a route asks for: shallow skimming or
// leaving or landing low, full in open air.
const deep = (kind: Piece) => (kind === 'skim' || kind === 'lift' ? 0 : 1);
// What the layer eases a crow's strokes toward; null on the ledge, where it
// keeps the depth it landed with (its wings settle as they flew).
export const depthFor = (c: Crow, now: number): number | null => (c.flight ? deep(flightAt(c.flight, now).kind) : null);

export function crowView(c: Crow, page: PageMap, now: number, memory: Memory): CrowView | null {
  if (c.mode === 'away') return null;
  const rig = (pose: CrowPose, over: Partial<RigCrow> = {}): RigCrow => ({ pose, walked: memory.walked, seed: c.id + 1, beat: 0, t: 0, ...over });
  const beats = (since: number) => ((now - since) * beatRate(c.id)) / 1000;
  const f = page.floors.get(c.floor);
  const feet = f ? pageAt(f, c.x) : null;
  if (c.mode === 'takeoff' || c.mode === 'depart' || c.mode === 'arrive') {
    const flight = c.flight;
    if (!flight) return null;
    const started = now >= flight.start;
    const where = flightAt(flight, now);
    const at = started || !feet ? where.at : feet;
    // Taking off: the wings open half a beat before the first stroke.
    const off = c.mode === 'arrive' ? Infinity : beats(flight.start) - 0.5;
    // Taking off and landing, the depth is the hop's own, never eased.
    if (c.mode !== 'arrive' && off < TAKEOFF_BEATS) return { at, dir: c.dir, flying: true, rig: rig('takeoff', { beat: Math.max(-0.5, off), depth: deep(flight.kinds[0]) }) };
    // Landing: the flare over the last FLARE of the flight, as low or as
    // full as the piece it comes down by.
    const left = flight.start + flight.duration - now;
    if (c.mode === 'arrive' && left < FLARE) {
      return { at: where.at, dir: where.dir, flying: true, rig: rig('flare', { beat: beats(flight.start), t: 1 - left / FLARE, depth: deep(flight.kinds[flight.kinds.length - 1]) }) };
    }
    return { at: where.at, dir: where.dir, flying: true, rig: rig('flap', { beat: beats(flight.start), depth: memory.depth, climb: where.pitch }) };
  }
  if (!feet || !f) return null;
  const standing = { at: feet, dir: c.dir, flying: false };
  switch (c.mode) {
    case 'settle': return { ...standing, rig: rig('settle', { t: Math.min(1, (now - c.since) / SETTLE), depth: memory.depth }) };
    case 'walk': return { ...standing, rig: rig('walk') };
    case 'sidle': return { ...standing, rig: rig('sidle') };
    case 'peck': return { ...standing, rig: rig('peck', { t: (((now - c.since) % PECK) + PECK) % PECK / PECK }) };
    case 'wary': {
      // Alert where its stretched neck has room, else stood with its head up.
      const alert = FOOTPRINTS.alert;
      const room = roomOver(f, page, WALKER, c.x - alert.width / 2, c.x + alert.width / 2);
      return { ...standing, rig: rig(room >= alert.height ? 'alert' : 'stand') };
    }
    default: return { ...standing, rig: rig('stand') };
  }
}
