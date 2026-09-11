#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Capture the popup-state screenshots required by Chrome Web Store submission,
 * by loading popup.html in real Playwright Chromium with `chrome.*` APIs
 * mocked so the popup runs end-to-end.
 *
 * Output filenames match STORE_PREP.md:
 *   store-assets/01-zoom-detected.png
 *   store-assets/02-fix-complete.png
 *   store-assets/03-non-zoom-safe.png
 *
 * Screenshot #04 is the branded trust card rendered by
 * scripts/make-trust-card.js; the real chrome://extensions Details capture
 * lives in scripts/capture-extension-details.js.
 *
 * As of v1.1.0 the popup is intentionally zoom-only, and as of v1.2.0 it clears
 * cookies only and renders a single button. The former 05-manual-picker shot was
 * dropped along with the Custom domain / All sites scope feature.
 *
 * The mocked cookie jar is deliberately EMPTY, so shot 02 shows the truthful
 * "no Zoom cookies were left to remove" end state rather than a fabricated
 * count. Capture a real-session shot yourself if the listing needs one.
 *
 * Sizing: the store accepts screenshots at exactly 1280x800, and
 * letterbox-screenshots.js pads captures UP to that canvas but (correctly)
 * refuses to shrink an oversized one. A fixed deviceScaleFactor of 2 overflowed
 * that budget when the popup grew past 400 CSS px tall (F-C12: 360x415 CSS
 * captured as 720x830). So this script first measures every popup state at CSS
 * scale, then captures all of them at the largest clean deviceScaleFactor that
 * still fits — text is rasterized natively at the chosen factor, never
 * downscaled from a larger bitmap, which keeps it sharp.
 *
 * Resolves the globally-installed `playwright` so the repo does not gain a
 * node_modules dependency.
 */

const fs   = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT       = path.resolve(__dirname, '..', '..');
// Screenshots come from the BUILT Chrome popup: run `npm run build:chrome` first.
const POPUP_URL  = pathToFileURL(path.join(ROOT, 'dist', 'chrome', 'popup.html')).href;
const OUT_DIR    = path.join(ROOT, 'store-assets');
const VERSION    = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', 'extensions', 'chrome', 'manifest.json'), 'utf8')).version;
fs.mkdirSync(OUT_DIR, { recursive: true });

// Chrome Web Store screenshot canvas. Must match letterbox-screenshots.js.
const STORE_W = 1280;
const STORE_H = 800;

// Viewport is CSS px and only needs to contain the popup; the screenshot is a
// tight crop of <body> regardless.
const VIEWPORT = { width: 460, height: 760 };

// Candidate deviceScaleFactors, sharpest first. Quarter steps are the factors
// Chromium renders at on real displays, so hairline borders land evenly; the
// first one whose capture of the tallest state fits the store canvas wins.
const SCALE_LADDER = [2, 1.75, 1.5, 1.25, 1];

/**
 * Build the mocked-chrome script the popup expects: init() calls
 * chrome.tabs.query + chrome.runtime.getManifest, and a FIX ZOOM click calls
 * chrome.cookies.getAll / chrome.cookies.remove / chrome.tabs.reload. Those are
 * the only chrome.* APIs the cookies-only popup touches.
 */
function chromeMock(activeUrl) {
  return `(() => {
    window.chrome = {
      runtime: {
        getManifest: () => ({ name: '1132 Fixer for Chrome', version: ${JSON.stringify(VERSION)}, manifest_version: 3 }),
      },
      tabs: {
        query: async () => [{ id: 1, url: ${JSON.stringify(activeUrl)} }],
        reload: async () => {},
      },
      cookies: {
        getAll: async () => [],
        remove: async () => ({}),
      },
    };
  })();`;
}

/** Shot 02: click FIX ZOOM and wait for the SUCCESS pill — a published
 * screenshot named "fix-complete" must never show ERROR or PARTIAL. */
async function clickFixAndSettle(page) {
  await page.click('#zoomFixBtn');
  await page.waitForFunction(() => {
    const t = document.getElementById('statusBadgeText');
    return t && /^CLEARED$/.test((t.textContent || '').trim());
  }, { timeout: 5000 });
}

const SHOTS = [
  // 01 — zoom.us active: state pill shows the host, one FIX ZOOM button
  { name: '01-zoom-detected.png', activeUrl: 'https://zoom.us/', expectState: /^READY · / },
  // 02 — same setup, click FIX ZOOM, wait for the CLEARED state
  { name: '02-fix-complete.png',  activeUrl: 'https://zoom.us/', expectState: /^READY · /, after: clickFixAndSettle },
  // 03 — non-Zoom site: NOT ZOOM pill, no FIX ZOOM button, one explanatory line
  { name: '03-non-zoom-safe.png', activeUrl: 'https://example.com/', expectState: /^NOT ZOOM$/ },
];

/**
 * Load popup.html with the chrome mock, settle the requested popup state, then
 * run `fn(page)` and return its result.
 */
async function withPopupState(browser, { name, activeUrl, expectState, after }, deviceScaleFactor, fn) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor });
  try {
    await context.addInitScript(chromeMock(activeUrl));
    const page = await context.newPage();
    page.on('pageerror', e => { throw new Error('popup pageerror: ' + e.message); });
    await page.goto(POPUP_URL, { waitUntil: 'domcontentloaded' });
    // The shot's REQUIRED state must be reached — a timeout here is a hard
    // failure, never a shrug: publishing a popup stuck on the pre-JS
    // 'Checking…' (or any unexpected state) would ship a broken screenshot.
    await page.waitForFunction((pattern) => {
      const t = document.getElementById('statusBadgeText');
      return t && new RegExp(pattern).test((t.textContent || '').trim());
    }, expectState.source, { timeout: 5000 }).catch(() => {
      throw new Error(`${name}: popup never reached required state ${expectState} — refusing to capture`);
    });
    if (typeof after === 'function') {
      await after(page);
    }
    return await fn(page);
  } finally {
    await context.close();
  }
}

/** Largest ladder factor whose scaled capture of w x h CSS px fits the store canvas. */
function pickScale(w, h) {
  return SCALE_LADDER.find(s => Math.ceil(w * s) <= STORE_W && Math.ceil(h * s) <= STORE_H) || null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // Pass 1 — measure every state at CSS scale (deviceScaleFactor 1). One
    // shared factor is chosen from the tallest state, so the three listing
    // shots render their text at the same size.
    let maxW = 0;
    let maxH = 0;
    for (const shot of SHOTS) {
      const box = await withPopupState(browser, shot, 1, page => page.evaluate(() => {
        const r = document.body.getBoundingClientRect();
        return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
      }));
      console.log(`  measured ${shot.name}: ${box.w}x${box.h} CSS px`);
      maxW = Math.max(maxW, box.w);
      maxH = Math.max(maxH, box.h);
    }

    const scale = pickScale(maxW, maxH);
    if (!scale) {
      throw new Error(
        `popup measures ${maxW}x${maxH} CSS px and cannot fit ${STORE_W}x${STORE_H} even at 1x — ` +
        'shrink the popup layout before regenerating store screenshots');
    }
    console.log(
      `  capturing at deviceScaleFactor ${scale} ` +
      `(tallest state ${maxW}x${maxH} CSS -> ${Math.ceil(maxW * scale)}x${Math.ceil(maxH * scale)} px, budget ${STORE_W}x${STORE_H})`);

    // Pass 2 — capture. Text is rasterized natively at `scale`, so
    // letterbox-screenshots.js receives an already-fitting image and its
    // no-downscale guard keeps protecting against arbitrary oversized inputs.
    for (const shot of SHOTS) {
      await withPopupState(browser, shot, scale, async (page) => {
        const out = path.join(OUT_DIR, shot.name);
        await page.locator('body').screenshot({ path: out, omitBackground: false });
        console.log(`  wrote ${path.relative(ROOT, out)}`);
      });
    }

    console.log('done');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error('capture failed:', e && e.stack || e);
  process.exit(1);
});
