import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createReadStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const mascotPath = resolve(here, '../assets/mascot.webp');

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'dashboard-mascot-dev',
      configureServer(server) {
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
    // An animal's rig tests sweep thousands of its poses, each drawn on its
    // skeleton; on a busy machine one can take longer than the default 5s.
    testTimeout: 30000,
  },
  server: {
    proxy: {
      // Point the dev server at a running daemon's API. Defaults to the
      // standard local address; override to target a daemon on another port.
      '/api': process.env.CCR_API || 'http://127.0.0.1:8330',
    },
  },
});
