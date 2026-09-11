import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectBrowserApi } from '../../packages/browser-api/src/index.ts';
import type { WebExtNamespace } from '../../packages/platform-types/src/index.ts';

function fakeNamespace(overrides: Partial<WebExtNamespace> = {}, calls: string[] = []): WebExtNamespace {
  return {
    runtime: { getManifest: () => ({ version: '9.9.9', name: 'x' }) },
    tabs: {
      query: async () => { calls.push('tabs.query'); return [{ id: 3, url: 'https://zoom.us/' }]; },
      reload: async (id) => { calls.push('tabs.reload:' + id); },
    },
    cookies: {
      getAll: async () => { calls.push('cookies.getAll'); return []; },
      remove: async () => { calls.push('cookies.remove'); return null; },
    },
    scripting: {
      executeScript: async () => { calls.push('scripting.executeScript'); return [{ result: 'ran' as never }]; },
    },
    permissions: {
      contains: async () => { calls.push('permissions.contains'); return true; },
      request: async () => { calls.push('permissions.request'); return true; },
    },
    ...overrides,
  };
}

test('prefers browser.* and detects Gecko by runtime.getBrowserInfo', () => {
  const gecko = fakeNamespace({ runtime: { getManifest: () => ({ version: '1', name: 'g' }), getBrowserInfo: async () => ({ name: 'Firefox', version: '128' }) } });
  const chromium = fakeNamespace();
  const api = detectBrowserApi({ browser: gecko, chrome: chromium });
  assert.equal(api.family, 'gecko');
  assert.equal(api.manifestVersion(), '1');
});

test('falls back to chrome.* and reports chromium', () => {
  const api = detectBrowserApi({ chrome: fakeNamespace() });
  assert.equal(api.family, 'chromium');
  assert.equal(api.manifestVersion(), '9.9.9');
});

test('throws when no namespace exists (never silently no-ops)', () => {
  assert.throws(() => detectBrowserApi({}), /no WebExtension namespace/);
});

test('activeTab returns null for tabs without id or url', async () => {
  const ns = fakeNamespace({ tabs: { query: async () => [{ url: undefined }], reload: async () => {} } });
  assert.equal(await detectBrowserApi({ chrome: ns }).activeTab(), null);
  const ok = detectBrowserApi({ chrome: fakeNamespace() });
  assert.deepEqual(await ok.activeTab(), { id: 3, url: 'https://zoom.us/' });
});

test('runInTab returns the first injection result', async () => {
  const api = detectBrowserApi({ chrome: fakeNamespace() });
  assert.equal(await api.runInTab(3, async () => 'x'), 'ran');
});

test('host access: missing permissions API means access cannot have been revoked', async () => {
  const ns = fakeNamespace();
  (ns as Partial<WebExtNamespace>).permissions = undefined;
  const api = detectBrowserApi({ chrome: ns });
  assert.equal(await api.hasHostAccess(['https://*.zoom.us/*']), true);
  assert.equal(await api.requestHostAccess(['https://*.zoom.us/*']), false);
});

test('every call is forwarded to the namespace', async () => {
  const calls: string[] = [];
  const api = detectBrowserApi({ chrome: fakeNamespace({}, calls) });
  await api.activeTab();
  await api.reloadTab(3);
  await api.cookies.getAll({ domain: 'zoom.us' });
  await api.cookies.remove({ url: 'https://zoom.us/', name: 'a' });
  await api.runInTab(3, async () => 1);
  await api.hasHostAccess([]);
  await api.requestHostAccess([]);
  assert.deepEqual(calls, ['tabs.query', 'tabs.reload:3', 'cookies.getAll', 'cookies.remove', 'scripting.executeScript', 'permissions.contains', 'permissions.request']);
});
