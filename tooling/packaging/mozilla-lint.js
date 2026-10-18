'use strict';

const path = require('node:path');

// Keep web-ext lint's default exclusions. Generated files outside those
// exclusions all reach Mozilla's validator, including unexpected files.
function shouldScanFile(fileName, isDir = false) {
  const normalized = path.posix.normalize(fileName.replaceAll('\\', '/'));
  if (normalized === '.') return isDir === true;
  const parts = normalized.split('/');
  return !parts.some((part) => part.startsWith('.') || part === 'node_modules')
    && !/\.(?:xpi|zip)$/.test(parts.at(-1));
}

async function lintFirefox(sourceDir) {
  const { createInstance } = require('addons-linter');
  const absoluteSourceDir = path.resolve(sourceDir);
  const linter = createInstance({
    config: {
      _: [absoluteSourceDir],
      logLevel: 'fatal',
      stack: false,
      pretty: false,
      privileged: false,
      enterprise: false,
      warningsAsErrors: false,
      metadata: false,
      output: 'none',
      boring: true,
      selfHosted: false,
      shouldScanFile: (fileName, isDir) => shouldScanFile(path.relative(absoluteSourceDir, path.resolve(absoluteSourceDir, fileName)), isDir),
      minManifestVersion: 2,
      maxManifestVersion: 3,
      enableDataCollectionPermissions: true,
    },
    runAsBinary: false,
  });
  const report = await linter.run();
  if (!report || !Array.isArray(report.errors) || !Array.isArray(report.warnings)) {
    throw new Error('Mozilla addons-linter returned an invalid report');
  }
  return report;
}

module.exports = { lintFirefox, shouldScanFile };
