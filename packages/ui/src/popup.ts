/**
 * Popup: DOM wiring only. The cleanup lives in packages/core; browser access
 * goes through packages/browser-api. This file must not reference `chrome.*`
 * or `browser.*` directly (enforced by tests/integration/validate-source.js).
 *
 * Nothing runs until the user presses FIX ZOOM. init() only reads the active
 * tab and the host-access state; it never removes, injects, or reloads.
 */

import { detectBrowserApi, type BrowserApi } from '../../browser-api/src/index.ts';
import {
  POPUP_COPY,
  ZOOM_ORIGIN_PATTERNS,
  clearZoomCookies,
  clearZoomOriginPageData,
  describeInterruption,
  describeOutcome,
  isZoomHost,
  normalizeHost,
  shouldClearPageDataForTabUrl,
} from '../../core/src/index.ts';
import type { ActiveTab } from '../../platform-types/src/index.ts';

type StatusKind = '' | 'scanning' | 'done' | 'error' | 'neutral';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('popup element missing: #' + id);
  return el as T;
}

const els = {
  statusBadge: byId<HTMLSpanElement>('statusBadge'),
  statusText: byId<HTMLSpanElement>('statusBadgeText'),
  result: byId<HTMLParagraphElement>('result'),
  appVersion: byId<HTMLSpanElement>('appVersion'),
  zoomFixBtn: byId<HTMLButtonElement>('zoomFixBtn'),
};

const state: { hostAccess: boolean | null } = { hostAccess: null };

let api: BrowserApi;

function setStatus(kind: StatusKind, text: string): void {
  els.statusBadge.classList.remove('scanning', 'done', 'error', 'neutral');
  if (kind) els.statusBadge.classList.add(kind);
  els.statusText.textContent = text;
}

/** The popup's only output: one line of plain text. No log, no counters table. */
function setResult(text: string, cls = ''): void {
  els.result.className = 'result' + (cls ? ' ' + cls : '');
  els.result.textContent = text;
}

async function detectActiveTab(): Promise<ActiveTab | null> {
  try {
    return await api.activeTab();
  } catch {
    return null; // chrome:// and about: pages, or no window
  }
}

async function clearZoomOriginStorageForTab(tab: ActiveTab): Promise<boolean> {
  if (!shouldClearPageDataForTabUrl(tab.url)) return false;
  const result = await api.runInTab(tab.id, clearZoomOriginPageData);
  if (!result || result.skipped) return false;
  return !!(result.localStorage && result.sessionStorage && result.errors.length === 0);
}

async function reloadActiveTabIfZoom(): Promise<boolean> {
  try {
    const tab = await api.activeTab();
    if (!tab) return false;
    if (!isZoomHost(new URL(tab.url).hostname)) return false;
    await api.reloadTab(tab.id);
    return true;
  } catch {
    return false;
  }
}

async function runZoomFix(): Promise<void> {
  els.zoomFixBtn.disabled = true;

  // Firefox only prompts for host access from inside a user-input handler, so
  // the request is issued synchronously here, before the first await.
  const accessRequest = state.hostAccess === false
    ? api.requestHostAccess(ZOOM_ORIGIN_PATTERNS)
    : null;

  setStatus('scanning', POPUP_COPY.workingStatus);
  setResult(POPUP_COPY.working);

  try {
    if (accessRequest && !(await accessRequest)) {
      setStatus('neutral', POPUP_COPY.accessNeededStatus);
      setResult(POPUP_COPY.accessDenied, 'warn');
      return;
    }
    state.hostAccess = true;

    const tab = await detectActiveTab();
    if (!tab || !shouldClearPageDataForTabUrl(tab.url)) {
      setStatus('neutral', POPUP_COPY.notZoomStatus);
      setResult(POPUP_COPY.notZoom);
      els.zoomFixBtn.hidden = true;
      return;
    }

    const cookies = await clearZoomCookies(api.cookies);

    let storageOk = false;
    try {
      storageOk = await clearZoomOriginStorageForTab(tab);
    } catch {
      storageOk = false;
    }

    const reloaded = await reloadActiveTabIfZoom();
    const outcome = describeOutcome({ ...cookies, storageOk, reloaded });
    setStatus(outcome.kind, outcome.status);
    setResult(outcome.text, outcome.cls);
  } catch (e) {
    setStatus('error', POPUP_COPY.errorStatus);
    // Never show a bare exception as the whole message. Clearing is safe to
    // repeat, so the honest next step is always "run it again".
    setResult(describeInterruption(e), 'bad');
  } finally {
    els.zoomFixBtn.disabled = false;
  }
}

function setVersion(): void {
  const v = api.manifestVersion();
  if (v) els.appVersion.textContent = 'v' + v;
}

async function init(): Promise<void> {
  api = detectBrowserApi();
  setVersion();
  els.zoomFixBtn.addEventListener('click', runZoomFix);

  const tab = await detectActiveTab();
  let host: string | null = null;
  if (tab) {
    try {
      const u = new URL(tab.url);
      if (/^https?:$/.test(u.protocol)) host = normalizeHost(u.hostname);
    } catch {
      host = null;
    }
  }

  if (!isZoomHost(host)) {
    setStatus('neutral', POPUP_COPY.notZoomStatus);
    setResult(POPUP_COPY.notZoom);
    return;
  }

  state.hostAccess = await api.hasHostAccess(ZOOM_ORIGIN_PATTERNS);
  els.zoomFixBtn.hidden = false;
  if (state.hostAccess) {
    setStatus('', POPUP_COPY.detectedStatus);
    setResult(POPUP_COPY.detected);
  } else {
    setStatus('neutral', POPUP_COPY.accessNeededStatus);
    setResult(POPUP_COPY.accessNeeded);
  }
}

document.addEventListener('DOMContentLoaded', () => { void init(); });
