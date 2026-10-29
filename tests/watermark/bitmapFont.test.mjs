import test from 'node:test';
import assert from 'node:assert';
import { drawText, measureText } from '../../apps/mobile/src/utils/bitmapFont.js';

test('measureText calculates correct pixel dimensions for scale', () => {
  const dims = measureText('YEKA', 2);
  assert.strictEqual(dims.width > 0, true);
  assert.strictEqual(dims.height, 7 * 2);
});

test('measureText returns zero dimensions for empty or whitespace-only without height', () => {
  const empty = measureText('', 1);
  assert.strictEqual(empty.width, 0);
  assert.strictEqual(empty.height, 0);
});

test('drawText burns pixels into RGBA buffer at designated coordinates', () => {
  const width = 100;
  const height = 50;
  const buffer = new Uint8Array(width * height * 4); // all black/transparent

  const res = drawText(buffer, width, height, 'A', 10, 10, { scale: 1, color: [255, 255, 255, 255] });

  assert.strictEqual(typeof res.nextY, 'number');
  assert.strictEqual(typeof res.textWidth, 'number');
  assert.strictEqual(res.textWidth > 0, true);

  // Verify at least one pixel turned white [255, 255, 255, 255]
  let hasWhite = false;
  for (let i = 0; i < buffer.length; i += 4) {
    if (buffer[i] === 255 && buffer[i + 1] === 255 && buffer[i + 2] === 255 && buffer[i + 3] === 255) {
      hasWhite = true;
      break;
    }
  }
  assert.strictEqual(hasWhite, true);
});

test('drawText handles scale factor properly (scale 2 creates 2x2 blocks)', () => {
  const width = 40;
  const height = 40;
  const buf1 = new Uint8Array(width * height * 4);
  const buf2 = new Uint8Array(width * height * 4);

  drawText(buf1, width, height, 'I', 5, 5, { scale: 1, color: [255, 255, 255, 255] });
  drawText(buf2, width, height, 'I', 5, 5, { scale: 2, color: [255, 255, 255, 255] });

  let count1 = 0;
  for (let i = 0; i < buf1.length; i += 4) {
    if (buf1[i] === 255) count1++;
  }

  let count2 = 0;
  for (let i = 0; i < buf2.length; i += 4) {
    if (buf2[i] === 255) count2++;
  }

  // Scale 2 should render approximately 4x the pixel count of scale 1
  assert.strictEqual(count2, count1 * 4);
});

test('drawText supports custom colors and alpha blending', () => {
  const width = 20;
  const height = 20;
  const buffer = new Uint8Array(width * height * 4);

  // Pre-fill buffer with solid blue [0, 0, 255, 255]
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 0;
    buffer[i + 1] = 0;
    buffer[i + 2] = 255;
    buffer[i + 3] = 255;
  }

  // Draw red with 50% opacity (alpha = 128)
  drawText(buffer, width, height, 'X', 2, 2, { scale: 1, color: [255, 0, 0, 128] });

  // A written pixel should blend red over blue
  let blendedFound = false;
  for (let i = 0; i < buffer.length; i += 4) {
    if (buffer[i] > 100 && buffer[i + 2] > 100) {
      blendedFound = true;
      break;
    }
  }
  assert.strictEqual(blendedFound, true);
});

test('drawText and measureText handle explicit newlines', () => {
  const single = measureText('Hello', 1);
  const multiline = measureText('Hello\nWorld', 1);

  assert.strictEqual(multiline.height > single.height, true);

  const width = 80;
  const height = 40;
  const buffer = new Uint8Array(width * height * 4);
  const res = drawText(buffer, width, height, 'Line 1\nLine 2', 5, 5, { scale: 1 });

  assert.strictEqual(res.nextY > 5 + 7, true);
});

test('drawText and measureText wrap words when maxWidth is set', () => {
  const scale = 1;
  const fullText = 'The quick brown fox jumps over the lazy dog';
  const unwrapped = measureText(fullText, scale);

  // If maxWidth is half of unwrapped width, it must wrap into multiple lines
  const maxWidth = Math.floor(unwrapped.width / 2);
  const wrapped = measureText(fullText, scale, maxWidth);

  assert.strictEqual(wrapped.height > unwrapped.height, true);
  assert.strictEqual(wrapped.width <= maxWidth + 10, true);

  const width = 200;
  const height = 200;
  const buffer = new Uint8Array(width * height * 4);
  const res = drawText(buffer, width, height, fullText, 10, 10, { scale, maxWidth });

  assert.strictEqual(res.nextY > 10 + 7, true);
});

test('drawText handles long unbroken word exceeding maxWidth', () => {
  const longWord = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  const width = 100;
  const height = 100;
  const buffer = new Uint8Array(width * height * 4);

  // Should break into multiple lines without throwing
  assert.doesNotThrow(() => {
    drawText(buffer, width, height, longWord, 5, 5, { scale: 1, maxWidth: 30 });
  });
});

test('drawText handles non-ASCII characters gracefully without throwing', () => {
  const width = 80;
  const height = 40;
  const buffer = new Uint8Array(width * height * 4);
  const nonAsciiText = 'YEKA: \u00E9, \u00F1, \u2014, \u201Cquote\u201D, \uD83D\uDE00';

  assert.doesNotThrow(() => {
    drawText(buffer, width, height, nonAsciiText, 5, 5, { scale: 1 });
  });
});

test('drawText safely clips coordinates outside buffer boundaries', () => {
  const width = 30;
  const height = 30;
  const buffer = new Uint8Array(width * height * 4);

  // Negative coordinates and out-of-bound coordinates should not throw or corrupt
  assert.doesNotThrow(() => {
    drawText(buffer, width, height, 'CLIP', -5, -3, { scale: 2 });
    drawText(buffer, width, height, 'CLIP', 25, 25, { scale: 2 });
  });
});
