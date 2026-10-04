import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { atlasIdleAvailable, validateAtlasIdleManifest, validateIdleManifest } from './manifest';
import { loadIdleAssets, type AssetDependencies } from './idle-assets';
import { createAtlasIdlePlayback } from './idle-playback';
import { advanceBird, createBird, type Scene } from './robin';

const raw = readFileSync(new URL('./robin-atlas/manifest.json', import.meta.url), 'utf8');
const accepted = () => JSON.parse(raw);

it('ships accepted idle without metadata overrides', () => {
  const manifest = validateAtlasIdleManifest(JSON.parse(raw));
  expect(atlasIdleAvailable(manifest)).toBe(true);
  expect(manifest.rows!.idle.acceptance).toBe('accepted');
  expect(Object.values(manifest.rows!).filter(row => row.available)).toHaveLength(1);
});
const scene: Scene = { floors: new Map([[1, { left: 100, right: 500, y: 200, base: 300, room: 100 }]]), obstacles: [], width: 800, height: 600 };
const bird = () => createBird(scene, 0, () => .5);

it('validates pending inventory but selects only explicitly accepted idle; legacy stays usable', () => {
  const pending = accepted(); pending.rows.idle.available = false; pending.rows.idle.acceptance = 'pending';
  expect(atlasIdleAvailable(validateAtlasIdleManifest(pending))).toBe(false);
  const manifest = validateIdleManifest(accepted());
  expect(atlasIdleAvailable(manifest)).toBe(true);
  expect(Object.values(manifest.rows!).filter(r => r.available)).toHaveLength(1);
  expect(validateIdleManifest(JSON.parse(readFileSync(new URL('./robin-frames/manifest.json', import.meta.url), 'utf8'))).profile).toBe('idle-blink');
});

it('rejects unaccepted enabled rows, wrong cells, counts, timing and enabled future rows', () => {
  for (const change of [
    (m: ReturnType<typeof accepted>) => { m.rows.idle.acceptance = 'pending'; },
    (m: ReturnType<typeof accepted>) => { m.rows.flying.available = true; },
    (m: ReturnType<typeof accepted>) => { m.rows.idle.count = 7; },
    (m: ReturnType<typeof accepted>) => { delete m.rows.hop; },
    (m: ReturnType<typeof accepted>) => { m.frames.I7.y = 112; },
    (m: ReturnType<typeof accepted>) => { m.frames.I2.x = 128; },
    (m: ReturnType<typeof accepted>) => { delete m.frames.I4; },
    (m: ReturnType<typeof accepted>) => { m.clips.idle.durations[0] = 1601; },
    (m: ReturnType<typeof accepted>) => { m.clips.idle.frames[7] = 'I0'; },
  ]) { const value = accepted(); change(value); expect(() => validateAtlasIdleManifest(value)).toThrow(); }
});

it('samples all eight half-open intervals and the 4800ms seam without a separate blink', () => {
  const player = createAtlasIdlePlayback(), resting = bird();
  const boundaries = [0, 1600, 2050, 2500, 3150, 3210, 3290, 3380, 4800];
  for (let i = 0; i < 8; i++) {
    expect(player.frame(resting, boundaries[i])).toBe(`I${i}`);
    expect(player.frame(resting, boundaries[i + 1] - 1)).toBe(`I${i}`);
  }
  expect(player.frame(resting, 4800)).toBe('I0');
  expect(player.frame(resting, 4900)).toBe('I0');
  expect(player.frame(resting, 6400)).toBe('I1');
});

it('preempts for movement, alert, missing geometry and reduced motion and resets epochs', () => {
  const resting = bird();
  const moving = { ...resting, action: { from: { x: 124, y: 200 }, to: { x: 149, y: 200 }, target: resting.perch!, start: 3200, duration: 270, rise: 8, kind: 'hop' as const } };
  for (const changed of [moving, { ...resting, alert: true }, { ...resting, perch: null }]) {
    const player = createAtlasIdlePlayback();
    player.frame(resting, 0); expect(player.frame(resting, 3210)).toBe('I5');
    expect(player.frame(changed, 3211)).toBe('I0');
    expect(player.frame(resting, 4000)).toBe('I0');
    expect(player.frame(resting, 5600)).toBe('I1');
  }
  const player = createAtlasIdlePlayback();
  player.frame(resting, 0); player.frame(resting, 3210);
  expect(player.frame(resting, 3211, true)).toBe('I0');
  expect(player.frame(resting, 100000, true)).toBe('I0');
  expect(player.frame(resting, 100001)).toBe('I0');
  expect(player.frame(resting, 0)).toBe('I0');
  expect(player.frame(resting, 1600)).toBe('I1');
  player.reset(); expect(player.frame(resting, 2000)).toBe('I0');
});

it('does not mutate movement, RNG consumption, routes, facing or action deadlines', () => {
  const run = (animate: boolean) => {
    let calls = 0;
    const random = () => { calls++; return .5; };
    let current = createBird(scene, 0, random);
    const player = createAtlasIdlePlayback(), states = [];
    for (const now of [0, 1600, 3210, 4800, 9000, 9100, 9270, 20000]) {
      current = advanceBird(current, scene, now, random);
      const before = structuredClone(current);
      if (animate) player.frame(current, now);
      expect(current).toEqual(before); states.push(current);
    }
    return { calls, states };
  };
  expect(run(true)).toEqual(run(false));
});

function dependencies() {
  const manifest = validateAtlasIdleManifest(accepted());
  const urls: Record<string, string> = {}, created: string[] = [], revoked: string[] = [];
  const sheets = { ...manifest.sheets, [manifest.fallback.file]: manifest.fallback };
  for (const name of Object.keys(sheets)) urls[name] = name;
  const deps: AssetDependencies = {
    async read(name) { return new Uint8Array(readFileSync(new URL('./robin-atlas/' + name, import.meta.url))).buffer; },
    async hash(bytes) { return createHash('sha256').update(new Uint8Array(bytes)).digest('hex'); },
    async decode(bytes) {
      const hash = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
      const sheet = Object.values(sheets).find(s => s.sha256 === hash);
      if (!sheet) throw new Error('Decode');
      return sheet;
    },
    createUrl() { const url = 'blob:test-' + created.length; created.push(url); return url; },
    revoke(url) { revoked.push(url); },
  };
  return { deps, urls, created, revoked };
}

it('loads shipped accepted strip bytes and releases URLs once', async () => {
  const f = dependencies(), loaded = await loadIdleAssets(JSON.stringify(accepted()), f.urls, undefined, f.deps);
  expect(loaded.manifest.clips.idle.frames).toHaveLength(8);
  loaded.release(); loaded.release(); expect(f.revoked).toEqual(f.created);
});

it.each(['unavailable', 'missing', 'hash', 'dimensions', 'decode', 'cancelled', 'allocation', 'stale'])('retains fallback and cleans resources for %s', async failure => {
  const f = dependencies(), abort = new AbortController();
  if (failure === 'missing') f.deps.read = async () => { throw new Error('Missing'); };
  if (failure === 'hash') f.deps.hash = async () => '0'.repeat(64);
  if (failure === 'dimensions') f.deps.decode = async () => ({ width: 1, height: 1 });
  if (failure === 'decode') f.deps.decode = async () => { throw new Error('Decode'); };
  if (failure === 'cancelled') abort.abort();
  const create = f.deps.createUrl;
  if (failure === 'allocation') f.deps.createUrl = bytes => { if (f.created.length) throw new Error('Allocation'); return create(bytes); };
  if (failure === 'stale') f.deps.createUrl = bytes => { const url = create(bytes); abort.abort(); return url; };
  const pending = accepted(); pending.rows.idle.available = false; pending.rows.idle.acceptance = 'pending';
  await expect(loadIdleAssets(JSON.stringify(failure === 'unavailable' ? pending : accepted()), f.urls, abort.signal, f.deps)).rejects.toThrow();
  expect(f.revoked).toEqual(f.created);
});

it('validates flying row dimensions and anchors against actual sheet bounds', () => {
  const value = accepted();
  const manifest = validateAtlasIdleManifest(value);
  expect(manifest.frames.W0.height).toBeGreaterThan(112);
  expect(manifest.frames.W0.anchor).toEqual(manifest.rows!.flying.anchor);
  expect(manifest.frames.W0.canonical_anchor).toEqual([97.1, 26.7]);
  for (const mutate of [
    (m: typeof value) => { m.frames.W1.x = 0; },
    (m: typeof value) => { m.frames.W0.height += 2; },
    (m: typeof value) => { m.frames.W0.anchor[0] += 1; },
    (m: typeof value) => { m.frames.W3.x = 9999; },
    (m: typeof value) => { m.frames.I0.width = 140; },
  ]) {
    const m = accepted(); mutate(m);
    expect(() => validateAtlasIdleManifest(m)).toThrow();
  }
});
