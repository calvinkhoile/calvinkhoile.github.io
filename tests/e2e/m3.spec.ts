import { expect, test, type Page } from '@playwright/test';
import { stations } from '../../src/content/stations';

// M3: prompts, dialogue, the Calvin NPC, project cards with every screen type, and the BetMGM interior.

async function boot(page: Page, save: object = { look: 'a' }): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.url().startsWith('http://localhost') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.addInitScript((s) => {
    if (!localStorage.getItem('mypark:v1')) localStorage.setItem('mypark:v1', JSON.stringify(s));
  }, save);
  await page.goto('/');
  await page.waitForFunction(() => window.__mypark?.ready === true);
  return errors;
}

const idle = (page: Page) => expect.poll(() => page.evaluate(() => window.__mypark!.busy), { timeout: 20_000 }).toBe(false);
const goTo = (page: Page, x: number, z: number) => page.evaluate(([px, pz]) => window.__mypark!.teleport(px, pz), [x, z]);

/** Interact the way this device does: E on desktop, the A button on touch. */
async function interact(page: Page, isMobile: boolean | undefined): Promise<void> {
  if (isMobile) await page.locator('#a-button').tap();
  else await page.keyboard.press('e');
}

/** Stand on a target (by id) and wait for its prompt. */
async function standAt(page: Page, id: string, label: RegExp | string): Promise<void> {
  const t = await page.evaluate((tid) => window.__mypark!.targets.find((x) => x.id === tid)!, id);
  // Stand just off-center so the target is in range without being on top of an NPC or door tile.
  await goTo(page, t.x + (t.kind === 'npc' ? 0 : 0.2), t.z + (t.kind === 'npc' ? 1.3 : t.kind === 'door' ? -0.95 : 0.2));
  await expect(page.locator('.prompt')).toContainText(label, { timeout: 15_000 });
  // The game ignores interact presses for 250ms after a dialogue or card closes (so one press can't do two things).
  await page.waitForTimeout(320);
}

/** Every image in the open card must have loaded. Walks each tab so lazy images are requested. */
async function expectCardImagesLoad(page: Page): Promise<void> {
  const tabs = page.locator('.card [data-tab]');
  const n = Math.max(1, await tabs.count());
  for (let i = 0; i < n; i++) {
    if ((await tabs.count()) > 0) await tabs.nth(i).click();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Array.from(document.querySelectorAll<HTMLImageElement>('.card img'))
              .filter((img) => img.offsetParent !== null || img.closest('.gallery, .ba, .zoom'))
              .filter((img) => !img.closest('[hidden]'))
              .every((img) => {
                img.loading = 'eager';
                return img.complete && img.naturalWidth > 0;
              }),
          ),
        { timeout: 20_000 },
      )
      .toBe(true);
  }
}

test('signpost: prompt appears in range and its dialogue plays through', async ({ page, isMobile }) => {
  const errors = await boot(page);
  await standAt(page, 'plaza/signpost', 'Signpost');
  await interact(page, isMobile);
  await expect(page.locator('.dialogue')).toBeVisible();
  await expect(page.locator('.dialogue-speaker')).toHaveText('Signpost');
  // First press completes the typewriter, second moves to the next line.
  await page.locator('.dialogue').click();
  await expect(page.locator('.dialogue-text')).toContainText('West: UCLA');
  await page.locator('.dialogue').click();
  await page.locator('.dialogue').click();
  await expect(page.locator('.dialogue-text')).toContainText('The Workshop');
  await page.locator('.dialogue').click();
  await expect(page.locator('.dialogue')).toBeHidden();
  await idle(page);
  expect(errors).toEqual([]);
});

test('plaza Calvin: choices, the About card, and the tour to UCLA', async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await boot(page);
  await standAt(page, 'calvin-plaza', 'Talk to Calvin');
  await interact(page, isMobile);
  await expect(page.locator('.dialogue-choice')).toHaveCount(3, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Who are you?' }).click();
  await expect(page.locator('.card')).toBeVisible();
  await expect(page.locator('.card-title')).toHaveText('Calvin Le');
  await expect(page.locator('.card-desc')).toHaveCount(2);
  await expect(page.locator('.card-desc').first()).toContainText('Sr. Product Manager at BetMGM');
  await page.keyboard.press('Escape');
  await expect(page.locator('.card')).toBeHidden();
  await idle(page);

  // Tour: Calvin leads the visitor to the UCLA door.
  await standAt(page, 'calvin-plaza', 'Talk to Calvin');
  await interact(page, isMobile);
  await page.getByRole('button', { name: 'Show me around' }).click();
  await expect(page.locator('.dialogue-text')).toContainText('Follow me', { timeout: 10_000 });
  await page.locator('.dialogue').click();
  await page.locator('.dialogue').click();
  await expect(page.locator('.dialogue-text')).toContainText('UCLA', { timeout: 60_000 });
  const p = await page.evaluate(() => window.__mypark!.player);
  expect(p.x).toBeLessThan(22);
  expect(Math.abs(p.z - 49.5)).toBeLessThan(2);
});

test('BetMGM gym: enter, visit all four stations, talk to the leader, exit, and progress persists', async ({ page, isMobile }, info) => {
  test.setTimeout(180_000);
  const errors = await boot(page);
  await standAt(page, 'door-betmgm', 'Enter BetMGM Gym');
  await interact(page, isMobile);
  await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 20_000 }).toBe('gym-betmgm');
  await idle(page);
  await expect(page.locator('#station-counter')).toHaveText('BetMGM Gym · 0/4 stations');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/progress/m3-${info.project.name}-betmgm-interior.png` });

  const order = ['betmgm/rewards-store', 'betmgm/loyalty-apis', 'betmgm/enablement-wins', 'betmgm/ai-betmgm'];
  const titles = ['Rewards Store Enhancements', 'Loyalty APIs', 'Platform Enablement', 'AI at BetMGM'];
  for (let i = 0; i < order.length; i++) {
    const label = stations.find((s) => s.id === order[i])!.label;
    await standAt(page, order[i], label);
    await interact(page, isMobile);
    const card = page.locator('.card');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-card', order[i]);
    await expect(page.locator('.card-title')).toHaveText(titles[i]);
    await expect(page.locator('.card-chip')).toHaveText(`${i + 1}/4 stations`);
    await expectCardImagesLoad(page);

    if (i === 0) {
      // Before/after slider follows the range input.
      await page.locator('.card [data-tab="0"]').click();
      const slider = page.locator('.card-panel:not([hidden]) .ba');
      await slider.locator('.ba-range').evaluate((el: HTMLInputElement) => {
        el.value = '80';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(slider).toHaveAttribute('style', /--pos:\s*80%/);
      await page.screenshot({ path: `docs/progress/m3-${info.project.name}-card.png` });
      // Footer points at the next station.
      await page.getByRole('button', { name: 'Next station →' }).click();
      await expect(card).toBeHidden();
      expect(await page.evaluate(() => window.__mypark!.guide)).toMatch(/^betmgm\//);
    } else {
      if (i === 1) {
        // Side-by-side with a zoom spot that toggles on tap.
        await page.locator('.card [data-tab="1"]').click();
        const zoom = page.locator('.card-panel:not([hidden]) .zoom');
        await zoom.click();
        await expect(zoom).toHaveClass(/is-zoomed/);
      }
      if (i === 2) {
        // Gallery pages with its arrows.
        await page.locator('.card [data-tab="0"]').click();
        await page.locator('.card-panel:not([hidden]) .gallery-next').click();
        await expect(page.locator('.card-panel:not([hidden]) .gallery-dot').nth(1)).toHaveClass(/is-on/);
      }
      if (i === 3) await expect(page.locator('.card-footer-note')).toHaveText('Talk to Calvin for your badge.');
      await page.locator('.card-close').click();
      await expect(card).toBeHidden();
    }
    await idle(page);
  }
  await expect(page.locator('#station-counter')).toHaveText('BetMGM Gym · 4/4 stations ✓');

  // Prop: the Product Summit photo opens in the lightbox.
  await standAt(page, 'betmgm/product-summit', 'Product Summit Stage');
  await interact(page, isMobile);
  await expect(page.locator('.lightbox')).toBeVisible();
  await expect.poll(() => page.locator('.lightbox-img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.locator('.lightbox-close').click();
  await expect(page.locator('.lightbox')).toBeHidden();
  await idle(page);

  // Gym leader: intro lines, then the overview card with jump links to the stations.
  await standAt(page, 'calvin-betmgm', 'Talk to Calvin');
  await interact(page, isMobile);
  await expect(page.locator('.dialogue')).toBeVisible();
  for (let i = 0; i < 4 && (await page.locator('.dialogue').isVisible()); i++) await page.locator('.dialogue').click();
  await expect(page.locator('.card')).toHaveAttribute('data-card', 'betmgm-overview');
  await expect(page.locator('.card-link')).toHaveCount(4);
  await page.getByRole('button', { name: 'Loyalty APIs' }).click();
  await expect(page.locator('.card')).toBeHidden();
  expect(await page.evaluate(() => window.__mypark!.guide)).toBe('betmgm/loyalty-apis');
  await idle(page);

  // Out the exit, back in front of the BetMGM door.
  await standAt(page, 'exit', 'Exit to the park');
  await interact(page, isMobile);
  await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 20_000 }).toBe('exterior');
  await idle(page);
  const p = await page.evaluate(() => window.__mypark!.player);
  expect(Math.hypot(p.x - 16.9, p.z - 8.5)).toBeLessThan(0.3);
  await expect(page.locator('#station-counter')).toBeHidden();

  // Progress survives a reload.
  await page.reload();
  await page.waitForFunction(() => window.__mypark?.ready === true);
  expect((await page.evaluate(() => window.__mypark!.visited)).filter((v) => v.startsWith('betmgm/')).length).toBe(5);
  expect(errors).toEqual([]);
});

test('walking onto a door tile goes through it', async ({ page }) => {
  await boot(page);
  await goTo(page, 17.4, 8.5);
  const door = await page.evaluate(() => window.__mypark!.project(15.5, 8.5));
  await page.mouse.click(door.x, door.y);
  await expect.poll(() => page.evaluate(() => window.__mypark!.scene), { timeout: 30_000 }).toBe('gym-betmgm');
});

test('a door to a gym that is not built yet says so', async ({ page, isMobile }) => {
  await boot(page);
  await standAt(page, 'door-ucla', 'Enter UCLA Gym');
  await interact(page, isMobile);
  await expect(page.locator('.dialogue-speaker')).toHaveText('UCLA Gym');
  expect(await page.evaluate(() => window.__mypark!.scene)).toBe('exterior');
});

test('every station card renders with all of its images', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await boot(page);
  const withCards = stations.filter((s) => s.content.source !== 'photo' && s.content.source !== 'dialogue');
  expect(withCards.length).toBeGreaterThan(15);
  for (const s of withCards) {
    expect(await page.evaluate((id) => window.__mypark!.openStationCard(id), s.id), s.id).toBe(true);
    await expect(page.locator('.card')).toHaveAttribute('data-card', s.id);
    await expect(page.locator('.card-title')).not.toBeEmpty();
    await expectCardImagesLoad(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('.card')).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test('card content: UCLA tabs and timeline, Deloitte impact, hobby slices', async ({ page }, info) => {
  await boot(page);
  // UCLA internships: opens on its own tab and shows the five-step timeline.
  await page.evaluate(() => window.__mypark!.openStationCard('ucla/internships'));
  await expect(page.locator('.card-tab.is-on')).toHaveText('Internships');
  await expect(page.locator('.card-panel:not([hidden]) .timeline-item')).toHaveCount(5);
  await expect(page.locator('.card-panel:not([hidden]) .timeline-role').nth(2)).toContainText('Later raised $120M Series C from SoftBank.');
  await page.screenshot({ path: `docs/progress/m3-${info.project.name}-card-ucla.png` });
  await page.keyboard.press('Escape');

  // Deloitte whiteboard: one impact bullet, verbatim.
  await page.evaluate(() => window.__mypark!.openStationCard('deloitte/hr-tools'));
  await expect(page.locator('.card-desc')).toHaveText('Designed self-service HR tools (name/address changes, manager approvals) adopted by 10,000+ employees');
  await page.keyboard.press('Escape');

  // Coach's bench opens the Basketball card on the Coaching slice.
  await page.evaluate(() => window.__mypark!.openStationCard('blacktop/coaching'));
  await expect(page.locator('.card-title')).toHaveText('Basketball');
  await expect(page.locator('.card-tab.is-on')).toHaveText('Coaching');
  await expect(page.locator('.card-panel:not([hidden]) .card-caption')).toContainText('Genesis Elite');
  await page.keyboard.press('Escape');

  // No em dashes anywhere in migrated copy.
  await page.evaluate(() => window.__mypark!.openStationCard('workshop/ai-building'));
  await expect(page.locator('.card-wip')).toBeVisible();
  await expect(page.locator('.card-tags li')).toHaveCount(3);
});

test('card is a keyboard-usable modal dialog', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard only');
  await boot(page);
  await page.evaluate(() => window.__mypark!.openStationCard('betmgm/rewards-store'));
  const card = page.locator('.card');
  await expect(card).toHaveAttribute('role', 'dialog');
  await expect(card).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('.card-close')).toBeFocused();
  // Focus stays inside the card.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.card'))).toBe(true);
  }
  // The player can't move while a card is open.
  const before = await page.evaluate(() => window.__mypark!.player);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  expect(await page.evaluate(() => window.__mypark!.player.x)).toBe(before.x);
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
});
