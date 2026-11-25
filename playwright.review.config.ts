import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Temporary review captures (tests/review). Removed before the PR.
const phone = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
export default defineConfig({
  ...base,
  testDir: 'tests/review',
  retries: 0,
  workers: 2,
  reporter: 'list',
  timeout: 300_000,
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, ...phone } },
    { name: 'phone-rm', use: { viewport: { width: 390, height: 844 }, ...phone } },
    { name: 'se-rm', use: { viewport: { width: 375, height: 667 }, ...phone } },
    { name: 'land', use: { viewport: { width: 844, height: 390 }, ...phone } },
  ],
});
