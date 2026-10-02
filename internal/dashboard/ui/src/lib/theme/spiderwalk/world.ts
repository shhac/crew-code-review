import { step } from './behaviour';
import { type Context, LINE_LIFE, type Line, MAX_LINES, MIN_DROP, type Spider, USED_LINE_FADE, inView } from './model';

export type World = { spiders: Spider[]; lines: Line[]; nextLine: number };

// Idle lines need an in-view lower floor and expire by age. A claimed line
// follows its climber even when the lower anchor scrolls out of view, then
// fades after release. Both kinds disappear if their anchors go away.
export function keep(line: Line, ctx: Context): boolean {
  const bottom = ctx.floors.get(line.bottom.floor);
  if (!bottom || (!line.claimed && !inView(bottom, ctx.frame))) return false;
  if (line.claimed ? (line.released ?? 0) >= USED_LINE_FADE : line.age > LINE_LIFE) return false;
  const top = line.top.floor === null ? { y: 0 } : ctx.floors.get(line.top.floor);
  return !!top && bottom.y - top.y >= MIN_DROP;
}

export function advance(world: World, ctx: Context): World {
  const start: World = { spiders: [], lines: world.lines, nextLine: world.nextLine };
  const stepped = world.spiders.reduce((w, spider) => {
    // Taking a thread makes it unavailable to the other spider, but the silk
    // remains visible. It is released and fades only after the climb ends.
    const out = step(spider, ctx, w.lines.filter((l) => !l.claimed));
    const kept = out.take === undefined ? w.lines : w.lines.map((l) => l.id === out.take ? { ...l, claimed: true } : l);
    const lines = out.leave ? [...kept, { ...out.leave, id: w.nextLine, age: 0 }] : kept;
    return { spiders: [...w.spiders, out.spider], lines, nextLine: out.leave ? w.nextLine + 1 : w.nextLine };
  }, start);
  const climbing = new Set(stepped.spiders.map(lineBeingClimbed));
  const kept = stepped.lines
    .map((l) => ({ ...l, age: l.age + ctx.dt, ...(l.claimed && !climbing.has(l.id) ? { released: (l.released ?? 0) + ctx.dt } : {}) }))
    .filter((l) => keep(l, ctx));
  // An idle-thread cap must never cut the tail from an active climb.
  const idle = new Set(kept.filter((l) => !l.claimed).slice(-MAX_LINES).map((l) => l.id));
  const lines = kept.filter((l) => l.claimed || idle.has(l.id));
  return { ...stepped, lines };
}

function lineBeingClimbed(s: Spider): number | undefined {
  if (s.kind === 'act') return lineBeingClimbed(s.next);
  return s.kind === 'climb' && s.route.via === 'line' ? s.route.lineId : undefined;
}
