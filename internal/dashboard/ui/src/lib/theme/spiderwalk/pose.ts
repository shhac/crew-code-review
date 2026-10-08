import { clamp } from '../spidergait';
import { type Act, type Dir, EASES, type Floors, type Frame, JUMP_ARC, fits, type Pose, type Spider, swayAngle, swing, type Tween } from './model';
import { hanging, resolve } from './routes';

// ---------------------------------------------------------------- drawing

const restingPose = (x: number, y: number, dir: Dir, moving: boolean): Pose => ({
  drawing: 'walk',
  x,
  y,
  dir,
  rotate: 0,
  moving,
  crouch: 0,
  tuck: 0,
  fade: 1,
  silk: null,
});

function tweenPose(s: Act, floors: Floors, frame: Frame): Pose | null {
  const { tween } = s;
  const p = clamp(s.t / tween.dur, 0, 1);
  if (tween.web) {
    const e = EASES.out(p);
    const { hold } = tween.web;
    return { ...hold, x: hold.x + tween.dx * e, y: hold.y + tween.dy * e, fade: 1 - e, moving: true };
  }
  const end = pose(s.next, floors, frame);
  if (!end) return null;
  if (tween.jump) return jumpPose(end, tween, p);
  const left = 1 - EASES[tween.ease](p);
  return {
    ...end,
    drawing: tween.drawing,
    x: end.x + tween.dx * left,
    y: end.y + tween.dy * left,
    rotate: end.rotate + tween.rotate * left,
    moving: true,
  };
}

// Gather, fly, land: a crouch where it stands, an arc across with the legs
// drawn in and the body tipped into the jump, and a bend of the knees as it
// comes down.
function jumpPose(end: Pose, tween: Tween, p: number): Pose {
  const GATHER = 0.22;
  const LAND = 0.82;
  if (p < GATHER) return { ...end, x: end.x + tween.dx, y: end.y + tween.dy, crouch: p / GATHER, moving: false };
  if (p >= LAND) return { ...end, crouch: 0.6 * (1 - (p - LAND) / (1 - LAND)), moving: false };
  const q = (p - GATHER) / (LAND - GATHER);
  const arc = 4 * JUMP_ARC * q * (1 - q);
  const lean = -12 * end.dir * (1 - 2 * q);
  return { ...end, x: end.x + tween.dx * (1 - q), y: end.y + tween.dy * (1 - q) - arc, rotate: lean, tuck: 1, moving: false };
}

const NOWHERE: Frame = { width: Infinity, height: Infinity, bottomWeb: false };

export function pose(s: Spider, floors: Floors, frame: Frame = NOWHERE): Pose | null {
  switch (s.kind) {
    case 'away':
      return null;
    case 'act':
      return tweenPose(s, floors, frame);
    case 'dangle': {
      const h = hanging(s, floors);
      if (!h) return null;
      return { ...restingPose(h.x, h.y, s.dir, s.phase !== 'hang'), drawing: 'hang', rotate: h.angle, silk: h.tie };
    }
    case 'climb': {
      const path = resolve(s.route, floors, frame);
      if (!path) return null;
      const length = Math.hypot(path.to.x - path.from.x, path.to.y - path.from.y);
      const k = length > 0 ? clamp(s.along / length, 0, 1) : 1;
      const at = { x: path.from.x + (path.to.x - path.from.x) * k, y: path.from.y + (path.to.y - path.from.y) * k };
      if (s.route.via !== 'line' || !path.silk) return { ...restingPose(at.x, at.y, s.dir, true), rotate: path.rotate, silk: path.silk };
      // A dragline can be climbed facing either way, and swings from its tie
      // as the spider goes up it, the spider swinging with it.
      const angle = swayAngle(s.sway ?? 0);
      const swung = swing(path.silk, at, angle);
      return { ...restingPose(swung.x, swung.y, s.dir, true), rotate: path.rotate + (s.dir === -1 ? 180 : 0) + angle, silk: path.silk, dragline: s.route.lineId };
    }
    case 'walk':
    case 'rest': {
      const f = floors.get(s.floor);
      if (!f || !fits(f)) return null;
      return restingPose(f.left + s.x, f.y, s.dir, s.kind === 'walk');
    }
  }
}
