import { atlasIdleAvailable, validateIdleManifest, validateSheetInventory, type Manifest, type Sheet } from './manifest';

export type AssetDependencies = {
  read: (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
  hash: (bytes: ArrayBuffer) => Promise<string>;
  decode: (bytes: ArrayBuffer) => Promise<{ width: number; height: number }>;
  createUrl: (bytes: ArrayBuffer) => string;
  revoke: (url: string) => void;
};

const browser: AssetDependencies = {
  async read(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Missing robin asset');
    return response.arrayBuffer();
  },
  async hash(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); },
  async decode(bytes) {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close(); return size;
  },
  createUrl: bytes => URL.createObjectURL(new Blob([bytes], { type: 'image/webp' })),
  revoke: url => URL.revokeObjectURL(url),
};

export type IdleAssets = { manifest: Manifest; urls: Record<string, string>; release: () => void };

export async function loadIdleAssets(raw: string, urls: Record<string, string>, signal?: AbortSignal, deps = browser): Promise<IdleAssets> {
  const manifest = validateIdleManifest(JSON.parse(raw));
  if (manifest.profile === 'atlas-idle' && !atlasIdleAvailable(manifest)) throw new Error('Atlas idle unavailable');
  const decoded: Record<string, Sheet> = {}, snapshots: Record<string, ArrayBuffer> = {};
  // Bytes verified here are the same bytes rendered via immutable blob URLs.
  await Promise.all([...Object.entries(manifest.sheets), [manifest.fallback.file, manifest.fallback] as const].map(async ([name]) => {
    if (!Object.hasOwn(urls, name)) throw new Error('Missing robin asset URL');
    const bytes = await deps.read(urls[name], signal);
    const hash = await deps.hash(bytes);
    const dimensions = await deps.decode(bytes);
    decoded[name] = { ...dimensions, sha256: hash }; snapshots[name] = bytes;
  }));
  validateSheetInventory(manifest, decoded);
  if (signal?.aborted) throw new Error('Cancelled robin asset load');
  const rendered: Record<string, string> = {};
  let released = false;
  const release = () => { if (released) return; released = true; Object.values(rendered).forEach(deps.revoke); };
  try {
    for (const [name, bytes] of Object.entries(snapshots)) {
      if (signal?.aborted) throw new Error('Cancelled robin asset load');
      rendered[name] = deps.createUrl(bytes);
    }
    if (signal?.aborted) throw new Error('Cancelled robin asset load');
    return { manifest, urls: rendered, release };
  } catch (failure) { release(); throw failure; }
}
