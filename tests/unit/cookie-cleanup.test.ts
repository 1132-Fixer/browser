import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearZoomCookies, collectCookies, cookieKey, cookieUrl } from '../../packages/core/src/cookie-cleanup.ts';
import type { CookieApi, CookieQuery, CookieRecord, CookieRemoveDetails } from '../../packages/platform-types/src/index.ts';

function cookie(partial: Partial<CookieRecord> & { name: string; domain: string }): CookieRecord {
  return { path: '/', secure: true, storeId: '0', ...partial };
}

interface FakeOptions {
  jar: CookieRecord[];
  partitionSupport?: boolean;
  getAllThrows?: boolean;
  failNames?: string[];
}

/** In-memory cookie API with the same partition semantics as Chrome 119+ / Firefox. */
function fakeCookieApi(opts: FakeOptions) {
  const jar = [...opts.jar];
  const calls = { getAll: [] as CookieQuery[], remove: [] as CookieRemoveDetails[] };
  const baseOf = (d: string) => (d.startsWith('.') ? d.slice(1) : d);
  const api: CookieApi = {
    async getAll(q) {
      calls.getAll.push(q);
      if (opts.getAllThrows) throw new Error('simulated');
      if (q.partitionKey && !opts.partitionSupport) throw new Error('Invalid argument: partitionKey');
      return jar.filter((c) => {
        const d = baseOf(c.domain);
        const inDomain = d === q.domain || d.endsWith('.' + q.domain);
        const inPartition = q.partitionKey ? true : !c.partitionKey;
        return inDomain && inPartition;
      });
    },
    async remove(details) {
      calls.remove.push(details);
      if ((opts.failNames || []).includes(details.name)) return null;
      const i = jar.findIndex((c) => c.name === details.name && details.url.includes(baseOf(c.domain)));
      if (i < 0) return null;
      jar.splice(i, 1);
      return { name: details.name };
    },
  };
  return { api, jar, calls };
}

test('cookieUrl maps secure/non-secure and leading-dot domains', () => {
  assert.equal(cookieUrl(cookie({ name: 'a', domain: 'zoom.us', secure: true })), 'https://zoom.us/');
  assert.equal(cookieUrl(cookie({ name: 'a', domain: 'zoom.us', secure: false })), 'http://zoom.us/');
  assert.equal(cookieUrl(cookie({ name: 'a', domain: '.zoom.us' })), 'https://zoom.us/');
  assert.equal(cookieUrl(cookie({ name: 'a', domain: '.zoom.com', path: '/wc/' })), 'https://zoom.com/wc/');
});

test('cookieKey is stable and distinguishes path and partition', () => {
  const base = cookie({ name: 'cred', domain: 'zoom.us' });
  assert.equal(cookieKey(base), cookieKey({ ...base }));
  assert.notEqual(cookieKey(base), cookieKey({ ...base, path: '/wc/' }));
  assert.notEqual(cookieKey(base), cookieKey({ ...base, partitionKey: { topLevelSite: 'https://zoom.us' } }));
});

test('collectCookies falls back to the unpartitioned query when the empty partitionKey is rejected', async () => {
  const { api, calls } = fakeCookieApi({ jar: [cookie({ name: 'a', domain: 'zoom.us' })], partitionSupport: false });
  const found = await collectCookies(api, 'zoom.us');
  assert.equal(found.length, 1);
  assert.deepEqual(calls.getAll.map((q) => 'partitionKey' in q), [true, false]);
});

test('collectCookies dedupes identical records', async () => {
  const c = cookie({ name: 'a', domain: 'zoom.us' });
  const { api } = fakeCookieApi({ jar: [c, { ...c }], partitionSupport: true });
  const found = await collectCookies(api, 'zoom.us');
  assert.equal(found.length, 1);
});

test('collectCookies throws when every query fails', async () => {
  const { api } = fakeCookieApi({ jar: [], getAllThrows: true });
  await assert.rejects(() => collectCookies(api, 'zoom.us'), /unavailable/);
});

test('clearZoomCookies removes every Zoom cookie once and leaves other origins alone', async () => {
  const { api, jar, calls } = fakeCookieApi({
    jar: [
      cookie({ name: '_zm_ssid', domain: 'zoom.us' }),
      cookie({ name: 'cred', domain: '.zoom.us' }),
      cookie({ name: '_zm_lang', domain: 'zoom.us', secure: false }),
      cookie({ name: 'zm_aid', domain: '.zoom.com' }),
      cookie({ name: 'sid', domain: 'example.com' }),
      cookie({ name: 'id', domain: 'github.com' }),
    ],
    partitionSupport: false,
  });
  const r = await clearZoomCookies(api);
  assert.deepEqual(r, { removed: 4, failed: 0, hostErrors: 0 });
  assert.equal(calls.remove.length, 4);
  assert.deepEqual(jar.map((c) => c.domain).sort(), ['example.com', 'github.com']);
  for (const d of calls.remove) assert.match(new URL(d.url).hostname, /(^|\.)zoom\.(us|com)$/);
  assert.ok(calls.remove.some((d) => d.url === 'http://zoom.us/'), 'non-secure cookie removed over http');
});

test('clearZoomCookies passes the partition key back and clears third-party partitions', async () => {
  const { api, jar, calls } = fakeCookieApi({
    jar: [
      cookie({ name: '_zm_ssid', domain: 'zoom.us' }),
      cookie({ name: '_zm_chtaid', domain: 'zoom.us', partitionKey: { topLevelSite: 'https://zoom.us' } }),
      cookie({ name: '_zm_embed', domain: 'zoom.us', partitionKey: { topLevelSite: 'https://school-lms.example' } }),
    ],
    partitionSupport: true,
  });
  const r = await clearZoomCookies(api);
  assert.equal(r.removed, 3);
  assert.equal(jar.length, 0);
  const withKey = calls.remove.filter((d) => d.partitionKey);
  assert.equal(withKey.length, 2);
  assert.ok(withKey.some((d) => d.partitionKey?.topLevelSite === 'https://school-lms.example'));
});

test('clearZoomCookies reports partial failure honestly', async () => {
  const { api, jar } = fakeCookieApi({
    jar: [cookie({ name: 'a', domain: 'zoom.us' }), cookie({ name: 'cred', domain: 'zoom.us' })],
    failNames: ['cred'],
  });
  const r = await clearZoomCookies(api);
  assert.deepEqual(r, { removed: 1, failed: 1, hostErrors: 0 });
  assert.equal(jar.length, 1);
});

test('clearZoomCookies counts an unreadable jar per host, not as success', async () => {
  const { api } = fakeCookieApi({ jar: [cookie({ name: 'a', domain: 'zoom.us' })], getAllThrows: true });
  const r = await clearZoomCookies(api);
  assert.deepEqual(r, { removed: 0, failed: 0, hostErrors: 2 });
});
