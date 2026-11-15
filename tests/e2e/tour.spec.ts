import { expect, test } from '@playwright/test';

// Visits every area of the park, checks the spot is walkable, and saves a screenshot for docs/PROGRESS.md.
const STOPS: [string, number, number][] = [
  ['ucla', 19.5, 49.5],
  ['deloitte', 19.5, 37.5],
  ['meta', 19.5, 23.5],
  ['betmgm', 19.5, 9],
  ['court', 38, 10.5],
  ['weightroom', 37.5, 30],
];

test('tour: every area renders and is reachable', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => localStorage.setItem('mypark:v1', JSON.stringify({ look: 'a' })));
  await page.goto('/?quality=high');
  await page.waitForFunction(() => window.__mypark?.ready === true);
  for (const [name, x, z] of STOPS) {
    expect(await page.evaluate(([px, pz]) => window.__mypark!.isBlocked(px, pz), [x, z]), `${name} stop is blocked`).toBe(false);
    await page.evaluate(([px, pz]) => window.__mypark!.teleport(px, pz), [x, z]);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.__mypark!.drawCalls), `${name} draw calls`).toBeLessThan(150);
    await page.screenshot({ path: `docs/progress/m2-${info.project.name}-${name}.png` });
  }
  expect(errors).toEqual([]);
});
