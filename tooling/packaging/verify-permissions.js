#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Permission-justification gate.
 *
 *   node tooling/packaging/verify-permissions.js   (or: npm run verify:permissions)
 *
 * Every permission and host pattern in every built manifest must have a row
 * in docs/security/permissions-matrix.md that marks the target "yes" and
 * carries a justification. A new permission without a written justification
 * fails CI. Rows marked "yes" for a target that no longer requests the
 * permission fail too, so the matrix cannot drift from the manifests.
 *
 * Table format (first header cell is "Permission"):
 *   | Permission | Chrome | Edge | Brave | Firefox | Why it is needed | Narrower alternative considered |
 */

const fs = require('fs');
const path = require('path');
const T = require('../build/targets');

const MATRIX = path.join(T.ROOT, 'docs/security/permissions-matrix.md');

let failed = 0;
let passed = 0;
function pass(name) { passed++; console.log(`  PASS  ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
function check(ok, name, detail) { (ok ? pass : fail)(name, detail); }

function parseMatrix(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^\|\s*Permission\s*\|/i.test(l));
  if (start < 0) throw new Error('permissions-matrix.md: no table with a "Permission" header cell');
  const header = lines[start].split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
  const rows = [];
  for (let i = start + 2; i < lines.length && /^\|/.test(lines[i]); i++) {
    const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
    const row = {};
    header.forEach((h, idx) => { row[h] = cells[idx] || ''; });
    const perm = (row.permission || '').replace(/`/g, '').trim();
    if (perm) rows.push({ perm, row });
  }
  return { header, rows };
}

const markdown = fs.readFileSync(MATRIX, 'utf8');
const { header, rows } = parseMatrix(markdown);
const targetColumns = T.EXTENSION_TARGET_IDS.filter((id) => header.includes(id));
check(targetColumns.length === T.EXTENSION_TARGET_IDS.length, `matrix has a column for every extension target (${T.EXTENSION_TARGET_IDS.join(', ')})`, header.join(' | '));
check(header.includes('why it is needed'), 'matrix has a "Why it is needed" column');

for (const id of T.EXTENSION_TARGET_IDS) {
  const manifestPath = path.join(T.DIST_DIR, id, 'manifest.json');
  if (!fs.existsSync(manifestPath)) { fail(`${id}: built manifest exists`, 'run npm run build'); continue; }
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const requested = [
    ...(m.permissions || []),
    ...(m.host_permissions || []),
    ...(m.optional_permissions || []),
    ...(m.optional_host_permissions || []),
  ];
  for (const p of requested) {
    const entry = rows.find((r) => r.perm === p);
    if (!entry) { fail(`${id}: "${p}" is justified in the matrix`, 'no row'); continue; }
    const yes = /^yes\b/i.test(entry.row[id] || '');
    check(yes, `${id}: "${p}" row marks ${id} as yes`, entry.row[id]);
    check((entry.row['why it is needed'] || '').length >= 20, `${id}: "${p}" has a written justification`);
  }
  for (const { perm, row } of rows) {
    if (/^yes\b/i.test(row[id] || '') && !requested.includes(perm)) {
      fail(`${id}: matrix marks "${perm}" yes but the manifest does not request it`, 'matrix drift');
    }
  }
}

console.log('');
console.log(`Passed: ${passed}  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
