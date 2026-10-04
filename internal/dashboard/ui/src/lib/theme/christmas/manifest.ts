import { clipDuration, breathing, blink, type Clip } from './animation';

export type Sheet = { width: number; height: number; sha256: string };
export type Frame = { sheet: string; x: number; y: number; width: number; height: number; anchor?: [number, number]; canonical_anchor?: [number, number] };
export type ManifestClip = Clip & { terminalFrame: string; restFrame: string };
export type Manifest = {
  version: 1;
  profile?: 'idle-blink' | 'atlas-idle';
  rows?: Record<string, { row: number; count: number; available: boolean; acceptance: 'accepted' | 'pending'; joins?: 'accepted' | 'pending'; cell_size?: [number, number]; anchor?: [number, number]; canonical_anchor?: [number, number] }>;
  anchor: readonly [64, 100];
  scale: .35;
  sheets: Record<string, Sheet>;
  fallback: Sheet & { file: string };
  frames: Record<string, Frame>;
  clips: Record<string, ManifestClip>;
};
export const frameIDs = [
  'I0', 'I1', 'I2', 'I3', 'B1', 'B2', 'T1', 'T2',
  'H1', 'H2', 'H3', 'H4', 'H5', 'F1', 'F2',
  'W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7',
  'L1', 'L2', 'L3', 'A1', 'A2', 'A3',
] as const;
const clipIDs = ['breathing', 'blink', 'tilt', 'hop', 'takeoff', 'flap', 'landing', 'alertEntry', 'alertReturn'];
const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
const filename = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]+\.webp$/.test(value);
const isSheet = (value: unknown): value is Sheet => record(value) && integer(value.width, 128) && integer(value.height, 112)
  && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256);
const isFallback = (value: unknown): value is Sheet & { file: string } => record(value) && filename(value.file)
  && isSheet(value) && value.width === 128 && value.height === 112;
const point = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n));
const isFrame = (value: unknown): value is Frame => record(value) && typeof value.sheet === 'string'
  && integer(value.x, 0) && integer(value.y, 0) && integer(value.width, 16) && integer(value.height, 16)
  && value.width % 2 === 0 && value.height % 2 === 0
  && (value.anchor === undefined && value.canonical_anchor === undefined && value.width === 128 && value.height === 112
    || point(value.anchor) && point(value.canonical_anchor) && value.anchor[0] >= 0 && value.anchor[0] < value.width
      && value.anchor[1] >= 0 && value.anchor[1] < value.height);
const isClip = (value: unknown): value is ManifestClip => record(value) && Array.isArray(value.frames)
  && value.frames.every(id => typeof id === 'string') && Array.isArray(value.durations)
  && value.durations.every(ms => typeof ms === 'number') && typeof value.loop === 'boolean'
  && (value.deadline === undefined || typeof value.deadline === 'number')
  && typeof value.terminalFrame === 'string' && typeof value.restFrame === 'string';

// Accept JSON only after checking every reference and absolute native rectangle.
// Decoding, SHA-256 verification and independently packaged I0 checks belong to
// the asset loader/packer; this function never claims to have inspected pixels.
export function validateManifest(value: unknown): Manifest {
  return validateInventory(value, frameIDs, clipIDs);
}

export const idleFrameIDs = ['I0', 'I1', 'I2', 'I3', 'B1', 'B2'] as const;
export function validateIdleManifest(value: unknown): Manifest {
  if (record(value) && value.profile === 'atlas-idle') return validateAtlasIdleManifest(value);
  if (!record(value) || value.profile !== 'idle-blink') throw new Error('Invalid robin idle profile');
  const manifest = validateInventory(value, idleFrameIDs, ['breathing', 'blink']);
  for (const [name, expected] of Object.entries({ breathing, blink })) {
    const clip = manifest.clips[name];
    if (JSON.stringify(clip.frames) !== JSON.stringify(expected.frames)
      || JSON.stringify(clip.durations) !== JSON.stringify(expected.durations) || clip.loop !== expected.loop) {
      throw new Error('Unsupported robin idle timing');
    }
  }
  return { ...manifest, profile: 'idle-blink' };
}

export const atlasIdleFrames = Array.from({ length: 8 }, (_, i) => `I${i}`);
export const atlasIdleDurations = [1600, 450, 450, 650, 60, 80, 90, 1420];
export function atlasIdleAvailable(manifest: Manifest): boolean {
  return manifest.profile === 'atlas-idle' && manifest.rows?.idle?.available === true
    && manifest.rows.idle.acceptance === 'accepted';
}

export function atlasFlyingAvailable(manifest: Manifest): boolean {
  return atlasIdleAvailable(manifest) && manifest.rows?.flying?.available === true
    && manifest.rows.flying.acceptance === 'accepted' && manifest.rows.flying.joins === 'accepted';
}

export function validateAtlasIdleManifest(value: unknown): Manifest {
  if (!record(value) || value.profile !== 'atlas-idle' || !record(value.rows)) throw new Error('Invalid atlas idle profile');
  const flying = value.rows.flying;
  if (!record(flying) || ![0, 4, 5, 6, 8].includes(Number(flying.count)) || typeof flying.count !== 'number') throw new Error('Invalid flying cell count');
  const flyingFrames = Array.from({ length: flying.count }, (_, i) => `W${i}`);
  const manifest = validateInventory(value, [...atlasIdleFrames, ...flyingFrames], flyingFrames.length ? ['idle', 'flap'] : ['idle']);
  if (Object.keys(manifest.sheets).length > 2 || !Object.values(manifest.sheets).some(s => s.width === 1024 && s.height === 672)) {
    throw new Error('Invalid atlas geometry');
  }
  for (const [i, id] of atlasIdleFrames.entries()) {
    const frame = manifest.frames[id];
    if (frame.x !== i * 128 || frame.y !== 0 || frame.width !== 128 || frame.height !== 112 || frame.anchor !== undefined) throw new Error('Invalid atlas cell index');
  }
  const clip = manifest.clips.idle;
  if (JSON.stringify(clip.frames) !== JSON.stringify(atlasIdleFrames)
    || JSON.stringify(clip.durations) !== JSON.stringify(atlasIdleDurations) || !clip.loop || clip.deadline !== undefined) {
    throw new Error('Unsupported atlas idle timing');
  }
  if (flyingFrames.length) {
    for (const [i, id] of flyingFrames.entries()) {
      const f = manifest.frames[id];
      const variable = Array.isArray(flying.cell_size);
      if (variable) {
        if (!point(flying.cell_size) || !point(flying.anchor) || !point(flying.canonical_anchor)
          || f.width !== flying.cell_size[0] || f.height !== flying.cell_size[1]
          || JSON.stringify(f.anchor) !== JSON.stringify(flying.anchor)
          || JSON.stringify(f.canonical_anchor) !== JSON.stringify(flying.canonical_anchor)
          || f.x !== i * f.width || f.y !== 0) throw new Error('Invalid flying row geometry');
      } else if (f.x !== i * 128 || f.y !== 112 || f.width !== 128 || f.height !== 112 || f.anchor !== undefined) throw new Error('Invalid flying cell index');
    }
    const flap = manifest.clips.flap;
    if (JSON.stringify(flap.frames) !== JSON.stringify(flyingFrames) || !flap.loop || flap.deadline !== undefined
      || flap.durations.length !== flyingFrames.length || flap.durations.some(ms => ms !== 200 / flyingFrames.length)) throw new Error('Unsupported flying timing');
  }
  const names = ['idle', 'flying', 'takeoff', 'landing', 'hop', 'alert'];
  if (Object.keys(value.rows).length !== names.length) throw new Error('Invalid atlas rows');
  const rows: NonNullable<Manifest['rows']> = {};
  for (const [i, name] of names.entries()) {
    const row = value.rows[name];
    if (!record(row) || row.row !== i || row.count !== (i === 0 ? 8 : i === 1 ? flyingFrames.length : 0)
      || typeof row.available !== 'boolean' || (row.acceptance !== 'accepted' && row.acceptance !== 'pending')
      || row.available && row.acceptance !== 'accepted'
      || i > 1 && (row.available || row.acceptance !== 'pending')
      || i === 1 && (row.joins !== undefined && row.joins !== 'accepted' && row.joins !== 'pending'
        || !flyingFrames.length && row.acceptance !== 'pending'
        || row.joins === 'accepted' && row.acceptance !== 'accepted'
        || row.available && (!flyingFrames.length || row.joins !== 'accepted'))) throw new Error('Invalid atlas row availability');
    const joins = row.joins === 'accepted' ? 'accepted' : row.joins === 'pending' ? 'pending' : undefined;
    rows[name] = { row: i, count: Number(row.count), available: row.available, acceptance: row.acceptance,
      ...(i === 1 && joins !== undefined ? { joins } : {}),
      ...(i === 1 && point(row.cell_size) && point(row.anchor) && point(row.canonical_anchor)
        ? { cell_size: row.cell_size, anchor: row.anchor, canonical_anchor: row.canonical_anchor } : {}) };
  }
  return { ...manifest, profile: 'atlas-idle', rows };
}

function validateInventory(value: unknown, requiredFrames: readonly string[], requiredClips: readonly string[]): Manifest {
  const fail = (reason: string): never => { throw new Error(`Invalid robin manifest: ${reason}`); };
  if (!record(value) || value.version !== 1 || value.scale !== .35
    || !Array.isArray(value.anchor) || value.anchor.length !== 2 || value.anchor[0] !== 64 || value.anchor[1] !== 100) return fail('registration');
  const { sheets, frames, clips, fallback } = value;
  if (!isFallback(fallback)) return fail('independent I0 fallback');
  if (!record(sheets) || !record(frames) || !record(clips)) return fail('inventory');
  const parsedSheets: Record<string, Sheet> = {};
  const parsedFrames: Record<string, Frame> = {};
  const parsedClips: Record<string, ManifestClip> = {};
  if (!Object.keys(sheets).length) fail('empty sheets');
  for (const [name, sheet] of Object.entries(sheets)) {
    if (!filename(name) || !isSheet(sheet)) return fail(`sheet ${name}`);
    parsedSheets[name] = sheet;
  }
  for (const id of requiredFrames) if (!own(frames, id)) fail(`missing frame ${id}`);
  if (Object.keys(frames).length !== requiredFrames.length) fail('unexpected frame IDs');
  for (const [id, frame] of Object.entries(frames)) {
    if (!isFrame(frame) || !own(parsedSheets, frame.sheet)) return fail(`rectangle ${id}`);
    const f = frame, s = parsedSheets[f.sheet];
    if ((!id.startsWith('W') || value.profile !== 'atlas-idle') && (f.width !== 128 || f.height !== 112 || f.anchor !== undefined)) fail('idle geometry');
    parsedFrames[id] = f;
    if (f.x + f.width > s.width || f.y + f.height > s.height) fail(`out of bounds ${id}`);
    for (const [otherID, other] of Object.entries(frames)) {
      if (id >= otherID || !record(other) || other.sheet !== f.sheet) continue;
      if (f.x < Number(other.x) + Number(other.width) && f.x + f.width > Number(other.x)
        && f.y < Number(other.y) + Number(other.height) && f.y + f.height > Number(other.y)) fail(`overlap ${id}/${otherID}`);
    }
  }
  for (const id of requiredClips) if (!own(clips, id)) fail(`missing clip ${id}`);
  if (Object.keys(clips).length !== requiredClips.length) fail('unexpected clip IDs');
  for (const [name, clip] of Object.entries(clips)) {
    if (!isClip(clip) || clip.frames.some(id => !own(parsedFrames, id))) return fail(`clip ${name}`);
    if (!own(parsedFrames, clip.terminalFrame) || !own(parsedFrames, clip.restFrame)
      || clip.restFrame !== 'I0' || clip.terminalFrame !== clip.frames.at(-1)) return fail(`terminal/rest frame ${name}`);
    clipDuration(clip);
    parsedClips[name] = clip;
  }
  return { version: 1, anchor: [64, 100], scale: .35, sheets: parsedSheets, frames: parsedFrames, clips: parsedClips, fallback };
}

// The runtime supplies decoded dimensions/hashes from the actual sheet bytes.
// Metadata matching alone is not visual or geometry acceptance.
export function validateSheetInventory(manifest: Manifest, decoded: Record<string, Sheet>): void {
  for (const [name, expected] of [...Object.entries(manifest.sheets), [manifest.fallback.file, manifest.fallback] as const]) {
    const actual = own(decoded, name) ? decoded[name] : undefined;
    if (!actual || actual.width !== expected.width || actual.height !== expected.height || actual.sha256 !== expected.sha256) {
      throw new Error(`Missing or mismatched robin sheet: ${name}`);
    }
  }
}
