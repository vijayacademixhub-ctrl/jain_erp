import { expect, test, type Page } from '@playwright/test';

/** Fails the test if the page logs any console error or warning. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

test('landing opens the committee console', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /One timetable/ })).toBeVisible();
  await page.getByRole('link', { name: /Open Committee Console/ }).click();
  await expect(page.getByRole('heading', { name: /Timetable Committee/ })).toBeVisible();
  expect(problems).toEqual([]);
});

test('builder blocks publishing and a suggestion resolves the room clash', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/committee/builder');
  const publish = page.getByRole('button', { name: /^Publish v/ });
  await expect(publish).toBeDisabled();
  await expect(page.getByText(/Publishing is blocked/)).toBeVisible();

  const critical = page.getByRole('button', { name: /\d+ critical/ });
  const before = Number((await critical.textContent())!.match(/\d+/)![0]);

  await page.getByRole('button', { name: /Clash panel/ }).click();
  const panel = page.getByRole('dialog', { name: 'Clash panel' });
  await panel.getByRole('button', { name: /Room double-booked/ }).click();
  await panel.getByRole('heading', { name: /Free rooms/i }).waitFor();
  await panel.locator('h4:has-text("Free rooms") + div button').first().click();
  await page.keyboard.press('Escape');

  await expect(critical).toHaveText(new RegExp(`${before - 1} critical`));
  expect(problems).toEqual([]);
});

test('drag a subject into the grid runs the clash check', async ({ page }) => {
  await page.goto('/committee/builder');
  await page.getByRole('switch', { name: 'All periods' }).click();
  const chip = page.getByRole('button', { name: /BBA101/ }).first();
  const target = page.locator('[data-cell="bba1a|5|8"]');
  await target.scrollIntoViewIfNeeded();
  const from = (await chip.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + 15);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  // Every drop is checked and reported: a critical alert, a warning or a success toast.
  await expect(page.locator('[role="alert"],[role="status"]').filter({ hasText: /clash|Outside|Placed/i }).first()).toBeVisible();
  await expect(target.getByText('BBA101')).toBeVisible();
});

test('faculty leave flows through the mock mail to approval', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/faculty/leave');
  await page.getByLabel('Reason').fill('Presenting a paper at a national conference.');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText('Emailed to Chaitra, Krishna Koppa and Jai Shree')).toBeVisible();
  await page.getByRole('button', { name: 'Open mail preview' }).click();
  const drawer = page.getByRole('dialog', { name: 'Mail preview' });
  await expect(drawer.getByText(/Dear Chaitra/)).toBeVisible();
  await drawer.getByRole('button', { name: 'Approve' }).click();
  await drawer.getByRole('tab', { name: 'Faculty' }).click();
  await expect(drawer.getByText(/Your leave request was approved/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Approved').first()).toBeVisible();

  await page.goto('/committee/builder');
  // Full reload: proves the approval was saved, and that approved leave reaches the builder.
  await expect(page.getByRole('region', { name: 'Planned leave' })).toContainText('Dr. Meera Iyer');
  expect(problems).toEqual([]);
});

test('daily publish and one-click undo', async ({ page }) => {
  await page.goto('/committee/daily');
  const publish = page.getByRole('button', { name: /^Publish \d+ change/ });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByRole('button', { name: /^Publish day/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Undo last publish' }).click();
  await expect(page.getByRole('button', { name: /^Publish \d+ change/ })).toBeEnabled();
});

test('assistant proposes substitutes and confirms them as drafts', async ({ page }) => {
  await page.goto('/committee/assistant');
  const box = page.getByLabel('Message the assistant');
  await box.fill('Prof. Arjun Rao is absent Thursday');
  await box.press('Enter');
  await expect(page.getByText(/Substitution plan/)).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Confirm as drafts' }).click();
  await expect(page.getByText('Drafts created')).toBeVisible();
  await expect(page.getByText(/They are not live yet/)).toBeVisible({ timeout: 8000 });
});

test('student choice is remembered on the device', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/student');
  await page.getByRole('radio', { name: 'WOW' }).click();
  await page.getByRole('radio', { name: 'Semester 5' }).click();
  await page.getByRole('radio', { name: 'Section B' }).click();
  await page.getByRole('button', { name: 'Show my timetable' }).click();
  await expect(page.getByRole('heading', { name: /WOW Semester 5 · Section B/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /WOW Semester 5 · Section B/ })).toBeVisible();
  expect(problems).toEqual([]);
});
