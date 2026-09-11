/**
 * Shared types for the 1132 Fixer browser extension workspace.
 *
 * This package holds only types. It has no runtime code and no dependencies.
 * The build tooling (plain Node) mirrors the target ids in
 * tooling/build/targets.js; tests assert the two lists agree.
 */

/** Distribution targets that produce an extension package. */
export type ExtensionTargetId = 'chrome' | 'edge' | 'brave' | 'firefox';

/** Engine family detected at runtime. Never derived from the user agent. */
export type BrowserFamily = 'chromium' | 'gecko' | 'unknown';

/** The subset of a browser cookie record the cleanup needs. */
export interface CookieRecord {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  storeId?: string;
  partitionKey?: { topLevelSite?: string };
}

/** Query passed to cookies.getAll. An empty partitionKey means every partition. */
export interface CookieQuery {
  domain: string;
  partitionKey?: Record<string, never>;
}

/** Details passed to cookies.remove. */
export interface CookieRemoveDetails {
  url: string;
  name: string;
  storeId?: string;
  partitionKey?: { topLevelSite?: string };
}

/** The cookie API surface the core needs. Injected, so the core never touches a browser namespace. */
export interface CookieApi {
  getAll(query: CookieQuery): Promise<CookieRecord[]>;
  /** Resolves with a truthy value when the browser removed the cookie, null when it declined. */
  remove(details: CookieRemoveDetails): Promise<unknown>;
}

export interface ActiveTab {
  id: number;
  url: string;
}

/** Result returned by the in-page cleaner injected into the active Zoom tab. */
export interface PageDataResult {
  skipped: boolean;
  reason?: string;
  host?: string;
  origin?: string;
  localStorage: boolean;
  sessionStorage: boolean;
  caches: number;
  indexedDB: number;
  errors: string[];
}

export interface CookieClearResult {
  removed: number;
  failed: number;
}

export interface ZoomCookieClearResult extends CookieClearResult {
  /** Number of Zoom base domains whose cookie jar could not be read at all. */
  hostErrors: number;
}

export interface OutcomeInput {
  removed: number;
  failed: number;
  hostErrors: number;
  storageOk: boolean;
  reloaded: boolean;
}

export type OutcomeStatus = 'CLEARED' | 'PARTIAL' | 'ERROR';

/** Pure view model for the popup's result line. Every string the user sees is built here. */
export interface OutcomeView {
  status: OutcomeStatus;
  kind: 'done' | 'error';
  cls: 'good' | 'warn' | 'bad';
  text: string;
}

/**
 * Minimal ambient declarations for the WebExtension namespaces this project
 * uses. Only the members the adapter calls are declared, so the type-checker
 * documents the exact API surface rather than the whole platform.
 */
export interface WebExtNamespace {
  runtime: {
    getManifest(): { version: string; name: string };
    getBrowserInfo?: () => Promise<{ name: string; version: string }>;
  };
  tabs: {
    query(info: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number; url?: string }>>;
    reload(tabId: number): Promise<void>;
  };
  cookies: {
    getAll(details: CookieQuery): Promise<CookieRecord[]>;
    remove(details: CookieRemoveDetails): Promise<unknown>;
  };
  scripting: {
    executeScript<T>(injection: {
      target: { tabId: number };
      func: () => T | Promise<T>;
    }): Promise<Array<{ result?: T }>>;
  };
  permissions: {
    contains(p: { origins: string[] }): Promise<boolean>;
    request(p: { origins: string[] }): Promise<boolean>;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var chrome: WebExtNamespace | undefined;
  // eslint-disable-next-line no-var
  var browser: WebExtNamespace | undefined;
}
