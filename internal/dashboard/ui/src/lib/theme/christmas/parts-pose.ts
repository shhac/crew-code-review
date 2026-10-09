import manifest from './robin-parts/manifest.json' with { type: 'json' };

const smooth = (value: number) => value * value * (3 - 2 * value);
const pulse = (time: number, start: number, duration: number) => {
  const progress = (time - start) / duration;
  return progress <= 0 || progress >= 1 ? 0 : Math.sin(Math.PI * smooth(progress));
};

export const partsModes = ['alive', 'still', 'breathing', 'blink', 'tilt', 'tail', 'hop', 'peck', 'flight', 'flight-up', 'flight-high-fall', 'flight-forward', 'flight-low-fall', 'flight-down', 'flight-low-rise', 'flight-recovery', 'flight-high-rise'];
export type PartId = 'body' | 'body-peck' | 'head' | 'neck' | 'wing' | 'tail' | 'leg-near' | 'leg-far' | 'eyelid'
  | 'wing-up' | 'wing-down' | 'wing-far-up' | 'wing-far-down' | 'wing-forward' | 'wing-recovery'
  | 'wing-far-forward' | 'wing-far-recovery' | 'leg-near-tucked' | 'leg-far-tucked' | 'wing-shoulder'
  | 'wing-high-fall' | 'wing-low-fall' | 'wing-low-rise' | 'wing-high-rise'
  | 'wing-far-high-fall' | 'wing-far-low-fall' | 'wing-far-low-rise' | 'wing-far-high-rise';

function track(time: number, points: [number, number][]) {
  for (let index = 1; index < points.length; index++) {
    const [end, value] = points[index], [start, previous] = points[index - 1];
    if (time <= end) return previous + (value - previous) * smooth(Math.max(0, (time - start) / (end - start)));
  }
  return points[points.length - 1][1];
}

const wingStates = ['up', 'high-fall', 'forward', 'low-fall', 'down', 'low-rise', 'recovery', 'high-rise'] as const;
function wingDrawing(state: typeof wingStates[number], far = false) {
  const id = ('wing-' + (far ? 'far-' : '') + state) as keyof typeof manifest.parts;
  const p = manifest.parts[id];
  if (!('rootSource' in p)) throw new Error('Missing wing calibration: ' + id);
  return { span: p.projectedSpan, angle: Math.atan2(p.tipSource[1] - p.rootSource[1],
    p.tipSource[0] - p.rootSource[0]) * 180 / Math.PI };
}
function wingStroke(phase: number, far = false) {
  const progress = phase * wingStates.length;
  const index = Math.floor(progress), fraction = progress - index;
  const state = wingStates[index], nextState = wingStates[(index + 1) % wingStates.length];
  const current = wingDrawing(state, far), next = wingDrawing(nextState, far);
  const up = wingDrawing('up').angle, down = wingDrawing('down').angle - 360;
  // A continuous shoulder-to-primary trajectory drives BOTH drawings in a
  // handoff. Perspective profiles change feather shape, not tip location.
  return { state, nextState, blend: smooth(Math.max(0, (fraction - .55) / .45)),
    angle: up + (down - up) * (1 - Math.cos(phase * Math.PI * 2)) / 2,
    span: current.span + (next.span - current.span) * smooth(fraction),
    drawing: current, nextDrawing: next };
}

export function partsViewport(mode: string, reduced = false) {
  if (reduced) return [0, 0, 128, 112];
  if (mode.startsWith('flight')) return [-36, -64, 200, 210];
  if (mode === 'hop') return [-24, -40, 176, 154];
  if (mode === 'peck') return [-12, -8, 152, 133];
  return [0, 0, 128, 112];
}

export function partsPose(elapsed: number, mode = 'alive', reduced = false) {
  const time = Math.max(0, elapsed) % 12000;
  const breathes = !reduced && (mode === 'alive' || mode === 'breathing');
  const breathing = breathes ? (1 - Math.cos(time * Math.PI * 2 / 3000)) / 2 : 0;
  const headBreath = breathes ? (1 - Math.cos((time - 160) * Math.PI * 2 / 3000)) / 2 : 0;
  const tilt = reduced ? 0 : mode === 'tilt' ? Math.sin(time * Math.PI * 2 / 3000)
    : mode === 'alive' ? pulse(time, 2300, 1600) - .65 * pulse(time, 7900, 1900) : 0;
  const flick = reduced ? 0 : mode === 'tail' ? Math.sin(time * Math.PI * 2 / 2000)
    : mode === 'alive' ? pulse(time, 5700, 650) - .45 * pulse(time, 6100, 800) : 0;
  const closed = !reduced && (mode === 'alive' || mode === 'blink')
    && (mode === 'blink' ? time % 2000 > 1500 && time % 2000 < 1630
      : time > 4300 && time < 4430 || time > 9700 && time < 9830);
  const beat = time % 4000;
  const hopping = !reduced && mode === 'hop', pecking = !reduced && mode === 'peck';
  const flying = !reduced && mode.startsWith('flight');
  const lift = hopping ? track(beat, [[0, 0], [1050, 0], [1250, -25], [1540, 0], [4000, 0]]) : 0;
  const crouch = hopping ? track(beat, [[0, 0], [700, 0], [940, 5], [1050, 0], [1540, 0], [1640, 4], [1920, 0], [4000, 0]])
    : pecking ? track(beat, [[0, 0], [700, 0], [1120, 4], [1580, 4], [2200, 0], [4000, 0]]) : 0;
  const lean = pecking ? track(beat, [[0, 0], [700, 0], [1120, 20], [1580, 20], [2200, 0], [4000, 0]])
    : flying ? 28 : hopping ? -lift * .12 : 0;
  const headAngle = pecking ? track(beat, [[0, 0], [700, 0], [1120, 82], [1250, 68], [1350, 82], [1480, 68], [1580, 82], [1900, 14], [2200, 0], [4000, 0]])
    : flying ? -20 : tilt * 9;
  const heldStroke = wingStates.findIndex(state => mode === 'flight-' + state);
  const phase = heldStroke >= 0 ? heldStroke / wingStates.length : time % 600 / 600;
  const nearWing = wingStroke(phase), farWing = wingStroke(mode === 'flight' ? (phase - .035 + 1) % 1 : phase, true);
  return {
    breathing, headBreath, headAngle, headPivotY: pecking ? 52 : 42,
    tailAngle: pecking ? -lean * .25 : flying ? -10 : flick * 12, closed,
    flying, pecking, flightMix: flying ? 1 : 0, peckMix: pecking ? 1 : 0, lift, crouch, lean, tuck: -lift / 25,
    bob: flying && mode === 'flight' ? -2 * Math.sin(phase * Math.PI * 2) : 0,
    nearWing: flying ? nearWing : wingStroke(0), farWing: flying ? farWing : wingStroke(0, true),
  };
}

export type PartsPose = ReturnType<typeof partsPose>;

// Articulate shared geometry once; only variant artwork fades at a state change.
export function mixPartsPose(from: PartsPose, to: PartsPose, amount: number): PartsPose {
  if (amount >= 1) return to;
  if (amount <= 0) return from;
  const mix = (a: number, b: number) => a + (b - a) * amount;
  return { ...to, flying: from.flying || to.flying, pecking: from.pecking || to.pecking,
    breathing: mix(from.breathing, to.breathing), headBreath: mix(from.headBreath, to.headBreath),
    headAngle: mix(from.headAngle, to.headAngle), headPivotY: mix(from.headPivotY, to.headPivotY),
    tailAngle: mix(from.tailAngle, to.tailAngle), lift: mix(from.lift, to.lift),
    crouch: mix(from.crouch, to.crouch), lean: mix(from.lean, to.lean), tuck: mix(from.tuck, to.tuck),
    bob: mix(from.bob, to.bob), flightMix: mix(from.flightMix, to.flightMix), peckMix: mix(from.peckMix, to.peckMix),
    nearWing: to.flying ? to.nearWing : from.nearWing, farWing: to.flying ? to.farWing : from.farWing };
}

// Shared by the live SVG rig and the deterministic exported motion preview.
export function partsTransforms(pose: ReturnType<typeof partsPose>, exploded = false) {
  const wing = (stroke: ReturnType<typeof wingStroke>, x: number, y: number) =>
    `translate(${x} ${y}) rotate(${stroke.angle - stroke.drawing.angle - pose.lean}) scale(${stroke.span / stroke.drawing.span}) translate(${-x} ${-y})`;
  return {
    rig: exploded ? '' : `translate(${-5 * pose.flightMix} ${pose.lift + (-12 + pose.bob) * pose.flightMix})`,
    body: exploded ? 'translate(0 15)' : `translate(0 ${pose.crouch}) rotate(${pose.lean} 64 83) translate(64 83) scale(${1 + pose.breathing * .012} ${1 + pose.breathing * .018}) translate(-64 -83)`,
    head: exploded ? 'translate(8 -14)' : `translate(0 ${pose.headBreath * -.45}) rotate(${pose.headAngle} 82 ${pose.headPivotY})`,
    neck: exploded ? 'translate(16 4)' : `rotate(${pose.headAngle * (.3 + .35 * pose.peckMix)} 82 ${pose.headPivotY})`,
    tail: exploded ? 'translate(-6 5)' : `rotate(${pose.tailAngle} 46 65)`,
    wing: exploded ? 'translate(-17 -8)' : pose.flying ? wing(pose.nearWing, 79, 43) : `rotate(${pose.breathing * -.6} 79 43)`,
    farWing: exploded ? 'translate(20 -16)' : wing(pose.farWing, 90, 42),
    foldedWing: exploded ? 'translate(-17 -8)' : `rotate(${pose.breathing * -.6} 79 43)`,
    // The cover's feathers point down-left (150 degrees) in its source.
    // Align them to the continuous wing trajectory, not the selected drawing.
    shoulder: exploded ? 'translate(-17 -8)' : `rotate(${pose.nearWing.angle + 360 - 150 - pose.lean} 79 43)`,
    farLeg: exploded ? 'translate(-8 5)' : `translate(78 101) scale(1 ${1 - pose.crouch * .055}) translate(-78 -101) rotate(${-pose.tuck * 10} 72 80)`,
    nearLeg: exploded ? 'translate(8 5)' : `translate(64 102.1) scale(1 ${1 - pose.crouch * .055}) translate(-64 -102.1) rotate(${pose.tuck * 12} 59 86)`,
    flightFarLeg: exploded ? 'translate(-8 5)' : 'rotate(-28 77.71 81.75)',
    flightNearLeg: exploded ? 'translate(8 5)' : 'rotate(-28 65.85 88.61)',
  };
}

// One layer plan for the live SVG and exported previews, including occlusion.
export function partsLayers(pose: ReturnType<typeof partsPose>, exploded = false, showNeck = true) {
  const t = partsTransforms(pose, exploded);
  const layer = (id: PartId, ...transforms: string[]): { id: PartId; transform: string; nextId?: PartId; blend?: number; nextAdjustment?: string; opacity?: number } => ({ id, transform: transforms.filter(Boolean).join(' ') });
  const airborne = pose.flightMix > 0, grounded = pose.flightMix < 1;
  const fade = (value: ReturnType<typeof layer>, opacity: number) => ({ ...value, opacity });
  const flightWing = (far: boolean, stroke: ReturnType<typeof wingStroke>, transform: string) => ({
    ...layer(('wing-' + (far ? 'far-' : '') + stroke.state) as PartId, t.rig, t.body, transform),
    nextId: ('wing-' + (far ? 'far-' : '') + stroke.nextState) as PartId, blend: stroke.blend,
    nextAdjustment: `translate(${far ? 90 : 79} ${far ? 42 : 43}) rotate(${stroke.drawing.angle - stroke.nextDrawing.angle}) scale(${stroke.drawing.span / stroke.nextDrawing.span}) translate(${far ? -90 : -79} ${far ? -42 : -43})`,
  });
  return [
    ...(airborne ? [fade(flightWing(true, pose.farWing, t.farWing), pose.flightMix),
      fade(layer('leg-far-tucked', t.rig, t.body, t.flightFarLeg), pose.flightMix)] : []),
    ...(grounded ? [fade(layer('leg-far', t.rig, t.farLeg), 1 - pose.flightMix)] : []),
    { ...layer(pose.peckMix === 1 ? 'body-peck' : 'body', t.rig, t.body),
      ...(pose.peckMix > 0 && pose.peckMix < 1 ? { nextId: 'body-peck' as const, blend: pose.peckMix } : {}) },
    layer('tail', t.rig, t.body, t.tail),
    ...(showNeck ? [layer('neck', t.rig, t.body, t.neck)] : []),
    layer('head', t.rig, t.body, t.head),
    ...(pose.closed ? [layer('eyelid', t.rig, t.body, t.head)] : []),
    ...(airborne ? [fade(layer('leg-near-tucked', t.rig, t.body, t.flightNearLeg), pose.flightMix)] : []),
    ...(grounded ? [fade(layer('wing', t.rig, t.body, t.foldedWing), 1 - pose.flightMix)] : []),
    ...(airborne ? [fade(flightWing(false, pose.nearWing, t.wing), pose.flightMix),
      fade(layer('wing-shoulder', t.rig, t.body, t.shoulder), pose.flightMix)] : []),
    ...(grounded ? [fade(layer('leg-near', t.rig, t.nearLeg), 1 - pose.flightMix)] : []),
  ];
}

// Every drawing each layer of the plan above can show, back to front. A live
// robin mounts each drawing once and only shows or hides it: an image mounted
// mid-play, or one whose href is swapped, paints nothing or its old picture
// in the new place until the file arrives, a flash wherever it is uncached.
export const partsSlots: readonly (readonly PartId[])[] = [
  ['wing-far-up', 'wing-far-high-fall', 'wing-far-forward', 'wing-far-low-fall', 'wing-far-down', 'wing-far-low-rise', 'wing-far-recovery', 'wing-far-high-rise'],
  ['leg-far-tucked'], ['leg-far'], ['body', 'body-peck'], ['tail'], ['neck'], ['head'], ['eyelid'], ['leg-near-tucked'], ['wing'],
  ['wing-up', 'wing-high-fall', 'wing-forward', 'wing-low-fall', 'wing-down', 'wing-low-rise', 'wing-recovery', 'wing-high-rise'],
  ['wing-shoulder'], ['leg-near'],
];

// The plan laid onto the fixed slots: a slot the plan leaves out, and a
// drawing it does not use, get no weight. A hidden half of a cross-fade
// leaves the other drawn alone, whole.
export function partsSlotLayers(pose: ReturnType<typeof partsPose>, exploded = false, showNeck = true, hidden: readonly string[] = []) {
  const layers = partsLayers(pose, exploded, showNeck);
  return partsSlots.map(ids => {
    const layer = layers.find(each => ids.includes(each.id));
    if (!layer) return { transform: '', opacity: 0, blend: 0, drawings: ids.map(id => ({ id, weight: 0, adjustment: '' })) };
    const blend = layer.nextId && layer.blend && !hidden.includes(layer.id) && !hidden.includes(layer.nextId) ? layer.blend : 0;
    const weight = (id: PartId) => id === layer.id ? 1 - blend : blend && id === layer.nextId ? blend : 0;
    return { transform: layer.transform, opacity: layer.opacity ?? 1, blend,
      drawings: ids.map(id => ({ id, weight: weight(id), adjustment: blend && id === layer.nextId ? layer.nextAdjustment ?? '' : '' })) };
  });
}
