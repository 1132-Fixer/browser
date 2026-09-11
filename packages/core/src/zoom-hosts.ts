/**
 * Zoom host matching. Pure functions, no browser access.
 *
 * ZOOM_HOSTS is the only list of domains the extension may touch. The
 * manifest host permissions in apps/extensions/chrome/manifest.json and
 * ZOOM_ORIGIN_PATTERNS below must describe the same two domains;
 * tests/integration/validate-source.js checks that they agree.
 */

export const ZOOM_HOSTS: readonly string[] = ['zoom.us', 'zoom.com'];

/** Match patterns the runtime asks the browser about when host access is revoked (Firefox). */
export const ZOOM_ORIGIN_PATTERNS: readonly string[] = [
  'https://*.zoom.us/*',
  'https://*.zoom.com/*',
  'http://*.zoom.us/*',
  'http://*.zoom.com/*',
];

/** Normalize hostname: lowercase, strip trailing dot, drop port. Returns null if invalid. */
export function normalizeHost(host: unknown): string | null {
  if (typeof host !== 'string') return null;
  let h = host.trim().toLowerCase();
  if (!h) return null;
  if (h.endsWith('.')) h = h.slice(0, -1);
  const colon = h.indexOf(':');
  if (colon >= 0) h = h.slice(0, colon);
  if (!h) return null;
  return h;
}

/** True when host equals base or is a subdomain of base. Both must already be normalized. */
export function hostMatchesBase(host: string | null, base: string | null): boolean {
  if (!host || !base) return false;
  if (host === base) return true;
  return host.endsWith('.' + base);
}

export function isZoomHost(host: unknown): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  return ZOOM_HOSTS.some((z) => hostMatchesBase(h, z));
}

/** True only for http(s) Zoom tabs: the only pages the cleaner may be injected into. */
export function shouldClearPageDataForTabUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    return isZoomHost(u.hostname);
  } catch {
    return false;
  }
}
