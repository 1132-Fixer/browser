#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Install-and-first-run smoke test: load each Chromium-family build UNPACKED
 * into a real Chromium (Playwright's bundled build, `chromium` channel, which
 * supports extensions headless) and open its popup page as an extension page
 * with the REAL chrome.* namespace.
 *
 *   node tests/end-to-end/extension-install.e2e.js            (chrome, edge, brave)
 *   node tests/end-to-end/extension-install.e2e.js chrome
 *
 * What this proves: the package installs, the manifest is accepted, the
 * popup boots without errors against the real API, the version chip comes
 * from the real manifest, host access is granted at install, and the popup
 * treats its own (extension) tab as NOT ZOOM. It does not click FIX ZOOM
 * (that would need a real Zoom tab; the cleanup path is covered by the mock
 * e2e).
 *
 * Google Chrome and Microsoft Edge branded binaries removed the flags needed
 * to side-load extensions, so this runs on Chromium. Branded-browser runs are
 * MANUAL_VALIDATION_REQUIRED (docs/testing/README.md).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const T = require('../../tooling/build/targets');

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TARGETS = ids.length ? ids : T.EXTENSION_TARGET_IDS.filter((id) => T.TARGETS[id].family === 'chromium');

let passed = 0;
let failed = 0;
function check(ok, name, detail) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
function group(title) { console.log('\n' + title); }

async function discoverExtensionId(context) {
  const page = await context.newPage();
  try {
    await page.goto('chrome://extensions', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const mgr = document.querySelector('extensions-manager');
      const tb = mgr && mgr.shadowRoot && mgr.shadowRoot.querySelector('extensions-toolbar');
      const tog = tb && tb.shadowRoot && tb.shadowRoot.querySelector('#devMode');
      if (tog && !tog.checked) tog.click();
    });
    await page.waitForTimeout(400);
    return await page.evaluate(() => {
      const mgr = document.querySelector('extensions-manager');
      const list = mgr && mgr.shadowRoot && mgr.shadowRoot.querySelector('extensions-item-list');
      const items = list && list.shadowRoot && list.shadowRoot.querySelectorAll('extensions-item');
      if (!items) return null;
      for (const it of items) {
        const name = it.shadowRoot && it.shadowRoot.querySelector('#name');
        if (name && /1132/.test(name.textContent || '')) return it.getAttribute('id');
      }
      return null;
    });
  } finally {
    await page.close();
  }
}

async function smoke(id) {
  const target = T.TARGETS[id];
  const dist = path.join(T.DIST_DIR, id);
  group(`${id}: load unpacked into Chromium and open the popup as an extension page`);
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) { check(false, `${id} is built`, 'run npm run build'); return; }
  const expected = T.manifestFor(id);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `1132-${id}-`));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--no-first-run', '--no-default-browser-check'],
  });
  try {
    const extId = await discoverExtensionId(context);
    check(!!extId && /^[a-p]{32}$/.test(extId), `${id}: extension installed and listed on chrome://extensions`, extId);
    if (!extId) return;

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const t = document.getElementById('statusBadgeText');
      return t && t.textContent && t.textContent !== 'Checking…';
    }, { timeout: 10000 });

    const s = await page.evaluate(async () => ({
      status: document.getElementById('statusBadgeText').textContent.trim(),
      version: document.getElementById('appVersion').textContent.trim(),
      buttonHidden: document.getElementById('zoomFixBtn').hidden,
      manifestName: chrome.runtime.getManifest().name,
      manifestVersion: chrome.runtime.getManifest().version,
      permissions: chrome.runtime.getManifest().permissions,
      hostAccess: await chrome.permissions.contains({ origins: ['https://*.zoom.us/*', 'https://*.zoom.com/*', 'http://*.zoom.us/*', 'http://*.zoom.com/*'] }),
      allUrls: await chrome.permissions.contains({ origins: ['<all_urls>'] }),
      csp: chrome.runtime.getManifest().content_security_policy,
      width: Math.round(document.body.getBoundingClientRect().width),
    }));
    check(errors.length === 0, `${id}: popup booted with no page or console errors`, errors.join('; '));
    check(s.manifestName === expected.name, `${id}: real manifest name is "${expected.name}"`, s.manifestName);
    check(s.manifestVersion === expected.version && s.version === 'v' + expected.version, `${id}: version chip reads v${expected.version} from the real manifest`, s.version);
    check(JSON.stringify(s.permissions) === JSON.stringify(expected.permissions), `${id}: installed permissions equal the manifest`, JSON.stringify(s.permissions));
    check(s.hostAccess === true, `${id}: Zoom host access is granted at install`);
    check(s.allUrls === false, `${id}: no <all_urls> access`);
    check(s.status === 'NOT ZOOM' && s.buttonHidden === true, `${id}: first run on a non-Zoom tab shows NOT ZOOM and no button`, s.status);
    check(s.width === 360, `${id}: popup renders at 360px`, String(s.width));

    const report = await context.newPage();
    const reportErrors = [];
    report.on('pageerror', (e) => reportErrors.push(e.message));
    await report.route('**/*', (route) => {
      // Never let the smoke test reach the real support service.
      if (route.request().url().startsWith('chrome-extension://')) return route.continue();
      return route.abort();
    });
    await report.goto(`chrome-extension://${extId}/report.html`, { waitUntil: 'load' });
    await report.waitForFunction(() => document.getElementById('checkingView').hidden === true, { timeout: 15000 });
    const r = await report.evaluate(() => ({
      fallbackShown: !document.getElementById('fallbackView').hidden,
      formHidden: document.getElementById('formView').hidden,
    }));
    check(reportErrors.length === 0, `${id}: report page booted without errors`, reportErrors.join('; '));
    check(r.fallbackShown && r.formHidden, `${id}: report page shows the GitHub fallback when the service is unreachable`);
  } finally {
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  void target;
}

(async () => {
  for (const id of TARGETS) await smoke(id);
  console.log('');
  console.log(`[install smoke] Passed: ${passed}  Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('\ninstall smoke crashed:', (e && e.stack) || e);
  process.exit(1);
});
