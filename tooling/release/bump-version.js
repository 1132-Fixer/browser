#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Bump the workspace version in every place it is written down, in one step:
 *
 *   apps/extensions/chrome/manifest.json   "version"   — the base manifest every target derives from
 *   package.json                           "version"   — kept in lockstep
 *   package-lock.json                      "version"   — root entry, so `npm ci` stays consistent
 *   packages/ui/src/popup.html             #appVersion — offline fallback label
 *   packages/ui/src/report.html            #appVersion — offline fallback label
 *   apps/tv/bravia/sony/.../manifest.json  "version"   — Sony launcher manifest
 *
 * The build refuses to run when these drift, so this script is the only
 * supported way to change the version.
 *
 * Usage:
 *   node tooling/release/bump-version.js patch          # 1.2.0 -> 1.2.1  (default)
 *   node tooling/release/bump-version.js minor          # 1.2.0 -> 1.3.0
 *   node tooling/release/bump-version.js major          # 1.2.0 -> 2.0.0
 *   node tooling/release/bump-version.js 1.4.2          # explicit version
 *   node tooling/release/bump-version.js patch --dry-run
 *   node tooling/release/bump-version.js --print        # print current version, change nothing
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const rel = (p) => path.join(ROOT, p);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const printer = args.includes('--print');
const bump = args.find((a) => !a.startsWith('--')) || 'patch';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const BASE_MANIFEST = 'apps/extensions/chrome/manifest.json';
const LAUNCHER = 'apps/tv/bravia/sony/apps/webapps/1132-fixer/app/manifest.json';

function readJson(p) { return JSON.parse(fs.readFileSync(rel(p), 'utf8')); }

const current = readJson(BASE_MANIFEST).version;

if (!SEMVER.test(current)) {
  console.error(`${BASE_MANIFEST} version "${current}" is not x.y.z — fix it by hand first.`);
  process.exit(1);
}

if (printer) {
  console.log(current);
  process.exit(0);
}

function nextVersion(from, how) {
  if (SEMVER.test(how)) return how;
  const [major, minor, patch] = from.split('.').map(Number);
  switch (how) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default:
      console.error(`Unknown bump "${how}". Use patch | minor | major | x.y.z`);
      process.exit(1);
  }
  return from;
}

const next = nextVersion(current, bump);

if (next === current) {
  console.log(`Version already ${current} — nothing to do.`);
  process.exit(0);
}

/** Replace the first `"version": "…"` in a JSON file, leaving formatting alone. */
function writeVersionInJson(file, occurrences = 1) {
  const text = fs.readFileSync(rel(file), 'utf8');
  let count = 0;
  const updated = text.replace(/("version"\s*:\s*")[^"]+(")/g, (m, a, b) => (count++ < occurrences ? `${a}${next}${b}` : m));
  if (count === 0) throw new Error(`could not find a "version" field in ${file}`);
  if (!dryRun) fs.writeFileSync(rel(file), updated);
  return `${file}: -> ${next}`;
}

/** Replace the page's hard-coded version chip (the pre-manifest fallback). */
function writeVersionInChip(file) {
  const text = fs.readFileSync(rel(file), 'utf8');
  const updated = text.replace(/(id="appVersion"[^>]*>)v[0-9.]+(<)/, `$1v${next}$2`);
  if (updated === text) throw new Error(`could not find the #appVersion chip in ${file}`);
  if (!dryRun) fs.writeFileSync(rel(file), updated);
  return `${file}: version chip -> v${next}`;
}

try {
  const changes = [
    writeVersionInJson(BASE_MANIFEST),
    writeVersionInJson('package.json'),
    // package-lock.json: the root "version" and the "" package entry are the first two occurrences.
    writeVersionInJson('package-lock.json', 2),
    writeVersionInJson(LAUNCHER),
    writeVersionInChip('packages/ui/src/popup.html'),
    writeVersionInChip('packages/ui/src/report.html'),
  ];
  console.log(`${dryRun ? '[dry run] ' : ''}${current} -> ${next}`);
  for (const c of changes) console.log(`  ${c}`);
  if (!dryRun) {
    console.log('\nNext: npm run check   (the build refuses to run if any copy drifted)');
  }
} catch (e) {
  console.error('bump failed:', e.message);
  process.exit(1);
}
