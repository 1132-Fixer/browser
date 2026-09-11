import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POPUP_COPY, describeInterruption, describeOutcome } from '../../packages/core/src/outcome.ts';

test('all clear -> CLEARED, good', () => {
  const v = describeOutcome({ removed: 4, failed: 0, hostErrors: 0, storageOk: true, reloaded: true });
  assert.equal(v.status, 'CLEARED');
  assert.equal(v.cls, 'good');
  assert.equal(v.text, "Removed 4 Zoom cookies. This tab's Zoom site data was cleared. Tab reloaded.");
});

test('singular cookie count', () => {
  const v = describeOutcome({ removed: 1, failed: 0, hostErrors: 0, storageOk: true, reloaded: false });
  assert.equal(v.text, "Removed 1 Zoom cookie. This tab's Zoom site data was cleared.");
});

test('nothing to remove is still CLEARED', () => {
  const v = describeOutcome({ removed: 0, failed: 0, hostErrors: 0, storageOk: true, reloaded: true });
  assert.equal(v.status, 'CLEARED');
  assert.match(v.text, /No Zoom cookies were left to remove\./);
});

test('one refused removal -> PARTIAL, warn, honest count', () => {
  const v = describeOutcome({ removed: 3, failed: 1, hostErrors: 0, storageOk: true, reloaded: true });
  assert.equal(v.status, 'PARTIAL');
  assert.equal(v.cls, 'warn');
  assert.match(v.text, /Removed 3 Zoom cookies; 1 could not be removed\./);
});

test('cookie jar unreadable but storage cleared -> PARTIAL with browser-neutral copy', () => {
  const v = describeOutcome({ removed: 0, failed: 0, hostErrors: 2, storageOk: true, reloaded: true });
  assert.equal(v.status, 'PARTIAL');
  assert.match(v.text, /The browser would not let us read the Zoom cookie jar\./);
  assert.doesNotMatch(v.text, /Chrome/);
});

test('cookies and storage both fail -> ERROR, bad', () => {
  const v = describeOutcome({ removed: 0, failed: 0, hostErrors: 2, storageOk: false, reloaded: false });
  assert.equal(v.status, 'ERROR');
  assert.equal(v.cls, 'bad');
  assert.match(v.text, /site data could not be cleared/);
});

test('copy never claims to fix or verify Error 1132', () => {
  const all = [
    ...Object.values(POPUP_COPY),
    describeOutcome({ removed: 2, failed: 0, hostErrors: 0, storageOk: true, reloaded: true }).text,
    describeInterruption(new Error('x')),
  ].join('\n');
  assert.doesNotMatch(all, /One-click fix|fixed|resolved|verified/i);
});

test('describeInterruption keeps the detail but never a bare exception', () => {
  const t = describeInterruption(new Error('simulated'));
  assert.match(t, /^Something interrupted the cleanup\./);
  assert.match(t, /\(detail: simulated\)$/);
  assert.match(describeInterruption('plain'), /\(detail: plain\)$/);
});
