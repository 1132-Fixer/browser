#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Check every generated store asset against the Chrome Web Store's rules:
 * exact pixel dimensions, and 24-bit PNG with no alpha channel.
 *
 *   node scripts/verify-store-assets.js     (or: npm run assets:verify)
 *
 * Exits non-zero if anything is missing or off-spec, so the operator finds out
 * here rather than in the dashboard's upload validator.
 */

const fs   = require('fs');
const path = require('path');
const { decodePng } = require('../lib/png');

const ROOT    = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'store-assets');

const SPEC = [
  { name: '01-zoom-detected.png',                 width: 1280, height: 800, required: true },
  { name: '02-fix-complete.png',                  width: 1280, height: 800, required: true },
  { name: '03-non-zoom-safe.png',                 width: 1280, height: 800, required: true },
  { name: '04-extension-details-permissions.png', width: 1280, height: 800, required: false },
  { name: 'promo-440x280.png',                    width: 440,  height: 280, required: true },
  { name: 'promo-1400x560.png',                   width: 1400, height: 560, required: false },
  { name: 'icon128-store.png',                    width: 128,  height: 128, required: true },
];

let failed = 0;

for (const { name, width, height, required } of SPEC) {
  const file = path.join(OUT_DIR, name);

  if (!fs.existsSync(file)) {
    if (required) { console.log(`  MISSING   ${name}  (required by the store)`); failed++; }
    else          { console.log(`  absent    ${name}  (optional)`); }
    continue;
  }

  let image;
  try {
    image = decodePng(fs.readFileSync(file));
  } catch (e) {
    console.log(`  UNREADABLE ${name}  — ${e.message}`);
    failed++;
    continue;
  }

  const problems = [];
  if (image.width !== width || image.height !== height) {
    problems.push(`is ${image.width}x${image.height}, expected ${width}x${height}`);
  }
  if (image.channels !== 3) {
    problems.push('has an alpha channel; the store wants 24-bit RGB');
  }

  const size = (fs.statSync(file).size / 1024).toFixed(0) + 'KB';
  if (problems.length) {
    console.log(`  BAD       ${name}  — ${problems.join('; ')}`);
    failed++;
  } else {
    console.log(`  ok        ${name}  ${image.width}x${image.height}, 24-bit RGB, ${size}`);
  }
}

console.log('');
if (failed) {
  console.log(`${failed} asset problem(s). Regenerate with: npm run assets`);
  process.exit(1);
}
console.log('all store assets conform');
