#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Capture screenshot #04: the chrome://extensions Details page for 1132 Fixer
 * with its loaded permissions list visible. Requires real Chromium load-unpacked
 * (headless mode does not support extensions), so we launch a temporary
 * persistent context with `--load-extension=` pointed at the repo root.
 *
 * Output: store-assets/04-extension-details-permissions.png
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { chromium } = require('playwright');
const { flattenPngFile } = require('../lib/png');

// How far down the Details page to scroll before shooting, so the Permissions
// and Site access blocks are both fully on screen.
const SCROLL_Y = Number(process.env.DETAILS_SCROLL_Y || 180);

const ROOT    = path.resolve(__dirname, '..', '..');
// The unpacked extension is the BUILT Chrome target: run `npm run build:chrome` first.
const EXT_DIR = path.join(ROOT, 'dist', 'chrome');
const OUT_DIR = path.join(ROOT, 'store-assets');
fs.mkdirSync(OUT_DIR, { recursive: true });

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), '1132-pw-profile-'));

(async () => {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    args: [
      '--disable-extensions-except=' + EXT_DIR,
      '--load-extension=' + EXT_DIR,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  let extensionId = null;
  try {
    // Discover the loaded extension's ID via the service worker / background URL.
    // For MV3 popup-only extensions without a service worker, the ID surfaces as
    // soon as Chrome registers the extension; we poll chrome://extensions for it.
    const page = await context.newPage();
    await page.goto('chrome://extensions', { waitUntil: 'domcontentloaded' });
    // Make sure dev mode is on so the ID + details surface.
    await page.evaluate(() => {
      const mgr = document.querySelector('extensions-manager');
      const tb  = mgr && mgr.shadowRoot && mgr.shadowRoot.querySelector('extensions-toolbar');
      const tog = tb  && tb.shadowRoot  && tb.shadowRoot.querySelector('#devMode');
      if (tog && !tog.checked) tog.click();
    });
    await page.waitForTimeout(500);
    extensionId = await page.evaluate(() => {
      const mgr   = document.querySelector('extensions-manager');
      const list  = mgr && mgr.shadowRoot && mgr.shadowRoot.querySelector('extensions-item-list');
      const items = list && list.shadowRoot && list.shadowRoot.querySelectorAll('extensions-item');
      if (!items) return null;
      for (const it of items) {
        const name = it.shadowRoot && it.shadowRoot.querySelector('#name');
        if (name && /1132/.test(name.textContent || '')) return it.getAttribute('id');
      }
      return null;
    });
    if (!extensionId) throw new Error('1132 Fixer extension id not discoverable on chrome://extensions');
    console.log('  extension id:', extensionId);

    // Navigate to the per-extension Details page; permissions list lives there.
    await page.goto('chrome://extensions/?id=' + extensionId, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // The Site access block sits below the fold, and it is the part a reviewer
    // needs to see — scroll until every host pattern is on screen. The details
    // view scrolls its own container inside the manager's shadow DOM, so try
    // that first and fall back to the window.
    const scrolled = await page.evaluate((y) => {
      // chrome://extensions scrolls a container nested in the manager's shadow
      // DOM, so document.scrollingElement never moves. Walk every shadow root
      // and drive the tallest genuinely scrollable element we find.
      const candidates = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 200) candidates.push(el);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);

      candidates.sort((a, b) => b.clientHeight - a.clientHeight);
      const target = candidates[0] || document.scrollingElement;
      target.scrollTop = y;
      if (!target.scrollTop) window.scrollTo(0, y);
      return {
        element: target.tagName ? target.tagName.toLowerCase() + (target.id ? '#' + target.id : '') : 'window',
        scrollTop: target.scrollTop || window.scrollY,
      };
    }, SCROLL_Y);
    console.log(`  scrolled ${scrolled.element} to ${scrolled.scrollTop}`);
    await page.waitForTimeout(300);

    const out = path.join(OUT_DIR, '04-extension-details-permissions.png');
    await page.screenshot({ path: out, fullPage: false });

    // The store wants exactly 1280x800 (or 640x400) with no alpha channel.
    const { width, height } = flattenPngFile(fs, out, [255, 255, 255]);
    if (width !== 1280 || height !== 800) {
      throw new Error(`screenshot is ${width}x${height}, the store requires 1280x800`);
    }
    console.log(`  wrote ${path.relative(ROOT, out)} (${width}x${height}, 24-bit RGB, no alpha)`);
  } finally {
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
})().catch(e => {
  console.error('capture failed:', e && e.stack || e);
  process.exit(1);
});
