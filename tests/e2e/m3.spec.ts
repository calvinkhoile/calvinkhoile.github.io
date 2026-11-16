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
  // The line types itself out, then shows how to continue.
  await expect(page.locator('.dialogue-text')).toContainText('North along the path: Deloitte, Meta, BetMGM.');
  await expect(page.locator('.dialogue-hint')).toHaveText(isMobile ? 'Tap to continue' : 'Enter or → to continue');
  // Enter or the right arrow continues on desktop. A tap does on touch.
  if (isMobile) await page.locator('.dialogue').click();
  else await page.keyboard.press('ArrowRight');
  await expect(page.locator('.dialogue-text')).toContainText("Calvin's Court.");
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
      // All three before/afters are on screen at once, with a hint, and each slider follows its range input.
      await expect(page.locator('.card .card-row .ba')).toHaveCount(3);
      await expect(page.locator('.card [data-tab]')).toHaveCount(0);
      await expect(page.locator('.card-hint')).toContainText('Drag each slider');
      const slider = page.locator('.card .card-row .ba').first();
      await slider.locator('.ba-range').evaluate((el: HTMLInputElement) => {
        el.value = '80';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(slider).toHaveAttribute('style', /--pos:\s*80%/);
      await page.screenshot({ path: `docs/progress/m3-${info.project.name}-card.png` });
      // The strip lists every stop here, with a check on the ones seen. "Next" swaps to the next one in place.
      await expect(page.locator('.card-station')).toHaveText([/Rewards Store/, /Loyalty APIs/, /Partnership Desk/, /AI Lab/]);
      await expect(page.locator('.card-station.is-done')).toHaveCount(1);
      await expect(page.locator('.card-station.is-current')).toContainText('Rewards Store');
      await page.locator('.card-footer-btn', { hasText: 'Next: Loyalty APIs →' }).click();
      await expect(card).toHaveAttribute('data-card', 'betmgm/loyalty-apis');
      await expect(page.locator('.card-station.is-done')).toHaveCount(2);
      await page.locator('.card-close').click();
      await expect(card).toBeHidden();
    } else {
      if (i === 1) {
        // Account Linking and Real-Time Data are one comparison with A/B spots.
        await expect(page.locator('.card [data-tab]')).toHaveText(['Before / After', 'BetMGM + MGM']);
        await page.locator('.card [data-tab="1"]').click();
        const panel = page.locator('.card-panel:not([hidden])');
        await expect(panel.locator('.card-hint')).toContainText('A or B');
        await expect(panel.locator('.spots-caption:not([hidden])')).toContainText('same MGM Rewards ID');
        await panel.locator('.spots-pin', { hasText: 'B' }).click();
        await expect(panel.locator('.spots-caption:not([hidden])')).toContainText('same Tier Credit balance');
        await expect(panel.locator('.spots-detail.is-on')).toHaveAttribute('src', /loyalty-info/);
        await page.screenshot({ path: `docs/progress/m3-${info.project.name}-card-spots.png` });
      }
      if (i === 2) {
        // Marriott and Global BRPs sit side by side, and the Marriott gallery pages with its arrows.
        await expect(page.locator('.card-row-label')).toHaveText(['Marriott', 'Global BRPs']);
        // Desktop pages with arrows. Phones swipe the strip (no arrows there).
        if (isMobile) await page.locator('.card .gallery-viewport').first().evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'auto' }));
        else await page.locator('.card .gallery-next').click();
        await expect(page.locator('.card .gallery-dot').nth(1)).toHaveClass(/is-on/);
      }
      if (i === 3) {
        // Last stop: the button says Finish, and closing with everything seen earns the badge on the spot.
        await expect(page.locator('.card-station.is-done')).toHaveCount(4);
        await page.locator('.card-footer-btn', { hasText: 'Finish' }).click();
        await expect(card).toBeHidden();
        await expect(page.locator('.ceremony-name')).toHaveText('High Roller Badge');
        await page.locator('.ceremony-continue').click();
      } else {
        await page.locator('.card-close').click();
        await expect(card).toBeHidden();
      }
    }
    await idle(page);
  }
  await expect(page.locator('#station-counter')).toHaveText('BetMGM Gym · 4/4 stations ✓');

  // Prop: the Product Summit photo opens in the lightbox.
  await standAt(page, 'betmgm/product-summit', 'Product Summit Stage');
  await interact(page, isMobile);
  await expect(page.locator('.lightbox')).toBeVisible();
  await expect.poll(() => page.locator('.lightbox-img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.lightbox-caption')).toHaveText('BetMGM Product Summit.');
  await page.locator('.lightbox-close').click();
  await expect(page.locator('.lightbox')).toBeHidden();
  await idle(page);

  // The gym leader, badge already earned: a line, then the overview card with jump links to the stations.
  await standAt(page, 'calvin-betmgm', 'Talk to Calvin');
  await interact(page, isMobile);
  await expect(page.locator('.dialogue')).toBeVisible();
  for (let i = 0; i < 4 && (await page.locator('.dialogue').isVisible()); i++) await page.locator('.dialogue').click();
  await expect(page.locator('.card')).toBeVisible();
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

test('every station card renders with all of its images', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await boot(page);
  const withCards = stations.filter((s) => s.content.source !== 'photo' && s.content.source !== 'dialogue');
  expect(withCards.length).toBeGreaterThanOrEqual(14);
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

test('card content: a UCLA station, Deloitte impact, hobbies', async ({ page }, info) => {
  await boot(page);
  // UCLA internships: opens on its own tab and shows the five-step timeline.
  await page.evaluate(() => window.__mypark!.openStationCard('ucla/internships'));
  // The station shows just its own part of UCLA: no tabs for the other two.
  await expect(page.locator('.card-title')).toHaveText('Internships');
  await expect(page.locator('.card-tag')).toHaveText('UCLA');
  await expect(page.locator('.card-tab')).toHaveCount(0);
  await expect(page.locator('.card .timeline-item')).toHaveCount(5);
  await expect(page.locator('.card .timeline-role').nth(2)).toContainText('Later raised $120M Series C from SoftBank.');
  await page.screenshot({ path: `docs/progress/m3-${info.project.name}-card-ucla.png` });
  await page.keyboard.press('Escape');

  // Deloitte whiteboard: one impact bullet, verbatim.
  await page.evaluate(() => window.__mypark!.openStationCard('deloitte/hr-tools'));
  await expect(page.locator('.card-desc')).toHaveText('Designed self-service HR tools (name/address changes, manager approvals) adopted by 10,000+ employees');
  await page.keyboard.press('Escape');

  // One hoop covers all of basketball: three slices in one card.
  await page.evaluate(() => window.__mypark!.openStationCard('weightroom/basketball'));
  await expect(page.locator('.card-title')).toHaveText('Basketball');
  await expect(page.locator('.card-row-label')).toHaveText(['Record', 'Playing', 'Coaching']);
  await expect(page.locator('.card-row-item').nth(2).locator('.card-caption')).toContainText('Genesis Elite');
  await page.keyboard.press('Escape');
  await expect(page.locator('.card')).toBeHidden();

  // One sprint lane covers both marathons.
  await page.evaluate(() => window.__mypark!.openStationCard('weightroom/running'));
  await expect(page.locator('.card-row-label')).toHaveText(['LA Marathon', 'Huntington Beach']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.card')).toBeHidden();
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
