#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Zip built targets into release/<target>/<stem>-<version>.zip.
 *
 *   node tooling/packaging/package.js --all
 *   node tooling/packaging/package.js chrome
 *   node tooling/packaging/package.js firefox bravia
 *
 * Packages exactly what tooling/build/build.js produced in dist/<target>/,
 * nothing more. Refuses to run when a target has not been built, and refuses
 * to ship files that must never leave the workspace (source maps, TypeScript,
 * test fixtures, editor files). Writes release/SHA256SUMS.txt.
 *
 * This script does not publish anywhere.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const T = require('../build/targets');
const { buildZip, listFilesRecursive } = require('../lib/zip');

const FORBIDDEN_ENTRY = [
  { re: /\.map$/i, why: 'source map' },
  { re: /\.ts$/i, why: 'TypeScript source' },
  { re: /(^|\/)\.(git|DS_Store|vscode|idea)/i, why: 'metadata' },
  { re: /(^|\/)(node_modules|test|tests|fixtures|__mocks__)\//i, why: 'test or dependency tree' },
  { re: /\.(env|pem|key|p12)$/i, why: 'credential-looking file' },
  { re: /(^|\/)(Thumbs\.db|desktop\.ini)$/i, why: 'OS clutter' },
];

function zipNameFor(target, version) {
  return `${target.zipStem}-${version}.zip`;
}

function zipPathFor(target, version) {
  return path.join(T.RELEASE_DIR, target.id, zipNameFor(target, version));
}

/** Entry order: extension packages follow the fixed inventory; other targets ship sorted. */
function orderedEntries(target, files) {
  if (target.kind !== 'extension') return files;
  const order = new Map(T.EXTENSION_PACKAGE_ENTRIES.map((n, i) => [n, i]));
  return [...files].sort((a, b) => (order.has(a) ? order.get(a) : 1e6) - (order.has(b) ? order.get(b) : 1e6) || a.localeCompare(b));
}

function packageTarget(id) {
  const target = T.TARGETS[id];
  if (!target) throw new Error('unknown target: ' + id);
  const distDir = path.join(T.DIST_DIR, id);
  if (!fs.existsSync(path.join(distDir, target.kind === 'tv' ? 'index.html' : 'manifest.json'))) {
    throw new Error(`dist/${id} is not built. Run: npm run build:${id}`);
  }
  const files = orderedEntries(target, listFilesRecursive(distDir));
  for (const f of files) {
    for (const { re, why } of FORBIDDEN_ENTRY) {
      if (re.test(f)) throw new Error(`refusing to package ${id}: ${f} (${why})`);
    }
  }
  if (target.kind === 'extension') {
    const expected = T.EXTENSION_PACKAGE_ENTRIES;
    const missing = expected.filter((e) => !files.includes(e));
    const extra = files.filter((f) => !expected.includes(f));
    if (missing.length || extra.length) {
      throw new Error(`dist/${id} inventory drift. missing: [${missing.join(', ')}] extra: [${extra.join(', ')}]`);
    }
  }

  const entries = files.map((name) => ({ name, data: fs.readFileSync(path.join(distDir, name)) }));
  const zip = buildZip(entries);
  const version = T.packageVersion();
  const outPath = zipPathFor(target, version);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, zip);
  const sha256 = crypto.createHash('sha256').update(zip).digest('hex');
  console.log(`wrote ${path.relative(T.ROOT, outPath)}  (${zip.length} bytes, ${entries.length} entries, sha256 ${sha256})`);
  return { id, path: outPath, bytes: zip.length, entries: entries.length, sha256 };
}

function writeChecksums(results) {
  const lines = results.map((r) => `${r.sha256}  ${path.relative(T.RELEASE_DIR, r.path).split(path.sep).join('/')}`);
  fs.mkdirSync(T.RELEASE_DIR, { recursive: true });
  fs.writeFileSync(path.join(T.RELEASE_DIR, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((a) => a !== '--');
  const ids = args.filter((a) => !a.startsWith('--'));
  const targets = args.includes('--all') || ids.length === 0 ? T.ALL_TARGET_IDS : ids;
  for (const id of targets) if (!T.TARGETS[id]) throw new Error(`unknown target "${id}". Known: ${T.ALL_TARGET_IDS.join(', ')}`);
  return targets;
}

function main() {
  const targets = parseArgs(process.argv);
  const results = targets.map(packageTarget);
  if (targets.length === T.ALL_TARGET_IDS.length) writeChecksums(results);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
} else {
  module.exports = { packageTarget, zipPathFor, zipNameFor, FORBIDDEN_ENTRY };
}
