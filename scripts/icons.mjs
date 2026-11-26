// Renders the app icon to PNG (192, 512, maskable 512) using headless Chrome.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const html = (size, maskable) => `<!doctype html><html><body style="margin:0;background:${maskable ? '#1F3864' : 'transparent'}">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center">
  <div style="width:${maskable ? size * 0.62 : size}px;height:${maskable ? size * 0.62 : size}px;border-radius:${maskable ? 0 : size * 0.22}px;background:#1F3864;display:grid;place-items:center;position:relative">
    <span style="font-family:Georgia,'Times New Roman',serif;color:#FAF8F3;font-size:${(maskable ? size * 0.62 : size) * 0.62}px;line-height:1;margin-top:-${size * 0.04}px">C</span>
    <span style="position:absolute;bottom:${(maskable ? size * 0.62 : size) * 0.17}px;left:22%;right:22%;height:${Math.max(3, size * 0.035)}px;border-radius:99px;background:#C9A35A"></span>
  </div>
</div></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
for (const [size, maskable, name] of [
  [192, false, 'icon-192.png'],
  [512, false, 'icon-512.png'],
  [512, true, 'maskable-512.png'],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html(size, maskable));
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: !maskable });
  await page.close();
  console.log(`  ✓ public/icons/${name}`);
}
await browser.close();
