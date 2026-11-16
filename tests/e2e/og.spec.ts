import { expect, test } from '@playwright/test';

// Captures the social preview image (public/og.png, 1200 x 630): the park with the HUD hidden.
test('social preview image', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'one image, taken at desktop size');
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.addInitScript(() => localStorage.setItem('mypark:v1', JSON.stringify({ look: 'a' })));
  await page.goto('/?quality=high');
  await page.waitForFunction(() => window.__mypark?.ready === true, undefined, { timeout: 30_000 });
  await page.evaluate(() => window.__mypark!.teleport(24.5, 43));
  await page.addStyleTag({ content: '#ui > *, .skip-link { display: none !important; }' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'public/og.png' });
  // The tags point at it.
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://calvinkhoile.github.io/og.png');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
});
