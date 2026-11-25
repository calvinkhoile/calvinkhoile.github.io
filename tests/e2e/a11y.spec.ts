import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Accessibility pass: zero serious or critical axe violations on the DOM UI in each of its states.

async function scan(page: Page, label: string): Promise<void> {
  // Pop-ups fade in and out (even with reduced motion); half-faded text isn't a real state, so let them settle.
  await expect(page.locator('.is-entering:visible, .is-leaving:visible')).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = bad.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
  expect(bad, `${label}\n${summary}`).toEqual([]);
}

async function play(page: Page, url = '/', waitIdle = true): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('mypark:v1', JSON.stringify({ look: 'a', badges: ['ucla'] })));
  await page.goto(url);
  await page.waitForFunction(() => window.__mypark?.ready === true, undefined, { timeout: 30_000 });
  if (waitIdle) await expect.poll(() => page.evaluate(() => window.__mypark!.busy), { timeout: 20_000 }).toBe(false);
}

test('title and character select', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#title')).toBeVisible({ timeout: 30_000 });
  await scan(page, 'title screen');
  await page.locator('#title-start').click();
  await expect(page.locator('#select')).toBeVisible();
  // Let the title finish fading out and the select finish fading in: half-faded text isn't a real state.
  await expect(page.locator('#title')).toBeHidden();
  await expect(page.locator('#select')).not.toHaveClass(/is-entering/);
  await scan(page, 'character select');
});

test('HUD, quick links, tracker, badge case, minimap', async ({ page }) => {
  await play(page, '/#/gym/meta');
  await scan(page, 'in a gym');
  await page.locator('#station-counter').click();
  await scan(page, 'tracker open');
  await page.keyboard.press('Escape');
  await page.locator('#badge-case').click();
  await expect(page.locator('.badge-panel:not(.settings-panel):not(.highlights-panel)').first()).toBeVisible();
  await scan(page, 'badge case');
  await page.keyboard.press('Escape');
  await page.locator('#hud-settings').click();
  await expect(page.locator('.settings-panel')).toBeVisible();
  await scan(page, 'settings');
});

test('dialogue with choices', async ({ page }) => {
  await play(page, '/#/gym/deloitte');
  const t = await page.evaluate(() => window.__mypark!.targets.find((x) => x.id === 'calvin-deloitte')!);
  await page.evaluate(([x, z]) => window.__mypark!.teleport(x, z), [t.x, t.z + 1.3]);
  await expect(page.locator('.prompt')).toContainText('Talk to Calvin');
  await page.waitForTimeout(320);
  await page.locator('.prompt').click();
  await expect(page.locator('.dialogue-choice').first()).toBeVisible();
  await scan(page, 'dialogue');
});

test('station pop-ups: sliders, A/B spots, galleries, timeline', async ({ page }) => {
  await play(page, '/#/gym/betmgm/rewards-store', false);
  await expect(page.locator('.card')).toBeVisible();
  await scan(page, 'rewards store card');
  await page.locator('.card-station', { hasText: 'Loyalty APIs' }).click();
  await page.locator('.card [data-tab="1"]').click();
  await scan(page, 'loyalty card, A/B spots');
  await page.keyboard.press('Escape');
  await expect(page.locator('.card')).toBeHidden();
  await page.evaluate(() => window.__mypark!.openStationCard('ucla/internships'));
  await scan(page, 'timeline card');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__mypark!.openStationCard('ucla/clubs'));
  await scan(page, 'gallery card');
});

test('the 1-on-1: each question type and the result screen', async ({ page }) => {
  test.setTimeout(120_000);
  await play(page, '/?set=chess-fork,hoops-fastbreak,betting-line-shopping,points-bonus,rivalry-teams,betting-odds#/court');
  const t = await page.evaluate(() => window.__mypark!.targets.find((x) => x.id === 'calvin-court')!);
  await page.evaluate(([x, z]) => window.__mypark!.teleport(x, z), [t.x - 1.3, t.z + 0.6]);
  await expect(page.locator('.prompt')).toContainText('Talk to Calvin');
  await page.waitForTimeout(320);
  await page.locator('.prompt').click();
  for (let i = 0; i < 6 && (await page.locator('.dialogue-choice').count()) === 0; i++) {
    await page.locator('.dialogue:not(.is-leaving)').click();
    await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'Run it' }).click();
  for (const kind of ['chess', 'play', 'odds board', 'choice', 'rivalry']) {
    await expect.poll(() => page.evaluate(() => !!window.__mypark!.finale && !document.querySelector('.q-verdict:not([hidden])'))).toBe(true);
    await scan(page, `finale ${kind}`);
    const q = (await page.evaluate(() => window.__mypark!.finale))!;
    if (q.type === 'rivalry') {
      for (const [i, m] of q.matchups!.entries()) await page.locator(`.matchup[data-matchup="${i}"] .team`, { hasText: new RegExp(`^${m.answer}`) }).click();
      await page.locator('.rivalry-lock').click();
    } else await page.locator(`.q-option[data-option="${q.answer}"]`).click();
    await expect(page.locator('.q-verdict')).toBeVisible({ timeout: 20_000 });
    if (kind === 'chess') await scan(page, 'finale verdict');
    await page.locator('.q-next').click();
  }
  await page.locator('.ceremony-continue').click();
  await expect(page.locator('.result-headline')).toBeVisible();
  await scan(page, 'finale result');
});
