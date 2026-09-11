#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * End-to-end behaviour test for the built Report-a-Bug page (#16).
 *
 *   node tests/end-to-end/report.e2e.js --engine chromium --target chrome
 *   node tests/end-to-end/report.e2e.js --engine firefox  --target firefox
 *
 * Loads dist/<target>/report.html over loopback http with a recording
 * window.fetch stub (nothing external is ever called) and the WebExtension
 * mock, then asserts:
 *   1. Service dark -> GitHub fallback link, never a dead form.
 *   2. Service live -> form renders; screenshot validation (magic bytes,
 *      5 MB) is honest; a submit carries the base64 image + bearer token and
 *      success shows the returned case reference.
 *   3. A non-image file is rejected client-side by content, not extension.
 *   4. Offline / service failure surfaces an honest error and re-enables Submit.
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
const MOCK_VERSION = '1.2.0';

const playwright = require('playwright');
const engine = playwright[ENGINE];

const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let passed = 0;
let failed = 0;
function check(ok, name, detail) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
function group(title) { console.log('\n' + title); }

function fetchStub(cfg) {
  return `(() => {
  const CFG = ${JSON.stringify(cfg)};
  const calls = [];
  window.__fetchCalls = calls;
  window.fetch = async (url, opts) => {
    const call = { url: String(url), method: (opts && opts.method) || 'GET', headers: (opts && opts.headers) || {}, body: opts && opts.body };
    calls.push(call);
    if (CFG.dark) throw new TypeError('Failed to fetch');
    if (CFG.failCases && call.url.endsWith('/v1/cases')) return { status: 500, ok: false, json: async () => ({}) };
    const respond = (status, obj) => ({ status, ok: status < 400, json: async () => obj });
    if (call.url.endsWith('/health')) return respond(200, { ok: true, capabilities: Object.assign({ screenshots: true }, CFG.products ? { products: CFG.products } : {}) });
    if (call.url.endsWith('/v1/principals')) return respond(201, { principalId: 'IN-TESTTESTTE', token: 'a'.repeat(64) });
    if (call.url.endsWith('/v1/cases')) {
      const body = JSON.parse(call.body);
      return respond(201, { caseRef: 'FX-TESTREF', kind: 'bug', state: 'new', subject: body.title, screenshotAttached: Boolean(body.screenshot) });
    }
    return respond(404, { error: 'unstubbed ' + call.url });
  };
})();`;
}

let server;
let browser;

async function withReportPage(cfg, fn) {
  const context = await browser.newContext({ viewport: { width: 700, height: 900 } });
  try {
    await context.addInitScript(mockInitScript({ namespace: NAMESPACE, version: MOCK_VERSION, grantOnRequest: cfg.grantOnRequest !== false }));
    await context.addInitScript(fetchStub(cfg));
    const page = await context.newPage();
    const pageErrors = [];
    const external = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(server.origin + '/') && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u);
    });
    await page.goto(server.origin + '/report.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('checkingView').hidden === true, { timeout: 10000 });
    await fn(page);
    check(pageErrors.length === 0, `${cfg.name}: page raised no errors`, pageErrors.join('; '));
    check(external.length === 0, `${cfg.name}: made no request outside the page origin`, external.join('; '));
  } finally {
    await context.close();
  }
}

(async () => {
  console.log(`engine=${ENGINE} target=${TARGET} namespace=${NAMESPACE}`);
  server = await serveDirectory(DIST);
  browser = await engine.launch({ headless: true });
  try {
    group('service dark -> honest fallback, no dead form');
    await withReportPage({ name: 'dark', dark: true }, async (page) => {
      const s = await page.evaluate(() => ({
        fallbackHidden: document.getElementById('fallbackView').hidden,
        formHidden: document.getElementById('formView').hidden,
        link: document.getElementById('fallbackLink').href,
      }));
      check(s.fallbackHidden === false, 'fallback view is shown');
      check(s.formHidden === true, 'form stays hidden');
      check(s.link.includes('github.com/1132-Fixer/browser/issues/new'), 'fallback links to GitHub issues', s.link);
    });

    group('service live -> form, validation, submit with screenshot');
    await withReportPage({ name: 'live' }, async (page) => {
      const s0 = await page.evaluate(() => ({
        formHidden: document.getElementById('formView').hidden,
        fallbackHidden: document.getElementById('fallbackView').hidden,
        submitDisabled: document.getElementById('bugSubmit').disabled,
        version: document.getElementById('appVersion').textContent.trim(),
        labelFor: document.querySelector('label[for="bugText"]') !== null,
      }));
      check(s0.formHidden === false, 'form is shown');
      check(s0.fallbackHidden === true, 'fallback is hidden');
      check(s0.submitDisabled === true, 'submit starts disabled');
      check(s0.version === 'v' + MOCK_VERSION, 'version chip comes from the manifest', s0.version);
      check(s0.labelFor, 'textarea has an associated label');

      await page.fill('#bugText', 'short');
      check(await page.locator('#bugSubmit').isDisabled(), 'under 50 chars keeps submit disabled');
      await page.fill('#bugText', 'The fix button does nothing on us02web.zoom.us — the popup opens, I click, nothing happens.');
      check(!(await page.locator('#bugSubmit').isDisabled()), '50+ chars enables submit');

      const shotStatusShows = (want) => page.waitForFunction(
        (w) => (document.getElementById('shotStatus').textContent || '').includes(w), want, { timeout: 5000 }).then(() => true, () => false);

      await page.setInputFiles('#shotInput', { name: 'notes-renamed.png', mimeType: 'image/png', buffer: Buffer.from('just some text') });
      check(await shotStatusShows('Only image files'), 'renamed text file rejected by content');
      await page.setInputFiles('#shotInput', { name: 'shot.png', mimeType: 'text/plain', buffer: TINY_PNG });
      check(await shotStatusShows('Only image files'), 'non-image declared MIME rejected');
      await page.setInputFiles('#shotInput', { name: 'error.png', mimeType: 'image/png', buffer: TINY_PNG });
      await page.waitForFunction(() => document.getElementById('shotPreview').hidden === false, { timeout: 5000 });
      const preview = await page.evaluate(() => ({
        name: document.getElementById('shotName').textContent,
        imgSrc: document.getElementById('shotImg').src,
        rowHidden: document.getElementById('shotRow').hidden,
      }));
      check(preview.name === 'error.png', 'preview shows the file name', preview.name);
      check(preview.imgSrc.startsWith('blob:'), 'preview renders the image', preview.imgSrc);
      check(preview.rowHidden === true, 'attach row is replaced by the preview');

      await page.click('#bugSubmit');
      await page.waitForFunction(() => /Submitted|error|failed|try again/i.test(document.getElementById('bugStatus').textContent), { timeout: 10000 });
      const done = await page.evaluate(() => ({
        status: document.getElementById('bugStatus').textContent,
        statusClass: document.getElementById('bugStatus').className,
        calls: window.__fetchCalls.map((c) => ({ url: c.url, method: c.method, headers: c.headers, body: c.body })),
      }));
      check(/Submitted — reference FX-TESTREF/.test(done.status), 'success names the case reference', done.status);
      check(done.statusClass.includes('ok'), 'success is styled ok', done.statusClass);
      const casePost = done.calls.find((c) => c.url.endsWith('/v1/cases'));
      check(Boolean(casePost), 'a /v1/cases POST was made');
      const body = casePost ? JSON.parse(casePost.body) : {};
      check(body.type === 'bug' && typeof body.title === 'string', 'case body carries type + title');
      check(Boolean(body.screenshot && body.screenshot.data), 'case body carries the base64 screenshot');
      check(body.screenshot && Buffer.from(body.screenshot.data, 'base64').equals(TINY_PNG), 'screenshot bytes survive the base64 round trip byte-exact');
      check(/^Bearer a{64}$/.test(casePost.headers.Authorization || ''), 'bearer token attached');
      check(Boolean(casePost.headers['Idempotency-Key']), 'idempotency key attached');
      const reg = done.calls.find((c) => c.url.endsWith('/v1/principals'));
      check(Boolean(reg) && JSON.parse(reg.body).product === 'CHROME', 'install registered with a product code the service accepts');
      check(done.calls.every((c) => c.url.startsWith('https://1132-fixer-feedback-proxy-production.up.railway.app/')), 'every call targets the support origin');
      const consent = await page.evaluate(() => window.__calls.request);
      if (NAMESPACE === 'browser') {
        check(consent.length === 1 && JSON.stringify(consent[0]) === JSON.stringify({ data_collection: ['technicalAndInteraction'] }),
          'Firefox: data-collection consent requested exactly once, for technicalAndInteraction, on Submit', JSON.stringify(consent));
      } else {
        check(consent.length === 0, 'Chromium: no data-collection consent request is sent (no such API)', JSON.stringify(consent));
      }
      const disclosure = await page.evaluate(() => (document.getElementById('sendDisclosure') || {}).textContent || '');
      // The support reference is the persistent identifier ADR 0007 says
      // implicit consent cannot cover, and this page carries no link to the
      // privacy policy, so the disclosure has to name it before Submit.
      check(/description/.test(disclosure) && /screenshot/.test(disclosure) && /user-agent/.test(disclosure)
        && /version/.test(disclosure) && /support reference/.test(disclosure),
        'the form states exactly what Submit sends, including the support reference');
    });

    if (NAMESPACE === 'browser') {
      group('Firefox: data-collection consent refused -> nothing is sent');
      await withReportPage({ name: 'consent refused', grantOnRequest: false }, async (page) => {
        await page.fill('#bugText', 'The popup shows ERROR every time I press FIX ZOOM on my company Zoom page, nothing else happens.');
        await page.click('#bugSubmit');
        await page.waitForFunction(() => /Not sent/.test(document.getElementById('bugStatus').textContent), { timeout: 10000 });
        const s = await page.evaluate(() => ({
          calls: window.__fetchCalls.map((c) => c.url),
          request: window.__calls.request,
          disabled: document.getElementById('bugSubmit').disabled,
        }));
        check(s.calls.every((u) => u.endsWith('/health')), 'no /v1 request was made without consent', s.calls.join(' '));
        check(s.request.length === 1, 'consent was asked exactly once');
        check(s.disabled === false, 'Submit is re-enabled so the user can retry after granting');
      });
    }

    group('newer service advertises browser product codes -> this build registers with its own code');
    await withReportPage({ name: 'product codes', products: ['WINDOWS', 'CHROME', 'MACOS', 'EDGE', 'FIREFOX', 'BRAVE'] }, async (page) => {
      await page.fill('#bugText', 'The popup shows ERROR every time I press FIX ZOOM on my company Zoom page, nothing else happens.');
      await page.click('#bugSubmit');
      await page.waitForFunction(() => /Submitted|error|failed|try again|Not sent/i.test(document.getElementById('bugStatus').textContent), { timeout: 10000 });
      const reg = await page.evaluate(() => { const c = window.__fetchCalls.find((x) => x.url.endsWith('/v1/principals')); return c ? JSON.parse(c.body).product : null; });
      const expected = { chrome: 'CHROME', edge: 'EDGE', brave: 'BRAVE', firefox: 'FIREFOX' }[TARGET];
      check(reg === expected, `registered as ${expected} for the ${TARGET} build`, String(reg));
    });

    // A service that answers /health with a products value that is not an
    // array must not break registration. report.ts guards this with
    // Array.isArray before productCodeFor ever sees it; without that guard the
    // page would throw on .includes and the report would be lost.
    group('malformed capabilities.products -> falls back to CHROME, no page error');
    await withReportPage({ name: 'malformed products', products: { CHROME: true, FIREFOX: true } }, async (page) => {
      await page.fill('#bugText', 'The popup shows ERROR every time I press FIX ZOOM on my company Zoom page, nothing else happens.');
      await page.click('#bugSubmit');
      await page.waitForFunction(() => /Submitted|error|failed|try again|Not sent/i.test(document.getElementById('bugStatus').textContent), { timeout: 10000 });
      const reg = await page.evaluate(() => { const c = window.__fetchCalls.find((x) => x.url.endsWith('/v1/principals')); return c ? JSON.parse(c.body).product : null; });
      check(reg === 'CHROME', 'a non-array products value falls back to CHROME', String(reg));
    });

    group('oversized image rejected client-side');
    await withReportPage({ name: 'big' }, async (page) => {
      const big = Buffer.alloc(5 * 1024 * 1024 + 1);
      TINY_PNG.copy(big, 0);
      await page.setInputFiles('#shotInput', { name: 'huge.png', mimeType: 'image/png', buffer: big });
      const shown = await page.waitForFunction(() => (document.getElementById('shotStatus').textContent || '').includes('5 MB'), undefined, { timeout: 5000 }).then(() => true, () => false);
      check(shown, 'oversized rejected with the truthful limit');
      check(await page.evaluate(() => document.getElementById('shotPreview').hidden), 'no preview for a rejected file');
      check(await page.evaluate(() => document.getElementById('shotInput').value === ''), 'rejected file clears the picker');
    });

    group('service failure on submit -> honest error, Submit re-enabled');
    await withReportPage({ name: 'submit fails', failCases: true }, async (page) => {
      await page.fill('#bugText', 'The popup shows ERROR every time I press FIX ZOOM on my company Zoom page, nothing else happens.');
      await page.click('#bugSubmit');
      await page.waitForFunction(() => /failed|error/i.test(document.getElementById('bugStatus').textContent), { timeout: 10000 });
      const s = await page.evaluate(() => ({
        status: document.getElementById('bugStatus').textContent,
        cls: document.getElementById('bugStatus').className,
        disabled: document.getElementById('bugSubmit').disabled,
        text: document.getElementById('bugText').value,
      }));
      check(/Submission failed/.test(s.status), 'failure copy shown', s.status);
      check(s.cls.includes('err'), 'failure styled as error');
      check(s.disabled === false, 'Submit is re-enabled for a retry');
      check(s.text.length > 50, 'typed report is preserved after a failure');
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
