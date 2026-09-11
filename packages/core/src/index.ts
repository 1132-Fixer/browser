/**
 * 1132 Fixer core: the one shared implementation of the Zoom cleanup.
 *
 * Nothing in this package references `chrome.*` or `browser.*`. Browser access
 * is injected through packages/browser-api. tests/integration/validate-source.js
 * fails the build if a browser namespace appears anywhere under packages/core.
 */

export { ZOOM_HOSTS, ZOOM_ORIGIN_PATTERNS, normalizeHost, hostMatchesBase, isZoomHost, shouldClearPageDataForTabUrl } from './zoom-hosts.ts';
export { cookieKey, cookieUrl, collectCookies, clearCookiesForHost, clearZoomCookies } from './cookie-cleanup.ts';
export { clearZoomOriginPageData } from './page-data.ts';
export { POPUP_COPY, describeOutcome, describeInterruption } from './outcome.ts';
