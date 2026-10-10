import { defineConfig } from '@playwright/test';

// Synthetic scene only. No daemon, store or API fixture. LAB_PORT moves it, so
// suites in separate worktrees can run side by side.
const PORT = Number(process.env.LAB_PORT ?? 5179);

export default defineConfig({
  testDir: './lab-tests',
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Use Playwright's dedicated headless shell, never the user's desktop browser.
    headless: true,
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/lab/scene.html`,
    reuseExistingServer: false,
  },
});
