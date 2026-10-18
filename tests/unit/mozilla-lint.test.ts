import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { lintFirefox, shouldScanFile } = require('../../tooling/packaging/mozilla-lint.js');

test('Mozilla file filter keeps web-ext default exclusions and scans unexpected files', () => {
  assert.equal(shouldScanFile('', true), true, 'source root directory must be traversed');
  assert.equal(shouldScanFile('', false), false, 'source root cannot be a file');
  assert.equal(shouldScanFile('../outside.js'), false, 'files outside the source root are excluded');
  for (const file of ['manifest.json', './manifest.json', 'icons/icon.png', 'nested/extra.js', '[literal]/file.js']) {
    assert.equal(shouldScanFile(file), true, file);
  }
  for (const file of ['.hidden', '.git/config', 'nested/.hidden/file.js', 'node_modules/x/index.js', 'nested/file.zip', 'nested/file.xpi']) {
    assert.equal(shouldScanFile(file), false, file);
  }
});

test('Mozilla validates a real fixture and rejects an unsupported manifest version', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '1132-mozilla-lint-'));
  const manifest = {
    manifest_version: 3,
    name: '1132 Mozilla validator fixture',
    version: '1.0',
    browser_specific_settings: {
      gecko: {
        id: 'validator-fixture@example.invalid',
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] },
      },
    },
  };
  try {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    const positive = await lintFirefox(dir);
    assert.deepEqual(positive.errors, []);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ ...manifest, manifest_version: 4 }));
    const negative = await lintFirefox(dir);
    assert.ok(negative.errors.length > 0, 'unsupported manifest must fail Mozilla validation');
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
