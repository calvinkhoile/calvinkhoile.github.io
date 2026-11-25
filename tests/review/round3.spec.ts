import { expect, test, type Page } from '@playwright/test';

// Temporary review captures (removed before the PR): the phone HUD, the shot, and pop-ups opening and closing,
// with and without reduced motion. Saves pictures to review-shots/<project>/.

const dir = () => `review-shots/${test.info().project.name}`;
const shot = (page: Page, name: string) => page.screenshot({ path: `${dir()}/${name}.png` }).catch(() => {});

async function boot(page: Page, hash: string): Promise<void> {
  if (test.info().project.name.includes('rm')) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('mypark:v1', JSON.stringify({ look: 'a', badges: ['ucla'] }));
    }
  });
  await page.goto(`/${hash}`);
  await page.waitForFunction(() => window.__mypark?.ready === true, undefined, { timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => window.__mypark!.busy), { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(1200);
}

async function standAt(page: Page, find: (t: { id: string; kind: string }) => boolean): Promise<boolean> {
  const t = await page.evaluate((src) => {
    const f = new Function('t', `return (${src})(t)`) as (t: unknown) => boolean;
    return window.__mypark!.targets.find((x) => f(x)) ?? null;
  }, find.toString());
  if (!t) return false;
  await page.evaluate(([x, z]) => window.__mypark!.teleport(x, z), [t.x + (t.kind === 'npc' ? 0 : 0.2), t.z + (t.kind === 'npc' ? 1.3 : 0.2)]);
  await expect(page.locator('.prompt')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);
  return true;
}

test('hud', async ({ page }) => {
  await boot(page, '#/');
  await shot(page, '01-plaza');
  await page.locator('#hud-toggle').click();
  await page.waitForTimeout(500);
  await shot(page, '02-links-open');
  await page.locator('#hud-toggle').click();
  await boot(page, '#/gym/betmgm');
  await shot(page, '03-gym');
});

test('shot', async ({ page }) => {
  await boot(page, '#/court');
  if (!(await standAt(page, (t) => t.kind === 'shoot'))) return;
  await page.locator('.prompt').click();
  await page.waitForTimeout(1500);
  await shot(page, '10-shoot-hud');
  const box = await page.locator('#lift-rep').boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(420);
  await page.mouse.up();
  for (const ms of [120, 300, 300, 300, 500]) {
    await page.waitForTimeout(ms);
    await shot(page, `11-flight-${ms}-${Date.now() % 100000}`);
  }
});

test('dialogue and card open and close', async ({ page }) => {
  await boot(page, '#/gym/deloitte');
  if (!(await standAt(page, (t) => t.id === 'calvin-deloitte'))) return;
  await page.locator('.prompt').click();
  for (const ms of [40, 80, 160]) {
    await page.waitForTimeout(ms);
    await shot(page, `20-talk-open-${ms}`);
  }
  await page.waitForTimeout(1500);
  await shot(page, '21-talk');
  await page.keyboard.press('Escape');
  for (const ms of [40, 100]) {
    await page.waitForTimeout(ms);
    await shot(page, `22-talk-close-${ms}`);
  }
  await page.waitForTimeout(800);
  if (!(await standAt(page, (t) => t.kind === 'station'))) return;
  await page.locator('.prompt').click();
  for (const ms of [40, 90]) {
    await page.waitForTimeout(ms);
    await shot(page, `23-card-open-${ms}`);
  }
  await page.waitForTimeout(1200);
  await shot(page, '24-card');
  await page.locator('.card-close').click();
  for (const ms of [40, 90]) {
    await page.waitForTimeout(ms);
    await shot(page, `25-card-close-${ms}`);
  }
});
