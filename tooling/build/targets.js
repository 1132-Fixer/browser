'use strict';

/**
 * Target registry: the single list of everything this workspace can build.
 *
 * Extension targets share ONE source tree (packages/*). Each target owns only
 * its manifest identity (apps/extensions/<id>/manifest.overlay.json) and its
 * shipped README. The Chrome manifest is the base; other targets are composed
 * from base + overlay at build time, never hand-maintained copies.
 *
 * Brave is a Chromium-family variant: it installs Chrome Web Store packages,
 * so there is no Brave store pipeline. The separate zip exists only so
 * Chrome-only claims stay off a package someone loads unpacked in Brave.
 *
 * packages/platform-types/src/index.ts mirrors the extension ids as a TS
 * union; tests/unit/targets.test.ts asserts the two lists agree.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.join(ROOT, 'dist');
const RELEASE_DIR = path.join(ROOT, 'release');
const BASE_MANIFEST = 'apps/extensions/chrome/manifest.json';
const UI_SRC = 'packages/ui/src';

const EXTENSION_TARGETS = {
  chrome: {
    id: 'chrome',
    kind: 'extension',
    family: 'chromium',
    appDir: 'apps/extensions/chrome',
    overlay: null,
    zipStem: '1132-fixer-chrome',
    esbuildTarget: 'chrome114',
    store: 'Chrome Web Store',
  },
  edge: {
    id: 'edge',
    kind: 'extension',
    family: 'chromium',
    appDir: 'apps/extensions/edge',
    overlay: 'manifest.overlay.json',
    zipStem: '1132-fixer-edge',
    esbuildTarget: 'chrome114',
    store: 'Microsoft Edge Add-ons',
  },
  brave: {
    id: 'brave',
    kind: 'extension',
    family: 'chromium',
    appDir: 'apps/extensions/brave',
    overlay: 'manifest.overlay.json',
    zipStem: '1132-fixer-brave',
    esbuildTarget: 'chrome114',
    store: 'Chrome Web Store (Brave installs Chrome packages)',
  },
  firefox: {
    id: 'firefox',
    kind: 'extension',
    family: 'gecko',
    appDir: 'apps/extensions/firefox',
    overlay: 'manifest.overlay.json',
    zipStem: '1132-fixer-firefox',
    esbuildTarget: 'firefox140',
    store: 'Firefox Add-ons (AMO)',
  },
};

const TV_TARGETS = {
  bravia: {
    id: 'bravia',
    kind: 'tv',
    family: 'tv-web',
    appDir: 'apps/tv/bravia',
    zipStem: '1132-fixer-bravia',
    store: 'Sony BRAVIA Professional Display HTML5 app (hosted URL / USB / built-in storage)',
  },
};

const TARGETS = { ...EXTENSION_TARGETS, ...TV_TARGETS };
const EXTENSION_TARGET_IDS = Object.keys(EXTENSION_TARGETS);
const ALL_TARGET_IDS = Object.keys(TARGETS);

/** Static UI files copied into every extension package, relative to packages/ui/src. */
const UI_STATIC_FILES = [
  'popup.html',
  'popup.css',
  'report.html',
  'report.css',
  'icons/icon.png',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'icons/popup-logo.png',
];

/** Bundled entry points: packages/ui/src/<name>.ts -> dist/<target>/<name>.js */
const UI_ENTRY_POINTS = ['popup', 'report'];

/** Repo-root documents shipped inside every extension package. */
const SHIPPED_ROOT_DOCS = ['LICENSE', 'NOTICE.md', 'TRADEMARKS.md', 'ASSET-LICENSE.md', 'PRIVACY_POLICY.md'];

/**
 * The exact zip inventory, in order. manifest.json first (store requirement).
 * docs/release/store-prep.md mirrors this list; tooling/packaging/verify-packages.js
 * asserts every zip matches it exactly.
 */
const EXTENSION_PACKAGE_ENTRIES = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'popup.js',
  'report.html',
  'report.css',
  'report.js',
  'icons/icon.png',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'icons/popup-logo.png',
  'LICENSE',
  'NOTICE.md',
  'TRADEMARKS.md',
  'ASSET-LICENSE.md',
  'README.md',
  'PRIVACY_POLICY.md',
];

/** Files of the BRAVIA TV client, relative to apps/tv/bravia. */
const TV_FILES = [
  'index.html',
  'tv.css',
  'tv.js',
  'sony/autorun.txt',
  'sony/apps/webapps/1132-fixer/app/manifest.json',
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Deep merge for manifest overlays: objects merge, everything else (arrays included) is replaced. */
function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

/** base + overlay -> target manifest. Pure: same inputs, same output. */
function composeManifest(baseManifest, overlay) {
  let out = deepMerge(baseManifest, overlay.set || {});
  for (const key of overlay.delete || []) {
    out = { ...out };
    delete out[key];
  }
  return out;
}

function baseManifest() {
  return readJson(BASE_MANIFEST);
}

function overlayFor(targetId) {
  const t = EXTENSION_TARGETS[targetId];
  if (!t) throw new Error('unknown extension target: ' + targetId);
  if (!t.overlay) return { set: {}, delete: [] };
  return readJson(path.join(t.appDir, t.overlay));
}

/** The manifest object a target ships. Chrome is the base itself. */
function manifestFor(targetId) {
  const base = baseManifest();
  if (targetId === 'chrome') return base;
  return composeManifest(base, overlayFor(targetId));
}

function packageVersion() {
  return readJson('package.json').version;
}

module.exports = {
  ROOT,
  DIST_DIR,
  RELEASE_DIR,
  BASE_MANIFEST,
  UI_SRC,
  EXTENSION_TARGETS,
  TV_TARGETS,
  TARGETS,
  EXTENSION_TARGET_IDS,
  ALL_TARGET_IDS,
  UI_STATIC_FILES,
  UI_ENTRY_POINTS,
  SHIPPED_ROOT_DOCS,
  EXTENSION_PACKAGE_ENTRIES,
  TV_FILES,
  composeManifest,
  baseManifest,
  overlayFor,
  manifestFor,
  packageVersion,
  readJson,
};
