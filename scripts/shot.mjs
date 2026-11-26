// Quick visual check: node scripts/shot.mjs <url> <out.png> [width] [height] [theme] [fullPage]
import { chromium } from '@playwright/test';

const [url, out, w = '1440', h = '900', theme = 'light', full = 'false'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1, colorScheme: theme === 'dark' ? 'dark' : 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.addInitScript((t) => {
  try {
    const raw = localStorage.getItem('ttp:ui:v1');
    const ui = raw ? JSON.parse(raw) : {};
    localStorage.setItem('ttp:ui:v1', JSON.stringify({ ...ui, theme: t }));
  } catch {}
}, theme);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: full === 'true' });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
