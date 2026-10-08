import { clearance, inView, type Ledge, type PageMap } from '../floors';
import type { Cursor, Point } from '../pointer';
import { between, maxBy, type Rand } from '../seed';

// A hedgehog living in a small unlit woodpile on one card top. It stays in
// while the cursor is moving, peeks out once the page has been still for a
// while, then potters along its ledge sniffing. A cursor moving close makes
// it curl into a ball; once things are quiet it uncurls and hurries home.
// Everything is in ledge-local x, so the pile and the hedgehog ride along
// with their card as the page scrolls.

// The woodpile's footprint, and the hedgehog's, in page pixels (the exported
// art's display sizes, see design-docs/bonfire/export.py). The pile is the
// taller, so a hedgehog behind it is hidden.
export const PILE = { width: 70, height: 20 };
export const HOG = { width: 26, height: 18 };
export const BALL = { width: 18, height: 18 };
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

export type Mode = 'hidden' | 'peek' | 'walk' | 'sniff' | 'curled' | 'flee' | 'home';
export type Home = { floor: number; pile: number; lo: number; hi: number };
export type Hog = { home: Home | null; x: number; dir: 1 | -1; mode: Mode; target: number; until: number; out: number };

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
  // The roomiest ledge in view, so the hedgehog has somewhere to walk.
  const homes = [...scene.floors].flatMap(([id, f]) => homeOn(id, f, scene) ?? []);
  return maxBy(homes, (h) => h.hi - h.lo) ?? null;
}

// A hedgehog newly moved in: tucked inside its pile, waiting for stillness.
const movedIn = (home: Home | null, now: number): Hog => ({ home, x: home?.pile ?? 0, dir: -1, mode: 'hidden', target: 0, until: now + STILL, out: now });
const hide = (hog: Hog, home: Home, until: number): Hog => ({ ...hog, mode: 'hidden', x: home.pile, until });
const headHome = (hog: Hog, home: Home, mode: 'home' | 'flee'): Hog => ({ ...hog, mode, target: home.hi, dir: 1 });
const clampTo = (home: Home, x: number) => Math.max(home.lo, Math.min(home.hi, x));

export const createHog = (scene: PageMap, now: number): Hog => movedIn(chooseHome(scene), now);

// After a layout change: the same home if it is still good, otherwise a new
// one with the hedgehog tucked away in it.
export function reconcileHog(hog: Hog, scene: PageMap, now: number): Hog {
  const home = chooseHome(scene, hog.home);
  if (!home || !sameHome(home, hog.home)) return movedIn(home, now);
  if (hog.mode === 'hidden' || hog.mode === 'peek') return { ...hog, home };
  return { ...hog, home, x: clampTo(home, hog.x), target: clampTo(home, hog.target) };
}

// Where the hedgehog is on the page, or null when it has no home.
export function hogPoint(hog: Hog, scene: PageMap): Point | null {
  const f = hog.home && scene.floors.get(hog.home.floor);
  return f ? { x: f.left + hog.x, y: f.y } : null;
}

const near = (hog: Hog, scene: PageMap, cursor: Cursor | null, now: number) => {
  const at = hogPoint(hog, scene);
  return !!at && !!cursor && now - cursor.at < STARTLED && Math.hypot(cursor.x - at.x, cursor.y - (at.y - HOG.height / 2)) < NEAR;
};

const curl = (hog: Hog, now: number, rand: Rand): Hog => ({ ...hog, mode: 'curled', until: now + between(rand, 3000, 4500) });

function wander(hog: Hog, home: Home, now: number, rand: Rand): Hog {
  if (home.hi - home.lo < MIN_ROAM || now - hog.out > between(rand, 20000, 40000)) return headHome(hog, home, 'home');
  const target = between(rand, home.lo, home.hi);
  return { ...hog, mode: 'walk', target, dir: target < hog.x ? -1 : 1 };
}

// Out of the pile: wander off, unless there is nowhere to wander.
function emerge(hog: Hog, home: Home, now: number, rand: Rand): Hog {
  return home.hi - home.lo < MIN_ROAM ? hide(hog, home, now + 4 * STILL) : wander({ ...hog, out: now }, home, now, rand);
}

// Walking, heading home or fleeing: a step toward the target, then a sniff
// on arrival from a walk, or back into the pile from either trip home.
function travel(hog: Hog, home: Home, now: number, dt: number, rand: Rand): Hog {
  const step = (hog.mode === 'flee' ? HURRY : SPEED) * dt / 1000;
  const gap = hog.target - hog.x;
  if (Math.abs(gap) > step) return { ...hog, x: hog.x + Math.sign(gap) * step, dir: gap < 0 ? -1 : 1 };
  if (hog.mode !== 'walk') return hide(hog, home, now + 4 * STILL);
  return { ...hog, x: hog.target, mode: 'sniff', until: now + between(rand, 1500, 4000) };
}

// One step of the hedgehog's day. dt is in milliseconds.
export function stepHog(hog: Hog, scene: PageMap, now: number, dt: number, rand: Rand, cursor: Cursor | null): Hog {
  const home = hog.home;
  if (!home) return hog;
  const stillFor = cursor ? now - cursor.at : Infinity;
  switch (hog.mode) {
    case 'hidden':
      if (now < hog.until || stillFor < STILL) return hog;
      return { ...hog, mode: 'peek', x: home.pile - PILE.width / 2 + 2, dir: -1, until: now + PEEK };
    case 'peek':
      if (stillFor < PEEK) return hide(hog, home, now + STILL);
      return now < hog.until ? hog : emerge(hog, home, now, rand);
    case 'curled':
      if (near(hog, scene, cursor, now)) return { ...hog, until: Math.max(hog.until, now + 2500) };
      return now < hog.until ? hog : headHome(hog, home, 'flee');
    case 'sniff':
      if (near(hog, scene, cursor, now)) return curl(hog, now, rand);
      return now < hog.until ? hog : wander(hog, home, now, rand);
    case 'walk':
    case 'home':
    case 'flee':
      return near(hog, scene, cursor, now) ? curl(hog, now, rand) : travel(hog, home, now, dt, rand);
  }
}

// The modes in which the hedgehog is on the move, and so waddles.
export const moving = (mode: Mode) => mode === 'walk' || mode === 'home' || mode === 'flee';

// Reduced motion: sat beside its pile, facing out, never moving.
export function restingHog(scene: PageMap): Hog {
  const home = chooseHome(scene);
  return { home, x: home ? Math.max(home.lo, home.hi - 10) : 0, dir: -1, mode: 'sniff', target: 0, until: Infinity, out: 0 };
}
