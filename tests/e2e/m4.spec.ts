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

    // Every station in the room, counted or not. Closing the pop-up after the last counted one earns the badge.
    const here = stations.filter((s) => s.scene === gym.scene);
    const total = countedStations(gym.scene).length;
    let seen = 0;
    for (const s of here) {
      await standAt(page, s.id, s.label);
      await interact(page, isMobile);
      await dismiss(page);
      if (s.counts && ++seen === total) {
        await expect(page.locator('.ceremony-name')).toHaveText(gym.badge);
        if (n === 0) await page.screenshot({ path: `docs/progress/m4-${info.project.name}-ceremony.png` });
        await page.locator('.ceremony-continue').click();
        await expect(page.locator('.ceremony')).toBeHidden();
      }
      await idle(page);
    }
    await expect(page.locator('#station-counter')).toHaveText(`${gym.name} · ${total}/${total} stations ✓`);
    expect(await page.evaluate(() => window.__mypark!.badges)).toContain(gym.prefix);
    await expect(page.locator('#badge-case .medal.is-earned')).toHaveCount(n + 1);
    if (n === 1) await expect(page.locator('#toast')).toContainText('Two badges already?');
    const talk = page.locator('.dialogue');

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
  expect(stops).toHaveLength(4);
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
  // A deep link is a look around: the stop counts as seen, but no trainer look is locked in.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mypark:v1')!))).toMatchObject({ look: null, visitedStations: ['betmgm/rewards-store'] });

  // Changing the hash moves the visitor.
  await idle(page);
  await page.evaluate(() => (location.hash = '#/court'));
  await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 20_000 }).toBe('exterior');
  await expect.poll(async () => Math.hypot((await page.evaluate(() => window.__mypark!.player)).x - 35, (await page.evaluate(() => window.__mypark!.player)).z - 13)).toBeLessThan(0.5);

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
  // His welcome is one line, and the choices are there as soon as it finishes typing. Finish comes first.
  await expect(page.locator('.dialogue-choice')).toHaveText(['Finish this gym', 'Walk me through it', "I'll look around"], { timeout: 20_000 });
  await page.getByRole('button', { name: 'Walk me through it' }).click();

  const card = page.locator('.card');
  const stops = countedStations('gym-deloitte');
  for (const [i, s] of stops.entries()) {
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-card', s.id);
    await expect(page.locator('.card-station.is-current')).toContainText(s.label);
    await expect(page.locator('.card-station.is-done')).toHaveCount(i + 1);
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
  // The pop-up is about that one station, with the others a tap away in the strip.
  await expect(page.locator('.card-title')).toHaveText('Highlighted Features');
  await expect(page.locator('.card-station.is-current')).toContainText('Feature Wall');
  await page.locator('.card-close').click();
  await expect(page.locator('.card')).toBeHidden();
  await idle(page);
  await expect(counter).toHaveText('Meta Gym · 1/3 stations');

  // Skip the walk, then bail out with X: the tour stops and no badge is given.
  await counter.click();
  await expect(page.locator('.tracker-finish')).toHaveText('Finish this gym now');
  await page.locator('.tracker-skip').click();
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'meta/external-feedback');
  // Hop to another stop from the strip.
  await page.locator('.card-station', { hasText: 'Voice of the Customer' }).click();
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'meta/product-feedback');
  await expect(page.locator('.card-station.is-done')).toHaveCount(3);
  // All three seen: closing with X is enough to earn the badge.
  await page.locator('.card-close').click();
  await expect(page.locator('.card')).toBeHidden();
  await expect(page.locator('.ceremony-name')).toHaveText('Ship-It Badge');
  await page.locator('.ceremony-continue').click();
  await idle(page);
  expect(await page.evaluate(() => window.__mypark!.badges)).toEqual(['meta']);
});

test('tracker shows the Weightroom stops only while the visitor is in the Weightroom', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#station-counter')).toBeHidden();
  await goTo(page, 37.5, 30);
  await expect(page.locator('#station-counter')).toHaveText('The Weightroom · 0/4 stations');
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
  await standAt(page, 'weightroom/dumbbells', 'Grab the dumbbells');
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

test('Finish: one choice with the gym leader completes the gym and awards the badge', async ({ page, isMobile }) => {
  await boot(page, '/#/gym/ucla');
  await idle(page);
  await standAt(page, 'calvin-ucla', 'Talk to Calvin');
  await interact(page, isMobile);
  await expect(page.locator('.dialogue-choice').first()).toHaveText('Finish this gym', { timeout: 20_000 });
  // It's the focused choice, so Enter is enough on a keyboard.
  if (isMobile) await page.locator('.dialogue-choice').first().click();
  else {
    await expect(page.locator('.dialogue-choice').first()).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('.ceremony-name')).toHaveText('Bruin Badge');
  if (isMobile) await page.locator('.ceremony-continue').click();
  else await page.keyboard.press('ArrowRight');
  await idle(page);
  await expect(page.locator('#station-counter')).toHaveText('UCLA Gym · 3/3 stations ✓');
  expect(await page.evaluate(() => window.__mypark!.badges)).toEqual(['ucla']);
});

test('badge case has a jump button for every badge', async ({ page }) => {
  await boot(page);
  await page.locator('#badge-case').click();
  await expect(page.locator('.badge-go')).toHaveText(['Jump to gym →', 'Jump to gym →', 'Jump to gym →', 'Jump to gym →', 'Jump to the Weightroom →', 'Jump to the court →']);
  await page.locator('.badge-row', { hasText: 'High Roller Badge' }).locator('.badge-go').click();
  await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 20_000 }).toBe('gym-betmgm');
  await idle(page);
  // And out again, to the court.
  await page.locator('#badge-case').click();
  await page.locator('.badge-row', { hasText: 'Park Legend' }).locator('.badge-go').click();
  await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 20_000 }).toBe('exterior');
  await expect.poll(async () => (await page.evaluate(() => window.__mypark!.player)).z).toBeLessThan(17);
  // Standing on the court for the first time explains the loose balls.
  await expect(page.locator('#toast')).toContainText('Loose balls on the court');
});

test('walkthrough cards move on with Enter or the right arrow', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard');
  await boot(page, '/#/gym/meta');
  await idle(page);
  await page.locator('#station-counter').click();
  await page.locator('.tracker-skip').click();
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'meta/external-feedback');
  await expect(page.locator('.card-footer-btn')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'meta/highlighted-features');
  await expect(page.locator('.card-footer-btn')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'meta/product-feedback');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.ceremony-name')).toHaveText('Ship-It Badge');
});

test('"I\'ll look around" closes the conversation with no pop-up', async ({ page, isMobile }) => {
  await boot(page, '/#/gym/betmgm');
  await idle(page);
  await standAt(page, 'calvin-betmgm', 'Talk to Calvin');
  await interact(page, isMobile);
  await page.getByRole('button', { name: "I'll look around" }).click();
  await expect(page.locator('.dialogue')).toBeHidden();
  await idle(page);
  await page.waitForTimeout(400);
  await expect(page.locator('.card')).toBeHidden();
});

test('the workbench is scenery: no prompt, no card', async ({ page }) => {
  await boot(page);
  await goTo(page, 43, 26);
  await page.waitForTimeout(500);
  await expect(page.locator('.prompt')).toBeHidden();
  expect(await page.evaluate(() => window.__mypark!.targets.some((t) => /workbench|ai-building/i.test(t.id + t.label)))).toBe(false);
});

test('phones swipe photo sets instead of using arrows', async ({ page, isMobile }) => {
  await boot(page);
  await page.evaluate(() => window.__mypark!.openStationCard('ucla/clubs'));
  const gallery = page.locator('.card .gallery').first();
  await expect(gallery.locator('.gallery-slide')).toHaveCount(3);
  if (isMobile) {
    await expect(gallery.locator('.gallery-arrow').first()).toBeHidden();
    // Scrolling the strip moves the dots.
    await gallery.locator('.gallery-viewport').evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'auto' }));
    await expect(gallery.locator('.gallery-dot').nth(2)).toHaveClass(/is-on/);
  } else {
    await gallery.locator('.gallery-next').click();
    await expect(gallery.locator('.gallery-dot').nth(1)).toHaveClass(/is-on/);
  }
});

test('sound is off by default and one click turns it on; the map toggles outdoors', async ({ page, isMobile }) => {
  const errors = await boot(page);
  const sound = page.locator('#hud-sound');
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toast')).toHaveText('Sound effects on.');
  // The sound files exist and load.
  const res = await page.request.get('/audio/select.ogg');
  expect(res.status()).toBe(200);
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');

  const map = page.locator('.minimap');
  await expect(map).toBeHidden();
  if (isMobile) await page.locator('#hud-map').tap();
  else await page.keyboard.press('m');
  await expect(map).toBeVisible();
  await expect(page.locator('#hud-map')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#hud-map').click();
  await expect(map).toBeHidden();
  expect(errors).toEqual([]);
});
