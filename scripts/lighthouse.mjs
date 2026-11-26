// Runs Lighthouse (mobile by default; FORM=desktop for the desktop preset) against the preview build and prints the scores.
//   npm run build && npm run preview   (in another terminal)
//   node scripts/lighthouse.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const DESKTOP = process.env.FORM === 'desktop';
const PAGES = ['/', '/student', '/committee', '/committee/builder', '/faculty'];
mkdirSync('docs/lighthouse', { recursive: true });

const rows = [];
for (const path of PAGES) {
  const name = path === '/' ? 'landing' : path.slice(1).replace(/\//g, '-');
  const out = `docs/lighthouse/${name}${DESKTOP ? '-desktop' : ''}.json`;
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--yes', 'lighthouse@12', BASE + path, '--quiet', '--output=json', `--output-path=${out}`, '--only-categories=performance,accessibility,best-practices', '--chrome-flags=--headless=new', ...(DESKTOP ? ['--preset=desktop'] : [])],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  const r = JSON.parse(readFileSync(out, 'utf8'));
  const s = (k) => Math.round(r.categories[k].score * 100);
  const a = r.audits;
  rows.push({
    page: path,
    performance: s('performance'),
    accessibility: s('accessibility'),
    'best-practices': s('best-practices'),
    LCP: a['largest-contentful-paint'].displayValue,
    CLS: a['cumulative-layout-shift'].displayValue,
    TBT: a['total-blocking-time'].displayValue,
  });
}
console.table(rows);
