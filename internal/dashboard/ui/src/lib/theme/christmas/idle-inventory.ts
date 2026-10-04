import raw from './robin-frames/manifest.json?raw';
import perch from './robin-perch.webp';
import { validateIdleManifest } from './manifest';
import { breathing, blink } from './animation';

const bundled = import.meta.glob('./robin-frames/*.webp', { eager: true, query: '?url', import: 'default' });
export const idleAssetUrls: Record<string, string> = { 'robin-perch.webp': perch };
for (const [path, url] of Object.entries(bundled)) {
  const filename = path.split('/').at(-1);
  if (filename && typeof url === 'string') idleAssetUrls[filename] = url;
}
export const idleManifestText = raw;
export function idleClips() {
  try {
    const manifest = validateIdleManifest(JSON.parse(raw));
    return { breathing: manifest.clips.breathing, blink: manifest.clips.blink };
  } catch {
    // Invalid art cannot affect movement. The loader reports the failure.
    return { breathing, blink };
  }
}
