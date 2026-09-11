/**
 * Zoom cookie cleanup. The cookie API is injected, so this module holds no
 * browser namespace reference and runs under any adapter or a test double.
 */

import type {
  CookieApi,
  CookieClearResult,
  CookieRecord,
  CookieRemoveDetails,
  ZoomCookieClearResult,
} from '../../platform-types/src/index.ts';
import { ZOOM_HOSTS } from './zoom-hosts.ts';

/** Stable identity for a cookie, so one cookie is never removed, or counted, twice. */
export function cookieKey(c: CookieRecord): string {
  const partition = c.partitionKey ? JSON.stringify(c.partitionKey) : '';
  return [c.storeId || '', c.domain, c.path, c.name, partition].join('\0');
}

/** A URL the cookie is valid for. cookies.remove requires one. */
export function cookieUrl(c: CookieRecord): string {
  const scheme = c.secure ? 'https:' : 'http:';
  const host = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
  return scheme + '//' + host + c.path;
}

/**
 * Every cookie the browser will hand us for `host` and its subdomains, deduplicated.
 *
 * `getAll({domain})` already covers subdomains. An empty `partitionKey: {}`
 * makes Chrome (119+) and Firefox return cookies from EVERY partition plus the
 * unpartitioned jar. Without it, a Zoom cookie partitioned under some other
 * top-level site (Zoom embedded in a third-party page) would be invisible and
 * survive the clear. Browsers without partition support reject the empty key,
 * so the plain unpartitioned query is the fallback.
 */
export async function collectCookies(api: CookieApi, host: string): Promise<CookieRecord[]> {
  const queries = [{ domain: host, partitionKey: {} }, { domain: host }];

  for (const query of queries) {
    let cookies: CookieRecord[];
    try {
      cookies = await api.getAll(query);
    } catch {
      continue; // unsupported filter: fall back to the plain query
    }
    const found = new Map<string, CookieRecord>();
    for (const c of cookies || []) {
      found.set(cookieKey(c), c);
    }
    return [...found.values()];
  }

  throw new Error('cookies.getAll unavailable');
}

export async function clearCookiesForHost(api: CookieApi, host: string): Promise<CookieClearResult> {
  const cookies = await collectCookies(api, host);

  // Removals are independent, so they run concurrently.
  const outcomes = await Promise.all(
    cookies.map(async (c) => {
      const details: CookieRemoveDetails = { url: cookieUrl(c), name: c.name };
      if (c.storeId !== undefined) details.storeId = c.storeId;
      if (c.partitionKey) details.partitionKey = c.partitionKey;
      try {
        // Resolves with null when the browser declined the removal.
        return (await api.remove(details)) ? 'removed' : 'failed';
      } catch {
        return 'failed';
      }
    }),
  );

  return {
    removed: outcomes.filter((o) => o === 'removed').length,
    failed: outcomes.filter((o) => o === 'failed').length,
  };
}

/** Clear cookies for every Zoom base domain. A jar that cannot be read counts as a host error. */
export async function clearZoomCookies(api: CookieApi): Promise<ZoomCookieClearResult> {
  let removed = 0;
  let failed = 0;
  let hostErrors = 0;
  for (const host of ZOOM_HOSTS) {
    try {
      const result = await clearCookiesForHost(api, host);
      removed += result.removed;
      failed += result.failed;
    } catch {
      hostErrors++;
    }
  }
  return { removed, failed, hostErrors };
}
