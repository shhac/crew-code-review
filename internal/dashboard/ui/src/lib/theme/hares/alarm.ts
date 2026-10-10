import type { PageMap } from '../floors';
import { apart, sign } from '../math';
import type { Cursor, Point } from '../pointer';
import { between, type Rand } from '../seed';
import { BOLT_SPEED, sitUp, type Hare } from './hare';
import { breakBout } from './bout';
import type { Hares } from './hares';
import { claimsBut, grounded, pagePoint, placeOf, planning, update, type Run } from './runs';
import { plan } from './trail';

// A moving cursor coming near freezes the hares, and once frozen, those it
// is still near bolt.

// How long a bolt runs, and over how many ledges.
const BOLT = { budget: 600, ledges: 2 };
// A cursor that moved this recently, this close to a hare's middle, freezes
// it and every hare within FREEZE_REACH of it; after freezing, one still
// within BOLT_REACH bolts.
const MOVING = 150;
const NEAR = 100;
const FREEZE_REACH = 240;
const BOLT_REACH = 200;

// A hare's middle on the page, where the cursor is measured from.
function middleOf(group: Hares, hare: Hare, scene: PageMap): Point | null {
  const at = pagePoint(placeOf(group, hare), scene);
  return at && { x: at.x, y: at.y - 12 };
}
const near = (a: Point | null, b: Point, reach: number) => !!a && apart(a, b) < reach;
const freeze = (hare: Hare, now: number, rand: Rand): Hare => ({ ...hare, mode: 'freeze', until: now + between(rand, 700, 1100) });

// A moving cursor coming near freezes them: every hare on a ledge within
// reach, and every hare on a trail once all on it are on a ledge (so none
// lands on a frozen one). Their trails, and any bout, end.
export function alarm(group: Hares, scene: PageMap, now: number, rand: Rand, cursor: Cursor | null): Hares {
  if (!cursor || now - cursor.at >= MOVING) return group;
  const triggered = group.hares.some((h) => grounded(group, h) && near(middleOf(group, h, scene), cursor, NEAR));
  if (!triggered) return group;
  const stopped = group.runs.filter((r) => group.hares.filter((h) => r.members.some((m) => m.id === h.id)).every((h) => grounded(group, h)));
  const onRuns = new Set(stopped.flatMap((r) => r.members.map((m) => m.id)));
  const busy = new Set(group.runs.filter((r) => !stopped.includes(r)).flatMap((r) => r.members.map((m) => m.id)));
  const hares = group.hares.map((h) => {
    if (busy.has(h.id) || h.mode === 'freeze') return h;
    const settled = onRuns.has(h.id) ? settle(group, h) : h;
    return onRuns.has(h.id) || near(middleOf(group, h, scene), cursor, FREEZE_REACH) ? freeze(settled, now, rand) : h;
  });
  const bout = group.bout;
  const boutBroken = !!bout && hares.some((h) => (h.id === bout.jill || h.id === bout.jack) && h.mode === 'freeze');
  return { ...group, hares: boutBroken ? breakBout(hares, now) : hares, runs: group.runs.filter((r) => !stopped.includes(r)), bout: boutBroken ? null : bout };
}

// A hare taken off its trail where it is on it.
function settle(group: Hares, hare: Hare): Hare {
  const place = placeOf(group, hare);
  return place.kind === 'run' ? { ...hare, floor: place.floor, x: place.x, target: place.x, dir: place.dir } : hare;
}

// The frozen hares whose time is up: those the cursor is still near bolt,
// in file with the others on their ledge on the same side of it; the rest
// sit up and look about.
export function bolt(group: Hares, scene: PageMap, now: number, rand: Rand, cursor: Cursor | null): Hares {
  const done = group.hares.filter((h) => h.mode === 'freeze' && now >= h.until);
  if (!done.length) return group;
  const scared = cursor ? done.filter((h) => near(middleOf(group, h, scene), cursor, BOLT_REACH)) : [];
  const relaxed = done.filter((h) => !scared.includes(h)).map((h) => sitUp(h, scene, now, rand));
  const way = (h: Hare) => (cursor ? sign((middleOf(group, h, scene)?.x ?? 0) - cursor.x) : h.dir);
  const files = [...new Set(scared.map((h) => `${h.floor}:${way(h)}`))].map((key) => scared.filter((h) => `${h.floor}:${way(h)}` === key));
  const runs = files.reduce<Run[]>((all, file) => {
    const d = way(file[0]);
    const ordered = [...file].sort((a, b) => (b.x - a.x) * d);
    const [leader, rear] = [ordered[0], ordered[ordered.length - 1]];
    const claims = claimsBut(group, scene, file.map((h) => h.id), [...group.runs, ...all]);
    const trail = plan({ floor: rear.floor, x: rear.x }, d, scene, planning(claims, { ...BOLT, from: cursor }, rand));
    const lead = Math.abs(leader.x - rear.x);
    if (trail.length - lead < 1) return all;
    const members = ordered.map((h) => ({ id: h.id, lag: Math.abs(leader.x - h.x), start: Math.abs(h.x - rear.x) }));
    return [...all, { kind: 'bolt', trail, at: lead, speed: BOLT_SPEED, members }];
  }, []);
  const fled = new Set(runs.flatMap((r) => r.members.map((m) => m.id)));
  const cornered = scared.filter((h) => !fled.has(h.id)).map((h) => sitUp(h, scene, now, rand));
  return { ...update(group, ...relaxed, ...cornered, ...scared.filter((h) => fled.has(h.id)).map((h) => ({ ...h, mode: 'bolt' as const }))), runs: [...group.runs, ...runs] };
}
