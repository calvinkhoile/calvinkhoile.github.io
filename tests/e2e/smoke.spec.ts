import { expect, test, type Page } from '@playwright/test';

// Smoke tests: the world boots, the title flow works, and the player moves with every input method.
// Runs at 1440x900 desktop and 390x844 mobile (touch emulation).

type Pos = { x: number; z: number };

/** Boot straight into the world as a returning visitor (saved look), which skips the title screen. */
async function boot(page: Page, query = '', opts: { fresh?: boolean } = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  if (!opts.fresh) {
    await page.addInitScript(() => localStorage.setItem('mypark:v1', JSON.stringify({ look: 'a' })));
  }
  await page.goto('/' + query);
  if (!opts.fresh) await page.waitForFunction(() => window.__mypark?.ready === true);
  return errors;
}

const pos = (page: Page): Promise<Pos> => page.evaluate(() => ({ x: window.__mypark!.player.x, z: window.__mypark!.player.z }));
const dist = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.z - b.z);

test('world boots without errors', async ({ page }, info) => {
  const errors = await boot(page);
  await expect(page.locator('canvas#world')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `docs/progress/m2-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('fresh visit: title, character select, then into the park with the look saved', async ({ page }, info) => {
  const errors = await boot(page, '', { fresh: true });
  await expect(page.locator('#title')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.title-name')).toHaveText('CALVIN LE');
  await expect(page.locator('#title a')).toHaveAttribute('href', /classic|resume/);
  expect(await page.evaluate(() => window.__mypark!.ready)).toBe(false);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `docs/progress/m2-${info.project.name}-title.png` });

  await page.locator('#title-start').click();
  await expect(page.locator('#select')).toBeVisible();
  await expect(page.locator('#select-name')).toHaveText('Rookie');
  await page.locator('#select-next').click();
  await expect(page.locator('#select-name')).toHaveText('Playmaker');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `docs/progress/m2-${info.project.name}-select.png` });
  await page.locator('#select-confirm').click();

  await page.waitForFunction(() => window.__mypark?.ready === true);
  // First visit: Calvin walks over and starts the intro on his own. Esc skips it.
  await expect(page.locator('.dialogue')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.dialogue-speaker')).toHaveText('Calvin');
  await page.keyboard.press('Escape');
  await expect(page.locator('.dialogue')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__mypark!.busy)).toBe(false);
  expect(await page.evaluate(() => window.__mypark!.look)).toBe('b');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mypark:v1')!).look)).toBe('b');
  await expect(page.locator('.resume-link')).toBeVisible();
  expect(errors).toEqual([]);
});

test('exterior stays inside the draw-call budget', async ({ page }) => {
  await boot(page, '?quality=high');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__mypark!.drawCalls)).toBeLessThan(150);
});

test('debug overlay shows the grid and an FPS counter', async ({ page }, info) => {
  await boot(page, '?debug=1');
  await expect(page.locator('.debug-panel')).toContainText('fps');
  await page.waitForTimeout(700);
  await expect(page.locator('.debug-panel')).toContainText(/pos \d+\.\d+, \d+\.\d+/);
  await page.screenshot({ path: `docs/progress/m2-${info.project.name}-debug.png` });
});

test('click or tap on open ground walks the player there', async ({ page }, info) => {
  await boot(page);
  const target = { x: 36.5, z: 49.5 };
  const screen = await page.evaluate((t) => window.__mypark!.project(t.x, t.z), target);
  if (info.project.name === 'mobile') await page.touchscreen.tap(screen.x, screen.y);
  else await page.mouse.click(screen.x, screen.y);
  await expect.poll(async () => dist(await pos(page), target), { timeout: 20_000 }).toBeLessThan(0.3);
});

test('clicking a building walks to the nearest open tile instead', async ({ page }, info) => {
  await boot(page);
  const start = await pos(page);
  // Middle of the fountain (blocked).
  const screen = await page.evaluate(() => window.__mypark!.project(33.5, 48.5));
  if (info.project.name === 'mobile') await page.touchscreen.tap(screen.x, screen.y);
  else await page.mouse.click(screen.x, screen.y);
  await expect.poll(async () => (await page.evaluate(() => window.__mypark!.player.pathLength)) === 0 && dist(await pos(page), start) > 1, { timeout: 20_000 }).toBe(true);
  const end = await pos(page);
  expect(await page.evaluate((p) => window.__mypark!.isBlocked(p.x, p.z), end)).toBe(false);
});

const speed = (page: Page): Promise<number> => page.evaluate(() => window.__mypark!.player.speed);

/** Wait until the player has stopped, then return where. Frame-rate independent (headless WebGL is slow). */
async function settle(page: Page): Promise<Pos> {
  await expect.poll(() => speed(page), { timeout: 15_000 }).toBeLessThan(0.01);
  return pos(page);
}

test.describe('keyboard', () => {
  test.skip(({ isMobile }) => !!isMobile, 'desktop only');

  test('WASD moves at the fast desktop speed with no sprint key, and stops on release', async ({ page }) => {
    // yaw=0 makes W point straight at map north, which keeps the assertions simple.
    await boot(page, '?yaw=0');
    const start = await pos(page);
    await page.keyboard.down('KeyD');
    await expect.poll(async () => (await pos(page)).x - start.x, { timeout: 20_000 }).toBeGreaterThan(1.2);
    expect(await speed(page)).toBeCloseTo(7.5, 1);
    await page.keyboard.up('KeyD');
    const stopped = await settle(page);
    expect(Math.abs(stopped.z - start.z)).toBeLessThan(0.01);
  });

  test('walking into the fountain stops, then slides along it', async ({ page }) => {
    await boot(page, '?yaw=0');
    // Spawn is just south of the fountain (x 32..35, z 47..50).
    await page.keyboard.down('KeyW');
    await expect.poll(async () => (await pos(page)).z, { timeout: 20_000 }).toBeLessThan(50.4);
    const stopped = await settle(page);
    expect(stopped.z).toBeGreaterThan(50.34);
    await page.keyboard.down('KeyD');
    await expect.poll(async () => (await pos(page)).x - stopped.x, { timeout: 20_000 }).toBeGreaterThan(1);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    const slid = await settle(page);
    // It may have rounded the fountain's corner by now, so only assert it never ended up inside anything.
    expect(await page.evaluate((p) => window.__mypark!.isBlocked(p.x, p.z), slid)).toBe(false);
  });

  test('diagonal movement is not faster than straight movement', async ({ page }) => {
    await boot(page, '?yaw=0');
    const start = await pos(page);
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyS');
    await expect.poll(async () => dist(await pos(page), start), { timeout: 20_000 }).toBeGreaterThan(1.2);
    expect(await speed(page)).toBeCloseTo(7.5, 1);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyS');
  });
});

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile only');

  test('fixed joystick moves the player and releases cleanly', async ({ page }) => {
    await boot(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: x === undefined ? [] : [{ x, y: y!, id: 1 }],
      });
    const start = await pos(page);
    await expect(page.locator('.joystick-knob')).toBeVisible(); // fixed stick, always on screen
    await touch('touchStart', 84, 748);
    await expect(page.locator('.joystick')).toHaveClass(/is-active/);
    // Light push: analog walk, slower than full walk speed.
    await touch('touchMove', 84, 728);
    await expect.poll(async () => dist(await pos(page), start), { timeout: 20_000 }).toBeGreaterThan(0.4);
    const slow = await speed(page);
    expect(slow).toBeGreaterThan(0.5);
    expect(slow).toBeLessThan(3.9);
    // Full push: sprint.
    await touch('touchMove', 84, 690);
    await expect(page.locator('.joystick')).toHaveClass(/is-sprint/);
    await expect.poll(() => speed(page), { timeout: 20_000 }).toBeCloseTo(6.5, 1);
    await touch('touchEnd');
    await expect(page.locator('.joystick')).not.toHaveClass(/is-active/);
    await settle(page);
  });

  test('a touch away from the joystick does not grab it', async ({ page }) => {
    await boot(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 300, id: 1 }] });
    await expect(page.locator('.joystick')).not.toHaveClass(/is-active/);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  });

  test('A button only appears when there is something to use, and clears the home indicator area', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#a-button')).toBeHidden();
    await page.evaluate(() => window.__mypark!.teleport(28.7, 46.9)); // beside the signpost
    await expect(page.locator('#a-button')).toBeVisible();
    const box = (await page.locator('#a-button').boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(64);
    expect(box.y + box.height).toBeLessThanOrEqual(844 - 24);
    await page.evaluate(() => window.__mypark!.teleport(33.5, 52.5));
    await expect(page.locator('#a-button')).toBeHidden();
  });
});

test('the how-to-move hint hides while moving and comes back after standing still', async ({ page }) => {
  await boot(page);
  const hint = page.locator('#hint');
  await expect(hint).not.toHaveClass(/is-hidden/);
  const target = await page.evaluate(() => window.__mypark!.project(36.5, 49.5));
  await page.mouse.click(target.x, target.y);
  await expect(hint).toHaveClass(/is-hidden/);
  await expect(hint).not.toHaveClass(/is-hidden/, { timeout: 30_000 });
});

test('classic site still works at /classic/', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.url().startsWith('http://localhost') && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('/classic/');
  await expect(page).toHaveTitle(/Calvin/i);
  await page.waitForLoadState('load');
  const imgs = await page.locator('img').count();
  expect(imgs).toBeGreaterThan(5);
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.getAttribute('src') && i.complete && i.naturalWidth === 0)
      .map((i) => i.src),
  );
  expect(broken).toEqual([]);
  expect(failed).toEqual([]);
});
