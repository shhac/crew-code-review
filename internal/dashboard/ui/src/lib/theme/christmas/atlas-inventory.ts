import raw from './robin-atlas/manifest.json?raw';
import { atlasIdleAvailable, validateAtlasIdleManifest } from './manifest';

const bundled = import.meta.glob('./robin-atlas/*.webp', { eager: true, query: '?url', import: 'default' });
export const atlasAssetUrls: Record<string, string> = {};
for (const [path, url] of Object.entries(bundled)) {
  const filename = path.split('/').at(-1);
  if (filename && typeof url === 'string') atlasAssetUrls[filename] = url;
}
export const atlasManifestText = raw;
export function atlasFallbackUrl() {
  try {
    const manifest = validateAtlasIdleManifest(JSON.parse(raw));
    return atlasIdleAvailable(manifest) ? atlasAssetUrls[manifest.fallback.file] : undefined;
  } catch { return undefined; }
}
