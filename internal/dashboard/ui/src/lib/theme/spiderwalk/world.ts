import { step } from './behaviour';
import { type Context, LINE_LIFE, type Line, MAX_LINES, MIN_DROP, type Spider, inView } from './model';

export type World = { spiders: Spider[]; lines: Line[]; nextLine: number };

// A dragline is kept while both its floors are there, it still hangs a real
// distance, its lower floor is in view, and it has not aged out; past the cap
// the oldest go first.
export function keep(line: Line, ctx: Context): boolean {
  const bottom = ctx.floors.get(line.bottom.floor);
  if (!bottom || !inView(bottom, ctx.frame) || line.age > LINE_LIFE) return false;
  const top = line.top.floor === null ? { y: 0 } : ctx.floors.get(line.top.floor);
  return !!top && bottom.y - top.y >= MIN_DROP;
}

export function advance(world: World, ctx: Context): World {
  const start: World = { spiders: [], lines: world.lines, nextLine: world.nextLine };
  const stepped = world.spiders.reduce((w, spider) => {
    const out = step(spider, ctx, w.lines);
    const kept = out.take === undefined ? w.lines : w.lines.filter((l) => l.id !== out.take);
    const lines = out.leave ? [...kept, { ...out.leave, id: w.nextLine, age: 0 }] : kept;
    return { spiders: [...w.spiders, out.spider], lines, nextLine: out.leave ? w.nextLine + 1 : w.nextLine };
  }, start);
  const lines = stepped.lines
    .map((l) => ({ ...l, age: l.age + ctx.dt }))
    .filter((l) => keep(l, ctx))
    .slice(-MAX_LINES);
  return { ...stepped, lines };
}
