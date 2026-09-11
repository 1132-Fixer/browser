#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Build one or more targets into dist/<target>/.
 *
 *   node tooling/build/build.js --all
 *   node tooling/build/build.js chrome firefox
 *   node tooling/build/build.js chrome --watch      (dev loop: rebuild on change)
 *
 * Extension targets: manifest (base or base+overlay), bundled popup.js and
 * report.js (esbuild, no minification, no source maps), static UI files,
 * icons, shipped documents, and the target's README.
 *
 * TV target (bravia): the static TV client plus the Sony launcher package.
 *
 * The output is what a browser loads unpacked and exactly what the packager
 * zips. Nothing else is ever added at packaging time.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const T = require('./targets');

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(fromRel, toAbs) {
  fs.mkdirSync(path.dirname(toAbs), { recursive: true });
  fs.copyFileSync(path.join(T.ROOT, fromRel), toAbs);
}

function assertVersionsAgree() {
  const manifestVersion = T.baseManifest().version;
  const pkgVersion = T.packageVersion();
  if (manifestVersion !== pkgVersion) {
    throw new Error(`version drift: ${T.BASE_MANIFEST} says ${manifestVersion}, package.json says ${pkgVersion}. Use npm run bump.`);
  }
  return pkgVersion;
}

function writeManifest(target, outDir) {
  const outPath = path.join(outDir, 'manifest.json');
  if (target.id === 'chrome') {
    // Chrome ships the base manifest bytes verbatim.
    copyFile(T.BASE_MANIFEST, outPath);
  } else {
    fs.writeFileSync(outPath, JSON.stringify(T.manifestFor(target.id), null, 2) + '\n');
  }
}

function copyStatic(target, outDir) {
  for (const rel of T.UI_STATIC_FILES) copyFile(path.join(T.UI_SRC, rel), path.join(outDir, rel));
  for (const rel of T.SHIPPED_ROOT_DOCS) copyFile(rel, path.join(outDir, rel));
  copyFile(path.join(target.appDir, 'README.md'), path.join(outDir, 'README.md'));
}

function esbuildOptions(target, outDir) {
  return {
    entryPoints: T.UI_ENTRY_POINTS.map((name) => path.join(T.ROOT, T.UI_SRC, name + '.ts')),
    outdir: outDir,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: [target.esbuildTarget],
    sourcemap: false,
    minify: false,
    treeShaking: true,
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'warning',
    define: { __TARGET__: JSON.stringify(target.id) },
    banner: { js: `// 1132 Fixer ${target.id} build. Source: https://github.com/1132-Fixer/chrome (packages/ui/src). Not minified.` },
  };
}

async function buildExtension(target) {
  const outDir = path.join(T.DIST_DIR, target.id);
  rmrf(outDir);
  fs.mkdirSync(outDir, { recursive: true });
  writeManifest(target, outDir);
  copyStatic(target, outDir);
  await esbuild.build(esbuildOptions(target, outDir));
  return outDir;
}

function buildTv(target) {
  const outDir = path.join(T.DIST_DIR, target.id);
  rmrf(outDir);
  fs.mkdirSync(outDir, { recursive: true });
  for (const rel of T.TV_FILES) copyFile(path.join(target.appDir, rel), path.join(outDir, rel));
  // The Sony launcher manifest carries the workspace version so the TV package never drifts.
  const launcherPath = path.join(outDir, 'sony/apps/webapps/1132-fixer/app/manifest.json');
  const launcher = JSON.parse(fs.readFileSync(launcherPath, 'utf8'));
  launcher.version = T.packageVersion();
  fs.writeFileSync(launcherPath, JSON.stringify(launcher, null, 2) + '\n');
  return outDir;
}

async function buildTarget(id) {
  const target = T.TARGETS[id];
  if (!target) throw new Error('unknown target: ' + id);
  const outDir = target.kind === 'tv' ? buildTv(target) : await buildExtension(target);
  console.log(`built ${id} -> ${path.relative(T.ROOT, outDir)}`);
  return outDir;
}

async function watchTarget(id) {
  const target = T.TARGETS[id];
  if (!target) throw new Error('unknown target: ' + id);
  await buildTarget(id);
  const outDir = path.join(T.DIST_DIR, id);

  let timer = null;
  const rebuildStatic = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        if (target.kind === 'tv') buildTv(target);
        else { writeManifest(target, outDir); copyStatic(target, outDir); }
        console.log(`[${new Date().toLocaleTimeString()}] ${id}: static files refreshed`);
      } catch (e) {
        console.error(`${id}: refresh failed: ${e.message}`);
      }
    }, 150);
  };

  const watchDirs = [target.appDir, T.UI_SRC].map((d) => path.join(T.ROOT, d));
  for (const dir of watchDirs) {
    fs.watch(dir, { recursive: true }, (_event, file) => {
      if (file && /\.ts$/.test(String(file))) return; // esbuild handles TypeScript
      rebuildStatic();
    });
  }

  if (target.kind === 'extension') {
    const ctx = await esbuild.context(esbuildOptions(target, outDir));
    await ctx.watch();
  }
  console.log(`watching ${id}. Load ${path.relative(T.ROOT, outDir)} unpacked; press Ctrl+C to stop.`);
  await new Promise(() => {}); // run until interrupted
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((a) => a !== '--');
  const watch = args.includes('--watch');
  const ids = args.filter((a) => !a.startsWith('--'));
  const all = args.includes('--all') || ids.length === 0;
  const targets = all ? T.ALL_TARGET_IDS : ids;
  for (const id of targets) if (!T.TARGETS[id]) throw new Error(`unknown target "${id}". Known: ${T.ALL_TARGET_IDS.join(', ')}`);
  if (watch && targets.length !== 1) throw new Error('--watch takes exactly one target');
  return { targets, watch };
}

async function main() {
  const { targets, watch } = parseArgs(process.argv);
  const version = assertVersionsAgree();
  console.log(`1132 Fixer ${version}`);
  if (watch) return watchTarget(targets[0]);
  for (const id of targets) await buildTarget(id);
  return undefined;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
} else {
  module.exports = { buildTarget, assertVersionsAgree };
}
