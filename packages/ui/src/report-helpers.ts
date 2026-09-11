/**
 * Pure helpers for the Report-a-Bug page. No DOM, no network, no browser API.
 * Unit-tested in tests/unit/report-helpers.test.ts.
 */

// Public support-service endpoint. NOT a secret: same stance as the Windows
// app's FEEDBACK_PROXY_URL. tests/integration/validate-source.js pins this as
// the one allowed network origin in the report page.
export const SUPPORT_ORIGIN = 'https://1132-fixer-feedback-proxy-production.up.railway.app';

export const SHOT_MAX_BYTES = 5 * 1024 * 1024;
export const MIN_TEXT_CHARS = 50;
export const PRINCIPAL_KEY = '1132_support_principal';

/**
 * Product code sent when this install registers with the support service.
 *
 * Every deployment accepts CHROME. Newer deployments advertise the codes they
 * accept in GET /health `capabilities.products`; a build registers with its
 * own browser's code only when that list contains it, so an older service
 * never rejects a newer client (feedback-proxy lib/auth.js, migration 003).
 */
export const SUPPORT_PRODUCT = 'CHROME';

const TARGET_PRODUCT: Record<string, string> = {
  chrome: 'CHROME',
  edge: 'EDGE',
  brave: 'BRAVE',
  firefox: 'FIREFOX',
};

export function productCodeFor(target: string, advertised: readonly string[] | undefined): string {
  const code = TARGET_PRODUCT[target];
  return code && advertised && advertised.includes(code) ? code : SUPPORT_PRODUCT;
}

/** Sniffed image MIME of the bytes, or null when not an accepted image. */
export function sniffImageBytes(u8: Uint8Array | null | undefined): string | null {
  if (!u8 || u8.length < 12) return null;
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47 &&
      u8[4] === 0x0d && u8[5] === 0x0a && u8[6] === 0x1a && u8[7] === 0x0a) return 'image/png';
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg';
  const head = String.fromCharCode.apply(null, Array.from(u8.slice(0, 12)));
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a')) return 'image/gif';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Base64 of a Uint8Array, chunked so large images cannot blow the arg limit. */
export function bytesToBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  }
  return btoa(s);
}

/**
 * Single-line title from the report text, matching the Windows app's rule.
 * Falls back below the service's 3-char title minimum, not only on empty;
 * otherwise the whole submission dies on a "title" error for a field the UI
 * does not have.
 */
export function titleFrom(text: string): string {
  const t = text.slice(0, 80).replace(/\s+/g, ' ').trim();
  return t.length >= 3 ? t : 'Bug report';
}

export interface ServiceResponse {
  status: number;
  json: { error?: { code?: string; message?: string }; [k: string]: unknown } | null;
}

/** User-facing message for a failed submission. Server validation copy is user-facing by contract. */
export function messageFor(r: ServiceResponse): string {
  if (r.status === 429) return 'Too many submissions — try again later.';
  if (r.status === 413) return 'The report is too large — remove the screenshot and try again.';
  if (r.status === 400 && r.json && r.json.error && r.json.error.code === 'validation_failed' && r.json.error.message) {
    return r.json.error.message;
  }
  return 'Submission failed — try again later.';
}
