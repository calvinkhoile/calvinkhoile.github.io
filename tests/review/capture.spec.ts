import { expect, test, type Page } from '@playwright/test';
import { stations } from '../../src/content/stations';

// Review captures for the polish pass. Not a test suite: it walks every screen, pop-up and animation state
// and saves a picture of each to review-shots/<viewport>/. Run with: npx playwright test -c playwright.review.config.ts

const SET = 'chess-fork,hoops-fastbreak,chess-backrank,betting-line-shopping,rivalry-teams,betting-odds';
let dir = 'review-shots';

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${dir}/${name}.png` }).catch(() => {});
}

/** Pause every running CSS animation and transition at `ms` and take a picture. */
async function frame(page: Page, name: string, ms: number): Promise<void> {
  await page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t;
    }
  }, ms);
  await shot(page, name);
}

async function release(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      // Infinite animations can't finish; play them on instead of stopping the loop.
      try {
        a.finish();
      } catch {
        a.play();
      }
    }
  }).catch(() => {});
}

async function boot(page: Page, opts: { hash?: string; query?: string; fresh?: boolean; save?: object } = {}): Promise<void> {
  const save = opts.save ?? { look: 'a' };
  if (!opts.fresh) {
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('mypark:v1', JSON.stringify(s));
      }
    }, save);
  }
  await page.goto(`/${opts.query ?? ''}${opts.hash ?? ''}`);
  if (!opts.fresh) {
    await page.waitForFunction(() => window.__mypark?.ready === true, undefined, { timeout: 60_000 });
    await expect.poll(() => page.evaluate(() => window.__mypark!.busy), { timeout: 30_000 }).toBe(false);
  }
}

const idle = (page: Page) => expect.poll(() => page.evaluate(() => window.__mypark!.busy), { timeout: 30_000 }).toBe(false);

async function standAt(page: Page, id: string): Promise<boolean> {
  const t = await page.evaluate((tid) => window.__mypark!.targets.find((x) => x.id === tid) ?? null, id);
  if (!t) return false;
  await page.evaluate(([x, z]) => window.__mypark!.teleport(x, z), [t.x + (t.kind === 'npc' ? 0 : 0.2), t.z + (t.kind === 'npc' ? 1.3 : t.kind === 'door' ? -0.95 : 0.2)]);
  await expect(page.locator('.prompt')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(350);
  return true;
}

/** Click the dialogue until its choices show (or it closes). */
async function toChoices(page: Page): Promise<void> {
  for (let i = 0; i < 8 && (await page.locator('.dialogue-choice').count()) === 0; i++) {
    if (!(await page.locator('.dialogue:not(.is-leaving)').isVisible())) return;
    await page.locator('.dialogue:not(.is-leaving)').click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
}

async function waitImages(page: Page): Promise<void> {
  await page
    .waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('.card img')).every((i) => (i.loading = 'eager') && i.complete), undefined, { timeout: 15_000 })
    .catch(() => {});
}

/** Shoot a card at the top, then page by page to the bottom. */
async function cardPages(page: Page, name: string): Promise<void> {
  await waitImages(page);
  await page.waitForTimeout(500);
  await shot(page, `${name}-0`);
  const pages = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('.card')!;
    return Math.min(5, Math.ceil((c.scrollHeight - c.clientHeight) / Math.max(1, c.clientHeight * 0.8)));
  });
  for (let i = 1; i <= pages; i++) {
    await page.evaluate((k) => {
      const c = document.querySelector<HTMLElement>('.card')!;
      c.scrollTop = Math.min(c.scrollHeight, k * c.clientHeight * 0.8);
    }, i);
    await page.waitForTimeout(350);
    await shot(page, `${name}-${i}`);
  }
}

test.beforeEach(async ({}, info) => {
  dir = `review-shots/${info.project.name}`;
});

test('01 fresh visit: loading, title, select, intro dialogue', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, { fresh: true });
  await shot(page, '01-loading');
  await expect(page.locator('#title')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  await shot(page, '01-title');
  await page.locator('#title-start').click();
  await frame(page, '01-title-out-120', 120);
  await release(page);
  await expect(page.locator('#select')).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, '01-select');
  await page.locator('#select-next').click();
  await page.waitForTimeout(800);
  await shot(page, '01-select-2');
  await page.locator('#select-confirm').click();
  await page.waitForFunction(() => window.__mypark?.ready === true, undefined, { timeout: 60_000 });
  await expect(page.locator('.dialogue:not(.is-leaving)')).toBeVisible({ timeout: 60_000 });
  for (const t of [40, 120, 200, 300, 450]) await frame(page, `01-dialogue-in-${t}`, t);
  await release(page);
  await page.waitForTimeout(400);
  await shot(page, '01-dialogue-typing');
  await page.waitForTimeout(1600);
  await shot(page, '01-dialogue-line1');
  await toChoices(page);
  await shot(page, '01-dialogue-choices');
  await page.getByRole('button', { name: 'Who are you?' }).click();
  await expect(page.locator('.card')).toBeVisible();
  await cardPages(page, '01-about');
  await page.keyboard.press('Escape');
  await idle(page);
  await page.waitForTimeout(600);
  await shot(page, '01-after-intro');
});

test('02 park HUD, prompt, panels, toast', async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.waitForTimeout(1500);
  await shot(page, '02-park');
  await page.locator('#hud-toggle').click();
  await page.waitForTimeout(600);
  await shot(page, '02-park-links-toggled');
  await page.locator('#hud-toggle').click();
  await page.waitForTimeout(600);

  if (await standAt(page, 'plaza/signpost')) {
    await shot(page, '02-prompt');
    if (isMobile) await page.locator('#a-button').tap();
    else await page.keyboard.press('e');
    await page.waitForTimeout(2500);
    await shot(page, '02-signpost');
    await page.keyboard.press('Escape');
    await idle(page);
  }
  if (await standAt(page, 'calvin-plaza')) {
    await shot(page, '02-prompt-calvin');
    await page.locator('.prompt').click();
    await toChoices(page);
    await shot(page, '02-plaza-again-choices');
    await page.keyboard.press('Escape');
    await idle(page);
  }

  await page.locator('#badge-case').click();
  await frame(page, '02-badges-in-80', 80);
  await release(page);
  await page.waitForTimeout(500);
  await shot(page, '02-badges');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  await page.locator('#hud-settings').click();
  await page.waitForTimeout(600);
  await shot(page, '02-settings');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  await page.locator('#hud-highlights').click();
  await page.waitForTimeout(800);
  await shot(page, '02-highlights');
  await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('.highlights-panel .badge-sheet');
    if (s) s.scrollTop = s.scrollHeight;
  });
  await page.waitForTimeout(300);
  await shot(page, '02-highlights-bottom');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  await page.locator('#hud-map').click();
  await page.waitForTimeout(800);
  await shot(page, '02-map');
  await page.locator('#hud-map').click();
  await page.waitForTimeout(600);

  await page.locator('#hud-sound').click();
  await frame(page, '02-toast-in-100', 100);
  await release(page);
  await page.waitForTimeout(300);
  await shot(page, '02-toast');
  await page.locator('#hud-sound').click();
});

const cardStations = stations.filter((s) => !['photo', 'dialogue'].includes(s.content.source));

test('03 every station pop-up, top to bottom', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page);
  for (const [n, st] of cardStations.entries()) {
    const name = `03-${String(n).padStart(2, '0')}-${st.id.replace('/', '-')}`;
    const ok = await page.evaluate((id) => window.__mypark!.openStationCard(id), st.id);
    if (!ok) continue;
    if (n === 0) {
      for (const t of [40, 100, 180, 300]) await frame(page, `03-card-in-${t}`, t);
      await release(page);
    }
    await expect(page.locator('.card')).toBeVisible();
    await cardPages(page, name);
    const tabs = page.locator('.card [data-tab]');
    const count = await tabs.count();
    for (let i = 1; i < count; i++) {
      await page.evaluate(() => (document.querySelector<HTMLElement>('.card')!.scrollTop = 0));
      await tabs.nth(i).click();
      await cardPages(page, `${name}-tab${i}`);
    }
    if (n === 0) {
      await page.evaluate(() => {
        (document.querySelector('.card-close') as HTMLElement).click();
        getComputedStyle(document.querySelector('.card')!).transform;
      });
      for (const t of [60, 140]) await frame(page, `03-card-out-${t}`, t);
      await release(page);
    } else await page.keyboard.press('Escape');
    await idle(page);
  }
});

test('04 a gym: leader, station session with strip, swap, ceremony', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, { hash: '#/gym/betmgm' });
  await page.waitForTimeout(1500);
  await shot(page, '04-gym');
  await page.locator('#station-counter').click();
  await page.waitForTimeout(600);
  await shot(page, '04-tracker-open');
  await page.locator('#station-counter').click();
  await page.waitForTimeout(500);
  const leader = await page.evaluate(() => window.__mypark!.targets.find((t) => t.kind === 'npc')?.id ?? null);
  if (leader && (await standAt(page, leader))) {
    await page.locator('.prompt').click();
    await toChoices(page);
    await shot(page, '04-leader-choices');
    await page.getByRole('button', { name: 'Walk me through it' }).click();
    await expect(page.locator('.card')).toBeVisible();
    await cardPages(page, '04-session-1');
    await page.locator('.card-footer-btn').click();
    for (const t of [40, 100, 200]) await frame(page, `04-swap-${t}`, t);
    await release(page);
    await page.waitForTimeout(600);
    await shot(page, '04-session-2');
    for (let i = 0; i < 4 && (await page.locator('.card-footer-btn').count()) > 0; i++) {
      await page.locator('.card-footer-btn').click();
      await page.waitForTimeout(800);
    }
    await shot(page, '04-session-last');
    await expect(page.locator('.ceremony')).toBeVisible({ timeout: 20_000 });
    for (const t of [100, 300, 600, 1000]) await frame(page, `04-ceremony-${t}`, t);
    await release(page);
    await page.waitForTimeout(800);
    await shot(page, '04-ceremony');
    await page.locator('.ceremony-continue').click();
    await idle(page);
    await page.waitForTimeout(800);
    await shot(page, '04-after-badge');
  }
  // A photo stop in Meta.
  await boot(page, { hash: '#/gym/meta' });
  if (await standAt(page, 'meta/hq-window')) {
    await page.locator('.prompt').click();
    await page.waitForTimeout(150);
    await frame(page, '04-lightbox-in-120', 120);
    await release(page);
    await page.waitForTimeout(1500);
    await shot(page, '04-lightbox');
    await page.keyboard.press('Escape');
    await idle(page);
  }
});

test('05 weightroom lift and the shootaround', async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  await boot(page, { hash: '#/weightroom' });
  await page.waitForTimeout(1200);
  await shot(page, '05-weightroom');
  const lift = await page.evaluate(() => window.__mypark!.targets.find((t) => t.kind === 'lift')?.id ?? null);
  if (lift && (await standAt(page, lift))) {
    await shot(page, '05-lift-prompt');
    await page.locator('.prompt').click();
    await page.waitForTimeout(1200);
    await shot(page, '05-lift-hud');
    await page.locator('#lift-rep').click();
    await page.waitForTimeout(1500);
    await shot(page, '05-lift-rep');
    await page.locator('#lift-done').click();
    await page.waitForTimeout(800);
    await shot(page, '05-lift-toast');
    await idle(page);
  }
  await boot(page, { hash: '#/court' });
  await page.waitForTimeout(2000);
  await shot(page, '05-court');
  const ball = await page.evaluate(() => window.__mypark!.targets.find((t) => t.kind === 'shoot')?.id ?? null);
  if (ball && (await standAt(page, ball))) {
    await page.locator('.prompt').click();
    await page.waitForTimeout(1500);
    await shot(page, '05-shoot-hud');
    const b = page.locator('#lift-rep');
    const box = await b.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(300);
      await shot(page, '05-shoot-meter');
      await page.mouse.up();
      await page.waitForTimeout(400);
      await shot(page, '05-shoot-callout');
    }
    await page.locator('#lift-done').click();
    await page.waitForTimeout(600);
  }
  void isMobile;
});

test('06 the 1-on-1', async ({ page }) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, { query: `?set=${SET}`, hash: '#/court' });
  if (!(await standAt(page, 'calvin-court'))) return;
  await page.locator('.prompt').click();
  await toChoices(page);
  await shot(page, '06-challenge-choices');
  await page.getByRole('button', { name: 'Run it' }).click();
  for (let n = 1; n <= 6; n++) {
    const ok = await expect
      .poll(() => page.evaluate(() => !!window.__mypark!.finale && !document.querySelector('.q-verdict:not([hidden])')), { timeout: 30_000 })
      .toBe(true)
      .then(() => true)
      .catch(() => false);
    if (!ok) break;
    await page.waitForTimeout(600);
    await shot(page, `06-q${n}`);
    const q = (await page.evaluate(() => window.__mypark!.finale))!;
    if (q.type === 'rivalry') {
      for (const [i, m] of q.matchups!.entries()) await page.locator(`.matchup[data-matchup="${i}"] .team`, { hasText: new RegExp(`^${m.answer}`) }).click();
      await shot(page, `06-q${n}-picked`);
      await page.locator('.rivalry-lock').click();
    } else {
      // Miss the second one to see the blocked verdict.
      const pick = n === 2 ? q.options.find((o) => o !== q.answer)! : q.answer;
      await page.locator(`.q-option[data-option="${pick.replace(/"/g, '\\"')}"]`).click();
    }
    await expect(page.locator('.q-verdict')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await shot(page, `06-q${n}-verdict`);
    await page.evaluate(() => {
      const c = document.querySelector<HTMLElement>('.finale-card, .finale .q-card, .finale');
      if (c) c.scrollTop = c.scrollHeight;
    });
    await page.waitForTimeout(300);
    await shot(page, `06-q${n}-verdict-bottom`);
    await page.locator('.q-next').click();
    if (await page.locator('.ceremony-continue').isVisible().catch(() => false)) break;
  }
  if (await page.locator('.ceremony-continue').isVisible({ timeout: 5000 }).catch(() => false)) {
    await shot(page, '06-ceremony');
    await page.locator('.ceremony-continue').click();
  }
  await page.waitForTimeout(800);
  await shot(page, '06-result');
});

test('07 reduced motion: dialogue and a card', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  if (await standAt(page, 'calvin-plaza')) {
    await page.locator('.prompt').click();
    await page.waitForTimeout(200);
    await shot(page, '07-dialogue');
    await toChoices(page);
    await shot(page, '07-choices');
    await page.keyboard.press('Escape');
    await idle(page);
  }
  await page.evaluate(() => window.__mypark!.openStationCard('betmgm/rewards-store'));
  await page.waitForTimeout(200);
  await shot(page, '07-card');
});
