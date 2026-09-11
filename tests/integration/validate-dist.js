#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Integration checks on the BUILT output in dist/<target>/.
 *
 *   node tests/integration/validate-dist.js     (npm run test:integration)
 *
 * The build is what browsers load and what the packager zips, so the
 * cross-file promises are checked here rather than on the sources:
 *   - every asset the pages reference exists in the build;
 *   - bundles are plain scripts (no imports, no source maps), the popup
 *     bundle makes no network call, the report bundle pins its one origin;
 *   - the injected cleaner survived bundling self-contained;
 *   - shipped documents and icons are byte-identical to their sources;
 *   - the TV client is complete.
 */

const fs = require('fs');
const path = require('path');
const T = require('../../tooling/build/targets');

let failed = 0;
let passed = 0;
function pass(name) { passed++; console.log(`  PASS  ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
function check(ok, name, detail) { (ok ? pass : fail)(name, detail); }
function group(title) { console.log('\n' + title); }

function same(relA, absB) {
  return fs.readFileSync(path.join(T.ROOT, relA)).equals(fs.readFileSync(absB));
}

for (const id of T.EXTENSION_TARGET_IDS) {
  const dir = path.join(T.DIST_DIR, id);
  group(`dist/${id}`);
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) { fail('built', 'run npm run build'); continue; }
  const at = (rel) => path.join(dir, rel);
  const text = (rel) => fs.readFileSync(at(rel), 'utf8');

  for (const page of ['popup.html', 'report.html']) {
    const html = text(page);
    const refs = [
      ...[...html.matchAll(/<link[^>]+href="([^"]+)"/gi)].map((m) => m[1]),
      ...[...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((m) => m[1]),
      ...[...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]),
    ];
    for (const r of refs) check(fs.existsSync(at(r)), `${page} references an existing file: ${r}`);
    check(!/<script(?![^>]*\bsrc=)/i.test(html), `${page} has no inline <script>`);
    check(!/\son[a-z]+\s*=\s*["']/i.test(html), `${page} has no inline handlers`);
    const js = page.replace('.html', '.js');
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    const used = [...text(js).matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
    const missing = used.filter((u) => !ids.has(u));
    check(missing.length === 0, `${js} only looks up ids that exist in ${page}`, missing.join(', '));
  }

  for (const js of ['popup.js', 'report.js']) {
    const src = text(js);
    check(!/^\s*import\s|\brequire\s*\(/m.test(src), `${js} is a plain script (no import/require)`);
    check(!/sourceMappingURL/.test(src), `${js} has no source map`);
    check(!/__TARGET__/.test(src), `${js} has the build target substituted`);
    check(/1132 Fixer .* build\. Source: https:\/\/github\.com\/1132-Fixer\/chrome/.test(src), `${js} carries the source banner`);
    check(!/\beval\s*\(|new\s+Function\s*\(/.test(src), `${js} has no eval`);
  }
  {
    const popup = text('popup.js');
    check(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(popup), 'popup.js makes no network calls');
    check(/async function clearZoomOriginPageData\(\)/.test(popup) && /not-zoom-origin/.test(popup), 'popup.js contains the self-contained in-page cleaner');
    check(/permissions\.contains|permissions\.request/.test(popup) && /getBrowserInfo/.test(popup), 'popup.js includes the host-access and Gecko detection paths');
    check(!/\bChrome would not/.test(popup), 'popup.js has no Chrome-specific outcome copy');
    const report = text('report.js');
    const fetches = [...report.matchAll(/\bfetch\s*\(\s*([^,)]+)/g)].map((m) => m[1].trim());
    check(fetches.length > 0 && fetches.every((f) => /^SUPPORT_ORIGIN\b/.test(f)), 'report.js fetches only SUPPORT_ORIGIN + path', fetches.join(' | '));
    const reportCode = report.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const origins = [...new Set((reportCode.match(/https?:\/\/[^\s"'`)]+/gi) || []))];
    check(origins.length === 1 && /1132-fixer-feedback-proxy-production\.up\.railway\.app$/.test(origins[0]), 'report.js carries exactly one network origin', origins.join(', '));
  }

  for (const rel of T.UI_STATIC_FILES) check(same(path.posix.join(T.UI_SRC, rel), at(rel)), `${rel} is byte-identical to the source`);
  for (const rel of T.SHIPPED_ROOT_DOCS) check(same(rel, at(rel)), `${rel} is byte-identical to the repo root copy`);
  check(same(`${T.TARGETS[id].appDir}/README.md`, at('README.md')), 'README.md is the target README');
  const files = require('../../tooling/lib/zip').listFilesRecursive(dir);
  const extra = files.filter((f) => !T.EXTENSION_PACKAGE_ENTRIES.includes(f));
  const missing = T.EXTENSION_PACKAGE_ENTRIES.filter((e) => !files.includes(e));
  check(extra.length === 0 && missing.length === 0, `dist/${id} contains exactly the ${T.EXTENSION_PACKAGE_ENTRIES.length} package entries`, `extra [${extra}] missing [${missing}]`);
}

group('dist/bravia');
{
  const dir = path.join(T.DIST_DIR, 'bravia');
  if (!fs.existsSync(path.join(dir, 'index.html'))) {
    fail('built', 'run npm run build:bravia');
  } else {
    for (const rel of T.TV_FILES) check(fs.existsSync(path.join(dir, rel)), `contains ${rel}`);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    for (const r of [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1])) {
      check(fs.existsSync(path.join(dir, r)), `index.html references an existing file: ${r}`);
    }
    check(!/<img\b/i.test(html), 'TV client ships no raster brand asset (text-only wordmark)');
    const js = fs.readFileSync(path.join(dir, 'tv.js'), 'utf8');
    check(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB/.test(js), 'tv.js makes no network call and stores nothing');
    const launcher = JSON.parse(fs.readFileSync(path.join(dir, 'sony/apps/webapps/1132-fixer/app/manifest.json'), 'utf8'));
    check(launcher.version === T.packageVersion(), 'Sony launcher manifest carries the workspace version', launcher.version);
  }
}

console.log('');
console.log(`Passed: ${passed}  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
