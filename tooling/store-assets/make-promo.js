#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Generate the Chrome Web Store promo tiles, on any OS.
 *
 *   node scripts/make-promo.js                 -> store-assets/promo-440x280.png
 *   node scripts/make-promo.js 1400 560        -> store-assets/promo-1400x560.png
 *
 * Cross-platform replacement for scripts/make-promo.ps1 (System.Drawing, Windows
 * only). Draws into a Chromium canvas, then re-encodes to a 24-bit PNG with no
 * alpha channel, which is what the store requires for promo assets.
 *
 * Content rules from STORE_PREP.md: reuse the shipped 1132 icon and the popup's
 * dark/amber palette, the "1132 FIXER" wordmark, an approved tagline, and the
 * not-affiliated-with-Zoom disclaimer. No Zoom logo or product art.
 */

const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { decodePng, toRgb, encodeRgbPng } = require('../lib/png');

const ROOT    = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'store-assets');
const ICON    = path.join(ROOT, 'packages', 'ui', 'src', 'icons', 'icon128.png');

const WIDTH  = Number(process.argv[2]) || 440;
const HEIGHT = Number(process.argv[3]) || 280;
const OUT    = path.join(OUT_DIR, process.argv[4] || `promo-${WIDTH}x${HEIGHT}.png`);

const COPY = {
  wordmarkA:  '1132',
  wordmarkB:  'FIXER',
  tagline:    'Fix Zoom cookies in one click.',
  subline:    'One button. Zoom cookies only. Reload.',
  disclaimer: 'Independent project. Not affiliated with Zoom.',
};

/** Runs inside the page: paint the tile and hand back a PNG data URL. */
async function paint({ width, height, iconDataUri, copy }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Layout is authored at 440x280 and scaled from there, so the marquee size
  // keeps the same proportions.
  const s = Math.min(width / 440, height / 280);
  const S = v => v * s;

  // The scaled 440x280 layout box, centred on whatever canvas we were asked for.
  // Without this the marquee size would leave all its slack on one side.
  const boxW = S(440);
  const boxH = S(280);
  const ox = (width - boxW) / 2;
  const oy = (height - boxH) / 2;

  // Background: the popup's navy gradient.
  const bg = ctx.createLinearGradient(0, 0, width * 0.35, height);
  bg.addColorStop(0, '#0a1020');
  bg.addColorStop(0.45, '#081018');
  bg.addColorStop(1, '#050a14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Amber glow upper-right, Zoom-blue glow lower-left.
  const amber = ctx.createRadialGradient(width * 0.88, -height * 0.1, 0, width * 0.88, -height * 0.1, height * 1.1);
  amber.addColorStop(0, 'rgba(245,166,35,0.30)');
  amber.addColorStop(1, 'rgba(245,166,35,0)');
  ctx.fillStyle = amber;
  ctx.fillRect(0, 0, width, height);

  const blue = ctx.createRadialGradient(width * 0.05, height * 1.05, 0, width * 0.05, height * 1.05, height * 0.9);
  blue.addColorStop(0, 'rgba(45,140,255,0.22)');
  blue.addColorStop(1, 'rgba(45,140,255,0)');
  ctx.fillStyle = blue;
  ctx.fillRect(0, 0, width, height);

  // Icon, rounded like the popup renders it.
  const icon = new Image();
  await new Promise((resolve, reject) => {
    icon.onload = resolve;
    icon.onerror = () => reject(new Error('icon failed to load'));
    icon.src = iconDataUri;
  });
  const iconSize = S(96);
  const iconX = ox + S(26);
  const iconY = oy + (boxH - iconSize) / 2 - S(6);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = S(22);
  ctx.shadowOffsetY = S(8);
  ctx.beginPath();
  ctx.roundRect(iconX, iconY, iconSize, iconSize, S(24));
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
  ctx.restore();

  const textX = iconX + iconSize + S(20);
  const textRoom = ox + boxW - S(22) - textX;
  const font = (weight, size) => `${weight} ${size}px "DejaVu Sans", "Segoe UI", sans-serif`;

  /**
   * Largest size at or below `start` where the text still fits `textRoom`.
   * Font metrics vary by platform, so measure instead of trusting the layout.
   */
  const fit = (text, weight, start, spacing) => {
    for (let size = start; size > start * 0.55; size -= start * 0.02) {
      ctx.letterSpacing = `${spacing}px`;
      ctx.font = font(weight, size);
      if (ctx.measureText(text).width <= textRoom) return size;
    }
    return start * 0.55;
  };

  // Wordmark: "1132" in the gold gradient, "FIXER" in warm white.
  ctx.textBaseline = 'alphabetic';
  const wordSize = fit(`${copy.wordmarkA} ${copy.wordmarkB}`, 900, S(40), S(2.5));
  ctx.font = font(900, wordSize);
  ctx.letterSpacing = `${S(2.5)}px`;
  const wordY = oy + boxH / 2 - S(22);
  const gold = ctx.createLinearGradient(0, wordY - wordSize, 0, wordY + wordSize * 0.2);
  gold.addColorStop(0, '#ffe066');
  gold.addColorStop(0.55, '#ffd700');
  gold.addColorStop(1, '#f5a623');
  ctx.save();
  ctx.shadowColor = 'rgba(245,166,35,0.45)';
  ctx.shadowBlur = S(16);
  ctx.fillStyle = gold;
  ctx.fillText(copy.wordmarkA, textX, wordY);
  const aWidth = ctx.measureText(copy.wordmarkA).width;
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f4f7fb';
  ctx.fillText(copy.wordmarkB, textX + aWidth + S(12), wordY);
  ctx.restore();

  // Amber rule under the wordmark.
  const rule = ctx.createLinearGradient(textX, 0, textX + S(150), 0);
  rule.addColorStop(0, '#ff8c00');
  rule.addColorStop(1, '#f5a623');
  ctx.fillStyle = rule;
  ctx.beginPath();
  ctx.roundRect(textX, wordY + S(14), S(150), S(4), S(2));
  ctx.fill();

  const taglineSize = fit(copy.tagline, 600, S(16), S(0.3));
  ctx.letterSpacing = `${S(0.3)}px`;
  ctx.font = font(600, taglineSize);
  ctx.fillStyle = '#cfe6ff';
  ctx.fillText(copy.tagline, textX, wordY + S(46));

  const sublineSize = fit(copy.subline, 400, S(11.5), S(0.2));
  ctx.letterSpacing = `${S(0.2)}px`;
  ctx.font = font(400, sublineSize);
  ctx.fillStyle = '#8ca4c0';
  ctx.fillText(copy.subline, textX, wordY + S(68));

  const discSize = fit(copy.disclaimer, 400, S(9.5), 0);
  ctx.letterSpacing = '0px';
  ctx.font = font(400, discSize);
  ctx.fillStyle = '#6f89a6';
  ctx.fillText(copy.disclaimer, textX, wordY + S(87));

  // Hazard stripe along the bottom — the popup's footer motif.
  const bandH = S(10);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, height - bandH, width, bandH);
  ctx.clip();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, height - bandH, width, bandH);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = S(8);
  ctx.globalAlpha = 0.75;
  for (let x = -bandH * 2; x < width + bandH * 2; x += S(16)) {
    ctx.beginPath();
    ctx.moveTo(x, height + bandH);
    ctx.lineTo(x + bandH * 2, height - bandH * 2);
    ctx.stroke();
  }
  ctx.restore();

  return canvas.toDataURL('image/png');
}

(async () => {
  if (!fs.existsSync(ICON)) throw new Error(`source icon missing: ${ICON}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const iconDataUri = 'data:image/png;base64,' + fs.readFileSync(ICON).toString('base64');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    page.on('pageerror', e => { throw new Error('promo page error: ' + e.message); });
    const dataUrl = await page.evaluate(paint, {
      width: WIDTH, height: HEIGHT, iconDataUri, copy: COPY,
    });

    const decoded = decodePng(Buffer.from(dataUrl.split(',')[1], 'base64'));
    fs.writeFileSync(OUT, encodeRgbPng(decoded.width, decoded.height, toRgb(decoded, [10, 16, 32])));
    console.log(`wrote ${path.relative(ROOT, OUT)} (${decoded.width}x${decoded.height}, 24-bit RGB, no alpha)`);
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error('promo generation failed:', (e && e.stack) || e);
  process.exit(1);
});
