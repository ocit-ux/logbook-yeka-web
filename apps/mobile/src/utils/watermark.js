/**
 * Geo-Timestamp Photo Watermark Core Generator
 * Provides pure-JS pixel compositing with jpeg-js and bitmapFont for React Native Hermes,
 * and HTML5 Canvas 2D compositing for Web platforms.
 * 
 * Global Constraints:
 * - No em dashes permitted anywhere in code or output strings.
 * - Pure JavaScript: zero DOM or native modules inside stampWatermarkNativeAsync.
 * - Always pass alpha = 255 for solid text colors.
 */

import jpeg from 'jpeg-js';
import { drawText, measureText, GLYPH_HEIGHT } from './bitmapFont.js';

export const HEADER_TEXT = 'YAYASAN ELANG KATULISTIWA ADIPAVITRA';
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

/**
 * Pure-JS Base64 decoder to Uint8Array.
 * Works seamlessly in Hermes React Native without Buffer or atob.
 * @param {string} b64
 * @returns {Uint8Array}
 */
export function base64ToUint8Array(b64) {
  if (!b64 || typeof b64 !== 'string') return new Uint8Array(0);
  const commaIdx = b64.indexOf(',');
  const clean = commaIdx !== -1 ? b64.slice(commaIdx + 1) : b64;
  const sanitized = clean.replace(/[\r\n\t ]/g, '');
  const len = sanitized.length;
  if (len === 0) return new Uint8Array(0);

  let placeHolders = 0;
  if (sanitized[len - 1] === '=') placeHolders++;
  if (sanitized[len - 2] === '=') placeHolders++;

  const byteLen = Math.max(0, Math.floor((len * 3) / 4) - placeHolders);
  const bytes = new Uint8Array(byteLen);

  let cur = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64_LOOKUP[sanitized.charCodeAt(i)];
    const b = B64_LOOKUP[sanitized.charCodeAt(i + 1)];
    const c = sanitized[i + 2] === '=' ? 0 : B64_LOOKUP[sanitized.charCodeAt(i + 2)];
    const d = sanitized[i + 3] === '=' ? 0 : B64_LOOKUP[sanitized.charCodeAt(i + 3)];

    const chunk = (a << 18) | (b << 12) | (c << 6) | d;

    if (cur < byteLen) bytes[cur++] = (chunk >> 16) & 0xff;
    if (cur < byteLen) bytes[cur++] = (chunk >> 8) & 0xff;
    if (cur < byteLen) bytes[cur++] = chunk & 0xff;
  }
  return bytes;
}

/**
 * Pure-JS Uint8Array to Base64 encoder.
 * Works in 30000-byte chunks to avoid call stack limits or large allocations.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function uint8ArrayToBase64(bytes) {
  if (!bytes || bytes.length === 0) return '';
  const len = bytes.length;
  let result = '';
  const CHUNK_SIZE = 30000; // Divisible by 3 for clean block boundaries
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, len);
    let chunkStr = '';
    for (let j = i; j < end; j += 3) {
      const b0 = bytes[j];
      const hasB1 = j + 1 < len;
      const b1 = hasB1 ? bytes[j + 1] : 0;
      const hasB2 = j + 2 < len;
      const b2 = hasB2 ? bytes[j + 2] : 0;

      const n = (b0 << 16) | (b1 << 8) | b2;

      chunkStr += B64_CHARS[(n >> 18) & 63];
      chunkStr += B64_CHARS[(n >> 12) & 63];
      chunkStr += hasB1 ? B64_CHARS[(n >> 6) & 63] : '=';
      chunkStr += hasB2 ? B64_CHARS[n & 63] : '=';
    }
    result += chunkStr;
  }
  return result;
}

/**
 * Sanitizes strings to eliminate any em dash or en dash characters.
 * @param {string} str
 * @returns {string}
 */
function removeEmDashes(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\u2014\u2013]/g, '-');
}

/**
 * Polyfills globalThis.Buffer with lightweight Uint8Array subclass for Hermes React Native.
 * Prevents ReferenceError: Property 'Buffer' doesn't exist when jpeg-js encoder runs.
 */
export function ensureHermesBufferShim() {
  if (typeof globalThis.Buffer === 'undefined') {
    class HermesBufferShim extends Uint8Array {
      toString(encoding) {
        if (encoding === 'base64') {
          return uint8ArrayToBase64(this);
        }
        let str = '';
        for (let i = 0; i < this.length; i++) {
          str += String.fromCharCode(this[i]);
        }
        return str;
      }
    }

    HermesBufferShim.from = function(data, encoding) {
      if (typeof data === 'string') {
        if (encoding === 'base64') {
          return new HermesBufferShim(base64ToUint8Array(data));
        }
        const arr = new HermesBufferShim(data.length);
        for (let i = 0; i < data.length; i++) {
          arr[i] = data.charCodeAt(i) & 0xff;
        }
        return arr;
      }
      if (Array.isArray(data) || data instanceof Uint8Array || ArrayBuffer.isView(data)) {
        return new HermesBufferShim(data);
      }
      if (data instanceof ArrayBuffer) {
        return new HermesBufferShim(data);
      }
      return new HermesBufferShim();
    };

    HermesBufferShim.alloc = function(size, fill = 0) {
      const arr = new HermesBufferShim(size);
      if (fill) arr.fill(fill);
      return arr;
    };

    HermesBufferShim.isBuffer = function(obj) {
      return obj instanceof Uint8Array;
    };

    globalThis.Buffer = HermesBufferShim;
  } else {
    // If Buffer already exists (e.g. Node or partial polyfill), ensure .from and .alloc exist
    if (typeof globalThis.Buffer.from !== 'function') {
      globalThis.Buffer.from = function(data) {
        return new Uint8Array(data);
      };
    }
    if (typeof globalThis.Buffer.alloc !== 'function') {
      globalThis.Buffer.alloc = function(size, fill = 0) {
        const arr = new Uint8Array(size);
        if (fill) arr.fill(fill);
        return arr;
      };
    }
  }
}

/**
 * Formats a Date object to consistent WIB (Asia/Jakarta, UTC+7) string.
 * @param {Date|string|number} dateInput
 * @returns {string}
 */
export function formatWibTimestamp(dateInput) {
  const d = dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date());
  // Normalize to UTC+7 (WIB)
  const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utcMs + (7 * 3600000));

  const day = String(wib.getDate()).padStart(2, '0');
  const month = MONTHS_ID[wib.getMonth()];
  const year = wib.getFullYear();
  const hours = String(wib.getHours()).padStart(2, '0');
  const minutes = String(wib.getMinutes()).padStart(2, '0');
  const seconds = String(wib.getSeconds()).padStart(2, '0');

  return `${day} ${month} ${year} | ${hours}:${minutes}:${seconds} WIB`;
}

/**
 * Formats watermark lines from metadata.
 * Produces clean lines without em dashes.
 * @param {object} metadata - { user, date, coords, location, wilayah, gps }
 * @returns {{ header: string, staff: string, timestamp: string, time: string, location: string, wilayah: string }}
 */
export function formatWatermarkLines(metadata = {}) {
  const user = metadata?.user || {};
  const nama = (user.nama || user.name || 'Staff YEKA').trim();
  const devisi = user.devisi && user.devisi !== '-' ? user.devisi.trim() : '';
  const jabatan = user.jabatan && user.jabatan !== '-' ? user.jabatan.trim() : '';
  const role = devisi || jabatan || 'Staff';
  const staff = `${nama} | ${role}`;

  const timestamp = formatWibTimestamp(metadata?.date);

  // Extract latitude and longitude
  let lat = null;
  let lng = null;

  if (metadata?.coords) {
    lat = metadata.coords.latitude ?? metadata.coords.lat;
    lng = metadata.coords.longitude ?? metadata.coords.lng;
  } else if (metadata?.location) {
    if (metadata.location.coords) {
      lat = metadata.location.coords.latitude ?? metadata.location.coords.lat;
      lng = metadata.location.coords.longitude ?? metadata.location.coords.lng;
    } else {
      lat = metadata.location.latitude ?? metadata.location.lat;
      lng = metadata.location.longitude ?? metadata.location.lng;
    }
  } else if (typeof metadata?.gps === 'string' && metadata.gps.includes(',')) {
    const parts = metadata.gps.split(',');
    lat = parseFloat(parts[0].trim());
    lng = parseFloat(parts[1].trim());
  }

  let locationStr = 'GPS: Belum terkunci';
  if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
    locationStr = `GPS: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  } else if (typeof metadata?.gps === 'string' && metadata.gps.trim()) {
    locationStr = metadata.gps.startsWith('GPS:') ? metadata.gps : `GPS: ${metadata.gps}`;
  }

  // Format wilayah
  let wilayahStr = '';
  if (typeof metadata?.wilayah === 'string') {
    wilayahStr = metadata.wilayah.trim();
  } else if (metadata?.wilayah && typeof metadata.wilayah === 'object') {
    const parts = [metadata.wilayah.desa, metadata.wilayah.kecamatan, metadata.wilayah.kabupaten]
      .map(p => (p && typeof p === 'string' ? p.trim() : ''))
      .filter(p => p && p !== '-');
    wilayahStr = parts.join(', ');
  }
  if (wilayahStr === '-') wilayahStr = '';

  return {
    header: removeEmDashes(HEADER_TEXT),
    staff: removeEmDashes(staff),
    timestamp: removeEmDashes(timestamp),
    time: removeEmDashes(timestamp),
    location: removeEmDashes(locationStr),
    wilayah: removeEmDashes(wilayahStr)
  };
}

/**
 * Stamps geo-timestamp watermark onto a base64 JPEG image in pure JavaScript.
 * Runs on Android Hermes and Node with zero DOM or native modules.
 * @param {string} jpegBase64 - Input JPEG base64 string (with or without data URI scheme)
 * @param {object} metadata - Watermark metadata
 * @returns {Promise<{ uri: string, base64: string }>}
 */
export async function stampWatermarkNativeAsync(jpegBase64, metadata = {}) {
  ensureHermesBufferShim();

  if (typeof jpegBase64 !== 'string' || !jpegBase64.trim()) {
    throw new Error('stampWatermarkNativeAsync: input base64 string is required');
  }

  const rawBytes = base64ToUint8Array(jpegBase64);
  const decoded = jpeg.decode(rawBytes, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = decoded;

  const lines = formatWatermarkLines(metadata);

  // Responsive scale factor based on image width
  // scale 1 for width < 700px, scale 2 for 700px-1400px (e.g. standard 1000px mobile photo)
  const scale = Math.max(1, Math.round(width / 500));
  const charSpacing = 1;
  const lineSpacing = 2;

  const paddingX = Math.max(6, Math.round(12 * scale));
  const paddingY = Math.max(6, Math.round(10 * scale));
  const barWidth = Math.max(3, Math.round(3 * scale));
  const barGap = Math.max(4, Math.round(6 * scale));

  const textStartX = paddingX + barWidth + barGap;
  const maxWidth = Math.max(50, width - textStartX - paddingX);

  // Prepare text entries
  // Alpha is strictly 255 for solid colors
  const textItems = [
    { text: lines.header, color: [212, 175, 55, 255] },
    { text: lines.staff, color: [255, 255, 255, 255] },
    { text: lines.timestamp, color: [255, 255, 255, 255] },
    { text: lines.location, color: [255, 255, 255, 255] }
  ];
  if (lines.wilayah) {
    textItems.push({ text: lines.wilayah, color: [255, 255, 255, 255] });
  }

  // Calculate total visual lines including word wrapping
  let totalVisualLines = 0;
  for (const item of textItems) {
    const m = measureText(item.text, scale, maxWidth, lineSpacing);
    totalVisualLines += Math.max(1, m.lines.length);
  }

  const textTotalHeight = totalVisualLines * (GLYPH_HEIGHT * scale) + Math.max(0, totalVisualLines - 1) * (lineSpacing * scale);
  const bannerHeight = textTotalHeight + (paddingY * 2);
  const bannerY = Math.max(0, height - bannerHeight);

  // 1. Alpha-blend dark banner rgba(15, 23, 42, 0.76) on bottom rows
  const bannerStartIdx = bannerY * width * 4;
  const totalBannerPixels = (height - bannerY) * width;
  for (let i = 0; i < totalBannerPixels; i++) {
    const idx = bannerStartIdx + (i * 4);
    data[idx] = (15 * 0.76 + data[idx] * 0.24) | 0;
    data[idx + 1] = (23 * 0.76 + data[idx + 1] * 0.24) | 0;
    data[idx + 2] = (42 * 0.76 + data[idx + 2] * 0.24) | 0;
    data[idx + 3] = 255;
  }

  // 2. Draw gold vertical accent bar (#d4af37)
  const barStartY = bannerY + paddingY;
  const barEndY = bannerY + bannerHeight - paddingY;
  const goldR = 212, goldG = 175, goldB = 55;
  for (let y = barStartY; y < barEndY && y < height; y++) {
    for (let x = paddingX; x < paddingX + barWidth && x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = goldR;
      data[idx + 1] = goldG;
      data[idx + 2] = goldB;
      data[idx + 3] = 255;
    }
  }

  // 3. Draw text items
  let curY = barStartY;
  for (const item of textItems) {
    const res = drawText(data, width, height, item.text, textStartX, curY, {
      scale,
      color: item.color,
      maxWidth,
      lineSpacing,
      charSpacing
    });
    curY = res.nextY;
  }

  // 4. Encode back to JPEG with quality 75
  const encoded = jpeg.encode({ data, width, height }, 75);

  let base64Out = '';
  if (typeof globalThis.Buffer !== 'undefined' && typeof globalThis.Buffer.from === 'function') {
    base64Out = globalThis.Buffer.from(encoded.data).toString('base64');
  } else {
    base64Out = uint8ArrayToBase64(encoded.data);
  }

  return {
    uri: 'data:image/jpeg;base64,' + base64Out,
    base64: base64Out
  };
}

/**
 * Stamps geo-timestamp watermark onto an HTML5 Canvas 2D element.
 * Used for Web App iOS Safari and Web Apps Google Apps Script.
 * @param {HTMLCanvasElement} canvas
 * @param {object} metadata
 * @returns {HTMLCanvasElement}
 */
export function stampWatermarkCanvas(canvas, metadata = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('stampWatermarkCanvas: valid canvas element is required');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const lines = formatWatermarkLines(metadata);

  // Responsive scale relative to 1000px photo width
  const scale = Math.max(0.6, width / 1000);
  const fontSizeHeader = Math.max(10, Math.round(15 * scale));
  const fontSizeBody = Math.max(9, Math.round(13 * scale));
  const lineSpacing = Math.max(4, Math.round(6 * scale));
  const paddingX = Math.max(10, Math.round(20 * scale));
  const paddingY = Math.max(8, Math.round(14 * scale));
  const barWidth = Math.max(3, Math.round(4 * scale));
  const barGap = Math.max(6, Math.round(10 * scale));

  const textStartX = paddingX + barWidth + barGap;
  const maxWidth = Math.max(50, width - textStartX - paddingX);

  const textEntries = [
    { text: lines.header, color: '#d4af37', bold: true, size: fontSizeHeader },
    { text: lines.staff, color: '#ffffff', bold: false, size: fontSizeBody },
    { text: lines.timestamp, color: '#ffffff', bold: false, size: fontSizeBody },
    { text: lines.location, color: '#ffffff', bold: false, size: fontSizeBody }
  ];
  if (lines.wilayah) {
    textEntries.push({ text: lines.wilayah, color: '#ffffff', bold: false, size: fontSizeBody });
  }

  // Pre-calculate visual lines with word wrapping
  const visualLines = [];
  for (const entry of textEntries) {
    if (typeof ctx.measureText === 'function') {
      ctx.font = `${entry.bold ? 'bold ' : ''}${entry.size}px sans-serif`;
      const fullW = ctx.measureText(entry.text).width;
      if (fullW > maxWidth && maxWidth > 0) {
        const words = entry.text.split(' ');
        let curLine = '';
        for (const w of words) {
          const testLine = curLine ? `${curLine} ${w}` : w;
          if (ctx.measureText(testLine).width <= maxWidth) {
            curLine = testLine;
          } else {
            if (curLine) visualLines.push({ ...entry, text: curLine });
            curLine = w;
          }
        }
        if (curLine) visualLines.push({ ...entry, text: curLine });
      } else {
        visualLines.push(entry);
      }
    } else {
      visualLines.push(entry);
    }
  }

  const totalContentHeight = visualLines.reduce((acc, l, idx) => {
    return acc + l.size + (idx > 0 ? lineSpacing : 0);
  }, 0);

  const bannerHeight = Math.max(height * 0.12, totalContentHeight + paddingY * 2);
  const bannerY = Math.max(0, height - bannerHeight);

  // 1. Draw dark background banner rgba(15, 23, 42, 0.76)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
  ctx.fillRect(0, bannerY, width, bannerHeight);

  // 2. Draw gold vertical accent bar (#d4af37)
  const barStartY = bannerY + paddingY;
  const barHeight = bannerHeight - paddingY * 2;
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(paddingX, barStartY, barWidth, barHeight);

  // 3. Draw text lines
  ctx.textBaseline = 'top';
  let curY = barStartY;
  for (const l of visualLines) {
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size}px sans-serif`;
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, textStartX, curY);
    curY += l.size + lineSpacing;
  }

  return canvas;
}

export default {
  HEADER_TEXT,
  base64ToUint8Array,
  uint8ArrayToBase64,
  ensureHermesBufferShim,
  formatWibTimestamp,
  formatWatermarkLines,
  stampWatermarkNativeAsync,
  stampWatermarkCanvas
};
