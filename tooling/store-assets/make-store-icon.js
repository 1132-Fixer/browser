#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Produce the Web Store's 128x128 listing icon: the shipped icon, flattened to
 * a 24-bit PNG with no alpha channel (the store rejects ARGB here).
 *
 *   node scripts/make-store-icon.js   -> store-assets/icon128-store.png
 *
 * Cross-platform replacement for scripts/make-store-icon.ps1.
 */

const fs   = require('fs');
const path = require('path');
const { decodePng, toRgb, encodeRgbPng } = require('../lib/png');

const ROOT    = path.resolve(__dirname, '..', '..');
const SRC     = path.join(ROOT, 'packages', 'ui', 'src', 'icons', 'icon128.png');
const OUT_DIR = path.join(ROOT, 'store-assets');
const OUT     = path.join(OUT_DIR, 'icon128-store.png');

// Matches the popup's top gradient stop, so any transparent icon corners blend
// into the same navy the rest of the listing art uses.
const BACKGROUND = [10, 16, 32];

const image = decodePng(fs.readFileSync(SRC));
if (image.width !== 128 || image.height !== 128) {
  console.error(`expected a 128x128 source icon, got ${image.width}x${image.height}`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, encodeRgbPng(image.width, image.height, toRgb(image, BACKGROUND)));
console.log(`wrote ${path.relative(ROOT, OUT)} (128x128, 24-bit RGB, no alpha)`);
