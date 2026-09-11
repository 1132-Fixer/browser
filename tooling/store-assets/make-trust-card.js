#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Screenshot #04: a branded 1280x800 "what it can and cannot touch" card,
 * rendered from inline HTML with the extension's own popup styling — no
 * browser chrome, no settings page. Same ink/amber/hazard brand as the popup.
 *
 * Output: store-assets/04-extension-details-permissions.png
 */

const fs   = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const os   = require('os');

const { chromium } = require('playwright');
const { flattenPngFile } = require('../lib/png');

const ROOT    = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'store-assets');
fs.mkdirSync(OUT_DIR, { recursive: true });

const iconUrl = pathToFileURL(path.join(ROOT, 'packages', 'ui', 'src', 'icons', 'icon128.png')).href;

const HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1280px; height:800px; overflow:hidden;
    font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;
    background:linear-gradient(170deg,#0a1020 0%,#081018 45%,#050a14 100%);
    color:#f0f0f0; display:flex; flex-direction:column; align-items:center;
  }
  .head { display:flex; align-items:center; gap:24px; margin-top:64px; }
  .head img { width:96px; height:96px; border-radius:22px; filter:drop-shadow(0 10px 30px rgba(0,0,0,.75)); }
  .title { font-size:46px; font-weight:900; letter-spacing:5px;
    background:linear-gradient(180deg,#ffe066,#ffd700,#f5a623);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    filter:drop-shadow(0 2px 10px rgba(245,166,35,.55)); }
  .sub { color:#8ca4c0; font-size:16px; letter-spacing:2.4px; text-transform:uppercase; margin-top:10px; text-align:center; }
  .cols { display:flex; gap:36px; margin-top:56px; }
  .card { width:470px; border-radius:18px; padding:34px 38px;
    border:1.5px solid rgba(255,255,255,.12);
    background:linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.02)); }
  .card h2 { font-size:15px; letter-spacing:2.6px; margin-bottom:24px; font-weight:800; }
  .can  h2 { color:#22c55e; }
  .cant h2 { color:#ef4444; }
  .card li { list-style:none; font-size:17px; line-height:1.55; color:#c9d6e6;
    margin-bottom:14px; padding-left:34px; position:relative; }
  .card li::before { position:absolute; left:0; top:0; font-weight:900; }
  .can  li::before { content:'\\2713'; color:#22c55e; }
  .cant li::before { content:'\\2715'; color:#ef4444; }
  .badges { display:flex; gap:14px; margin-top:52px; }
  .badge { font-size:13px; font-weight:700; letter-spacing:1.6px; padding:9px 20px;
    border-radius:50px; text-transform:uppercase; }
  .amber { color:#f5a623; border:1.5px solid rgba(245,166,35,.45);
    background:linear-gradient(145deg,rgba(245,166,35,.14),rgba(245,166,35,.05)); }
  .grey  { color:#8ca4c0; border:1.5px solid rgba(255,255,255,.12);
    background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.03)); }
  .hazard { position:fixed; left:0; right:0; bottom:0; height:10px; opacity:.7;
    background:repeating-linear-gradient(-45deg,#f5c518,#f5c518 12px,#1a1a1a 12px,#1a1a1a 24px); }
</style></head><body>
  <div class="head"><img src="${iconUrl}"><div class="title">1132 FIXER</div></div>
  <div class="sub">Zoom cookie cleaner &middot; what it can and cannot touch</div>
  <div class="cols">
    <ul class="card can"><h2>WHAT IT CAN DO</h2>
      <li>Delete cookies for zoom.us and zoom.com, including subdomains</li>
      <li>Reload your active Zoom tab after the clear</li>
      <li>Report how many cookies were removed</li>
      <li>Run only when you click FIX ZOOM</li>
    </ul>
    <ul class="card cant"><h2>WHAT IT CANNOT DO</h2>
      <li>Touch storage, cache, IndexedDB, or any other data type</li>
      <li>See or change any non-Zoom website</li>
      <li>Read cookie values, collect data, or send anything anywhere</li>
      <li>Run on install, on startup, or on a timer</li>
    </ul>
  </div>
  <div class="badges">
    <span class="badge amber">Cookies only</span>
    <span class="badge amber">Zoom-only access</span>
    <span class="badge grey">No telemetry</span>
    <span class="badge grey">Open source &middot; MIT</span>
  </div>
  <div class="hazard"></div>
</body></html>`;

(async () => {
  const tmp = path.join(os.tmpdir(), '1132-trust-card.html');
  fs.writeFileSync(tmp, HTML);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await page.waitForTimeout(250);
    const out = path.join(OUT_DIR, '04-extension-details-permissions.png');
    await page.screenshot({ path: out, fullPage: false });
    const { width, height } = flattenPngFile(fs, out, [10, 16, 32]);
    if (width !== 1280 || height !== 800) throw new Error(`got ${width}x${height}, need 1280x800`);
    console.log(`wrote ${path.relative(ROOT, out)} (${width}x${height}, 24-bit RGB, no alpha)`);
  } finally {
    await browser.close();
    try { fs.rmSync(tmp); } catch {}
  }
})().catch(e => { console.error('trust card failed:', e && e.stack || e); process.exit(1); });
