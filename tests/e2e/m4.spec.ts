import { expect, test, type Page } from '@playwright/test';
import { badges } from '../../src/content/badges';
import { countedStations, stations, type SceneId } from '../../src/content/stations';

// M4: every gym interior, gym leaders, badges, the badge case, deep links, and the Weightroom.

async function boot(page: Page, url = '/', save: object | null = { look: 'a' }): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.url().startsWith('http://localhost') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  if (save) {
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('mypark:v1', JSON.stringify(s));
      }
    }, save);
  }
  await page.goto(url);
  await page.waitForFunction(() => window.__mypark?.ready === true, undefined, { timeout: 30_000 });
  return errors;
}

const idle = (page: Page) => expect.poll(() => page.evaluate(() => window.__mypark!.busy), { timeout: 20_000 }).toBe(false);
const goTo = (page: Page, x: number, z: number) => page.evaluate(([px, pz]) => window.__mypark!.teleport(px, pz), [x, z]);

async function interact(page: Page, isMobile: boolean | undefined): Promise<void> {
  if (isMobile) await page.locator('#a-button').tap();
  else await page.keyboard.press('e');
}

async function standAt(page: Page, id: string, label: RegExp | string): Promise<void> {
  const t = await page.evaluate((tid) => window.__mypark!.targets.find((x) => x.id === tid)!, id);
  await goTo(page, t.x + (t.kind === 'npc' ? 0 : 0.2), t.z + (t.kind === 'npc' ? 1.3 : t.kind === 'door' ? -0.95 : 0.2));
  await expect(page.locator('.prompt')).toContainText(label, { timeout: 15_000 });
  await page.waitForTimeout(320);
}

/** Dismiss whatever a station opened: a card, a photo, or a line of dialogue. */
async function dismiss(page: Page): Promise<void> {
  const card = page.locator('.card');
  const photo = page.locator('.lightbox');
  const talk = page.locator('.dialogue');
  await expect.poll(async () => (await card.isVisible()) || (await photo.isVisible()) || (await talk.isVisible()), { timeout: 15_000 }).toBe(true);
  if (await photo.isVisible()) await page.locator('.lightbox-close').click();
  else if (await card.isVisible()) await page.locator('.card-close').click();
  else for (let i = 0; i < 6 && (await talk.isVisible()); i++) await talk.click();
  await expect(card).toBeHidden();
  await expect(photo).toBeHidden();
  await expect(talk).toBeHidden();
  await idle(page);
}

const GYMS: { scene: SceneId; door: string; name: string; prefix: string; badge: string }[] = [
  { scene: 'gym-ucla', door: 'door-ucla', name: 'UCLA Gym', prefix: 'ucla', badge: 'Bruin Badge' },
  { scene: 'gym-deloitte', door: 'door-deloitte', name: 'Deloitte Gym', prefix: 'deloitte', badge: 'Consultant Badge' },
  { scene: 'gym-meta', door: 'door-meta', name: 'Meta Gym', prefix: 'meta', badge: 'Ship-It Badge' },
];

test('UCLA, Deloitte, and Meta: visit every station, earn each badge from the gym leader', async ({ page, isMobile }, info) => {
  test.setTimeout(300_000);
  const errors = await boot(page);
  for (const [n, gym] of GYMS.entries()) {
    await standAt(page, gym.door, `Enter ${gym.name}`);
    await interact(page, isMobile);
    await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 20_000 }).toBe(gym.scene);
    await idle(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `docs/progress/m4-${info.project.name}-${gym.prefix}-interior.png` });

    // Every station in the room, counted or not.
    const here = stations.filter((s) => s.scene === gym.scene);
    for (const s of here) {
      await standAt(page, s.id, s.label);
      await interact(page, isMobile);
      await dismiss(page);
    }
    const total = countedStations(gym.scene).length;
    await expect(page.locator('#station-counter')).toHaveText(`${gym.name} · ${total}/${total} stations ✓`);

    // The leader hands over the badge.
    await standAt(page, `calvin-${gym.prefix}`, 'Talk to Calvin');
    await interact(page, isMobile);
    const talk = page.locator('.dialogue');
    await expect(talk).toBeVisible();
    for (let i = 0; i < 6 && (await talk.isVisible()); i++) await talk.click();
    await expect(page.locator('.ceremony')).toBeVisible();
    await expect(page.locator('.ceremony-name')).toHaveText(gym.badge);
    if (n === 0) await page.screenshot({ path: `docs/progress/m4-${info.project.name}-ceremony.png` });
    await page.locator('.ceremony-continue').click();
    await expect(page.locator('.ceremony')).toBeHidden();
    await idle(page);
    expect(await page.evaluate(() => window.__mypark!.badges)).toContain(gym.prefix);
    await expect(page.locator('#badge-case .medal.is-earned')).toHaveCount(n + 1);
    if (n === 1) await expect(page.locator('#toast')).toContainText('Two badges already?');

    // Talking again doesn't award twice: a new line, then the overview card.
    await standAt(page, `calvin-${gym.prefix}`, 'Talk to Calvin');
    await interact(page, isMobile);
    await expect(talk).toBeVisible();
    for (let i = 0; i < 6 && (await talk.isVisible()); i++) await talk.click();
    await expect(page.locator('.card')).toHaveAttribute('data-card', `${gym.prefix}-overview`);
    await page.locator('.card-close').click();
    await expect(page.locator('.card')).toBeHidden();
    await idle(page);

    await standAt(page, 'exit', 'Exit to the park');
    await interact(page, isMobile);
    await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 20_000 }).toBe('exterior');
    await idle(page);
  }

  // Badges survive a reload.
  await page.reload();
  await page.waitForFunction(() => window.__mypark?.ready === true);
  expect((await page.evaluate(() => window.__mypark!.badges)).sort()).toEqual(['deloitte', 'meta', 'ucla']);
  await expect(page.locator('#badge-case .medal.is-earned')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('the Weightroom: five stops, then the Explorer badge', async ({ page, isMobile }, info) => {
  test.setTimeout(120_000);
  await boot(page);
  const stops = stations.filter((s) => s.id.startsWith('weightroom/'));
  expect(stops).toHaveLength(5);
  for (const [i, s] of stops.entries()) {
    await standAt(page, s.id, s.label);
    if (i === 0) await page.screenshot({ path: `docs/progress/m4-${info.project.name}-weightroom.png` });
    await interact(page, isMobile);
    await expect(page.locator('.card')).toHaveAttribute('data-card', s.id);
    await page.locator('.card-close').click();
    await expect(page.locator('.card')).toBeHidden();
    if (i < stops.length - 1) await idle(page);
  }
  await expect(page.locator('.ceremony-name')).toHaveText('Explorer Badge');
  await page.locator('.ceremony-continue').click();
  await idle(page);
  expect(await page.evaluate(() => window.__mypark!.badges)).toEqual(['explorer']);
});

test('badge case: lists all six badges, and reset clears progress', async ({ page }) => {
  await boot(page, '/', { look: 'c', badges: ['ucla'], visitedStations: ['ucla/clubs'] });
  await page.locator('#badge-case').click();
  const panel = page.locator('.badge-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.badge-row')).toHaveCount(badges.length);
  await expect(panel.locator('.badge-row.is-earned')).toHaveCount(1);
  await expect(panel.locator('.badge-row').nth(3)).toContainText('High Roller Badge');
  expect(await page.evaluate(() => window.__mypark!.busy)).toBe(true);

  await panel.locator('.badge-reset').click();
  await expect(panel.locator('.badge-reset')).toHaveText('Tap again to clear everything');
  await panel.locator('.badge-reset').click();
  // Back to a first visit: title screen, nothing saved.
  await expect(page.locator('#title')).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem('mypark:v1'))).toBeNull();
});

test('deep links drop a first-time visitor straight at a project', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await boot(page, '/#/gym/betmgm/rewards-store', null);
  await expect(page.locator('#title')).toBeHidden();
  expect(await page.evaluate(() => window.__mypark!.scene)).toBe('gym-betmgm');
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'betmgm/rewards-store');
  expect(await page.evaluate(() => location.hash)).toBe('#/gym/betmgm/rewards-store');
  await page.locator('.card-close').click();
  await expect(page.locator('.card')).toBeHidden();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/gym/betmgm');
  // A deep link is a look around, not a saved game: no look is stored.
  expect(await page.evaluate(() => localStorage.getItem('mypark:v1'))).toBeNull();

  // Changing the hash moves the visitor.
  await idle(page);
  await page.evaluate(() => (location.hash = '#/court'));
  await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 20_000 }).toBe('exterior');
  await expect.poll(async () => Math.hypot((await page.evaluate(() => window.__mypark!.player)).x - 36, (await page.evaluate(() => window.__mypark!.player)).z - 11)).toBeLessThan(0.5);

  await page.evaluate(() => (location.hash = '#/weightroom/chess'));
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'weightroom/chess');
  expect(errors).toEqual([]);
});

test('walking into and out of a gym keeps the URL hash in step', async ({ page, isMobile }) => {
  await boot(page);
  await standAt(page, 'door-meta', 'Enter Meta Gym');
  await interact(page, isMobile);
  await expect.poll(() => page.evaluate(() => location.hash), { timeout: 20_000 }).toBe('#/gym/meta');
  await idle(page);
  await standAt(page, 'exit', 'Exit to the park');
  await interact(page, isMobile);
  await expect.poll(() => page.evaluate(() => location.hash), { timeout: 20_000 }).toBe('#/');
});

test('quick links: résumé PDF, socials, and the email spelled out with a copy button', async ({ page, isMobile, context }) => {
  await boot(page);
  const links = page.locator('#hud-links');
  await expect(page.locator('.hud-resume')).toHaveAttribute('href', '/resume.pdf');
  await expect(page.locator('[data-social="linkedin"]')).toHaveAttribute('href', 'https://www.linkedin.com/in/calvinle13/');
  await expect(page.locator('[data-social="github"]')).toHaveAttribute('href', 'https://github.com/calvinkhoile');
  await expect(page.locator('[data-social="x"]')).toHaveAttribute('href', 'https://x.com/calvinle13');
  // Every link is on screen in both states: icons when collapsed, icon plus name when expanded.
  await expect(page.locator('#hud-items .hud-btn')).toHaveCount(5);
  for (const btn of await page.locator('#hud-items .hud-btn').all()) await expect(btn).toBeVisible();

  // Phones start collapsed (icons only), desktop starts expanded.
  if (isMobile) {
    await expect(links).toHaveClass(/is-collapsed/);
    await expect(page.locator('#hud-email-text')).toBeHidden();
    await page.locator('#hud-toggle').tap();
  }
  await expect(links).not.toHaveClass(/is-collapsed/);
  await expect(page.locator('#hud-email-text')).toHaveText('calvinkhoile13@gmail.com');
  await expect(page.locator('#hud-email .hud-copy')).toBeVisible();
  await expect(page.locator('.hud-resume .hud-label')).toBeVisible();

  // Collapse: names go away, icons stay. The choice survives a reload.
  await page.locator('#hud-toggle').click();
  await expect(links).toHaveClass(/is-collapsed/);
  await expect(page.locator('.hud-resume .hud-label')).toBeHidden();
  await expect(page.locator('.hud-resume .icon')).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => window.__mypark?.ready === true);
  await expect(links).toHaveClass(/is-collapsed/);
  await page.locator('#hud-toggle').click();
  await expect(links).not.toHaveClass(/is-collapsed/);

  // Touch emulation refuses clipboard access, which sends the button down its mailto fallback. Desktop checks the copy.
  if (isMobile) return;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#hud-email').click();
  await expect(page.locator('#toast')).toContainText('Copied calvinkhoile13@gmail.com');
  await expect(page.locator('#hud-email')).toHaveClass(/is-copied/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('calvinkhoile13@gmail.com');
});

test('moving looks the same speed indoors as outdoors', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard');
  await boot(page, '/?yaw=0#/gym/ucla');
  await idle(page);
  await page.keyboard.down('KeyA');
  // Indoors the camera is closer (0.62x), so world speed drops by the same factor: 7.5 * 0.62.
  await expect.poll(() => page.evaluate(() => window.__mypark!.player.speed), { timeout: 20_000 }).toBeCloseTo(4.65, 1);
  await page.keyboard.up('KeyA');
});

test('talking to the gym leader offers a walkthrough that steps through every station in the pop-up', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  await boot(page, '/#/gym/deloitte');
  await idle(page);
  await standAt(page, 'calvin-deloitte', 'Talk to Calvin');
  await interact(page, isMobile);
  // Advance through his welcome until the choices come up.
  for (let i = 0; i < 6 && (await page.locator('.dialogue-choice').count()) === 0; i++) {
    await page.locator('.dialogue').click();
    await page.waitForTimeout(250);
  }
  await expect(page.locator('.dialogue-choice')).toHaveText(['Walk me through it', "I'll look around"]);
  await page.getByRole('button', { name: 'Walk me through it' }).click();

  const card = page.locator('.card');
  const stops = countedStations('gym-deloitte');
  for (const [i, s] of stops.entries()) {
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-card', s.id);
    await expect(page.locator('.card-footer-note')).toHaveText(`Stop ${i + 1} of ${stops.length}`);
    const next = i < stops.length - 1 ? `Next: ${stops[i + 1].label} →` : 'Finish';
    await expect(page.locator('.card-footer-btn')).toHaveText(next);
    await page.locator('.card-footer-btn').click();
  }
  // Finishing counts every stop and earns the badge on the spot.
  await expect(page.locator('.ceremony-name')).toHaveText('Consultant Badge');
  await page.locator('.ceremony-continue').click();
  await idle(page);
  await expect(page.locator('#station-counter')).toHaveText('Deloitte Gym · 3/3 stations ✓');
  expect(await page.evaluate(() => window.__mypark!.badges)).toEqual(['deloitte']);
});

test('tracker: sits with the quick links, expands to jump to a station or skip the walk', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, '/#/gym/meta');
  await idle(page);
  const counter = page.locator('#station-counter');
  await expect(counter).toHaveText('Meta Gym · 0/3 stations');
  // Under the résumé and social buttons, on the right.
  const links = (await page.locator('.hud-resume').boundingBox())!;
  const box = (await counter.boundingBox())!;
  expect(box.y).toBeGreaterThan(links.y + links.height - 1);
  expect(box.x + box.width).toBeGreaterThan((page.viewportSize()!.width * 2) / 3);

  await expect(page.locator('.tracker-panel')).toBeHidden();
  await counter.click();
  await expect(page.locator('.tracker-item')).toHaveText([/Feedback Kiosk/, /Feature Wall/, /Voice of the Customer/]);
  await page.locator('.tracker-item', { hasText: 'Feature Wall' }).click();
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'meta/highlighted-features');
  // A jump shows only that station: no walkthrough footer.
  await expect(page.locator('.card-footer-note')).toHaveCount(0);
  await page.locator('.card-close').click();
  await expect(page.locator('.card')).toBeHidden();
  await idle(page);
  await expect(counter).toHaveText('Meta Gym · 1/3 stations');

  // Skip the walk, then bail out with X: the tour stops and no badge is given.
  await counter.click();
  await page.locator('.tracker-skip').click();
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'meta/external-feedback');
  await expect(page.locator('.card-footer-note')).toHaveText('Stop 1 of 3');
  await page.locator('.card-close').click();
  await expect(page.locator('.card')).toBeHidden();
  await idle(page);
  expect(await page.evaluate(() => window.__mypark!.badges)).toEqual([]);
});

test('tracker shows the Weightroom stops only while the visitor is in the Weightroom', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#station-counter')).toBeHidden();
  await goTo(page, 37.5, 30);
  await expect(page.locator('#station-counter')).toHaveText('The Weightroom · 0/5 stations');
  await goTo(page, 33.5, 52.5);
  await expect(page.locator('#station-counter')).toBeHidden();
});

test('clicking or tapping the station itself, or Calvin, walks over and uses it', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  await boot(page, '/#/gym/betmgm');
  await idle(page);
  // The Rewards Store counter (the object, not its floor ring).
  const counter = await page.evaluate(() => window.__mypark!.project(1.6, 6.5));
  if (isMobile) await page.touchscreen.tap(counter.x, counter.y);
  else await page.mouse.click(counter.x, counter.y);
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'betmgm/rewards-store', { timeout: 30_000 });
  await expect(page.locator('.card')).toBeVisible();
  await page.locator('.card-close').click();
  await expect(page.locator('.card')).toBeHidden();
  await idle(page);

  // Calvin himself. Stand mid-room first so he's on screen and clear of the HUD.
  await goTo(page, 8.5, 6.5);
  await page.waitForTimeout(400);
  const calvin = await page.evaluate(() => {
    const t = window.__mypark!.targets.find((x) => x.id === 'calvin-betmgm')!;
    return window.__mypark!.project(t.x, t.z);
  });
  if (isMobile) await page.touchscreen.tap(calvin.x, calvin.y - 20);
  else await page.mouse.click(calvin.x, calvin.y - 20);
  await expect(page.locator('.dialogue')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.dialogue-speaker')).toHaveText('Calvin');
});

test('the prompt itself can be tapped', async ({ page }) => {
  await boot(page);
  await standAt(page, 'plaza/signpost', 'Signpost');
  await page.locator('.prompt').click();
  await expect(page.locator('.dialogue-speaker')).toHaveText('Signpost');
});

test('overhead press: grab the dumbbells, press a few reps, put them back', async ({ page, isMobile }, info) => {
  const errors = await boot(page);
  await standAt(page, 'weightroom/dumbbells', 'Dumbbells');
  await interact(page, isMobile);
  const hud = page.locator('#lift-hud');
  await expect(hud).toBeVisible();
  await expect(page.locator('#lift-count')).toHaveText('0 reps');
  expect(await page.evaluate(() => window.__mypark!.busy)).toBe(true);

  const press = async () => {
    if (isMobile) await page.locator('#lift-rep').tap();
    else await page.keyboard.press('g');
  };
  await press();
  await expect(page.locator('#lift-count')).toHaveText('1 rep');
  await page.waitForTimeout(450);
  await page.screenshot({ path: `docs/progress/m5-${info.project.name}-press.png` });
  // A second press mid-rep is ignored. One that lands after the rep finishes counts.
  await expect
    .poll(async () => {
      await press();
      return page.locator('#lift-count').textContent();
    }, { timeout: 20_000 })
    .toBe('2 reps');

  if (isMobile) await page.locator('#lift-done').tap();
  else await page.keyboard.press('Space');
  await expect(hud).toBeHidden();
  await expect(page.locator('#toast')).toContainText('2 reps');
  await idle(page);
  // Back to normal: the dumbbells didn't turn into an interaction loop.
  await page.waitForTimeout(400);
  await expect(hud).toBeHidden();
  expect(errors).toEqual([]);
});

test('the mini jet by the court tells the JetBlue story', async ({ page, isMobile }, info) => {
  await boot(page);
  await standAt(page, 'court/jetblue', 'Mini Jet');
  await page.screenshot({ path: `docs/progress/m5-${info.project.name}-jet.png` });
  await interact(page, isMobile);
  await expect(page.locator('.card-title')).toHaveText('JetBlue 25 for 25');
  await expect(page.locator('.card-desc')).toHaveText(
    'In 2025, I completed the JetBlue challenge that gave me 25 years of loyalty status, Mosaic 1. I hit 25 different airports in the span of 2 months. It was a crazy time!',
  );
  await expect.poll(() => page.locator('.card .card-photo').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});
