import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Review captures for the polish pass (tests/review). Five viewports: small phone, phone, landscape phone,
// tablet-ish, desktop.
export default defineConfig({
  ...base,
  testDir: 'tests/review',
  retries: 0,
  workers: 2,
  reporter: 'list',
  timeout: 600_000,
  projects: [
    { name: 'se', use: { viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'land', use: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'tablet', use: { viewport: { width: 860, height: 1000 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
