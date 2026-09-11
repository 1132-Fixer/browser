#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Prove each release zip is what it claims to be.
 *
 *   node tooling/packaging/verify-packages.js        (or: npm run verify:packages)
 *
 * Reads release/<target>/<stem>-<version>.zip for every target and checks:
 * inventory, manifest identity per target, no forbidden files, no source
 * maps or dev endpoints inside the bundles, Chrome-only claims stay on the
 * Chrome package, Firefox carries its own Gecko identity, packages differ,
 * and SHA256SUMS.txt matches. Does not publish. Does not load zips in a
 * browser (that is tests/end-to-end).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const T = require('../build/targets');
const { readZipEntries } = require('../lib/zip');
const { zipPathFor, FORBIDDEN_ENTRY } = require('./package');

let failed = 0;
let passed = 0;
function pass(name) { passed++; console.log(`  PASS  ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
function check(ok, name, detail) { (ok ? pass : fail)(name, detail); }
function group(title) { console.log('\n' + title); }

const version = T.packageVersion();
const MAX_BYTES = 2 * 1024 * 1024;
const DEV_ENDPOINT = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|\.local\b|ngrok|staging)\b/i;

const zips = {};
group('release zips exist');
for (const id of T.ALL_TARGET_IDS) {
  const p = zipPathFor(T.TARGETS[id], version);
  if (fs.existsSync(p) && fs.statSync(p).size > 0) {
    zips[id] = fs.readFileSync(p);
    pass(`${id}: ${path.relative(T.ROOT, p)} (${zips[id].length} bytes)`);
    check(zips[id].length <= MAX_BYTES, `${id}: zip is under ${MAX_BYTES} bytes`);
  } else {
    fail(`${id}: zip exists`, path.relative(T.ROOT, p) + ' (run npm run package)');
  }
}

group('extension package inventory and manifest identity');
const manifests = {};
for (const id of T.EXTENSION_TARGET_IDS) {
  if (!zips[id]) continue;
  const entries = readZipEntries(zips[id]);
  const names = Object.keys(entries);
  check(names[0] === 'manifest.json', `${id}: manifest.json is the first entry`, names[0]);
  const missing = T.EXTENSION_PACKAGE_ENTRIES.filter((e) => !entries[e]);
  const extra = names.filter((n) => !T.EXTENSION_PACKAGE_ENTRIES.includes(n));
  check(missing.length === 0 && extra.length === 0, `${id}: inventory is exactly the ${T.EXTENSION_PACKAGE_ENTRIES.length} expected entries`,
    `missing [${missing.join(', ')}] extra [${extra.join(', ')}]`);
  for (const n of names) {
    const hit = FORBIDDEN_ENTRY.find(({ re }) => re.test(n));
    if (hit) fail(`${id}: forbidden entry ${n}`, hit.why);
  }

  let m;
  try {
    m = JSON.parse(entries['manifest.json'].toString('utf8'));
    manifests[id] = m;
    pass(`${id}: manifest parses`);
  } catch (e) {
    fail(`${id}: manifest parses`, e.message);
    continue;
  }
  const expected = T.manifestFor(id);
  check(JSON.stringify(m) === JSON.stringify(expected), `${id}: packaged manifest equals base+overlay composition`);
  check(m.version === version, `${id}: version is ${version}`, m.version);
  if (id === 'chrome') {
    check(entries['manifest.json'].equals(fs.readFileSync(path.join(T.ROOT, T.BASE_MANIFEST))), 'chrome: ships the base manifest bytes verbatim');
  }

  for (const js of ['popup.js', 'report.js']) {
    const src = entries[js].toString('utf8');
    check(!/sourceMappingURL/.test(src), `${id}: ${js} has no source map reference`);
    check(!DEV_ENDPOINT.test(src), `${id}: ${js} has no development endpoint`, (src.match(DEV_ENDPOINT) || [])[0]);
    check(!/\beval\s*\(|new\s+Function\s*\(/.test(src), `${id}: ${js} has no eval / new Function`);
  }
  check(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(entries['popup.js'].toString('utf8')), `${id}: popup.js makes no network calls`);
  const readme = entries['README.md'].toString('utf8');
  check(readme.length > 200 && /1132 Fixer/.test(readme), `${id}: README.md is the target README`);
}

group('Chrome-only claims stay on the Chrome package; Firefox has its own identity');
if (manifests.chrome) {
  check(/\bChrome\b/.test(manifests.chrome.name) && /\bChrome\b/.test(manifests.chrome.description), 'chrome: package claims Chrome');
  check(!manifests.chrome.browser_specific_settings, 'chrome: no gecko settings');
  check(typeof manifests.chrome.minimum_chrome_version === 'string', 'chrome: keeps minimum_chrome_version');
}
for (const id of ['edge', 'brave', 'firefox']) {
  const m = manifests[id];
  if (!m) continue;
  check(!/\bChrome\b/.test(m.name + ' ' + m.description), `${id}: no Chrome-only claim`, m.name + ' / ' + m.description);
}
if (manifests.firefox) {
  const g = manifests.firefox.browser_specific_settings && manifests.firefox.browser_specific_settings.gecko;
  check(!!g && /^[^@]+@[^@]+$/.test(g.id), 'firefox: gecko id is set', JSON.stringify(g));
  check(!!g && /^\d+\.\d+$/.test(g.strict_min_version) && Number(g.strict_min_version) >= 128, 'firefox: strict_min_version >= 128.0', g && g.strict_min_version);
  check(!!g && g.data_collection_permissions && JSON.stringify(g.data_collection_permissions.required) === '["none"]', 'firefox: declares data_collection_permissions.required = ["none"]');
  check(!('minimum_chrome_version' in manifests.firefox), 'firefox: no minimum_chrome_version');
}
for (const id of ['edge', 'brave']) {
  if (manifests[id]) check(!manifests[id].browser_specific_settings, `${id}: no gecko settings (Chromium family)`);
}

group('packages are distinct');
const seen = new Map();
for (const id of Object.keys(zips)) {
  const h = crypto.createHash('sha256').update(zips[id]).digest('hex');
  check(!seen.has(h), `${id}: zip bytes differ from every other target`, seen.get(h));
  seen.set(h, id);
}

group('BRAVIA package');
if (zips.bravia) {
  const entries = readZipEntries(zips.bravia);
  for (const f of T.TV_FILES) check(!!entries[f], `bravia: contains ${f}`);
  const launcher = entries['sony/apps/webapps/1132-fixer/app/manifest.json'];
  if (launcher) {
    const l = JSON.parse(launcher.toString('utf8'));
    check(l.version === version, `bravia: Sony launcher manifest version is ${version}`, l.version);
    check(/^https:\/\//.test(l.app && l.app.launch && l.app.launch.web_url), 'bravia: launcher web_url is https', l.app && l.app.launch && l.app.launch.web_url);
    const autorun = JSON.parse(entries['sony/autorun.txt'].toString('utf8'));
    check(autorun.auid === l.auid, 'bravia: autorun.txt auid matches launcher manifest auid');
  }
  const html = entries['index.html'] ? entries['index.html'].toString('utf8') : '';
  check(!/<script(?![^>]*\bsrc=)/i.test(html), 'bravia: no inline script');
  check(!/https?:\/\/(?!1132-fixer\.xyz|github\.com\/1132-Fixer|www\.w3\.org)/.test(html), 'bravia: only project links');
}

group('SHA256SUMS.txt');
{
  const sumsPath = path.join(T.RELEASE_DIR, 'SHA256SUMS.txt');
  if (!fs.existsSync(sumsPath)) {
    fail('SHA256SUMS.txt exists', 'run npm run package (all targets) to write it');
  } else {
    const lines = fs.readFileSync(sumsPath, 'utf8').trim().split('\n');
    for (const line of lines) {
      const [sum, rel] = line.split(/\s+/);
      const file = path.join(T.RELEASE_DIR, rel);
      const actual = fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
      check(actual === sum, `checksum matches: ${rel}`);
    }
  }
}

console.log('');
console.log(`Passed: ${passed}  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
