import type { Segment } from '../pointer';
import { advanceBird, createBird, position, reconcileBird, type Bird, type Scene } from './robin';
import { curveBounds } from './flight-route';

function reservedScene(scene: Scene, others: readonly Bird[]): Scene {
  const obstacles = [...scene.obstacles];
  for (const bird of others) {
    for (const perch of [bird.perch, bird.action?.target]) {
      if (!perch || !scene.floors.has(perch.floor)) continue;
      const p = position(perch, scene);
      obstacles.push({ left: p.x - 30, right: p.x + 30, top: p.y - 37, bottom: p.y + 1 });
    }
    if (bird.action) {
      if (bird.action.route) obstacles.push(...bird.action.route.map(curveBounds));
      else {
        const a = bird.action;
        obstacles.push({ left: Math.min(a.from.x, a.to.x) - 30, right: Math.max(a.from.x, a.to.x) + 30,
          top: Math.min(a.from.y, a.to.y) - a.rise - 37, bottom: Math.max(a.from.y, a.to.y) });
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
