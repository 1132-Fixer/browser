#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Source-level guards for the 1132 Fixer workspace. This is `npm run lint`.
 *
 * It defends the invariants no type-checker can express:
 *   1. Zoom-only: manifest hosts, overlay scope, ZOOM_ORIGIN_PATTERNS agree.
 *   2. One browser boundary: only packages/browser-api touches chrome.* /
 *      browser.*, through an explicit allowlist; core and UI never do.
 *   3. User-triggered only: init() never cleans, injects, reloads, or asks
 *      for permissions; FIX ZOOM is wired to one click handler.
 *   4. No telemetry, no remote code, no eval, no secrets in the tree.
 *   5. One-button popup with no inputs.
 *   6. Approved product claim only (1132-Fixer/browser#20 ruling).
 *   7. Every copy of the version agrees.
 *
 * Exits non-zero if any check fails. No build required.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const T = require('../../tooling/build/targets');

const ROOT = T.ROOT;
let failed = 0;
let passed = 0;
function pass(name) { passed++; console.log(`  PASS  ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
function check(ok, name, detail) { (ok ? pass : fail)(name, detail); }
function group(title) { console.log('\n' + title); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

/**
 * Source with comments removed, so guards match code rather than prose about
 * the code. String-aware: a `//` or `/*` inside a string literal (host
 * patterns such as 'https://*.zoom.us/*') is kept, and quotes inside comments
 * do not open strings. Regex literals are not tracked; none in this tree
 * contains a quote or a comment marker.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\') j++;
        if (quote !== '`' && src[j] === '\n') break;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      // Keep line structure so line-based regexes still see the same layout.
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function codeOf(rel) {
  return stripComments(read(rel));
}

function listFiles(dirRel, re) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = path.posix.join(d, e.name);
      if (e.isDirectory()) walk(rel);
      else if (re.test(e.name)) out.push(rel);
    }
  };
  walk(dirRel);
  return out.sort();
}

// --- 1. Versions --------------------------------------------------------
group('version consistency');
{
  const v = T.packageVersion();
  check(T.baseManifest().version === v, `base manifest version is ${v}`);
  const lock = T.readJson('package-lock.json');
  check(lock.version === v && lock.packages[''].version === v, 'package-lock.json root version matches');
  for (const page of ['packages/ui/src/popup.html', 'packages/ui/src/report.html']) {
    const chip = read(page).match(/id="appVersion"[^>]*>v([0-9.]+)</);
    check(!!chip && chip[1] === v, `${page} version chip is v${v}`, chip && chip[1]);
  }
  const launcher = T.readJson('apps/tv/bravia/sony/apps/webapps/1132-fixer/app/manifest.json');
  check(launcher.version === v, 'BRAVIA launcher manifest version matches');
}

// --- 2. Manifest source and overlays ------------------------------------
group('manifest source: Zoom-only, minimal permissions, overlays touch identity only');
{
  const base = T.baseManifest();
  const ALLOWED_PERMS = ['cookies', 'activeTab', 'scripting'];
  const ALLOWED_HOSTS = ['https://*.zoom.us/*', 'https://*.zoom.com/*', 'http://*.zoom.us/*', 'http://*.zoom.com/*'];
  check(base.manifest_version === 3, 'manifest_version is 3');
  check(JSON.stringify([...base.permissions].sort()) === JSON.stringify([...ALLOWED_PERMS].sort()), 'permissions are exactly cookies, activeTab, scripting', base.permissions.join(', '));
  check(JSON.stringify([...base.host_permissions].sort()) === JSON.stringify([...ALLOWED_HOSTS].sort()), 'host_permissions are exactly the four Zoom patterns');
  check(!base.background && !base.content_scripts && !base.optional_permissions && !base.optional_host_permissions, 'no background, content_scripts, or optional permissions');
  check(base.content_security_policy && base.content_security_policy.extension_pages === "script-src 'self'; object-src 'self';", 'minimal extension_pages CSP');

  const OVERLAY_SET_KEYS = new Set(['name', 'description', 'browser_specific_settings']);
  const OVERLAY_DELETE_KEYS = new Set(['minimum_chrome_version']);
  for (const id of T.EXTENSION_TARGET_IDS) {
    if (id === 'chrome') continue;
    const o = T.overlayFor(id);
    const badSet = Object.keys(o.set || {}).filter((k) => !OVERLAY_SET_KEYS.has(k));
    const badDel = (o.delete || []).filter((k) => !OVERLAY_DELETE_KEYS.has(k));
    check(badSet.length === 0 && badDel.length === 0, `${id} overlay changes identity keys only`, [...badSet, ...badDel].join(', '));
  }

  const zoomHosts = codeOf('packages/core/src/zoom-hosts.ts');
  const patterns = [...((zoomHosts.match(/ZOOM_ORIGIN_PATTERNS[^=]*=\s*\[([^\]]*)\]/) || [])[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  check(JSON.stringify(patterns) === JSON.stringify([...ALLOWED_HOSTS].sort()), 'ZOOM_ORIGIN_PATTERNS equal the manifest host_permissions', patterns.join(', '));
}

// --- 3. One browser boundary --------------------------------------------
group('browser boundary: core and UI never touch chrome.* / browser.*');
const NS_RE = /\b(chrome|browser|globalThis\.chrome|globalThis\.browser|window\.chrome|window\.browser)\s*\.\s*[a-zA-Z]/;
for (const f of [...listFiles('packages/core/src', /\.ts$/), 'packages/ui/src/popup.ts', 'packages/ui/src/report.ts', 'packages/ui/src/report-helpers.ts', 'packages/platform-types/src/index.ts']) {
  const m = codeOf(f).match(NS_RE);
  check(!m, `${f} has no direct WebExtension namespace access`, m && m[0]);
}
{
  const adapter = codeOf('packages/browser-api/src/index.ts');
  const ALLOWED_CALLS = new Set([
    'runtime.getManifest', 'runtime.getBrowserInfo',
    'tabs.query', 'tabs.reload',
    'cookies.getAll', 'cookies.remove',
    'scripting.executeScript',
    'permissions.contains', 'permissions.request',
  ]);
  const used = [...adapter.matchAll(/\bns\.([a-zA-Z]+)\.([a-zA-Z]+)/g)].map((m) => `${m[1]}.${m[2]}`);
  const notAllowed = [...new Set(used)].filter((u) => !ALLOWED_CALLS.has(u));
  check(notAllowed.length === 0, `adapter uses only the allowlisted API surface (${[...ALLOWED_CALLS].join(', ')})`, notAllowed.join(', '));
  const destructive = adapter.match(/\bns\.\w+\.(remove|clear|delete|removeAll|set|update)\w*\s*\(/g) || [];
  check(destructive.length === 1 && /cookies\.remove/.test(destructive[0]), 'the only destructive namespace call is cookies.remove', destructive.join(', ') || 'none');
  check((adapter.match(/executeScript\s*\(/g) || []).length === 1, 'scripting.executeScript is called from exactly one site');
  check(!/navigator\.userAgent|userAgentData/.test(adapter), 'adapter never sniffs the user agent');
}
const SHIPPED_PACKAGES = ['packages/core/src', 'packages/browser-api/src', 'packages/ui/src', 'packages/platform-types/src'];
for (const f of SHIPPED_PACKAGES.flatMap((d) => listFiles(d, /\.(ts|js)$/))) {
  const code = codeOf(f);
  for (const [re, label] of [
    [/onInstalled|onStartup/, 'install/startup hooks'],
    [/\balarms\b/, 'alarms'],
    [/tabs\.onUpdated|webNavigation/, 'navigation auto-clear hooks'],
    [/browsingData/, 'browsingData'],
    [/serviceWorker/i, 'service workers'],
    [/\beval\s*\(|new\s+Function\s*\(/, 'eval / new Function'],
    [/\bXMLHttpRequest\b|\bWebSocket\b|sendBeacon/, 'XHR / WebSocket / sendBeacon'],
    [/\b(gtag|googletag|amplitude|mixpanel|posthog|hotjar|sentry)\b/i, 'analytics / telemetry'],
    [/innerHTML|outerHTML|insertAdjacentHTML|document\.write/, 'HTML injection sinks'],
  ]) {
    if (re.test(code)) fail(`${f} contains no ${label}`);
  }
}
pass('shipped packages scanned for install hooks, alarms, browsingData, eval, XHR, telemetry, HTML sinks');

// --- 4. User-triggered only ---------------------------------------------
group('popup: nothing runs before FIX ZOOM');
{
  const popup = codeOf('packages/ui/src/popup.ts');
  check(!/\bfetch\s*\(/.test(popup), 'popup.ts has no fetch(');
  check(/zoomFixBtn\.addEventListener\(\s*'click'\s*,\s*runZoomFix\s*\)/.test(popup), 'FIX ZOOM click is wired to runZoomFix');
  const initBody = (popup.match(/async function init\s*\([^)]*\)[^{]*{([\s\S]*?)\n}/) || [])[1] || '';
  check(initBody.length > 0, 'init() found');
  for (const [re, label] of [
    [/clearZoomCookies|clearCookiesForHost|cookies\.remove/, 'cookie removal'],
    [/runInTab|clearZoomOriginStorageForTab|executeScript/, 'script injection'],
    [/reloadTab|reloadActiveTabIfZoom/, 'tab reload'],
    [/runZoomFix\s*\(/, 'runZoomFix'],
    [/requestHostAccess/, 'permission prompts'],
  ]) check(!re.test(initBody), `init() never performs ${label}`);
  const runBody = (popup.match(/async function runZoomFix\s*\([^)]*\)[^{]*{([\s\S]*?)\n}/) || [])[1] || '';
  check(runBody.length > 0, 'runZoomFix() found');
  const reqIdx = runBody.indexOf('requestHostAccess');
  const awaitIdx = runBody.indexOf('await ');
  check(reqIdx >= 0 && awaitIdx >= 0 && reqIdx < awaitIdx, 'runZoomFix issues requestHostAccess before its first await (Firefox user-input rule)');
  check(/clearZoomCookies\(api\.cookies\)/.test(runBody) && /clearZoomOriginStorageForTab/.test(runBody), 'runZoomFix performs the cookie clear and the origin storage clear');
}

// --- 5. Report page network pin -----------------------------------------
group('report page: one origin, user-initiated');
{
  const report = codeOf('packages/ui/src/report.ts');
  const helpers = read('packages/ui/src/report-helpers.ts');
  const fetches = [...report.matchAll(/\bfetch\s*\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  check(fetches.length > 0 && fetches.every((f) => f.startsWith('SUPPORT_ORIGIN')), 'every fetch() goes through SUPPORT_ORIGIN', fetches.join(' | '));
  check(/export const SUPPORT_ORIGIN = 'https:\/\/[^'\s/]+';/.test(helpers), 'SUPPORT_ORIGIN is a single https literal');
  const urls = (report.match(/https?:\/\/[^\s"'`)]+/gi) || []);
  check(urls.length === 0, 'report.ts carries no other URL literal', urls.join(', '));
  const ls = [...report.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([^),]+)/g)].map((m) => m[1].trim());
  check(ls.length > 0 && ls.every((a) => a === 'PRINCIPAL_KEY'), 'localStorage use is limited to PRINCIPAL_KEY', ls.join(', '));
}

// --- 6. HTML surfaces ---------------------------------------------------
group('HTML: no inline script, no inline handlers, approved links only');
const STATIC_LINKS = new Set(['https://1132-fixer.xyz/', 'https://github.com/1132-Fixer/browser/issues/new']);
for (const f of ['packages/ui/src/popup.html', 'packages/ui/src/report.html', 'apps/tv/bravia/index.html']) {
  const html = read(f);
  check(!/<script(?![^>]*\bsrc=)/i.test(html), `${f} has no inline <script>`);
  check(!/\son[a-z]+\s*=\s*["']/i.test(html), `${f} has no inline event handler attributes`);
  const urls = (html.match(/https?:\/\/[^\s"')<]+/gi) || []).filter((u) => !STATIC_LINKS.has(u));
  check(urls.length === 0, `${f} links only to approved static destinations`, urls.join(', '));
  check(!/<link[^>]+href="https?:|<script[^>]+src="https?:|@import\s+url\(\s*['"]?https?:/i.test(html), `${f} loads no remote script or stylesheet`);
}
{
  const popupHtml = read('packages/ui/src/popup.html');
  check((popupHtml.match(/<button\b/gi) || []).length === 1, 'popup has exactly one <button>');
  check(/id="zoomFixBtn"[^>]*>FIX ZOOM</.test(popupHtml) || /id="zoomFixBtn"[\s\S]*?>FIX ZOOM</.test(popupHtml), 'the one button is #zoomFixBtn labelled FIX ZOOM');
  check(!/<input\b|<select\b|<textarea\b/i.test(popupHtml), 'popup has no inputs, selects, or textareas');
  check(/<script src="popup\.js">/.test(popupHtml), 'popup.html loads the bundled popup.js');
}

// --- 7. Claim regression ------------------------------------------------
group('approved product claim only (1132-Fixer/browser#20 ruling)');
{
  const REJECTED = /One-click fix for Zoom Error 1132/i;
  const surfaces = [
    'README.md', 'index.md', '_config.yml', 'PRIVACY_POLICY.md', 'SUPPORT.md',
    'packages/ui/src/popup.html', 'packages/ui/src/report.html', 'packages/core/src/outcome.ts',
    'apps/tv/bravia/index.html', 'docs/release/chrome-web-store-listing.md',
    ...T.EXTENSION_TARGET_IDS.map((id) => `apps/extensions/${id}/README.md`),
    ...T.EXTENSION_TARGET_IDS.filter((id) => id !== 'chrome').map((id) => `apps/extensions/${id}/manifest.overlay.json`),
    T.BASE_MANIFEST,
  ];
  for (const f of surfaces) {
    if (!exists(f)) { fail(`${f} exists`); continue; }
    check(!REJECTED.test(read(f)), `${f} does not carry the rejected claim`);
  }
}

// --- 8. GitHub Pages assets ---------------------------------------------
group('Pages layout: every referenced asset is published');
{
  // `_layouts/default.html` renders index.md and PRIVACY_POLICY.md, and the
  // privacy URL is the one store listings point at. A path that _config.yml
  // excludes is a permanent 404 on the live site with no build error, which is
  // how `/icons/icon128.png` shipped broken: the icons live under `packages/`,
  // and `packages` is excluded from the Jekyll build.
  const config = read('_config.yml');
  const excluded = config
    .split(/\r?\n/)
    .map((l) => /^\s*-\s+(.+?)\s*$/.exec(l))
    .filter(Boolean)
    .map((m) => m[1])
    .filter((v) => !v.endsWith('.md') || v !== 'PRIVACY_POLICY.md');

  const layout = read('_layouts/default.html');
  const refs = [...layout.matchAll(/'(\/[^']+)'\s*\|\s*(?:relative_url|absolute_url)/g)].map((m) => m[1]);
  check(refs.length > 0, 'default.html references at least one site asset');

  for (const ref of refs) {
    const rel = ref.replace(/^\//, '');
    if (rel === '' || rel.endsWith('.html') || rel.endsWith('/')) continue; // pages, not assets
    const onDisk = exists(rel);
    const blocked = excluded.find((e) => rel === e || rel.startsWith(e.replace(/\/$/, '') + '/'));
    check(onDisk && !blocked, `${ref} is published`,
      !onDisk ? 'no such file in the repository' : `_config.yml excludes "${blocked}"`);
  }
}

// --- 9. Secrets and strictness scan across tracked files ----------------
group('tracked files: no secrets, no TypeScript escape hatches');
{
  let tracked = [];
  try {
    tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch {
    fail('git ls-files available');
  }
  const SECRET_PATTERNS = [
    [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
    [/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/, 'private key'],
    [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
    [/\bya29\.[A-Za-z0-9_-]{20,}/, 'Google OAuth access token'],
    [/\bsk-[A-Za-z0-9]{32,}/, 'API secret key'],
    [/(client_secret|refresh_token|api[_-]?key|password)\s*[:=]\s*['"][A-Za-z0-9_\-/.+]{16,}['"]/i, 'inline credential'],
  ];
  let scanned = 0;
  for (const f of tracked) {
    if (/\.(png|jpg|jpeg|gif|webp|ico|svg|zip|woff2?)$/i.test(f) || f.startsWith('design-system/')) continue;
    let txt;
    try { txt = read(f); } catch { continue; }
    scanned++;
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(txt)) fail(`${f} contains no ${label}`);
    }
    if (/\.ts$/.test(f) && /@ts-ignore|@ts-nocheck|\bas any\b|:\s*any\b/.test(txt)) fail(`${f} uses no TypeScript escape hatch`);
  }
  pass(`${scanned} tracked text files scanned for credentials and TypeScript escape hatches`);
}

console.log('');
console.log(`Passed: ${passed}  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
