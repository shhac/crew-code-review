import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadIdleAssets, type AssetDependencies } from './idle-assets';
import { validateIdleManifest } from './manifest';

const raw = readFileSync(new URL('./robin-frames/manifest.json', import.meta.url), 'utf8');
const manifest = validateIdleManifest(JSON.parse(raw));
const fixture = () => {
  const urls: Record<string, string> = {}, dimensions: Record<string, { width: number; height: number }> = {};
  for (const [name, metadata] of [...Object.entries(manifest.sheets), [manifest.fallback.file, manifest.fallback] as const]) {
    urls[name] = name; dimensions[name] = metadata;
  }
  let reads = 0;
  const revoked: string[] = [], created: string[] = [];
  const deps: AssetDependencies = {
    async read(name) {
      reads++;
      const bytes = readFileSync(new URL(name === 'robin-perch.webp' ? './robin-perch.webp' : './robin-frames/' + name, import.meta.url));
      return new Uint8Array(bytes).buffer;
    },
    async hash(bytes) { return createHash('sha256').update(new Uint8Array(bytes)).digest('hex'); },
    async decode(bytes) {
      const hash = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
      const name = Object.keys(dimensions).find(key => (manifest.sheets[key] ?? manifest.fallback).sha256 === hash);
      if (!name) throw new Error('Decode failure');
      return dimensions[name];
    },
    createUrl() { const url = 'blob:verified-' + created.length; created.push(url); return url; },
    revoke(url) { revoked.push(url); },
  };
  return { deps, urls, created, revoked, reads: () => reads };
};

it('verifies actual committed bytes and returns immutable render URLs with idempotent release', async () => {
  const f = fixture(), loaded = await loadIdleAssets(raw, f.urls, undefined, f.deps);
  expect(loaded.manifest.profile).toBe('idle-blink');
  expect(f.reads()).toBe(2);
  expect(Object.values(loaded.urls)).toEqual(expect.arrayContaining(f.created));
  loaded.release(); loaded.release();
  expect(f.revoked).toEqual(f.created);
});

it('rejects bad manifests, frames, clip timing and forbidden deferred frames before loading', async () => {
  for (const mutate of [
    (m: typeof manifest) => { delete m.frames.I0; },
    (m: typeof manifest) => { m.frames.T1 = m.frames.I0; },
    (m: typeof manifest) => { m.frames.I2.x = m.frames.I1.x; },
    (m: typeof manifest) => { m.clips.breathing.durations = [200, 200, 200, 200, 200, 400]; },
    (m: typeof manifest) => { m.clips.blink.loop = true; },
  ]) {
    const broken = structuredClone(manifest); mutate(broken);
    const f = fixture();
    await expect(loadIdleAssets(JSON.stringify(broken), f.urls, undefined, f.deps)).rejects.toThrow();
    expect(f.reads()).toBe(0);
  }
});

it.each(['missing', 'hash', 'dimensions', 'decode', 'cancelled'])('fails safely without publishing URLs for %s', async failure => {
  const f = fixture(), abort = new AbortController();
  if (failure === 'missing') f.deps.read = async () => { throw new Error('Missing'); };
  if (failure === 'hash') f.deps.hash = async () => '0'.repeat(64);
  if (failure === 'dimensions') f.deps.decode = async () => ({ width: 1, height: 1 });
  if (failure === 'decode') f.deps.decode = async () => { throw new Error('Decode'); };
  if (failure === 'cancelled') abort.abort();
  await expect(loadIdleAssets(raw, f.urls, abort.signal, f.deps)).rejects.toThrow();
  expect(f.created).toEqual([]);
});

it('revokes partial blob publication if URL allocation fails', async () => {
  const f = fixture();
  const create = f.deps.createUrl;
  f.deps.createUrl = bytes => { if (f.created.length) throw new Error('Allocation'); return create(bytes); };
  await expect(loadIdleAssets(raw, f.urls, undefined, f.deps)).rejects.toThrow('Allocation');
  expect(f.revoked).toEqual(f.created);
});
