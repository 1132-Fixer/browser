import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORT_ORIGIN, SUPPORT_PRODUCT, bytesToBase64, messageFor, productCodeFor, sniffImageBytes, titleFrom } from '../../packages/ui/src/report-helpers.ts';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('sniffImageBytes recognizes accepted formats by content only', () => {
  assert.equal(sniffImageBytes(new Uint8Array(PNG)), 'image/png');
  assert.equal(sniffImageBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(sniffImageBytes(new Uint8Array(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(8)]))), 'image/gif');
  assert.equal(sniffImageBytes(new Uint8Array(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]))), 'image/webp');
  assert.equal(sniffImageBytes(new Uint8Array(Buffer.concat([Buffer.from('MZ'), Buffer.alloc(20)]))), null);
  assert.equal(sniffImageBytes(new Uint8Array(3)), null);
  assert.equal(sniffImageBytes(null), null);
});

test('bytesToBase64 round-trips byte-exact, including multi-chunk input', () => {
  assert.ok(Buffer.from(bytesToBase64(new Uint8Array(PNG)), 'base64').equals(PNG));
  const big = new Uint8Array(0x8000 * 2 + 17).map((_, i) => i % 251);
  assert.ok(Buffer.from(bytesToBase64(big), 'base64').equals(Buffer.from(big)));
});

test('titleFrom collapses whitespace, caps at 80, and falls back below 3 chars', () => {
  assert.equal(titleFrom('a  multi\nline   report about the bug'), 'a multi line report about the bug');
  assert.equal(titleFrom('x'.repeat(200)).length, 80);
  assert.equal(titleFrom('   '), 'Bug report');
  assert.equal(titleFrom('OK'), 'Bug report');
});

test('messageFor maps service statuses to user copy', () => {
  assert.match(messageFor({ status: 429, json: null }), /Too many/);
  assert.match(messageFor({ status: 413, json: null }), /too large/);
  assert.equal(messageFor({ status: 400, json: { error: { code: 'validation_failed', message: 'Title too short.' } } }), 'Title too short.');
  assert.match(messageFor({ status: 500, json: null }), /failed/);
});

test('productCodeFor uses the browser code only when the service advertises it, else CHROME', () => {
  const all = ['WINDOWS', 'CHROME', 'MACOS', 'EDGE', 'FIREFOX', 'BRAVE'];
  assert.equal(productCodeFor('firefox', all), 'FIREFOX');
  assert.equal(productCodeFor('edge', all), 'EDGE');
  assert.equal(productCodeFor('brave', all), 'BRAVE');
  assert.equal(productCodeFor('chrome', all), 'CHROME');
  assert.equal(productCodeFor('firefox', ['WINDOWS', 'CHROME', 'MACOS']), 'CHROME', 'older service');
  assert.equal(productCodeFor('firefox', undefined), 'CHROME', 'no capability list');
  assert.equal(productCodeFor('bravia', all), 'CHROME', 'unknown target');
});

test('support origin is a single https literal and the product code is one the service accepts', () => {
  assert.match(SUPPORT_ORIGIN, /^https:\/\/[^/]+$/);
  assert.ok(['WINDOWS', 'CHROME', 'MACOS'].includes(SUPPORT_PRODUCT));
});
