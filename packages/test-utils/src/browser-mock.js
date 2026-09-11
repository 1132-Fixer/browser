'use strict';

/**
 * Recording WebExtension namespace mock for end-to-end tests.
 *
 * `mockInitScript(cfg)` returns JavaScript source that a Playwright
 * `addInitScript` injects before the page's own script runs. It installs
 * `window.chrome` (Chromium shape) or `window.browser` + `window.chrome`
 * (Firefox shape, with `runtime.getBrowserInfo`) and records every call in
 * `window.__calls` so tests can assert what the popup actually did.
 *
 * cfg:
 *   namespace        'chrome' | 'browser'      (default 'chrome')
 *   version          manifest version string   (default '1.2.0')
 *   name             manifest name
 *   activeUrl        URL of the active tab, or falsy for none
 *   jar              [{ name, domain, secure, path?, storeId?, partitionKey? }]
 *   partitionSupport getAll accepts an empty partitionKey (default false)
 *   getAllThrows     cookies.getAll rejects
 *   failNames        cookie names cookies.remove declines (returns null)
 *   scriptingThrows  scripting.executeScript rejects
 *   pageCleanup      result object executeScript should return
 *   hostAccess       permissions.contains answer (default true)
 *   grantOnRequest   permissions.request answer (default true)
 *   noPermissionsApi omit the permissions namespace entirely
 */
function mockInitScript(cfg) {
  return `(() => {
  const CFG = ${JSON.stringify(cfg)};
  const jar = (CFG.jar || []).map(c => Object.assign({ path: '/', secure: true, storeId: '0' }, c));
  const calls = { getAll: [], remove: [], reload: [], executeScript: [], forbidden: [], contains: [], request: [] };
  window.__calls = calls;
  window.__jar = jar;

  const baseOf = d => (d.startsWith('.') ? d.slice(1) : d);
  const domainMatches = (cookieDomain, filter) => {
    if (!filter) return true;
    const c = baseOf(cookieDomain), f = baseOf(filter);
    return c === f || c.endsWith('.' + f);
  };
  const partitionMatches = (c, details) => {
    if (details.partitionKey) {
      // Chrome 119+ and Firefox: an empty partitionKey returns cookies from
      // every partition PLUS the unpartitioned jar.
      if (details.partitionKey.topLevelSite === undefined) return true;
      return !!c.partitionKey && c.partitionKey.topLevelSite === details.partitionKey.topLevelSite;
    }
    return !c.partitionKey;
  };

  const ns = {
    runtime: {
      getManifest: () => ({ name: CFG.name || '1132 Fixer', version: CFG.version || '1.2.0', manifest_version: 3 }),
    },
    tabs: {
      query: async () => (CFG.activeUrl ? [{ id: 7, url: CFG.activeUrl }] : []),
      reload: async (tabId) => { calls.reload.push(tabId); },
    },
    cookies: {
      getAll: async (details) => {
        calls.getAll.push(details);
        if (CFG.getAllThrows) throw new Error('simulated getAll failure');
        if (details.partitionKey && !CFG.partitionSupport) throw new Error('Invalid argument: partitionKey');
        return jar.filter(c => domainMatches(c.domain, details.domain) && partitionMatches(c, details));
      },
      remove: async (details) => {
        calls.remove.push(details);
        if ((CFG.failNames || []).includes(details.name)) return null;
        const i = jar.findIndex(c =>
          c.name === details.name &&
          details.url.includes(baseOf(c.domain)) &&
          c.path === new URL(details.url).pathname);
        if (i < 0) return null;
        jar.splice(i, 1);
        return { name: details.name, url: details.url };
      },
    },
    scripting: {
      executeScript: async (injection) => {
        const func = injection && injection.func;
        const record = {
          tabId: injection && injection.target && injection.target.tabId,
          hasFunc: typeof func === 'function',
          funcSource: typeof func === 'function' ? func.toString() : null,
          realResult: null,
        };
        calls.executeScript.push(record);
        if (typeof func === 'function') {
          // Run the serialized function against THIS page's (non-Zoom) origin.
          // It must refuse, which proves the last-line-of-defense origin check
          // in the real browser rather than in a Node sandbox.
          try { record.realResult = await func(); } catch (e) { record.realResult = { threw: String(e) }; }
        }
        if (CFG.scriptingThrows) throw new Error('simulated scripting failure');
        if (CFG.pageCleanup) return [{ result: CFG.pageCleanup }];
        return [{ result: {
          skipped: false,
          origin: 'https://zoom.us',
          localStorage: true,
          sessionStorage: true,
          caches: 1,
          indexedDB: 1,
          errors: [],
        } }];
      },
    },
  };

  if (!CFG.noPermissionsApi) {
    ns.permissions = {
      contains: async (p) => { calls.contains.push(p); return CFG.hostAccess !== false; },
      request: async (p) => { calls.request.push(p); return CFG.grantOnRequest !== false; },
    };
  }

  // These APIs must never be touched. scripting is allowed (Zoom-tab inject).
  for (const banned of ['browsingData', 'storage', 'webRequest', 'history', 'alarms', 'webNavigation']) {
    Object.defineProperty(ns, banned, {
      get() { calls.forbidden.push(banned); return {}; },
    });
  }

  if (CFG.namespace === 'browser') {
    ns.runtime.getBrowserInfo = async () => ({ name: 'Firefox', vendor: 'Mozilla', version: '128.0' });
    window.browser = ns;
    window.chrome = ns; // Firefox exposes both; the adapter must prefer browser.*
  } else {
    window.chrome = ns;
  }
})();`;
}

module.exports = { mockInitScript };
