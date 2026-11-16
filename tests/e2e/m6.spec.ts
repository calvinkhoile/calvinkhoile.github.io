import { expect, test, type Page } from '@playwright/test';

// M6: the 1-on-1 finale at Calvin's Court.

// A fixed game: two 3-pointers, two 2-pointers, the Rivalry Round, and a sudden-death question.
const SET = 'chess-fork,hoops-fastbreak,chess-backrank,betting-line-shopping,rivalry-teams,betting-odds';

async function boot(page: Page, query = `?set=${SET}`, reducedMotion = true): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Reduced motion skips the court animations, which keeps most of these tests quick.
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('mypark:v1', JSON.stringify({ look: 'a' }));
    }
  });
  await page.goto(`/${query}#/court`);
  await page.waitForFunction(() => window.__mypark?.ready === true, undefined, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.__mypark!.busy), { timeout: 20_000 }).toBe(false);
  return errors;
}

/** Walk up to court Calvin, hear the challenge, and pick "Run it". */
async function challenge(page: Page): Promise<void> {
  const t = await page.evaluate(() => window.__mypark!.targets.find((x) => x.id === 'calvin-court')!);
  await page.evaluate(([x, z]) => window.__mypark!.teleport(x, z), [t.x - 1.3, t.z + 0.6]);
  await expect(page.locator('.prompt')).toContainText('Talk to Calvin');
  await page.waitForTimeout(320);
  await page.locator('.prompt').click();
  await expect(page.locator('.dialogue-text')).toContainText('So you made it');
  for (let i = 0; i < 6 && (await page.locator('.dialogue-choice').count()) === 0; i++) {
    await page.locator('.dialogue').click();
    await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'Run it' }).click();
  await expect(page.locator('.scoreboard')).toContainText('POSS 1/5');
}

/** Answer the question on screen, right or wrong, and wait for the verdict. */
async function answer(page: Page, right: boolean): Promise<void> {
  await expect.poll(() => page.evaluate(() => !!window.__mypark!.finale && !document.querySelector('.q-verdict:not([hidden])'))).toBe(true);
  const q = (await page.evaluate(() => window.__mypark!.finale))!;
  if (q.type === 'rivalry') {
    for (const [i, m] of q.matchups!.entries()) {
      // A wrong run misses only the last matchup: all three have to be right to score.
      const pick = right || i < 2 ? m.answer : m.answer === m.a ? m.b : m.a;
      await page.locator(`.matchup[data-matchup="${i}"] .team`, { hasText: new RegExp(`^${pick}`) }).click();
    }
    await page.locator('.rivalry-lock').click();
  } else {
    const pick = right ? q.answer : q.options.find((o) => o !== q.answer)!;
    await page.locator(`.q-option[data-option="${pick.replace(/"/g, '\\"')}"]`).click();
  }
  await expect(page.locator('.q-verdict')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.q-call')).toContainText(right ? 'Bucket.' : 'Blocked.');
}

const next = (page: Page) => page.locator('.q-next').click();

test('win: five right answers, Park Legend badge, result screen with contact and share', async ({ page, isMobile, context }, info) => {
  test.setTimeout(120_000);
  const errors = await boot(page);
  await challenge(page);
  await page.screenshot({ path: `docs/progress/m6-${info.project.name}-chess.png` });

  // Possession 1: the knight fork, worth three.
  await expect(page.locator('.q-three')).toBeVisible();
  await expect(page.locator('.chessboard .sq')).toHaveCount(64);
  await answer(page, true);
  await expect(page.locator('.scoreboard')).toContainText('YOU 3');
  await expect(page.locator('.sq-to')).toHaveAttribute('data-sq', 'f6');
  await expect(page.locator('.q-explain')).toContainText('forks the king and queen');
  await next(page);

  // Possession 2: the fast break diagram.
  await expect(page.locator('.court-diagram svg')).toBeVisible();
  await page.screenshot({ path: `docs/progress/m6-${info.project.name}-play.png` });
  await answer(page, true);
  await expect(page.locator('.scoreboard')).toContainText('YOU 6');
  await next(page);

  await answer(page, true); // back-rank mate
  await next(page);

  // Possession 4: line shopping, with its odds board.
  await expect(page.locator('.odds-board tr')).toHaveCount(3);
  await answer(page, true);
  await next(page);

  // Possession 5 is always the Rivalry Round.
  await expect(page.locator('.scoreboard')).toContainText('POSS 5/5');
  await expect(page.locator('.matchup')).toHaveCount(3);
  await page.screenshot({ path: `docs/progress/m6-${info.project.name}-rivalry.png` });
  await answer(page, true);
  await expect(page.locator('.scoreboard')).toContainText('YOU 12');
  await expect(page.locator('.scoreboard')).toContainText('CALVIN 0');
  await next(page);

  // Winning earns the last badge, then the result screen.
  await expect(page.locator('.ceremony-name')).toHaveText('Park Legend');
  await page.locator('.ceremony-continue').click();
  await expect(page.locator('.result-headline')).toHaveText('You beat Calvin.');
  await expect(page.locator('.result-score')).toContainText('You answered 5/5.');
  await expect(page.locator('.finale-result')).toContainText("Respect. Let's actually talk.");
  await expect(page.locator('.result-contact a').first()).toHaveAttribute('href', 'https://www.linkedin.com/in/calvinle13/');
  await page.screenshot({ path: `docs/progress/m6-${info.project.name}-result.png` });
  if (!isMobile) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.result-share').click();
    await expect(page.locator('#toast')).toContainText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('I went 5/5 vs Calvin at calvinkhoile.github.io');
  }

  await page.locator('.result-exit').click();
  await expect(page.locator('.finale')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__mypark!.busy)).toBe(false);
  expect(await page.evaluate(() => window.__mypark!.badges)).toContain('legend');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mypark:v1')!).finaleBest)).toBe(5);
  expect(errors).toEqual([]);
});

test('lose: Calvin wins, then Run it back starts a fresh game', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await challenge(page);
  for (let i = 0; i < 5; i++) {
    await answer(page, false);
    await next(page);
  }
  await expect(page.locator('.result-headline')).toHaveText('Calvin wins, 12-0.');
  await expect(page.locator('.result-score')).toHaveText('You answered 0/5.');
  await expect(page.locator('.finale-result')).toContainText('Come back and get your revenge.');
  expect(await page.evaluate(() => window.__mypark!.badges)).not.toContain('legend');

  await page.locator('.result-again').click();
  await expect(page.locator('.scoreboard')).toContainText('POSS 1/5');
  await expect(page.locator('.scoreboard')).toContainText('YOU 0');
  await expect(page.locator('.q-prompt')).toBeVisible();
});

test('tie: 6-6 after five goes to sudden death, and the next bucket decides it', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await challenge(page);
  // Visitor takes both 3-pointers, Calvin takes the three 2-pointers.
  for (const right of [true, true, false, false, false]) {
    await answer(page, right);
    await next(page);
  }
  await expect(page.locator('.scoreboard')).toContainText('SUDDEN DEATH');
  await expect(page.locator('.scoreboard')).toContainText('YOU 6');
  await expect(page.locator('.scoreboard')).toContainText('CALVIN 6');
  await expect(page.locator('.q-setup')).toContainText('Tied up. Next bucket wins.');
  await answer(page, true);
  await next(page);
  await page.locator('.ceremony-continue').click();
  await expect(page.locator('.result-headline')).toHaveText('You beat Calvin.');
  // "You answered" counts the five possessions, not the tiebreaker.
  await expect(page.locator('.result-score')).toContainText('8-6. You answered 2/5.');
});

test('the court animations play, and "Not yet" backs out of the challenge', async ({ page }, info) => {
  test.setTimeout(120_000);
  await boot(page, `?set=${SET}`, false);
  // Decline first.
  const t = await page.evaluate(() => window.__mypark!.targets.find((x) => x.id === 'calvin-court')!);
  await page.evaluate(([x, z]) => window.__mypark!.teleport(x, z), [t.x - 1.3, t.z + 0.6]);
  await expect(page.locator('.prompt')).toContainText('Talk to Calvin');
  await page.waitForTimeout(320);
  await page.locator('.prompt').click();
  for (let i = 0; i < 6 && (await page.locator('.dialogue-choice').count()) === 0; i++) {
    await page.locator('.dialogue').click();
    await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'Not yet' }).click();
  await expect(page.locator('.dialogue-text')).toContainText("I'll be here");
  for (let i = 0; i < 4 && (await page.locator('.dialogue').isVisible()); i++) {
    await page.locator('.dialogue').click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await expect(page.locator('.dialogue')).toBeHidden();
  await expect(page.locator('.finale')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__mypark!.busy)).toBe(false);

  // Then play one possession with motion on: the card ducks away while the shot plays, then returns.
  await challenge(page);
  const q = (await page.evaluate(() => window.__mypark!.finale))!;
  await page.locator(`.q-option[data-option="${q.answer}"]`).click();
  await expect(page.locator('.finale-card')).toHaveClass(/is-watching/, { timeout: 15_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/progress/m6-${info.project.name}-shot.png` });
  await expect(page.locator('.q-verdict')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.finale-card')).not.toHaveClass(/is-watching/);
});

test('keyboard only: play the whole finale without a mouse', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard');
  test.setTimeout(120_000);
  await boot(page);
  const t = await page.evaluate(() => window.__mypark!.targets.find((x) => x.id === 'calvin-court')!);
  await page.evaluate(([x, z]) => window.__mypark!.teleport(x, z), [t.x - 1.3, t.z + 0.6]);
  await expect(page.locator('.prompt')).toContainText('Talk to Calvin');
  await page.waitForTimeout(320);
  await page.keyboard.press('e');
  await expect(page.locator('.dialogue')).toBeVisible();
  for (let i = 0; i < 6 && (await page.locator('.dialogue-choice').count()) === 0; i++) {
    await page.keyboard.press('x');
    await page.waitForTimeout(250);
  }
  // "Run it" is the first choice and already has focus.
  await expect(page.locator('.dialogue-choice').first()).toBeFocused();
  await page.keyboard.press('Enter');

  for (let i = 0; i < 5; i++) {
    await expect.poll(() => page.evaluate(() => !!window.__mypark!.finale && !document.querySelector('.q-verdict:not([hidden])'))).toBe(true);
    const q = (await page.evaluate(() => window.__mypark!.finale))!;
    if (q.type === 'rivalry') {
      // Tab through the six team buttons, pressing Enter on the right one in each pair, then Lock it in.
      for (const m of q.matchups!) {
        for (const team of [m.a, m.b]) {
          await expect(page.locator(':focus')).toHaveText(new RegExp(`^${team}`));
          if (team === m.answer) await page.keyboard.press('Enter');
          await page.keyboard.press('Tab');
        }
      }
      await expect(page.locator('.rivalry-lock')).toBeFocused();
      await page.keyboard.press('Enter');
    } else {
      // The first option has focus. Tab to the right answer and press Enter.
      const first = page.locator('.q-option').first();
      await expect(first).toBeFocused();
      for (let k = 0; k < q.options.indexOf(q.answer); k++) await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('data-option', q.answer);
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('.q-next')).toBeFocused({ timeout: 20_000 });
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('.ceremony-continue')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.result-headline')).toHaveText('You beat Calvin.');
  await expect(page.locator('.result-again')).toBeFocused();
});

test('a normal draw follows the rules: five possessions, rivalry last', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, '?seed=7');
  await challenge(page);
  const seen: { id: string; type: string }[] = [];
  for (let i = 0; i < 5; i++) {
    await expect.poll(() => page.evaluate(() => !!window.__mypark!.finale && !document.querySelector('.q-verdict:not([hidden])'))).toBe(true);
    const q = (await page.evaluate(() => window.__mypark!.finale))!;
    seen.push({ id: q.id, type: q.type });
    await answer(page, true);
    await next(page);
  }
  expect(seen[4].type).toBe('rivalry');
  expect(new Set(seen.map((s) => s.id)).size).toBe(5);
  expect(seen.slice(0, 4).some((s) => s.type === 'chess')).toBe(true);
  expect(seen.slice(0, 4).some((s) => s.type === 'play')).toBe(true);
});

test('shootaround: pick up a loose ball, put up shots, put it back', async ({ page, isMobile }, info) => {
  test.setTimeout(120_000);
  const errors = await boot(page, '', false);
  const t = await page.evaluate(() => window.__mypark!.targets.find((x) => x.id === 'court/shootaround')!);
  await page.evaluate(([x, z]) => window.__mypark!.teleport(x, z), [t.x + 0.2, t.z + 0.2]);
  await expect(page.locator('.prompt')).toContainText('Basketball');
  await page.waitForTimeout(320);
  await page.locator('.prompt').click();
  const hud = page.locator('#lift-hud');
  await expect(hud).toBeVisible();
  await expect(page.locator('#lift-count')).toHaveText('0 for 0');
  await expect(page.locator('#lift-rep')).toContainText('Shoot');

  const shoot = async () => {
    if (isMobile) await page.locator('#lift-rep').tap();
    else await page.keyboard.press('g');
  };
  await shoot();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `docs/progress/m6-${info.project.name}-shootaround.png` });
  await expect(page.locator('#lift-count')).toHaveText(/^[01] for 1$/, { timeout: 30_000 });
  await shoot();
  await expect(page.locator('#lift-count')).toHaveText(/^[012] for 2$/, { timeout: 30_000 });

  if (isMobile) await page.locator('#lift-done').tap();
  else await page.keyboard.press('Space');
  await expect(hud).toBeHidden();
  await expect(page.locator('#toast')).toContainText('for 2 from the floor.');
  await expect.poll(() => page.evaluate(() => window.__mypark!.busy)).toBe(false);
  expect(errors).toEqual([]);
});
