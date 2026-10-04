import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createReadStream, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const mascotPath = resolve(here, '../assets/mascot.webp');
const rigPath = resolve(here, '../../../design-docs/christmas/animation/accepted');

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'dashboard-mascot-dev',
      configureServer(server) {
        // Committed pipeline evidence is served only by Vite, never by the daemon.
        server.middlewares.use('/lab/robin-rig-evidence', (req, res) => {
          const name = (req.url ?? '').replace(/^\//, '');
          if (name !== 'complete.json' && !/^[a-f0-9]{64}-[a-zA-Z0-9-]+\.(webp|png|gif|json)$/.test(name)) {
            res.statusCode = 404; res.end(); return;
          }
          try {
            const bytes = readFileSync(resolve(rigPath, name));
            if (name !== 'complete.json' && createHash('sha256').update(bytes).digest('hex') !== name.slice(0, 64)) {
              res.statusCode = 409; res.end('Mismatched rig evidence'); return;
            }
            res.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : name.endsWith('.webp') ? 'image/webp' : name.endsWith('.gif') ? 'image/gif' : 'image/png');
            res.setHeader('Cache-Control', 'no-store');
            res.end(bytes);
          } catch {
            res.statusCode = 404; res.end('Rig evidence unavailable');
          }
        });
        server.middlewares.use('/mascot.webp', (_req, res) => {
          res.setHeader('Content-Type', 'image/webp');
          createReadStream(mascotPath).pipe(res);
        });
      },
    },
  ],
  build: {
    outDir: '../assets',
    emptyOutDir: false,
  },
  // Vitest's default include would also collect e2e/*.spec.ts, which are
  // Playwright tests and throw on import. The two suites are separate: unit
  // tests under src/, browser tests under e2e/ via `npm run test:e2e`.
  test: {
    include: ['src/**/*.test.ts'],
  },
  server: {
    proxy: {
      // Point the dev server at a running daemon's API. Defaults to the
      // standard local address; override to target a daemon on another port.
      '/api': process.env.CCR_API || 'http://127.0.0.1:8330',
    },
  },
});
