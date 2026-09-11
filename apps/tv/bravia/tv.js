// @ts-check
/**
 * 1132 Fixer TV guide: D-pad focus manager, back handling, connectivity state.
 *
 * Plain JavaScript on purpose: this file is served as-is by GitHub Pages and
 * by the Sony BRAVIA WebAppRuntime, with no build step. Type-checked with
 * `tsc --checkJs` (see tsconfig.json).
 *
 * Behaviour:
 *   - Deterministic focus order from data-order. Arrow keys move between
 *     cards; a panel traps focus on its BACK control.
 *   - OK / Enter opens the focused card's panel. BACK closes it and returns
 *     focus to the card that opened it. On the home screen BACK is left to
 *     the platform (Android TV: leaves the app).
 *   - Online/offline state is shown in the top bar; the guide keeps working
 *     offline because it needs no network.
 *   - Recovery after suspend: on `pageshow` / visibility change the focus is
 *     restored, so a resumed app never sits with nothing focused.
 */
(function () {
  'use strict';

  /** Key codes: standard arrows/Enter/Escape/Backspace, CE-HTML VK_BACK (461), Tizen back (10009). */
  var KEY = {
    LEFT: [37], UP: [38], RIGHT: [39], DOWN: [40],
    OK: [13],
    BACK: [8, 27, 461, 10009],
  };

  /** @param {number[]} codes @param {KeyboardEvent} e */
  function is(codes, e) { return codes.indexOf(e.keyCode) >= 0; }

  /** @returns {HTMLElement[]} */
  function cards() {
    return Array.prototype.slice.call(document.querySelectorAll('.tv-card'))
      .sort(function (a, b) { return Number(a.dataset.order) - Number(b.dataset.order); });
  }

  /** @type {HTMLElement | null} */
  var openedFrom = null;

  /** @returns {HTMLElement | null} */
  function openPanel() {
    return document.querySelector('.tv-panel:not([hidden])');
  }

  /** @param {HTMLElement} card */
  function showPanel(card) {
    var id = card.dataset.panel;
    var panel = id ? document.getElementById(id) : null;
    if (!panel) return;
    openedFrom = card;
    var home = document.getElementById('home');
    if (home) home.setAttribute('aria-hidden', 'true');
    panel.hidden = false;
    var back = /** @type {HTMLElement | null} */ (panel.querySelector('[data-back]'));
    if (back) back.focus();
  }

  function closePanel() {
    var panel = openPanel();
    if (!panel) return false;
    panel.hidden = true;
    var home = document.getElementById('home');
    if (home) home.removeAttribute('aria-hidden');
    var target = openedFrom || cards()[0] || null;
    if (target) target.focus();
    openedFrom = null;
    return true;
  }

  /** @param {number} delta */
  function moveFocus(delta) {
    var list = cards();
    var first = list[0];
    if (!first) return;
    var active = document.activeElement;
    var index = list.indexOf(/** @type {HTMLElement} */ (active));
    if (index < 0) { first.focus(); return; }
    var next = list[Math.min(list.length - 1, Math.max(0, index + delta))];
    if (next) next.focus();
  }

  function ensureFocus() {
    var panel = openPanel();
    if (panel) {
      var back = /** @type {HTMLElement | null} */ (panel.querySelector('[data-back]'));
      if (back && document.activeElement !== back) back.focus();
      return;
    }
    var list = cards();
    var first = list[0];
    if (first && list.indexOf(/** @type {HTMLElement} */ (document.activeElement)) < 0) first.focus();
  }

  /** @param {KeyboardEvent} e */
  function onKeyDown(e) {
    if (openPanel()) {
      if (is(KEY.BACK, e) || is(KEY.LEFT, e) || is(KEY.UP, e) || is(KEY.RIGHT, e) || is(KEY.DOWN, e)) {
        e.preventDefault();
        if (is(KEY.BACK, e)) closePanel(); else ensureFocus();
      }
      return;
    }
    if (is(KEY.LEFT, e) || is(KEY.UP, e)) { e.preventDefault(); moveFocus(-1); return; }
    if (is(KEY.RIGHT, e) || is(KEY.DOWN, e)) { e.preventDefault(); moveFocus(1); return; }
    if (is(KEY.OK, e)) {
      var active = /** @type {HTMLElement | null} */ (document.activeElement);
      if (active && active.classList.contains('tv-card')) { e.preventDefault(); showPanel(active); }
    }
    // BACK on the home screen is left to the platform.
  }

  function updateNetState() {
    var el = document.getElementById('netState');
    if (!el) return;
    var online = navigator.onLine !== false;
    el.textContent = online ? 'ONLINE' : 'OFFLINE · GUIDE STILL WORKS';
    el.classList.toggle('offline', !online);
  }

  function init() {
    cards().forEach(function (card) {
      card.addEventListener('click', function () { showPanel(card); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (btn) {
      btn.addEventListener('click', closePanel);
    });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('online', updateNetState);
    window.addEventListener('offline', updateNetState);
    window.addEventListener('pageshow', ensureFocus);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ensureFocus(); });
    updateNetState();
    ensureFocus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
