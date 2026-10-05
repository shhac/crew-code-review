import type { Segment } from '../pointer';
import { advanceBird, createBird, position, reconcileBird, type Bird, type Scene } from './robin';

function reservedScene(scene: Scene, others: readonly Bird[]): Scene {
  const obstacles = [...scene.obstacles];
  for (const bird of others) {
    for (const perch of [bird.perch, bird.action?.target]) {
      if (!perch || !scene.floors.has(perch.floor)) continue;
      const p = position(perch, scene);
      obstacles.push({ left: p.x - 30, right: p.x + 30, top: p.y - 37, bottom: p.y + 1 });
    }
    if (bird.action) {
      const flying = bird.action.kind === 'flight';
      for (const leg of bird.action.route ?? [bird.action]) {
        obstacles.push({ left: Math.min(leg.from.x, leg.to.x) - (flying ? 35 : 30),
          right: Math.max(leg.from.x, leg.to.x) + (flying ? 35 : 30),
          top: Math.min(leg.from.y, leg.to.y) - leg.rise - (flying ? 59 : 37), bottom: Math.max(leg.from.y, leg.to.y) });
      }
    }
  }
  return { ...scene, obstacles };
}

export function createFlock(scene: Scene, now: number, random: () => number): Bird[] {
  const first = createBird(scene, now, random);
  // Prefer another ledge initially, with another clear pocket as a fallback.
  const floors = new Map([...scene.floors].sort(([a], [b]) => Number(a === first.perch?.floor) - Number(b === first.perch?.floor)));
  const second = createBird(reservedScene({ ...scene, floors }, [first]), now, random);
  return [first, { ...second, restUntil: second.restUntil + 1800, flightAt: second.flightAt + 3000 }];
}

export function reconcileFlock(birds: readonly Bird[], scene: Scene, now: number, random: () => number): Bird[] {
  const settled: Bird[] = [];
  for (const bird of birds) settled.push(reconcileBird(bird, reservedScene(scene, settled), now, random));
  return settled;
}

export function advanceFlock(birds: readonly Bird[], scene: Scene, now: number, random: () => number, cursor: Segment | null = null): Bird[] {
  const next = [...birds];
  for (let i = 0; i < next.length; i++) {
    const others = next.filter((_, index) => index !== i);
    const available = reservedScene(scene, others);
    if (!next[i].perch) next[i] = reconcileBird(next[i], available, now, random);
    next[i] = advanceBird(next[i], available, now, random, cursor, !others.some(bird => bird.action?.kind === 'flight'));
  }
  return next;
}
