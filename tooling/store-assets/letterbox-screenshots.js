#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * The Chrome Web Store only accepts screenshots at exactly 1280x800 (or
 * 640x400), but the popup is 360 px wide, so its captures are tall and narrow.
 * Centre each one on a 1280x800 canvas in the popup's own navy, and write it
 * back as a 24-bit PNG with no alpha channel.
 *
 *   node scripts/letterbox-screenshots.js            # all popup shots
 *   node scripts/letterbox-screenshots.js 01-zoom-detected.png
 *
 * Cross-platform replacement for scripts/letterbox-screenshots.ps1.
 * Already-1280x800 files (such as the Details-page shot) are left alone.
 */

const fs   = require('fs');
const path = require('path');
const { decodePng, encodeRgbPng, letterbox } = require('../lib/png');

const ROOT    = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'store-assets');

const TARGET_W = 1280;
const TARGET_H = 800;
// popup.css --bg-top, so the padding reads as part of the popup's own artwork.
const BACKGROUND = [10, 16, 32];

const DEFAULTS = [
  '01-zoom-detected.png',
  '02-fix-complete.png',
  '03-non-zoom-safe.png',
];

const names = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS;
let processed = 0;

for (const name of names) {
  const file = path.join(OUT_DIR, name);
  if (!fs.existsSync(file)) {
    console.log(`  skip ${name} (not found — run capture-screenshots.js first)`);
    continue;
  }

  const image = decodePng(fs.readFileSync(file));
  if (image.width === TARGET_W && image.height === TARGET_H) {
    console.log(`  skip ${name} (already ${TARGET_W}x${TARGET_H})`);
    continue;
  }
  if (image.width > TARGET_W || image.height > TARGET_H) {
    console.error(`  FAIL ${name} is ${image.width}x${image.height}, larger than ${TARGET_W}x${TARGET_H} — recapture it smaller`);
    process.exitCode = 1;
    continue;
  }

  const rgb = letterbox(image, TARGET_W, TARGET_H, BACKGROUND);
  fs.writeFileSync(file, encodeRgbPng(TARGET_W, TARGET_H, rgb));
  console.log(`  ${name}: ${image.width}x${image.height} -> ${TARGET_W}x${TARGET_H}, 24-bit RGB, no alpha`);
  processed++;
}

console.log(`letterboxed ${processed} screenshot(s)`);
