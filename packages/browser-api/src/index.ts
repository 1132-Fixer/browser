/**
 * Typed browser adapter. The ONLY place in the shipped code that touches a
 * WebExtension namespace (`browser.*` or `chrome.*`).
 *
 * Detection is by feature, never by user agent:
 *   - `browser.runtime.getBrowserInfo` exists  -> Gecko (Firefox).
 *   - otherwise `chrome.runtime` exists         -> Chromium (Chrome, Edge, Brave, ...).
 *
 * Both families return Promises from the MV3 APIs used here, so no callback
 * shim is needed. Every call goes through this object so the source guard in
 * tests/integration/validate-source.js can allowlist the exact API surface:
 * the only destructive call is cookies.remove, and the only injection is one
 * scripting.executeScript with a function.
 *
 * Host access: Chromium grants host_permissions at install. Firefox (127+)
 * grants them at install too, but users can revoke host permissions at any
 * time in the Add-ons Manager, so the popup checks `hasHostAccess` and can
 * ask again with `requestHostAccess` from inside the click handler.
 */

import type {
  ActiveTab,
  BrowserFamily,
  CookieApi,
  WebExtNamespace,
} from '../../platform-types/src/index.ts';

export interface BrowserApi {
  readonly family: BrowserFamily;
  manifestVersion(): string;
  activeTab(): Promise<ActiveTab | null>;
  reloadTab(tabId: number): Promise<void>;
  readonly cookies: CookieApi;
  /** Run a self-contained function inside the tab and return its result (undefined when the browser returns none). */
  runInTab<T>(tabId: number, func: () => Promise<T>): Promise<T | undefined>;
  hasHostAccess(origins: readonly string[]): Promise<boolean>;
  /** Must be called synchronously inside a user-input handler, before any await. */
  requestHostAccess(origins: readonly string[]): Promise<boolean>;
}

interface NamespaceScope {
  browser?: WebExtNamespace;
  chrome?: WebExtNamespace;
}

function resolveNamespace(scope: NamespaceScope): { ns: WebExtNamespace; family: BrowserFamily } {
  const b = scope.browser;
  if (b && b.runtime) {
    const family: BrowserFamily = typeof b.runtime.getBrowserInfo === 'function' ? 'gecko' : 'unknown';
    return { ns: b, family };
  }
  const c = scope.chrome;
  if (c && c.runtime) {
    return { ns: c, family: 'chromium' };
  }
  throw new Error('no WebExtension namespace available');
}

export function detectBrowserApi(scope: NamespaceScope = globalThis as NamespaceScope): BrowserApi {
  const { ns, family } = resolveNamespace(scope);

  return {
    family,

    manifestVersion(): string {
      try {
        const m = ns.runtime.getManifest();
        return m && m.version ? m.version : '';
      } catch {
        return '';
      }
    },

    async activeTab(): Promise<ActiveTab | null> {
      const [tab] = await ns.tabs.query({ active: true, currentWindow: true });
      if (!tab || typeof tab.id !== 'number' || typeof tab.url !== 'string') return null;
      return { id: tab.id, url: tab.url };
    },

    async reloadTab(tabId: number): Promise<void> {
      await ns.tabs.reload(tabId);
    },

    cookies: {
      getAll: (query) => ns.cookies.getAll(query),
      remove: (details) => ns.cookies.remove(details),
    },

    async runInTab<T>(tabId: number, func: () => Promise<T>): Promise<T | undefined> {
      const results = await ns.scripting.executeScript({ target: { tabId }, func });
      const first = results && results[0];
      return first ? first.result : undefined;
    },

    async hasHostAccess(origins: readonly string[]): Promise<boolean> {
      try {
        return await ns.permissions.contains({ origins: [...origins] });
      } catch {
        // A browser without the permissions API cannot revoke install-time host access.
        return true;
      }
    },

    async requestHostAccess(origins: readonly string[]): Promise<boolean> {
      try {
        return await ns.permissions.request({ origins: [...origins] });
      } catch {
        return false;
      }
    },
  };
}
