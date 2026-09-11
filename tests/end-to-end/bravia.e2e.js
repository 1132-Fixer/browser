#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * BRAVIA TV client: ten-foot behaviour in a Chromium at TV viewports.
 *
 *   node tests/end-to-end/bravia.e2e.js
 *
 * Sony's WebAppRuntime is Chromium-based, but this is an EMULATION on a
 * desktop engine: layout, D-pad focus order, OK/BACK handling, offline
 * state, and safe-area margins. Real-device behaviour (remote key codes,
 * Pro-mode launch, suspend/resume) is MANUAL_VALIDATION_REQUIRED.
 */

const path = require('path');
const { chromium } = require('playwright');
const { serveDirectory } = require('../../tooling/lib/static-server');
const T = require('../../tooling/build/targets');

let passed = 0;
let failed = 0;
function check(ok, name, detail) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
function group(title) { console.log('\n' + title); }

const focusedId = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
const openPanelId = (page) => page.evaluate(() => { const p = document.querySelector('.tv-panel:not([hidden])'); return p ? p.id : null; });

(async () => {
  const server = await serveDirectory(path.join(T.DIST_DIR, 'bravia'));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [label, viewport] of [['1080p', { width: 1920, height: 1080 }], ['720p', { width: 1280, height: 720 }], ['4K scaled', { width: 3840, height: 2160 }]]) {
      group(`layout at ${label}`);
      const context = await browser.newContext({ viewport, hasTouch: false });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(server.origin + '/index.html', { waitUntil: 'load' });
      const m = await page.evaluate(() => {
        const safe = document.querySelector('.safe-area');
        const cs = getComputedStyle(safe);
        const body = getComputedStyle(document.querySelector('.tv-lead'));
        const cards = [...document.querySelectorAll('.tv-card')].map((c) => c.getBoundingClientRect());
        return {
          padL: parseFloat(cs.paddingLeft), padT: parseFloat(cs.paddingTop),
          leadPx: parseFloat(body.fontSize),
          scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
          cardsInside: cards.every((r) => r.left >= innerWidth * 0.05 - 1 && r.right <= innerWidth * 0.95 + 1 && r.bottom <= innerHeight * 0.95 + 1),
          cardCount: cards.length,
        };
      });
      check(errors.length === 0, 'no page errors', errors.join('; '));
      check(m.padL >= viewport.width * 0.05 - 1 && m.padT >= viewport.height * 0.05 - 1, 'safe-area padding is at least 5% (overscan)', `${m.padL}x${m.padT}`);
      check(m.leadPx >= 20, 'lead text is at least 20px', String(m.leadPx));
      check(m.scrollW <= viewport.width && m.scrollH <= viewport.height, 'no scrolling at TV viewport', `${m.scrollW}x${m.scrollH}`);
      check(m.cardCount === 3 && m.cardsInside, 'all three cards sit inside the 90% title-safe box');
      await context.close();
    }

    group('D-pad navigation, OK, BACK, focus recovery');
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.goto(server.origin + '/index.html', { waitUntil: 'load' });
    check((await focusedId(page)) === 'card-computer', 'first card is focused on load (never nothing focused)', await focusedId(page));
    await page.keyboard.press('ArrowRight');
    check((await focusedId(page)) === 'card-windows', 'ArrowRight moves to the second card');
    await page.keyboard.press('ArrowDown');
    check((await focusedId(page)) === 'card-tv', 'ArrowDown moves to the third card');
    await page.keyboard.press('ArrowRight');
    check((await focusedId(page)) === 'card-tv', 'focus stops at the last card (no wrap surprises)');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    check((await focusedId(page)) === 'card-computer', 'ArrowLeft/ArrowUp move back to the first card');
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    check(ring !== 'none', 'focused card has a visible outline', ring);

    await page.keyboard.press('Enter');
    check((await openPanelId(page)) === 'panel-computer', 'OK opens the focused card\'s panel');
    check((await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-back'))), 'focus moves to the BACK control inside the panel');
    check((await page.evaluate(() => document.getElementById('home').getAttribute('aria-hidden'))) === 'true', 'home is hidden from assistive tech while a panel is open');
    await page.keyboard.press('ArrowDown');
    check((await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-back'))), 'arrows inside a panel keep focus on BACK');
    await page.keyboard.press('Escape');
    check((await openPanelId(page)) === null, 'BACK (Escape) closes the panel');
    check((await focusedId(page)) === 'card-computer', 'focus returns to the card that opened the panel');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    check((await openPanelId(page)) === 'panel-tv', 'third card opens the TV panel');
    await page.keyboard.press('Backspace');
    check((await openPanelId(page)) === null && (await focusedId(page)) === 'card-tv', 'Backspace also acts as BACK and restores focus');
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 461, bubbles: true })));
    check((await openPanelId(page)) === null, 'CE-HTML VK_BACK (461) on the home screen is left to the platform (no crash)');
    await page.keyboard.press('Enter');
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 461, bubbles: true })));
    check((await openPanelId(page)) === null, 'CE-HTML VK_BACK (461) closes an open panel');

    // Focus recovery after a suspend/resume-like cycle.
    await page.evaluate(() => { document.activeElement.blur(); window.dispatchEvent(new Event('pageshow')); });
    check((await focusedId(page)) === 'card-computer', 'pageshow restores focus to a card');

    // Offline state.
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    const off = await page.evaluate(() => document.getElementById('netState').textContent);
    check(/OFFLINE/.test(off), 'offline banner appears and says the guide still works', off);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    check((await page.evaluate(() => document.getElementById('netState').textContent)) === 'ONLINE', 'online state restored');

    // No hover-only affordances: every interactive element is a button.
    const interactive = await page.evaluate(() => [...document.querySelectorAll('[data-panel], [data-back]')].every((el) => el.tagName === 'BUTTON'));
    check(interactive, 'every interactive element is a real <button>');
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
  console.log('');
  console.log(`[bravia] Passed: ${passed}  Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('\nbravia e2e crashed:', (e && e.stack) || e);
  process.exit(1);
});
