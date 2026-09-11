'use strict';

/**
 * Minimal PNG decode/encode, dependency-free.
 *
 * Exists because the Chrome Web Store wants 24-bit PNGs with no alpha channel,
 * while Chromium screenshots and canvas exports are always RGBA — and the repo
 * ships no image library. Supports what those two produce: 8-bit, non-interlaced,
 * colour types 0 / 2 / 4 / 6.
 */

const zlib = require('zlib');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS  = { 0: 1, 2: 3, 4: 2, 6: 4 };

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Reverse the per-scanline PNG filters in place, returning packed samples. */
function unfilter(raw, width, height, channels) {
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line   = raw.subarray(pos, pos + stride);
    pos += stride;

    const cur  = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;          // left
      const b = prev ? prev[x] : 0;                              // up
      const c = prev && x >= channels ? prev[x - channels] : 0;  // up-left
      const v = line[x];
      switch (filter) {
        case 0: cur[x] = v; break;
        case 1: cur[x] = (v + a) & 0xff; break;
        case 2: cur[x] = (v + b) & 0xff; break;
        case 3: cur[x] = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p  = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          cur[x] = (v + pred) & 0xff;
          break;
        }
        default: throw new Error(`unsupported PNG filter type ${filter}`);
      }
    }
  }
  return out;
}

/** Decode a PNG buffer into { width, height, channels, data }. */
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');

  let pos = 8;
  let header = null;
  const idat = [];

  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type   = buf.toString('ascii', pos + 4, pos + 8);
    const data   = buf.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;

    if (type === 'IHDR') {
      header = {
        width:     data.readUInt32BE(0),
        height:    data.readUInt32BE(4),
        bitDepth:  data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!header) throw new Error('PNG has no IHDR');
  if (header.bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${header.bitDepth}`);
  if (header.interlace !== 0) throw new Error('interlaced PNG is not supported');
  const channels = CHANNELS[header.colorType];
  if (!channels) throw new Error(`unsupported PNG colour type ${header.colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  return {
    width:  header.width,
    height: header.height,
    channels,
    data:   unfilter(raw, header.width, header.height, channels),
  };
}

/**
 * Flatten any decoded image to packed RGB, compositing over `background`
 * ([r,g,b]) wherever the source is transparent.
 */
function toRgb(image, background = [0, 0, 0]) {
  const { width, height, channels, data } = image;
  const out = Buffer.alloc(width * height * 3);

  for (let i = 0, px = 0; px < width * height; px++) {
    let r, g, b, a = 255;
    const s = px * channels;
    if (channels === 1)      { r = g = b = data[s]; }
    else if (channels === 2) { r = g = b = data[s]; a = data[s + 1]; }
    else if (channels === 3) { r = data[s]; g = data[s + 1]; b = data[s + 2]; }
    else                     { r = data[s]; g = data[s + 1]; b = data[s + 2]; a = data[s + 3]; }

    if (a !== 255) {
      const t = a / 255;
      r = Math.round(r * t + background[0] * (1 - t));
      g = Math.round(g * t + background[1] * (1 - t));
      b = Math.round(b * t + background[2] * (1 - t));
    }
    out[i++] = r; out[i++] = g; out[i++] = b;
  }
  return out;
}

/** Encode packed RGB samples as a 24-bit (colour type 2) PNG. */
function encodeRgbPng(width, height, rgb) {
  if (rgb.length !== width * height * 3) {
    throw new Error(`expected ${width * height * 3} RGB bytes, got ${rgb.length}`);
  }

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // colour type: truecolour, no alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Read a PNG file and rewrite it in place as 24-bit RGB. Returns its size. */
function flattenPngFile(fs, file, background = [0, 0, 0]) {
  const image = decodePng(fs.readFileSync(file));
  fs.writeFileSync(file, encodeRgbPng(image.width, image.height, toRgb(image, background)));
  return { width: image.width, height: image.height };
}

/**
 * Paste `src` (decoded) onto a solid `width` x `height` canvas, centred, and
 * return packed RGB. Used to letterbox the narrow popup shots onto the
 * 1280x800 canvas the Web Store expects.
 */
function letterbox(src, width, height, background = [10, 16, 32]) {
  const canvas = Buffer.alloc(width * height * 3);
  for (let i = 0; i < canvas.length; i += 3) {
    canvas[i] = background[0]; canvas[i + 1] = background[1]; canvas[i + 2] = background[2];
  }

  const rgb = toRgb(src, background);
  const dx  = Math.max(0, Math.round((width  - src.width)  / 2));
  const dy  = Math.max(0, Math.round((height - src.height) / 2));
  const cols = Math.min(src.width,  width);
  const rows = Math.min(src.height, height);

  for (let y = 0; y < rows; y++) {
    const from = y * src.width * 3;
    const to   = ((dy + y) * width + dx) * 3;
    rgb.copy(canvas, to, from, from + cols * 3);
  }
  return canvas;
}

module.exports = { decodePng, encodeRgbPng, toRgb, flattenPngFile, letterbox, crc32 };
