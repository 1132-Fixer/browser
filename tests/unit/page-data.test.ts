import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { clearZoomOriginPageData } from '../../packages/core/src/page-data.ts';

/**
 * The injected function is executed from its SOURCE TEXT inside a bare vm
 * context, exactly as scripting.executeScript serializes it. If the function
 * ever closed over a module import or helper, this test would throw a
 * ReferenceError.
 */
function makeStorage() {
  const data = new Map([['keep', 'yes']]);
  return {
    data,
    getItem(k: string) { return data.has(k) ? data.get(k) : null; },
    setItem(k: string, v: string) { data.set(k, String(v)); },
    clear() { data.clear(); },
    get length() { return data.size; },
  };
}

async function runCleaner(hostname: string, opts: { noDatabases?: boolean } = {}) {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const deletedCaches: string[] = [];
  const deletedDbs: string[] = [];
  const sandbox: Record<string, unknown> = {
    location: { hostname, origin: 'https://' + hostname },
    localStorage,
    sessionStorage,
    caches: {
      keys: async () => ['zoom-cache'],
      delete: async (k: string) => { deletedCaches.push(k); return true; },
    },
    indexedDB: {
      ...(opts.noDatabases ? {} : { databases: async () => [{ name: 'zoom-db' }] }),
      deleteDatabase(name: string) {
        const req: Record<string, unknown> = {};
        Object.defineProperty(req, 'onsuccess', { set(fn: () => void) { deletedDbs.push(name); fn(); } });
        Object.defineProperty(req, 'onerror', { set() {} });
        Object.defineProperty(req, 'onblocked', { set() {} });
        return req;
      },
    },
  };
  vm.createContext(sandbox);
  const raw = await vm.runInContext('(' + clearZoomOriginPageData.toString() + ')()', sandbox);
  // The result object belongs to the vm realm; round-trip it so strict deep equality compares values, not prototypes.
  const result = JSON.parse(JSON.stringify(raw)) as Awaited<ReturnType<typeof clearZoomOriginPageData>>;
  return { result, localStorage, sessionStorage, deletedCaches, deletedDbs };
}

test('the cleaner source is self-contained (no imports, no outer identifiers)', () => {
  const src = clearZoomOriginPageData.toString();
  assert.doesNotMatch(src, /\b(import|require|ZOOM_HOSTS|isZoomHost|normalizeHost)\b/);
});

test('cleaner clears every store on Zoom origins', async () => {
  for (const host of ['zoom.us', 'www.zoom.us', 'us02web.zoom.us', 'zoom.com', 'foo.zoom.com']) {
    const r = await runCleaner(host);
    assert.equal(r.result.skipped, false, host);
    assert.equal(r.localStorage.length, 0, host + ' localStorage');
    assert.equal(r.sessionStorage.length, 0, host + ' sessionStorage');
    assert.deepEqual(r.deletedCaches, ['zoom-cache'], host + ' caches');
    assert.deepEqual(r.deletedDbs, ['zoom-db'], host + ' idb');
    assert.deepEqual(r.result.errors, []);
  }
});

test('cleaner refuses non-Zoom origins and touches nothing', async () => {
  for (const host of ['example.com', 'zoom.us.evil.com', 'evilzoom.us', 'notzoom.us', 'github.com', '127.0.0.1']) {
    const r = await runCleaner(host);
    assert.equal(r.result.skipped, true, host);
    assert.equal(r.result.reason, 'not-zoom-origin');
    assert.equal(r.localStorage.length, 1, host + ' localStorage intact');
    assert.equal(r.sessionStorage.length, 1, host + ' sessionStorage intact');
    assert.equal(r.deletedCaches.length, 0);
    assert.equal(r.deletedDbs.length, 0);
  }
});

test('a browser without indexedDB.databases() is reported as an IndexedDB error, not success', async () => {
  const r = await runCleaner('zoom.us', { noDatabases: true });
  assert.equal(r.result.skipped, false);
  assert.equal(r.result.localStorage, true);
  assert.deepEqual(r.result.errors, ['indexedDB']);
});
