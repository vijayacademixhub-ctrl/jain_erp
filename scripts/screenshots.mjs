// Captures every main screen at desktop and phone widths into docs/screenshots,
// and fails loudly if any page logs a console error or warning.
//   npm run build && npm run preview   (in another terminal)
//   npm run screenshots                (BASE_URL defaults to http://localhost:4173)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const STUDENT = { program: 'BBA', semester: 3, sectionId: 'bba3b', oe: 's-oe01', me: null };

/** name, path, optional setup(page) run after load, phone capture too? */
const SHOTS = [
  ['01-landing', '/', null, true],
  ['02-committee-dashboard', '/committee', null, true],
  ['03-master-builder', '/committee/builder', null, true],
  [
    '04-builder-clash-panel',
    '/committee/builder',
    async (p) => {
      await p.getByRole('button', { name: /Clash panel/ }).click();
      await p.getByRole('dialog').getByRole('button', { name: /Faculty double-booked/ }).first().click();
      await p.waitForTimeout(400);
    },
    false,
  ],
  [
    '05-builder-publish-blocked',
    '/committee/builder',
    async (p) => {
      await p.getByRole('button', { name: 'Admin override…' }).click();
      await p.waitForTimeout(350);
    },
    false,
  ],
  ['06-daily-timetable', '/committee/daily', null, true],
  [
    '07-daily-change-dialog',
    '/committee/daily',
    async (p) => {
      await p.locator('tbody td button').filter({ hasText: /BBA30/ }).first().click();
      await p.waitForTimeout(400);
    },
    false,
  ],
  ['08-leave-approvals', '/committee/leave', null, true],
  [
    '09-mail-preview',
    '/committee/leave',
    async (p) => {
      await p.getByRole('button', { name: 'View emails' }).first().click();
      await p.waitForTimeout(450);
    },
    false,
  ],
  ['10-rooms-booking', '/committee/rooms', null, true],
  ['11-workload', '/committee/workload', null, true],
  ['12-calculator', '/calculator', null, true],
  [
    '13-assistant',
    '/committee/assistant',
    async (p) => {
      const box = p.getByLabel('Message the assistant');
      for (const msg of ['Dr. Meera Iyer is absent Thursday periods 3 to 5', 'Remember: Master Talk is every Friday period 6']) {
        await box.fill(msg);
        await box.press('Enter');
        await p.waitForTimeout(2600);
      }
      await p.getByRole('button', { name: 'Preview' }).first().click();
      await p.waitForTimeout(300);
    },
    true,
  ],
  [
    '14-data-upload',
    '/committee/upload',
    async (p) => {
      await p.getByRole('button', { name: 'Try a sample file' }).click();
      await p.waitForTimeout(400);
    },
    true,
  ],
  ['15-audit-trail', '/committee/audit', null, false],
  ['16-backup-year-end', '/committee/backup', null, false],
  ['17-faculty-timetable', '/faculty', null, true],
  [
    '18-faculty-apply-leave',
    '/faculty/leave',
    async (p) => {
      await p.getByLabel('Reason').fill('Presenting a paper at a national conference.');
      await p.getByRole('button', { name: 'Submit request' }).click();
      await p.waitForTimeout(2200);
    },
    true,
  ],
  ['19-faculty-leave-history', '/faculty/history', null, false],
  ['20-student-view', '/student', null, true],
  [
    '21-perf-lab',
    '/perf',
    async (p) => {
      await p.getByText('Edit → clash check → re-render').waitFor({ timeout: 20000 });
      await p.waitForTimeout(300);
    },
    false,
  ],
];

const browser = await chromium.launch({ channel: 'chrome' });
const problems = [];

async function capture(name, path, setup, viewport, theme, suffix) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, colorScheme: theme });
  await ctx.addInitScript(
    ({ theme, student }) => {
      try {
        if (!localStorage.getItem('ttp:ui:v1')) localStorage.setItem('ttp:ui:v1', JSON.stringify({ theme, student, muted: true, facultyId: 'f01' }));
      } catch {}
    },
    { theme, student: STUDENT },
  );
  const page = await ctx.newPage();
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`${name}${suffix}: ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${name}${suffix}: pageerror: ${e.message}`));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (setup) await setup(page);
  await page.screenshot({ path: `${OUT}/${name}${suffix}.png`, fullPage: false });
  await ctx.close();
  console.log(`  ✓ ${name}${suffix}`);
}

for (const [name, path, setup, phone] of SHOTS) {
  await capture(name, path, setup, { width: 1440, height: 900 }, 'light', '-desktop');
  if (phone) await capture(name, path, setup, { width: 390, height: 844 }, 'light', '-phone');
}
for (const [name, path] of [
  ['02-committee-dashboard', '/committee'],
  ['03-master-builder', '/committee/builder'],
  ['20-student-view', '/student'],
]) {
  await capture(name, path, null, { width: 1440, height: 900 }, 'dark', '-desktop-dark');
}
await browser.close();

if (problems.length) {
  console.error(`\n${problems.length} console problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('\nAll screens captured with zero console errors or warnings.');
