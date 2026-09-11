import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const T = require('../../tooling/build/targets.js');

test('extension target ids match the ExtensionTargetId union in platform-types', () => {
  const src = fs.readFileSync(path.join(T.ROOT, 'packages/platform-types/src/index.ts'), 'utf8');
  const m = src.match(/export type ExtensionTargetId = ([^;]+);/);
  assert.ok(m, 'ExtensionTargetId declared');
  const ids = [...m![1]!.matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(ids, [...T.EXTENSION_TARGET_IDS].sort());
});

test('composeManifest applies set (deep) and delete, and is pure', () => {
  const base = { a: 1, nested: { keep: true, drop: 1 }, gone: 'x' };
  const overlay = { set: { nested: { drop: 2 }, b: 2 }, delete: ['gone'] };
  const out = T.composeManifest(base, overlay);
  assert.deepEqual(out, { a: 1, nested: { keep: true, drop: 2 }, b: 2 });
  assert.deepEqual(base, { a: 1, nested: { keep: true, drop: 1 }, gone: 'x' }, 'base untouched');
});

test('every non-Chrome overlay changes only identity, never permissions or hosts', () => {
  const base = T.baseManifest();
  for (const id of T.EXTENSION_TARGET_IDS) {
    if (id === 'chrome') continue;
    const m = T.manifestFor(id);
    assert.deepEqual(m.permissions, base.permissions, id + ' permissions');
    assert.deepEqual(m.host_permissions, base.host_permissions, id + ' host_permissions');
    assert.deepEqual(m.content_security_policy, base.content_security_policy, id + ' csp');
    assert.deepEqual(m.action, base.action, id + ' action');
    assert.deepEqual(m.icons, base.icons, id + ' icons');
    assert.notEqual(m.name, base.name, id + ' name differs');
    assert.doesNotMatch(m.name + ' ' + m.description, /\bChrome\b/, id + ' no Chrome claim');
  }
});

test('firefox overlay adds gecko identity and drops minimum_chrome_version', () => {
  const m = T.manifestFor('firefox');
  assert.equal(m.browser_specific_settings.gecko.id, '1132-fixer@1132-fixer.xyz');
  assert.ok(Number(m.browser_specific_settings.gecko.strict_min_version) >= 140);
  assert.deepEqual(m.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'], optional: ['technicalAndInteraction'] });
  assert.equal('minimum_chrome_version' in m, false);
});

test('package inventory has manifest first and 19 unique entries', () => {
  assert.equal(T.EXTENSION_PACKAGE_ENTRIES[0], 'manifest.json');
  assert.equal(new Set(T.EXTENSION_PACKAGE_ENTRIES).size, 19);
});
