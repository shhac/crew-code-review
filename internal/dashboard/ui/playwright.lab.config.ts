import { defineConfig } from '@playwright/test';

// Synthetic scene only. No daemon, store or API fixture.
export default defineConfig({
  testDir: './lab-tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5179' },
  webServer: {
    command: 'npm run dev -- --port 5179 --strictPort',
    url: 'http://127.0.0.1:5179/lab/scene.html',
    reuseExistingServer: false,
  },
});
