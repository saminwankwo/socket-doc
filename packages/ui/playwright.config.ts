import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  // Serves the docs UI + a live Socket.IO server for the responsive checks
  webServer: {
    command: 'node ../../examples/express-chat/src/server.js',
    url: 'http://localhost:3000/socket-docs/spec.json',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
