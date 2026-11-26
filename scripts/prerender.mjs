// Post-build step:
//  - dist/app.html   = SPA shell, served for every route except "/" (see public/_redirects)
//  - dist/index.html = the landing page pre-rendered to static HTML, then hydrated.
//    It is fully visible and its links work before any JavaScript runs, so its
//    scripts are fetched at low priority to keep the first paint uncontended.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { render } = await import(pathToFileURL('dist-ssr/entry-prerender.js').href);
const html = render('/');
const file = 'dist/index.html';
const template = readFileSync(file, 'utf8');
const marker = '<div id="root"></div>';
if (!template.includes(marker)) throw new Error(`${file} has no empty #root to fill`);

// App routes paint from JavaScript, so give scripts the bandwidth: keep only the small display-serif
// preload. Inter's fallback is metric-matched to Arial, so the late swap causes no layout shift.
writeFileSync('dist/app.html', template.replace(/\s*<link rel="preload" as="font" type="font\/woff2" href="\/assets\/inter-latin-wght-normal[^>]*>/, ''));

const landing = template
  .replace(marker, `<div id="root">${html}</div>`)
  .replace(/<script type="module" crossorigin src=/, '<script type="module" crossorigin fetchpriority="low" src=')
  .replace(/<link rel="modulepreload" crossorigin href=/g, '<link rel="modulepreload" crossorigin fetchpriority="low" href=');
writeFileSync(file, landing);
rmSync('dist-ssr', { recursive: true, force: true });
console.log(`Pre-rendered landing page: ${(html.length / 1024).toFixed(1)} KB of HTML · app.html shell written`);
