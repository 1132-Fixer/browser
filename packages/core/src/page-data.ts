/**
 * In-page cleaner, injected into the active Zoom tab via scripting.executeScript.
 *
 * SELF-CONTAINED BY DESIGN. executeScript serializes this function and
 * deserializes it in the page, so it cannot close over anything in this
 * module: no imports, no helpers, no constants from other files. It re-checks
 * location.hostname and refuses to run on any non-Zoom origin. That is the
 * last line of defense against an unrelated-origin storage/cache/idb clear.
 *
 * tests/unit/page-data.test.ts runs this function's source text inside a bare
 * vm context to prove both properties.
 */

import type { PageDataResult } from '../../platform-types/src/index.ts';

export async function clearZoomOriginPageData(): Promise<PageDataResult> {
  const raw = String((location && location.hostname) || '').trim().toLowerCase();
  const noDot = raw.endsWith('.') ? raw.slice(0, -1) : raw;
  const host = noDot.indexOf(':') >= 0 ? noDot.slice(0, noDot.indexOf(':')) : noDot;
  const isZoom = host === 'zoom.us' || host.endsWith('.zoom.us')
    || host === 'zoom.com' || host.endsWith('.zoom.com');
  if (!isZoom) {
    return {
      skipped: true, reason: 'not-zoom-origin', host,
      localStorage: false, sessionStorage: false, caches: 0, indexedDB: 0, errors: [],
    };
  }

  const errors: string[] = [];
  const out: PageDataResult = {
    skipped: false,
    origin: location.origin,
    localStorage: false,
    sessionStorage: false,
    caches: 0,
    indexedDB: 0,
    errors,
  };

  try { localStorage.clear(); out.localStorage = true; } catch { errors.push('localStorage'); }
  try { sessionStorage.clear(); out.sessionStorage = true; } catch { errors.push('sessionStorage'); }

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    out.caches = keys.length;
  } catch {
    errors.push('caches');
  }

  try {
    // indexedDB.databases() needs Chrome 71+ / Firefox 126+. A browser without
    // it throws here, which is reported as an IndexedDB error, never as success.
    const dbs = await indexedDB.databases();
    await Promise.all((dbs || []).map((db) => new Promise<void>((resolve) => {
      if (!db || !db.name) { resolve(); return; }
      const req = indexedDB.deleteDatabase(db.name);
      req.onsuccess = () => { out.indexedDB += 1; resolve(); };
      req.onerror = () => { errors.push('indexedDB'); resolve(); };
      req.onblocked = () => { out.indexedDB += 1; resolve(); };
    })));
  } catch {
    errors.push('indexedDB');
  }

  return out;
}
