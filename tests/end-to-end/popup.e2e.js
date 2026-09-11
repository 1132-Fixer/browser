#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * End-to-end behaviour test for the built popup, in a real browser engine.
 *
 *   node tests/end-to-end/popup.e2e.js --engine chromium --target chrome
 *   node tests/end-to-end/popup.e2e.js --engine firefox  --target firefox
 *
 * Serves dist/<target>/ over loopback http, injects a recording WebExtension
 * mock (packages/test-utils) shaped like the engine's real namespace
 * (`chrome.*` on Chromium, `browser.*` + `chrome.*` on Gecko), drives the one
 * FIX ZOOM button and asserts what actually happened: Zoom cookies removed
 * exactly once each, page cleanup injected only into the Zoom tab and only
 * after the click, unrelated origins untouched, host-access recovery, and no
 * hidden background sweep. The serialized cleaner is also executed against
 * the popup's own (non-Zoom) origin and must refuse.
 */

const path = require('path');
const { mockInitScript } = require('../../packages/test-utils/src/browser-mock');
const { serveDirectory } = require('../../tooling/lib/static-server');
const T = require('../../tooling/build/targets');

const args = process.argv.slice(2);
const argOf = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const ENGINE = argOf('--engine', 'chromium');
const TARGET = argOf('--target', ENGINE === 'firefox' ? 'firefox' : 'chrome');
const NAMESPACE = ENGINE === 'firefox' ? 'browser' : 'chrome';
const DIST = path.join(T.DIST_DIR, TARGET);
const POPUP_WIDTH = 360;
const MOCK_VERSION = '1.2.0';

const playwright = require('playwright');
const engine = playwright[ENGINE];
if (!engine) { console.error('unknown engine: ' + ENGINE); process.exit(2); }

let passed = 0;
let failed = 0;
function check(ok, name, detail) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
function group(title) { console.log('\n' + title); }

const readState = (page) => page.evaluate(() => ({
  status: document.getElementById('statusBadgeText').textContent.trim(),
  badgeClass: document.getElementById('statusBadge').className,
  result: document.getElementById('result').textContent.trim(),
  resultClass: document.getElementById('result').className,
  version: document.getElementById('appVersion').textContent.trim(),
  buttonHidden: document.getElementById('zoomFixBtn').hidden,
  buttonDisabled: document.getElementById('zoomFixBtn').disabled,
  buttonLabel: document.getElementById('zoomFixBtn').textContent.trim(),
  buttonCount: document.querySelectorAll('button').length,
  fieldCount: document.querySelectorAll('input, select, textarea').length,
  bodyWidth: Math.round(document.body.getBoundingClientRect().width),
  bodyScrollW: document.body.scrollWidth,
  focusVisibleOk: !!document.querySelector('#zoomFixBtn'),
  jarLeft: window.__jar.length,
  calls: window.__calls,
}));

let server;
let browser;

async function withPopup(cfg, fn) {
  const context = await browser.newContext({ viewport: { width: 460, height: 820 } });
  try {
    await context.addInitScript(mockInitScript({ namespace: NAMESPACE, version: MOCK_VERSION, ...cfg }));
    const page = await context.newPage();
    const pageErrors = [];
    const external = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('request', (r) => { if (!r.url().startsWith(server.origin + '/')) external.push(r.url()); });

    await page.goto(server.origin + '/popup.html', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const t = document.getElementById('statusBadgeText');
      return t && t.textContent && t.textContent !== 'Checking…';
    }, { timeout: 10000 });

    await fn(page);

    check(pageErrors.length === 0, `${cfg.name}: popup raised no page errors`, pageErrors.join('; '));
    check(external.length === 0, `${cfg.name}: made no request outside the popup origin`, external.join('; '));
  } finally {
    await context.close();
  }
}

const clickFix = async (page) => {
  await page.click('#zoomFixBtn');
  await page.waitForFunction(
    () => /CLEARED|PARTIAL|ERROR|ACCESS NEEDED|NOT ZOOM/.test(document.getElementById('statusBadgeText').textContent || '')
      && !document.getElementById('zoomFixBtn').disabled,
    { timeout: 10000 });
};

const ZOOM_JAR = [
  { name: '_zm_ssid', domain: 'zoom.us', secure: true },
  { name: 'cred', domain: '.zoom.us', secure: true },
  { name: '_zm_lang', domain: 'zoom.us', secure: false },
  { name: 'zm_aid', domain: '.zoom.com', secure: true },
];
const MIXED_JAR = [
  ...ZOOM_JAR,
  { name: 'sid', domain: 'example.com', secure: true },
  { name: 'id', domain: 'github.com', secure: true },
];
const ZOOM_ORIGINS = ['https://*.zoom.us/*', 'https://*.zoom.com/*', 'http://*.zoom.us/*', 'http://*.zoom.com/*'];

const zoomOnlyRemoves = (removes) => removes.every((r) => {
  try {
    const host = new URL(r.url).hostname;
    return host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'zoom.com' || host.endsWith('.zoom.com');
  } catch { return false; }
});

(async () => {
  console.log(`engine=${ENGINE} target=${TARGET} namespace=${NAMESPACE} dist=${path.relative(T.ROOT, DIST)}`);
  server = await serveDirectory(DIST);
  browser = await engine.launch({ headless: true });
  try {
    group('FIX ZOOM on https://zoom.us (4 cookies, no partition support)');
    await withPopup({ name: 'zoom.us', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR, partitionSupport: false }, async (page) => {
      const before = await readState(page);
      check(before.buttonHidden === false, 'FIX ZOOM button is visible on a Zoom tab');
      check(before.buttonCount === 1, 'popup renders exactly one button', `got ${before.buttonCount}`);
      check(before.fieldCount === 0, 'popup renders no inputs, checkboxes or selects', `got ${before.fieldCount}`);
      check(before.buttonLabel === 'FIX ZOOM', 'button label is FIX ZOOM', before.buttonLabel);
      check(before.status === 'ZOOM DETECTED', 'state pill reads ZOOM DETECTED', before.status);
      check(before.version === 'v' + MOCK_VERSION, 'version chip comes from the manifest', before.version);
      check(before.bodyWidth === POPUP_WIDTH, `popup is ${POPUP_WIDTH}px wide`, String(before.bodyWidth));
      check(before.bodyScrollW <= POPUP_WIDTH, 'no horizontal overflow', `scrollWidth ${before.bodyScrollW}`);
      check(before.calls.remove.length === 0, 'opening the popup removes nothing');
      check(before.calls.executeScript.length === 0, 'opening the popup does not inject page cleanup');
      check(before.calls.getAll.length === 0, 'opening the popup does not read the cookie jar');
      check(before.calls.request.length === 0, 'opening the popup does not prompt for permissions');
      check(before.calls.contains.length === 1 && JSON.stringify(before.calls.contains[0].origins) === JSON.stringify(ZOOM_ORIGINS), 'opening the popup checks host access for the four Zoom origins only');

      // Keyboard: the button is reachable and activates with Enter.
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
      check(focused === 'zoomFixBtn', 'Tab focuses the FIX ZOOM button', focused);
      const outline = await page.evaluate(() => {
        const b = document.getElementById('zoomFixBtn');
        b.focus();
        return getComputedStyle(b).outlineStyle;
      });
      check(outline !== 'none', 'focused button has a visible focus outline', outline);

      await clickFix(page);
      const after = await readState(page);
      check(after.status === 'CLEARED', 'state pill reads CLEARED', after.status);
      check(/Removed 4 Zoom cookies\./.test(after.result), 'result line reports 4 cookies removed', after.result);
      check(/Zoom site data was cleared/.test(after.result), 'result line reports Zoom site data cleared', after.result);
      check(/Tab reloaded\./.test(after.result), 'result line reports the tab reload', after.result);
      check(after.resultClass.includes('good'), 'result line is styled as success', after.resultClass);
      check(after.jarLeft === 0, 'every Zoom cookie is gone from the jar', `${after.jarLeft} left`);
      check(after.calls.remove.length === 4, 'each cookie removed exactly once', `${after.calls.remove.length} remove calls`);
      check(after.calls.reload.join() === '7', 'active Zoom tab reloaded once', JSON.stringify(after.calls.reload));
      check(after.calls.executeScript.length === 1, 'page cleanup injected once after FIX ZOOM', `${after.calls.executeScript.length}`);
      const inj = after.calls.executeScript[0];
      check(inj.tabId === 7 && inj.hasFunc, 'page cleanup targeted the active Zoom tab with a function', JSON.stringify({ tabId: inj.tabId, hasFunc: inj.hasFunc }));
      check(inj.realResult && inj.realResult.skipped === true && inj.realResult.reason === 'not-zoom-origin',
        'the serialized cleaner refused the popup\'s own non-Zoom origin when executed for real', JSON.stringify(inj.realResult));
      check(after.calls.forbidden.length === 0, 'never reads browsingData / storage / webRequest / history / alarms', after.calls.forbidden.join(','));
      check(zoomOnlyRemoves(after.calls.remove), 'cookie removals stay on Zoom origins');
      const urls = after.calls.remove.map((r) => r.url).sort();
      check(urls.includes('http://zoom.us/'), 'non-Secure cookie removed over http', urls.join(' '));
      check(urls.filter((u) => u.startsWith('https://')).length === 3, 'Secure cookies removed over https', urls.join(' '));
      const domains = after.calls.getAll.map((q) => q.domain);
      check(domains.filter((d) => d === 'zoom.us').length === 2 && domains.filter((d) => d === 'zoom.com').length === 2,
        'queries both Zoom base domains (partitioned attempt + unpartitioned fallback)', domains.join(','));
    });

    group('partitioned cookies (own-site AND third-party partitions)');
    await withPopup({
      name: 'partitioned', activeUrl: 'https://zoom.us/', partitionSupport: true,
      jar: [
        { name: '_zm_ssid', domain: 'zoom.us', secure: true },
        { name: '_zm_chtaid', domain: 'zoom.us', secure: true, partitionKey: { topLevelSite: 'https://zoom.us' } },
        { name: '_zm_embed', domain: 'zoom.us', secure: true, partitionKey: { topLevelSite: 'https://school-lms.example' } },
      ],
    }, async (page) => {
      await clickFix(page);
      const s = await readState(page);
      check(s.calls.remove.length === 3, 'unpartitioned + both partitioned cookies removed', `${s.calls.remove.length}`);
      const withKey = s.calls.remove.filter((r) => r.partitionKey);
      check(withKey.length === 2, 'partitionKey is passed back to cookies.remove for each partitioned cookie', JSON.stringify(withKey));
      check(withKey.some((r) => r.partitionKey.topLevelSite === 'https://school-lms.example'), 'a cookie partitioned under a third-party top-level site is cleared too');
      check(s.jarLeft === 0, 'every partitioned cookie actually deleted', `${s.jarLeft} left`);
    });

    group('duplicate query results are deduplicated');
    await withPopup({ name: 'dedupe', activeUrl: 'https://zoom.us/', partitionSupport: true, jar: [
      { name: '_zm_ssid', domain: 'zoom.us', secure: true }, { name: 'cred', domain: 'zoom.us', secure: true },
    ] }, async (page) => {
      await clickFix(page);
      const s = await readState(page);
      check(s.calls.remove.length === 2, 'each cookie is removed exactly once', `${s.calls.remove.length}`);
      check(/Removed 2 Zoom cookies\./.test(s.result), 'count is not double-reported', s.result);
    });

    group('partial failure (browser refuses one removal)');
    await withPopup({ name: 'partial', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR, failNames: ['cred'] }, async (page) => {
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'PARTIAL', 'state pill reads PARTIAL', s.status);
      check(/Removed 3 Zoom cookies; 1 could not be removed\./.test(s.result), 'result line is honest about the failure', s.result);
      check(s.resultClass.includes('warn'), 'result line is styled as a warning', s.resultClass);
      check(s.jarLeft === 1, 'the refused cookie is still in the jar', `${s.jarLeft}`);
    });

    group('no Zoom cookies present');
    await withPopup({ name: 'empty', activeUrl: 'https://us02web.zoom.us/j/123', partitionSupport: true, jar: [] }, async (page) => {
      const before = await readState(page);
      check(before.status === 'ZOOM DETECTED', 'subdomain is detected as Zoom', before.status);
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'CLEARED', 'state pill reads CLEARED', s.status);
      check(/No Zoom cookies were left to remove\./.test(s.result), 'result line says there was nothing to remove', s.result);
      check(s.calls.remove.length === 0, 'no removal attempted');
    });

    group('cookies.getAll fails for both domains');
    await withPopup({ name: 'getAll fails', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR, getAllThrows: true }, async (page) => {
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'PARTIAL', 'state pill reads PARTIAL when cookies fail but site data clears', s.status);
      check(/The browser would not let us read the Zoom cookie jar/.test(s.result), 'result line explains the cookie-jar failure without naming a browser', s.result);
      check(s.calls.remove.length === 0, 'no cookie removal attempted');
      check(s.calls.executeScript.length === 1, 'site-data cleanup still ran');
      check(s.jarLeft === ZOOM_JAR.length, 'jar untouched', `${s.jarLeft}`);
    });

    for (const [label, activeUrl] of [
      ['non-Zoom site', 'https://example.com/'],
      ['browser-internal page', ENGINE === 'firefox' ? 'about:addons' : 'chrome://extensions/'],
      ['lookalike host', 'https://zoom.us.evil.com/'],
      ['lookalike suffix', 'https://evilzoom.us/'],
      ['no active tab', ''],
    ]) {
      group(`${label} (${activeUrl || 'none'})`);
      await withPopup({ name: label, activeUrl, jar: ZOOM_JAR }, async (page) => {
        const s = await readState(page);
        check(s.status === 'NOT ZOOM', 'state pill reads NOT ZOOM', s.status);
        check(s.badgeClass.includes('neutral'), 'state pill is neutral, not success-green', s.badgeClass);
        check(s.buttonHidden === true, 'no FIX ZOOM button is offered');
        check(/Open a zoom\.us or zoom\.com tab/.test(s.result), 'result line explains what to do', s.result);
        check(s.calls.getAll.length === 0, 'cookie jar is never read');
        check(s.calls.remove.length === 0 && s.calls.reload.length === 0 && s.calls.executeScript.length === 0, 'nothing removed, reloaded, or injected');
        check(s.calls.contains.length === 0 && s.calls.request.length === 0, 'no permission check or prompt on a non-Zoom tab');
        check(s.jarLeft === ZOOM_JAR.length, 'jar untouched', `${s.jarLeft}`);
      });
    }

    group('unrelated-origin cookies are not cleared');
    await withPopup({ name: 'mixed jar', activeUrl: 'https://zoom.us/', jar: MIXED_JAR }, async (page) => {
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'CLEARED', 'mixed jar still reports CLEARED', s.status);
      check(s.calls.remove.length === 4, 'only the four Zoom cookies are removed', `${s.calls.remove.length}`);
      check(zoomOnlyRemoves(s.calls.remove), 'no remove URL leaves Zoom origins');
      const leftover = (await page.evaluate(() => window.__jar.map((c) => c.domain))).sort();
      check(leftover.join(',') === 'example.com,github.com', 'leftover domains are the unrelated origins', leftover.join(','));
    });

    group('scripting.executeScript fails after cookies clear');
    await withPopup({ name: 'scripting fails', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR, scriptingThrows: true }, async (page) => {
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'PARTIAL', 'state pill reads PARTIAL when site data fails', s.status);
      check(/Removed 4 Zoom cookies\./.test(s.result), 'cookies were still cleared', s.result);
      check(/site data could not be cleared/.test(s.result), 'result line reports the storage failure', s.result);
      check(s.jarLeft === 0, 'Zoom jar empty after cookie clear');
    });

    group('cookies.getAll and scripting both fail');
    await withPopup({ name: 'both fail', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR, getAllThrows: true, scriptingThrows: true }, async (page) => {
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'ERROR', 'state pill reads ERROR when nothing succeeded', s.status);
      check(s.resultClass.includes('bad'), 'result line is styled as an error', s.resultClass);
      check(s.jarLeft === ZOOM_JAR.length, 'jar untouched');
    });

    group('host access revoked, user grants it on FIX ZOOM');
    await withPopup({ name: 'access granted', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR, hostAccess: false, grantOnRequest: true }, async (page) => {
      const before = await readState(page);
      check(before.status === 'ACCESS NEEDED', 'state pill reads ACCESS NEEDED', before.status);
      check(before.buttonHidden === false, 'FIX ZOOM is still the one button offered');
      check(/access to Zoom sites/.test(before.result), 'result line explains the missing access', before.result);
      check(before.calls.request.length === 0, 'no prompt before the click');
      await clickFix(page);
      const s = await readState(page);
      check(s.calls.request.length === 1 && JSON.stringify(s.calls.request[0].origins) === JSON.stringify(ZOOM_ORIGINS), 'one permission prompt for the four Zoom origins', JSON.stringify(s.calls.request));
      check(s.status === 'CLEARED', 'cleanup proceeds after the grant', s.status);
      check(s.jarLeft === 0, 'cookies cleared after the grant');
    });

    group('host access revoked, user refuses the prompt');
    await withPopup({ name: 'access refused', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR, hostAccess: false, grantOnRequest: false }, async (page) => {
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'ACCESS NEEDED', 'state pill stays ACCESS NEEDED', s.status);
      check(/was not granted/.test(s.result), 'result line reports the refusal and the recovery path', s.result);
      check(s.calls.getAll.length === 0 && s.calls.remove.length === 0 && s.calls.executeScript.length === 0, 'nothing is read, removed, or injected without access');
      check(s.buttonDisabled === false, 'the button is re-enabled so the user can retry');
    });

    group('browser without a permissions API (cannot revoke install-time host access)');
    await withPopup({ name: 'no permissions api', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR, noPermissionsApi: true }, async (page) => {
      const before = await readState(page);
      check(before.status === 'ZOOM DETECTED', 'treated as having access', before.status);
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'CLEARED', 'cleanup runs normally', s.status);
    });

    group('double click is harmless');
    await withPopup({ name: 'double click', activeUrl: 'https://zoom.us/', jar: ZOOM_JAR }, async (page) => {
      await clickFix(page);
      await clickFix(page);
      const s = await readState(page);
      check(s.status === 'CLEARED', 'second run reports CLEARED', s.status);
      check(/No Zoom cookies were left to remove/.test(s.result), 'second run finds nothing to remove', s.result);
      check(s.calls.remove.length === 4, 'no cookie is removed twice', `${s.calls.remove.length}`);
    });
  } finally {
    await browser.close();
    await server.close();
  }

  console.log('');
  console.log(`[${ENGINE}/${TARGET}] Passed: ${passed}  Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('\ne2e run crashed:', (e && e.stack) || e);
  process.exit(1);
});
