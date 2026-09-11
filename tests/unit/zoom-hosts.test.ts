import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZOOM_HOSTS,
  ZOOM_ORIGIN_PATTERNS,
  hostMatchesBase,
  isZoomHost,
  normalizeHost,
  shouldClearPageDataForTabUrl,
} from '../../packages/core/src/zoom-hosts.ts';

test('isZoomHost accepts Zoom domains and subdomains only', () => {
  const yes = ['zoom.us', 'www.zoom.us', 'us02web.zoom.us', 'ZOOM.US', 'zoom.us.', 'zoom.com', 'foo.zoom.com', 'zoom.us:443'];
  const no = ['notzoom.us', 'evilzoom.us', 'zoom.us.evil.com', 'foo.example.com', '', null, undefined, 42];
  for (const h of yes) assert.equal(isZoomHost(h), true, String(h));
  for (const h of no) assert.equal(isZoomHost(h), false, String(h));
});

test('normalizeHost lowercases, strips trailing dot and port', () => {
  assert.equal(normalizeHost('ZOOM.US.'), 'zoom.us');
  assert.equal(normalizeHost('host:443'), 'host');
  assert.equal(normalizeHost('  '), null);
  assert.equal(normalizeHost(':443'), null);
  assert.equal(normalizeHost(null), null);
});

test('hostMatchesBase requires a dot boundary', () => {
  assert.equal(hostMatchesBase('a.zoom.us', 'zoom.us'), true);
  assert.equal(hostMatchesBase('zoom.us', 'zoom.us'), true);
  assert.equal(hostMatchesBase('evilzoom.us', 'zoom.us'), false);
  assert.equal(hostMatchesBase(null, 'zoom.us'), false);
});

test('shouldClearPageDataForTabUrl injects only into http(s) Zoom tabs', () => {
  const yes = ['https://zoom.us/', 'https://www.zoom.us/meeting', 'https://us02web.zoom.us/j/1', 'https://zoom.com/', 'http://zoom.us/'];
  const no = ['https://example.com/', 'https://zoom.us.evil.com/', 'https://evilzoom.us/', 'https://notzoom.us/', 'chrome://extensions/', 'about:blank', 'ftp://zoom.us/', '', null, 'not a url'];
  for (const u of yes) assert.equal(shouldClearPageDataForTabUrl(u), true, u);
  for (const u of no) assert.equal(shouldClearPageDataForTabUrl(u), false, String(u));
});

test('ZOOM_ORIGIN_PATTERNS cover exactly ZOOM_HOSTS over http and https', () => {
  assert.deepEqual(ZOOM_HOSTS, ['zoom.us', 'zoom.com']);
  const expected = ZOOM_HOSTS.flatMap((h) => [`https://*.${h}/*`, `http://*.${h}/*`]).sort();
  assert.deepEqual([...ZOOM_ORIGIN_PATTERNS].sort(), expected);
});
