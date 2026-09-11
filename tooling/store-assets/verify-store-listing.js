#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Check the copy in docs/release/chrome-web-store-listing.md against the Chrome Web Store's field
 * limits, so an over-long summary or justification is caught here rather than
 * by the dashboard rejecting a paste.
 *
 *   node tooling/store-assets/verify-store-listing.js     (or: npm run listing:verify)
 *
 * Each field is the first ```text block under its own `### ` heading.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(ROOT, 'docs', 'release', 'chrome-web-store-listing.md');

// Heading substring -> character limit the dashboard enforces.
const LIMITS = [
  { heading: 'Name',                                  limit: 75 },
  { heading: 'Summary',                               limit: 132 },
  { heading: 'Detailed description',                  limit: 16000 },
  { heading: 'Single purpose',                        limit: 1000 },
  { heading: 'Permission justification — `cookies`',  limit: 1000 },
  { heading: 'Permission justification — `activeTab`', limit: 1000 },
  { heading: 'Permission justification — host permissions', limit: 1000 },
];

// Normalize CRLF so a Windows checkout (core.autocrlf) parses and counts
// identically to the LF blob the store dashboard ultimately receives.
const markdown = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const sections = markdown.split(/^### /m).slice(1);

let failed = 0;
let checked = 0;

for (const { heading, limit } of LIMITS) {
  const section = sections.find(s => s.split('\n')[0].trim() === heading);
  if (!section) {
    console.log(`  MISSING   ### ${heading}`);
    failed++;
    continue;
  }

  const block = section.match(/```text\n([\s\S]*?)```/);
  if (!block) {
    console.log(`  NO BLOCK  ${heading} — expected a \`\`\`text field block`);
    failed++;
    continue;
  }

  // The dashboard receives the text without the fence's trailing newline.
  const text = block[1].replace(/\n$/, '');
  const used = text.length;
  const pct  = Math.round((used / limit) * 100);
  checked++;

  if (used > limit) {
    console.log(`  OVER      ${heading.padEnd(46)} ${used}/${limit} chars (${used - limit} too many)`);
    failed++;
  } else {
    console.log(`  ok        ${heading.padEnd(46)} ${String(used).padStart(5)}/${limit} chars (${pct}%)`);
  }
}

// Cross-check the summary against what the manifest ships, since the store
// pre-fills the summary from the manifest description.
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', 'extensions', 'chrome', 'manifest.json'), 'utf8'));
if (manifest.description.length > 132) {
  console.log(`  OVER      manifest description ${manifest.description.length}/132 chars`);
  failed++;
} else {
  console.log(`  ok        manifest description (store summary default)  ${String(manifest.description.length).padStart(5)}/132 chars`);
}

console.log('');
if (failed) {
  console.log(`${failed} field problem(s) in docs/release/chrome-web-store-listing.md`);
  process.exit(1);
}
console.log(`all ${checked + 1} listing fields are within the store's limits`);
