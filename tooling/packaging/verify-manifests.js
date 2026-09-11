#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Validate the GENERATED manifests in dist/<target>/ against the invariants
 * this project promises, then run Mozilla's linter on the Firefox build.
 *
 *   node tooling/packaging/verify-manifests.js     (or: npm run verify:manifests)
 *
 * Invariants:
 *   1. Zoom-only host access, no <all_urls>, no broad patterns.
 *   2. Permissions are exactly cookies + activeTab + scripting. Nothing hidden
 *      runs: no background, no content_scripts, no alarms.
 *   3. MV3, minimal content security policy, no remote code.
 *   4. Every referenced file exists in the build.
 *   5. Firefox ships a Gecko id, strict_min_version >= 128, and the AMO
 *      data-collection declaration; Chromium targets keep minimum_chrome_version.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const T = require('../build/targets');

let failed = 0;
let passed = 0;
function pass(name) { passed++; console.log(`  PASS  ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
function check(ok, name, detail) { (ok ? pass : fail)(name, detail); }
function group(title) { console.log('\n' + title); }

const ALLOWED_PERMS = ['cookies', 'activeTab', 'scripting'];
const ALLOWED_HOSTS = [
  'https://*.zoom.us/*',
  'https://*.zoom.com/*',
  'http://*.zoom.us/*',
  'http://*.zoom.com/*',
];
const BANNED_PERMS = ['browsingData', 'tabs', 'storage', 'webRequest', 'webRequestBlocking', 'history', 'alarms', 'identity', 'notifications', 'management', 'nativeMessaging', 'declarativeNetRequest', '<all_urls>'];
const MIN_CSP = "script-src 'self'; object-src 'self';";

for (const id of T.EXTENSION_TARGET_IDS) {
  const target = T.TARGETS[id];
  const dir = path.join(T.DIST_DIR, id);
  group(`${id} (dist/${id}/manifest.json)`);
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) { fail('built manifest exists', 'run npm run build'); continue; }
  let m;
  try { m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); pass('parses as JSON'); } catch (e) { fail('parses as JSON', e.message); continue; }

  check(m.manifest_version === 3, 'manifest_version is 3', String(m.manifest_version));
  for (const k of ['name', 'version', 'description', 'icons', 'action', 'permissions', 'host_permissions', 'content_security_policy']) {
    check(k in m, `has "${k}"`);
  }
  check(typeof m.name === 'string' && m.name.length <= 75, 'name is <= 75 chars');
  check(typeof m.description === 'string' && m.description.length <= 132, `description is <= 132 chars (${(m.description || '').length})`);
  check(/^\d+\.\d+\.\d+$/.test(m.version), 'version is x.y.z', m.version);
  check(m.version === T.packageVersion(), 'version matches package.json', m.version);

  const perms = m.permissions || [];
  check(perms.length === ALLOWED_PERMS.length && ALLOWED_PERMS.every((p) => perms.includes(p)), `permissions are exactly [${ALLOWED_PERMS.join(', ')}]`, perms.join(', '));
  for (const b of BANNED_PERMS) check(!perms.includes(b), `permissions do not include "${b}"`);
  check(!m.optional_permissions && !m.optional_host_permissions, 'no optional permissions are declared');

  const hosts = m.host_permissions || [];
  check(hosts.length === ALLOWED_HOSTS.length && ALLOWED_HOSTS.every((h) => hosts.includes(h)), 'host_permissions are exactly the four Zoom patterns', hosts.join(', '));
  check(!hosts.some((h) => /^(\*|https?):\/\/(\*\/|\*$)/.test(h) || h === '<all_urls>'), 'no broad host pattern');

  check(!m.background, 'no background / service worker');
  check(!m.content_scripts, 'no content_scripts');
  check(!m.web_accessible_resources, 'no web_accessible_resources');
  check(!m.externally_connectable, 'no externally_connectable');
  check(!m.sandbox, 'no sandbox pages');
  check(!m.update_url, 'no update_url (stores own updates)');
  check(m.content_security_policy && m.content_security_policy.extension_pages === MIN_CSP, `extension_pages CSP is "${MIN_CSP}"`, JSON.stringify(m.content_security_policy));

  const popup = m.action && m.action.default_popup;
  check(!!popup && fs.existsSync(path.join(dir, popup)), `action.default_popup exists: ${popup}`);
  for (const size of ['16', '32', '48', '128']) {
    const p = m.icons && m.icons[size];
    check(!!p && fs.existsSync(path.join(dir, p)), `icons.${size} exists: ${p}`);
    const a = m.action && m.action.default_icon && m.action.default_icon[size];
    check(!!a && fs.existsSync(path.join(dir, a)), `action.default_icon.${size} exists: ${a}`);
  }

  if (target.family === 'gecko') {
    const g = m.browser_specific_settings && m.browser_specific_settings.gecko;
    check(!!g, 'firefox: browser_specific_settings.gecko present');
    check(!!g && /^[a-zA-Z0-9-._]*@[a-zA-Z0-9-._]+$/.test(g.id), 'firefox: gecko.id has the AMO id format', g && g.id);
    check(!!g && Number(g.strict_min_version) >= 128, 'firefox: strict_min_version >= 128.0 (indexedDB.databases needs 126+; 128 is ESR)', g && g.strict_min_version);
    check(!!g && g.data_collection_permissions && JSON.stringify(g.data_collection_permissions.required) === '["none"]', 'firefox: data_collection_permissions.required is ["none"]');
    check(!('minimum_chrome_version' in m), 'firefox: no minimum_chrome_version');
  } else {
    check(typeof m.minimum_chrome_version === 'string', 'chromium: minimum_chrome_version present', m.minimum_chrome_version);
    check(!m.browser_specific_settings, 'chromium: no browser_specific_settings');
  }
}

group('web-ext lint (Mozilla addons-linter) on dist/firefox');
{
  const firefoxDir = path.join(T.DIST_DIR, 'firefox');
  const webExt = path.join(T.ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'web-ext.cmd' : 'web-ext');
  if (!fs.existsSync(firefoxDir)) {
    fail('dist/firefox exists', 'run npm run build:firefox');
  } else if (!fs.existsSync(webExt)) {
    fail('web-ext is installed', 'run npm ci');
  } else {
    const r = spawnSync(webExt, ['lint', '--source-dir', firefoxDir, '--no-input', '--output', 'json'], {
      cwd: T.ROOT, encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true,
    });
    let report = null;
    try { report = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); } catch { /* fall through */ }
    if (!report) {
      fail('web-ext lint produced a JSON report', (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | '));
    } else {
      const errors = report.errors || [];
      const warnings = report.warnings || [];
      check(errors.length === 0, `web-ext lint reports 0 errors (${errors.length})`, errors.map((e) => e.code + ': ' + e.message).join(' | '));
      console.log(`        warnings: ${warnings.length}${warnings.length ? ' — ' + warnings.map((w) => w.code).join(', ') : ''}`);
      check(r.status === 0, 'web-ext lint exit code is 0', String(r.status));
    }
  }
}

console.log('');
console.log(`Passed: ${passed}  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
