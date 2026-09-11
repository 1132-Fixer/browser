#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * The end-to-end matrix. Shared behaviour is tested once per ENGINE; target
 * differences at the install-smoke level.
 *
 *   npm run test:e2e
 *
 *   popup   : Chromium x dist/chrome, Firefox x dist/firefox
 *   report  : Chromium x dist/chrome, Firefox x dist/firefox
 *   install : dist/chrome, dist/edge, dist/brave loaded unpacked in Chromium
 *   bravia  : dist/bravia at TV viewports in Chromium
 *
 * Requires: npm run build, and `npx playwright install chromium firefox`.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const here = __dirname;
const runs = [
  ['popup.e2e.js', ['--engine', 'chromium', '--target', 'chrome']],
  ['popup.e2e.js', ['--engine', 'firefox', '--target', 'firefox']],
  ['report.e2e.js', ['--engine', 'chromium', '--target', 'chrome']],
  ['report.e2e.js', ['--engine', 'firefox', '--target', 'firefox']],
  ['extension-install.e2e.js', []],
  ['bravia.e2e.js', []],
];

let failures = 0;
for (const [script, args] of runs) {
  console.log(`\n=== ${script} ${args.join(' ')} ===`);
  const r = spawnSync(process.execPath, [path.join(here, script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) failures++;
}
console.log(`\n${runs.length - failures}/${runs.length} end-to-end suites passed`);
process.exit(failures ? 1 : 0);
