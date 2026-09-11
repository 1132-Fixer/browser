/**
 * Every user-facing string of the fix flow, as pure view models.
 *
 * Truthfulness boundary (operator ruling, 1132-Fixer/chrome#20): the popup
 * reports the OPERATION RESULT (cookies found and removed, tab site data
 * cleared, tab reloaded). It never claims the ZOOM OUTCOME (that Error 1132
 * is resolved), because nothing here can verify that. Do not add wording
 * that implies detection or verification of the error.
 */

import type { OutcomeInput, OutcomeView } from '../../platform-types/src/index.ts';
import { ZOOM_HOSTS } from './zoom-hosts.ts';

export const POPUP_COPY = {
  detectedStatus: 'ZOOM DETECTED',
  detected: "One click clears Zoom cookies and this tab's Zoom site data, then reloads.",
  notZoomStatus: 'NOT ZOOM',
  notZoom: 'Open a zoom.us or zoom.com tab, then click this icon again.',
  workingStatus: 'WORKING',
  working: 'Clearing Zoom site data…',
  accessNeededStatus: 'ACCESS NEEDED',
  accessNeeded: 'This browser has turned off the extension’s access to Zoom sites. Press FIX ZOOM to grant it.',
  accessDenied: 'Zoom site access was not granted. Turn it on in your browser’s extension settings, then try again.',
  errorStatus: 'ERROR',
  interrupted: 'Something interrupted the cleanup. Close and reopen this popup, then try again. Running it twice is safe.',
} as const;

export function describeOutcome({ removed, failed, hostErrors, storageOk, reloaded }: OutcomeInput): OutcomeView {
  const cookieFail = hostErrors === ZOOM_HOSTS.length;
  const cookiePartial = failed > 0 || hostErrors > 0;
  const bits: string[] = [];

  if (cookieFail) {
    bits.push('The browser would not let us read the Zoom cookie jar.');
  } else if (removed === 0 && !cookiePartial) {
    bits.push('No Zoom cookies were left to remove.');
  } else if (cookiePartial) {
    bits.push(`Removed ${removed} Zoom cookie${removed === 1 ? '' : 's'}; ${failed + hostErrors} could not be removed.`);
  } else {
    bits.push(`Removed ${removed} Zoom cookie${removed === 1 ? '' : 's'}.`);
  }

  bits.push(storageOk
    ? "This tab's Zoom site data was cleared."
    : "This tab's Zoom site data could not be cleared.");

  if (reloaded) bits.push('Tab reloaded.');

  const allBad = cookieFail && !storageOk;
  const bad = cookieFail || cookiePartial || !storageOk;
  return {
    status: allBad ? 'ERROR' : bad ? 'PARTIAL' : 'CLEARED',
    kind: allBad || bad ? 'error' : 'done',
    cls: allBad ? 'bad' : bad ? 'warn' : 'good',
    text: bits.join(' '),
  };
}

/** Error text shown when the flow throws. The detail is a message, never a cookie or storage value. */
export function describeInterruption(error: unknown): string {
  const detail = error instanceof Error && error.message ? error.message : String(error);
  return `${POPUP_COPY.interrupted} (detail: ${detail})`;
}
