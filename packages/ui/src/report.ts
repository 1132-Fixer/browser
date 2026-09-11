/**
 * Report-a-bug page (#16): the ONLY page in this extension that talks to the
 * network, and it talks to exactly one place, the 1132 Fixer support service.
 * Everything is user-initiated. The page sends nothing until the user clicks
 * Submit. The popup's fix flow stays Zoom-origin-only and network-free.
 *
 * The form renders only when GET /health advertises capabilities.screenshots
 * (the support platform is live end-to-end); otherwise the page shows the
 * GitHub-issues fallback link, never a dead form.
 *
 * The submission travels the authenticated /v1 support API: the install
 * self-registers a support principal on first use (POST /v1/principals; the
 * token identifies this install to the support service and is stored in this
 * page's localStorage, extension-origin, never a shipped secret).
 */

import { detectBrowserApi, type BrowserApi } from '../../browser-api/src/index.ts';
import {
  MIN_TEXT_CHARS,
  PRINCIPAL_KEY,
  SHOT_MAX_BYTES,
  SUPPORT_ORIGIN,
  bytesToBase64,
  messageFor,
  productCodeFor,
  sniffImageBytes,
  titleFrom,
  type ServiceResponse,
} from './report-helpers.ts';

/** Build target id, substituted by esbuild (tooling/build/build.js `define`). */
declare const __TARGET__: string;
const BUILD_TARGET: string = typeof __TARGET__ === 'string' ? __TARGET__ : 'chrome';

/** Product codes the support service advertised on this page load (GET /health). */
let advertisedProducts: string[] | undefined;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('report element missing: #' + id);
  return el as T;
}

const els = {
  version: byId<HTMLSpanElement>('appVersion'),
  checking: byId<HTMLElement>('checkingView'),
  fallback: byId<HTMLElement>('fallbackView'),
  form: byId<HTMLElement>('formView'),
  text: byId<HTMLTextAreaElement>('bugText'),
  submit: byId<HTMLButtonElement>('bugSubmit'),
  status: byId<HTMLElement>('bugStatus'),
  shotRow: byId<HTMLElement>('shotRow'),
  shotAttach: byId<HTMLButtonElement>('shotAttach'),
  shotReplace: byId<HTMLButtonElement>('shotReplace'),
  shotRemove: byId<HTMLButtonElement>('shotRemove'),
  shotInput: byId<HTMLInputElement>('shotInput'),
  shotPreview: byId<HTMLElement>('shotPreview'),
  shotImg: byId<HTMLImageElement>('shotImg'),
  shotName: byId<HTMLElement>('shotName'),
  shotStatus: byId<HTMLElement>('shotStatus'),
};

interface Screenshot { bytes: Uint8Array; mediaType: string; name: string }
interface Principal { principalId: string; token: string }

let api: BrowserApi | null = null;
function browserApi(): BrowserApi | null {
  if (!api) { try { api = detectBrowserApi(); } catch { api = null; } }
  return api;
}

let screenshot: Screenshot | null = null;
let screenshotUrl: string | null = null;  // preview object URL
let shotReadGen = 0;       // invalidates in-flight async file reads
let shotBusy = false;      // a read is in flight: submission must wait
let submitBusy = false;    // a POST is in flight: no second submission

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const normalizeMime = (t: string): string => (t === 'image/jpg' ? 'image/jpeg' : t);

function updateSubmit(): void {
  els.submit.disabled = submitBusy || shotBusy ||
    els.text.value.trim().length < MIN_TEXT_CHARS;
}

function appVersion(): string {
  const b = browserApi();
  return (b && b.manifestVersion()) || '0.0.0';
}

function setStatus(msg: string, cls?: string): void {
  els.status.textContent = msg || '';
  els.status.className = 'report-status' + (cls ? ' ' + cls : '');
}
function setShotStatus(msg: string, isError?: boolean): void {
  els.shotStatus.textContent = msg || '';
  els.shotStatus.className = 'report-status' + (isError ? ' err' : '');
}

function clearScreenshot(): void {
  shotReadGen++; // a queued async read completion must not resurrect state
  shotBusy = false;
  screenshot = null;
  if (screenshotUrl) { URL.revokeObjectURL(screenshotUrl); screenshotUrl = null; }
  els.shotPreview.hidden = true;
  els.shotRow.hidden = false;
  els.shotInput.value = '';
  setShotStatus('');
  updateSubmit();
}

async function setScreenshot(fileOrBlob: Blob, name: string): Promise<void> {
  // Selecting ANY replacement, even one that will be rejected, must invalidate
  // a still-in-flight earlier read, or that older file could attach after the
  // rejection message. The generation bumps first; every rejection then also
  // releases the busy gate it now owns.
  const gen = ++shotReadGen;
  const rejectRead = (msg: string): void => {
    if (gen === shotReadGen) {
      shotBusy = false;
      updateSubmit();
    }
    setShotStatus(msg, true);
  };
  // Reset the picker immediately: a rejected file must not leave its value
  // behind, or re-selecting the same file later is a silent no-op.
  els.shotInput.value = '';
  if (fileOrBlob.size > SHOT_MAX_BYTES) {
    rejectRead('Screenshot must be 5 MB or smaller.');
    return;
  }
  // Declared MIME gate (spec: MIME + magic bytes). An empty type (some
  // drag/paste sources) falls through to the sniff, which stays decisive.
  const declared = normalizeMime((fileOrBlob.type || '').toLowerCase());
  if (declared && !ALLOWED_MIME.has(declared)) {
    rejectRead('Only image files can be attached (PNG, JPEG, WebP, or GIF).');
    return;
  }
  // Submission must not observe half-updated state: block Submit while the
  // read is in flight, and discard a completion the user has superseded.
  shotBusy = true;
  updateSubmit();
  try {
    const bytes = new Uint8Array(await fileOrBlob.arrayBuffer());
    if (gen !== shotReadGen) return; // replaced or cleared mid-read
    const mediaType = sniffImageBytes(bytes);
    if (!mediaType || (declared && declared !== mediaType)) {
      setShotStatus('Only image files can be attached (PNG, JPEG, WebP, or GIF).', true);
      return;
    }
    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    screenshot = { bytes, mediaType, name: name || 'screenshot' };
    screenshotUrl = URL.createObjectURL(new Blob([bytes], { type: mediaType }));
    els.shotImg.src = screenshotUrl;
    els.shotName.textContent = screenshot.name;
    els.shotPreview.hidden = false;
    els.shotRow.hidden = true;
    setShotStatus('');
    // Hiding the attach row drops keyboard focus to <body>; hand it to the
    // preview's Replace control when the user was on the attach path. A
    // paste/drop while typing keeps focus where it was.
    const active = document.activeElement;
    if (active === document.body || active === els.shotAttach) {
      els.shotReplace.focus();
    }
  } finally {
    if (gen === shotReadGen) {
      shotBusy = false;
      updateSubmit();
    }
  }
}

// --- support-service client ----------------------------------------

async function serviceRequest(
  method: string, path: string, headers?: Record<string, string>, body?: string, timeoutMs?: number,
): Promise<ServiceResponse> {
  // Application-level bound: a stalled connection must resolve into the
  // honest failure path, never park the page on a spinner or a disabled
  // Submit for the browser's own multi-minute timeout.
  const r = await fetch(SUPPORT_ORIGIN + path, {
    method, headers, body, signal: AbortSignal.timeout(timeoutMs || 30000),
  });
  let json: ServiceResponse['json'] = null;
  try { json = await r.json(); } catch { /* non-JSON body */ }
  return { status: r.status, json };
}

async function capabilityProbe(): Promise<boolean> {
  try {
    const r = await serviceRequest('GET', '/health', undefined, undefined, 8000);
    const caps = r.json && (r.json['capabilities'] as { screenshots?: boolean; products?: unknown } | undefined);
    advertisedProducts = caps && Array.isArray(caps.products)
      ? caps.products.filter((p): p is string => typeof p === 'string')
      : undefined;
    return Boolean(caps && caps.screenshots);
  } catch {
    return false; // unreachable, stalled, or CORS-dark -> fallback view
  }
}

function loadPrincipal(): Principal | null {
  try {
    const p = JSON.parse(localStorage.getItem(PRINCIPAL_KEY) || 'null') as Principal | null;
    return (p && p.principalId && p.token) ? p : null;
  } catch { return null; }
}

async function registerPrincipal(): Promise<Principal | null> {
  const r = await serviceRequest('POST', '/v1/principals',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ product: productCodeFor(BUILD_TARGET, advertisedProducts), appVersion: appVersion() }));
  const j = r.json as { principalId?: string; token?: string } | null;
  if (r.status === 201 && j && j.principalId && j.token) {
    const p: Principal = { principalId: j.principalId, token: j.token };
    localStorage.setItem(PRINCIPAL_KEY, JSON.stringify(p));
    return p;
  }
  return null;
}

async function submitReport(): Promise<void> {
  if (submitBusy) return; // typing must not re-arm the button mid-flight
  const text = els.text.value.trim();
  // Firefox's built-in data-collection consent: the report carries the
  // extension version, the user-agent string, and the per-install support
  // principal (technical data). The request must be issued synchronously in
  // the Submit click handler, before any await. Chromium resolves true.
  const b = browserApi();
  const consent = b ? b.requestDataCollection(['technicalAndInteraction']) : Promise.resolve(true);
  submitBusy = true;
  updateSubmit();
  setStatus(screenshot ? 'Submitting report + screenshot…' : 'Submitting…');
  try {
    if (!(await consent)) {
      setStatus('Not sent. Your browser did not allow this extension to send technical details with the report. You can allow it in the browser’s add-on settings, or open a GitHub issue instead.', 'err');
      return;
    }
    let principal = loadPrincipal() || await registerPrincipal();
    if (!principal) {
      setStatus('Could not reach the support service — try again later.', 'err');
      return;
    }
    const payload: Record<string, unknown> = {
      type: 'bug',
      title: titleFrom(text),
      description: text,
      os: navigator.userAgent,
      appVersion: appVersion(),
    };
    if (screenshot) {
      payload['screenshot'] = { data: bytesToBase64(screenshot.bytes), mediaType: screenshot.mediaType };
    }
    // Key derives from the submission content: a retry after an ambiguous
    // failure (timeout after the server committed) replays the stored
    // response instead of duplicating the case. Editing the report or the
    // screenshot changes the body and therefore the key.
    const bodyStr = JSON.stringify(payload);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bodyStr));
    const idemKey = 'fx-' + Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
    const post = (p: Principal): Promise<ServiceResponse> => serviceRequest('POST', '/v1/cases', {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + p.token,
      'Idempotency-Key': idemKey,
    }, bodyStr);

    let r = await post(principal);
    if (r.status === 401) {
      // Token revoked or service re-peppered: re-register once, retry once.
      localStorage.removeItem(PRINCIPAL_KEY);
      principal = await registerPrincipal();
      if (principal) r = await post(principal);
    }
    const j = r.json as { caseRef?: string; screenshotAttached?: boolean } | null;
    if (r.status === 201 && j && j.caseRef && (!screenshot || j.screenshotAttached)) {
      // Success is claimed only when the service confirmed the WHOLE
      // submission: a 201 without the screenshot must not read as sent.
      setStatus('Submitted — reference ' + j.caseRef + '. Thank you!', 'ok');
      els.text.value = '';
      clearScreenshot();
      return;
    }
    setStatus(messageFor(r), 'err');
  } catch {
    setStatus('Network error — check your connection and try again.', 'err');
  } finally {
    submitBusy = false;
    updateSubmit();
  }
}

// --- wiring ---------------------------------------------------------

async function init(): Promise<void> {
  els.version.textContent = 'v' + appVersion();

  els.text.addEventListener('input', updateSubmit);
  els.submit.addEventListener('click', () => { void submitReport(); });
  els.shotAttach.addEventListener('click', () => els.shotInput.click());
  els.shotReplace.addEventListener('click', () => els.shotInput.click());
  els.shotRemove.addEventListener('click', () => {
    clearScreenshot();
    // Removing hides the focused button; keep keyboard users in the flow.
    els.shotAttach.focus();
  });
  els.shotInput.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files && input.files[0];
    if (f) void setScreenshot(f, f.name);
  });

  // A file dropped ANYWHERE on this page must never navigate the tab away
  // (destroying the typed report). Text drags keep default behavior.
  const dragHasFile = (e: DragEvent): boolean =>
    !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  for (const ev of ['dragover', 'drop'] as const) {
    document.addEventListener(ev, (e) => { if (dragHasFile(e)) e.preventDefault(); });
  }
  for (const ev of ['dragover', 'dragenter'] as const) {
    els.form.addEventListener(ev, (e) => { if (dragHasFile(e)) els.shotRow.classList.add('report-drag'); });
  }
  for (const ev of ['dragleave', 'drop'] as const) {
    els.form.addEventListener(ev, () => { els.shotRow.classList.remove('report-drag'); });
  }
  els.form.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) void setScreenshot(f, f.name);
  });
  document.addEventListener('paste', (e) => {
    if (els.form.hidden) return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) { e.preventDefault(); void setScreenshot(f, 'pasted screenshot'); }
        return;
      }
    }
  });

  const capable = await capabilityProbe();
  els.checking.hidden = true;
  els.form.hidden = !capable;
  els.fallback.hidden = capable;
}

document.addEventListener('DOMContentLoaded', () => { void init(); });
