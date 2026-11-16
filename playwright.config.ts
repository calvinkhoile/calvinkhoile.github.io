import { defineConfig } from '@playwright/test';

// Smoke tests run against the production build (vite preview).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000, // CI renders WebGL in software, so the game loop runs slowly there
  fullyParallel: true,
  // Each page renders WebGL in software. More than three at once starves them all.
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // CI has no GPU and few cores. Start on the low quality tier there (no shadow pass) so the game runs near
    // real time. Tests that measure the high tier ask for it with ?quality=high, which wins over this.
    storageState: process.env.CI
      ? { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'mypark:quality', value: 'low' }] }] }
      : undefined,
    launchOptions: {
      // Software WebGL so the world renders in headless CI.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
