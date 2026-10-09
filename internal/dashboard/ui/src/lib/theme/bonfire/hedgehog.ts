import { clearance, inView, type Ledge, type PageMap } from '../floors';
import type { Cursor, Point } from '../pointer';
import { between, maxBy, type Rand } from '../seed';

// A few hedgehogs sharing a small unlit woodpile on one card top. They stay
// in while the cursor is moving; once the page has been still for a while
// they peek out one at a time, then potter along the ledge sniffing, each
// keeping its distance from the others. A cursor moving close makes one curl
// into a ball; once things are quiet it uncurls and hurries home, and any
// between it and the pile hurry home ahead of it. Everything is in
// ledge-local x, so the pile and the hedgehogs ride along with their card as
// the page scrolls.

// The woodpile's footprint, and a hedgehog's, in page pixels (the art's
// display sizes, design-docs/bonfire/export.py, and the rig put together in
// hedgehog-rig.ts). The pile is the taller, so a hedgehog behind it is hidden.
export const PILE = { width: 70, height: 20 };
export const HOG = { width: 30, height: 18 };
// Kept off the ledge's ends, and the pile kept clear of the right one.
const INSET = 24;
// The pile and the hedgehog stand up to this tall, so a home needs this much
// clear space above its ledge: up to the next floor, and free of the text,
// controls and cards that the obstacles cover. The dashboard's gaps between
// cards are about 25px, which is what sized the art.
const HEADROOM = 22;
const MIN_WIDTH = 220;
// A ledge whose free stretch is shorter than this is only good for peeking.
const MIN_ROAM = 40;
// How finely the hedgehog's range is searched for obstacles.
const STEP = 4;

const STILL = 2500;
const PEEK = 1400;
const NEAR = 80;
const STARTLED = 120;
const SPEED = 16;
const HURRY = 34;

// Hedgehogs keep at least this far apart, body to body.
const GAP = 6;
const SPACING = HOG.width + GAP;
// A range this long has room for three to sniff apart and still move about.
const ROOMY = 4 * SPACING;

export type Mode = 'hidden' | 'peek' | 'walk' | 'sniff' | 'curled' | 'flee' | 'home';
export type Home = { floor: number; pile: number; lo: number; hi: number };
// walked: distance walked, which drives its steps. seed: its own blinks.
export type Hog = { id: number; seed: number; x: number; dir: 1 | -1; mode: Mode; target: number; until: number; out: number; walked: number };
export type Hogs = { home: Home | null; hogs: Hog[] };

// Any text, chart, control or card in the band just above the ledge blocks
// the part of the ledge under it. A heading rule qualifies only along the
// stretch its own text leaves free.
const blocked = (f: Ledge, scene: PageMap, x0: number, x1: number) => clearance(f, scene.obstacles, x0, x1) < HEADROOM;

// Walks left from hi, a step at a time, until the hedgehog would stand under
// something or reach the ledge's inset; returns how far it got.
function reachLeft(f: Ledge, scene: PageMap, hi: number): number {
  const steps = Array.from({ length: Math.max(0, Math.floor((hi - INSET - HOG.width / 2) / STEP)) }, (_, i) => hi - STEP * (i + 1));
  const free = steps.findIndex((x) => blocked(f, scene, x - HOG.width / 2, x + HOG.width / 2));
  return hi - STEP * (free === -1 ? steps.length : free);
}

// The woodpile goes near the right end, opening to the left; the hedgehog's
// range runs leftwards from it to the first thing in the way. A new home must
// be in view; an existing one is kept while its card scrolls away, so the
// pile never jumps to another card.
function homeOn(id: number, f: Ledge, scene: PageMap, fresh = true): Home | null {
  const width = f.right - f.left;
  if (width < MIN_WIDTH || f.headroom < HEADROOM) return null;
  if (fresh && !inView(f, scene)) return null;
  const pile = width - INSET - PILE.width / 2;
  if (blocked(f, scene, pile - PILE.width / 2, pile + PILE.width / 2)) return null;
  const hi = pile - PILE.width / 2 - HOG.width / 2 + 4;
  return { floor: id, pile, lo: reachLeft(f, scene, hi), hi };
}

const sameHome = (a: Home | null, b: Home | null) => !!a && !!b && a.floor === b.floor && a.pile === b.pile;

export function chooseHome(scene: PageMap, previous: Home | null = null): Home | null {
  const held = previous && scene.floors.get(previous.floor);
  const again = previous && held ? homeOn(previous.floor, held, scene, false) : null;
  if (sameHome(again, previous)) return again;
  // The roomiest ledge in view, so the hedgehogs have somewhere to walk.
  const homes = [...scene.floors].flatMap(([id, f]) => homeOn(id, f, scene) ?? []);
  return maxBy(homes, (h) => h.hi - h.lo) ?? null;
}

// Two share a pile, or three where there is room for them all to roam.
const countFor = (home: Home) => (home.hi - home.lo >= ROOMY ? 3 : 2);
const mouth = (home: Home) => home.pile - PILE.width / 2 + 2;

// Hedgehogs newly moved in: tucked inside the pile, waiting for stillness,
// and coming out a little apart.
function movedIn(home: Home | null, now: number, rand: Rand): Hogs {
  if (!home) return { home, hogs: [] };
  const hogs = Array.from({ length: countFor(home) }, (_, id): Hog => ({
    id, seed: id + 1, x: home.pile, dir: -1, mode: 'hidden', target: 0, until: now + STILL + id * between(rand, 1500, 4000), out: now, walked: 0,
  }));
  return { home, hogs };
}
const hide = (hog: Hog, home: Home, until: number): Hog => ({ ...hog, mode: 'hidden', x: home.pile, until });
const headHome = (hog: Hog, home: Home, mode: 'home' | 'flee'): Hog => ({ ...hog, mode, target: home.hi, dir: 1 });
const clampTo = (home: Home, x: number) => Math.max(home.lo, Math.min(home.hi, x));
const visible = (hog: Hog) => hog.mode !== 'hidden';
const homeward = (hog: Hog) => hog.mode === 'home' || hog.mode === 'flee';

export const createHogs = (scene: PageMap, now: number, rand: Rand): Hogs => movedIn(chooseHome(scene), now, rand);

// After a layout change: the same home if it is still good, every hedgehog
// pulled back into its range (any that would then crowd another is tucked
// away); otherwise a new home with everyone tucked away in it.
export function reconcileHogs(group: Hogs, scene: PageMap, now: number, rand: Rand): Hogs {
  const home = chooseHome(scene, group.home);
  if (!home || !sameHome(home, group.home)) return movedIn(home, now, rand);
  const hogs = group.hogs.reduce<Hog[]>((placed, hog) => {
    if (hog.mode === 'hidden' || hog.mode === 'peek') return [...placed, hog];
    const kept = { ...hog, x: clampTo(home, hog.x), target: clampTo(home, hog.target) };
    const crowded = placed.some((o) => o.mode !== 'hidden' && o.mode !== 'peek' && Math.abs(o.x - kept.x) < SPACING);
    return [...placed, crowded ? hide(kept, home, now + STILL) : kept];
  }, []);
  return { home, hogs };
}

// Where a hedgehog is on the page, or null when it has no home.
export function hogPoint(hog: Hog, home: Home | null, scene: PageMap): Point | null {
  const f = home && scene.floors.get(home.floor);
  return f ? { x: f.left + hog.x, y: f.y } : null;
}

const near = (hog: Hog, home: Home, scene: PageMap, cursor: Cursor | null, now: number) => {
  const at = hogPoint(hog, home, scene);
  return !!at && !!cursor && now - cursor.at < STARTLED && Math.hypot(cursor.x - at.x, cursor.y - (at.y - HOG.height / 2)) < NEAR;
};

const curl = (hog: Hog, now: number, rand: Rand): Hog => ({ ...hog, mode: 'curled', until: now + between(rand, 3000, 4500) });

// The stretch of the range a hedgehog may wander in: between its nearest
// neighbours on either side, keeping its distance from both.
function lane(hog: Hog, home: Home, others: readonly Hog[]): { lo: number; hi: number } {
  const out = others.filter((o) => visible(o) && o.mode !== 'peek');
  const left = out.filter((o) => o.x <= hog.x).map((o) => o.x + SPACING);
  const right = out.filter((o) => o.x > hog.x).map((o) => o.x - SPACING);
  return { lo: Math.max(home.lo, ...left), hi: Math.min(home.hi, ...right) };
}

function wander(hog: Hog, home: Home, others: readonly Hog[], now: number, rand: Rand): Hog {
  const room = lane(hog, home, others);
  if (home.hi - home.lo < MIN_ROAM || room.hi - room.lo < 4 || now - hog.out > between(rand, 20000, 40000)) return headHome(hog, home, 'home');
  const target = between(rand, room.lo, room.hi);
  return { ...hog, mode: 'walk', target, dir: target < hog.x ? -1 : 1 };
}

// Out of the pile: wander off, unless there is nowhere to wander.
function emerge(hog: Hog, home: Home, others: readonly Hog[], now: number, rand: Rand): Hog {
  if (home.hi - home.lo < MIN_ROAM || lane(hog, home, others).hi < home.lo) return hide(hog, home, now + 4 * STILL);
  return wander({ ...hog, out: now }, home, others, now, rand);
}

// How far it may go toward its target before it would come within SPACING
// of a hedgehog in the way (one out on the ledge, not at the pile's mouth).
function clearAhead(hog: Hog, others: readonly Hog[], step: number): number {
  const ahead = others.filter((o) => visible(o) && o.mode !== 'peek' && (o.x - hog.x) * hog.dir > 0).map((o) => Math.abs(o.x - hog.x) - SPACING);
  return Math.max(0, Math.min(step, ...ahead));
}

// Walking, heading home or fleeing: a step toward the target, then a sniff
// on arrival from a walk, or back into the pile from either trip home. A
// walk blocked by another hedgehog ends in a sniff where it stands; a trip
// home waits for the way to clear.
function travel(hog: Hog, home: Home, others: readonly Hog[], now: number, dt: number, rand: Rand): Hog {
  const step = (hog.mode === 'flee' ? HURRY : SPEED) * dt / 1000;
  const gap = hog.target - hog.x;
  const dir = gap < 0 ? -1 : 1;
  if (Math.abs(gap) <= step) {
    if (hog.mode !== 'walk') return hide(hog, home, now + 4 * STILL);
    return { ...hog, x: hog.target, walked: hog.walked + Math.abs(gap), mode: 'sniff', until: now + between(rand, 1500, 4000) };
  }
  const moved = clearAhead({ ...hog, dir }, others, step);
  if (moved === 0 && hog.mode === 'walk') return { ...hog, mode: 'sniff', until: now + between(rand, 1500, 4000) };
  return { ...hog, x: hog.x + dir * moved, walked: hog.walked + moved, dir };
}

// One step of a hedgehog's day, given where the others are. dt is in ms.
function stepHog(hog: Hog, home: Home, others: readonly Hog[], scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Hog {
  const stillFor = cursor ? now - cursor.at : Infinity;
  switch (hog.mode) {
    case 'hidden': {
      // One at a time at the mouth, and never while another is coming in.
      const busy = others.some((o) => o.mode === 'peek' || homeward(o) || (visible(o) && Math.abs(o.x - mouth(home)) < SPACING));
      if (now < hog.until || stillFor < STILL || busy) return hog;
      return { ...hog, mode: 'peek', x: mouth(home), dir: -1, until: now + PEEK };
    }
    case 'peek':
      if (stillFor < PEEK || others.some(homeward)) return hide(hog, home, now + STILL);
      return now < hog.until ? hog : emerge(hog, home, others, now, rand);
    case 'curled':
      if (near(hog, home, scene, cursor, now)) return { ...hog, until: Math.max(hog.until, now + 2500) };
      return now < hog.until ? hog : headHome(hog, home, 'flee');
    case 'sniff':
      if (near(hog, home, scene, cursor, now)) return curl(hog, now, rand);
      return now < hog.until ? hog : wander(hog, home, others, now, rand);
    case 'walk':
    case 'home':
    case 'flee':
      return near(hog, home, scene, cursor, now) ? curl(hog, now, rand) : travel(hog, home, others, now, dt, rand);
  }
}

// One step for the whole group, each hedgehog in turn seeing the others as
// they now are. One that starts to flee sends any between it and the pile,
// out and not curled up, hurrying home ahead of it.
export function stepHogs(group: Hogs, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Hogs {
  const home = group.home;
  if (!home) return group;
  const hogs = group.hogs.reduce<Hog[]>((all, _, i) => {
    const hog = all[i];
    const next = stepHog(hog, home, all.filter((_, j) => j !== i), scene, now, dt, rand, cursor);
    const fled = hog.mode !== 'flee' && next.mode === 'flee';
    return all.map((o, j) => {
      if (j === i) return next;
      const inWay = fled && (o.mode === 'walk' || o.mode === 'sniff' || o.mode === 'home') && o.x > next.x;
      return inWay ? headHome(o, home, 'flee') : o;
    });
  }, group.hogs);
  return { home, hogs };
}

// The modes in which a hedgehog is on the move, and so steps.
export const moving = (mode: Mode) => mode === 'walk' || mode === 'home' || mode === 'flee';

// Reduced motion: sat in a row beside the pile, facing out, never moving;
// the same home and the same number as before where that still holds, so a
// scroll changes nothing. Any the range has no room for stay inside.
export function restingHogs(scene: PageMap, previous: Hogs | null): Hogs {
  const home = chooseHome(scene, previous?.home ?? null);
  if (!home) return { home, hogs: [] };
  const count = previous && sameHome(home, previous.home) && previous.hogs.length ? previous.hogs.length : countFor(home);
  const hogs = Array.from({ length: count }, (_, id): Hog => {
    const x = home.hi - 10 - id * SPACING;
    const fits = x >= home.lo;
    return { id, seed: id + 1, x: fits ? x : home.pile, dir: -1, mode: fits ? 'sniff' : 'hidden', target: 0, until: Infinity, out: 0, walked: 0 };
  });
  return { home, hogs };
}
