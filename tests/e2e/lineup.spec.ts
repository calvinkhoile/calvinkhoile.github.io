import { expect, test } from '@playwright/test';

// M5: Calvin's avatar. Renders the review lineup and saves it for docs/PROGRESS.md.
test('avatar lineup: Calvin renders in all six outfits', async ({ page, isMobile }, info) => {
  test.skip(!!isMobile, 'desktop screenshot only');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?lineup=1&still=1');
  await page.waitForFunction(() => (window as unknown as { __lineupReady?: boolean }).__lineupReady === true);
  await expect(page.locator('.lineup-labels span')).toHaveCount(6);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `docs/progress/m5-${info.project.name}-lineup.png` });
  await page.goto('/?lineup=1&still=1&close=1');
  await page.waitForFunction(() => (window as unknown as { __lineupReady?: boolean }).__lineupReady === true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `docs/progress/m5-${info.project.name}-closeup.png` });
  expect(errors).toEqual([]);
});
