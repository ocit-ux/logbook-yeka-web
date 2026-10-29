/**
 * Embedded pure-JS 5x7 bitmap font and RGBA glyph renderer.
 * Self-contained ASCII 32 to 126 glcdfont matrix for Hermes React Native.
 * Zero external font files, zero Canvas, zero native modules.
 */

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
export const DEFAULT_CHAR_SPACING = 1;
export const DEFAULT_LINE_SPACING = 2;

// 95 ASCII characters (32 to 126), 5 column bytes per character.
// LSB = row 0 (top), bit 6 = row 6 (bottom).
const FONT_DATA = new Uint8Array([
  0x00, 0x00, 0x00, 0x00, 0x00, // 32 ' '
  0x00, 0x00, 0x5f, 0x00, 0x00, // 33 '!'
  0x00, 0x07, 0x00, 0x07, 0x00, // 34 '"'
  0x14, 0x7f, 0x14, 0x7f, 0x14, // 35 '#'
  0x24, 0x2a, 0x6b, 0x2a, 0x12, // 36 '$'
  0x23, 0x13, 0x08, 0x64, 0x62, // 37 '%'
  0x36, 0x49, 0x55, 0x22, 0x50, // 38 '&'
  0x00, 0x05, 0x03, 0x00, 0x00, // 39 '''
  0x00, 0x1c, 0x22, 0x41, 0x00, // 40 '('
  0x00, 0x41, 0x22, 0x1c, 0x00, // 41 ')'
  0x14, 0x08, 0x3e, 0x08, 0x14, // 42 '*'
  0x08, 0x08, 0x3e, 0x08, 0x08, // 43 '+'
  0x00, 0x50, 0x30, 0x00, 0x00, // 44 ','
  0x08, 0x08, 0x08, 0x08, 0x08, // 45 '-'
  0x00, 0x60, 0x60, 0x00, 0x00, // 46 '.'
  0x20, 0x10, 0x08, 0x04, 0x02, // 47 '/'
  0x3e, 0x51, 0x49, 0x45, 0x3e, // 48 '0'
  0x00, 0x42, 0x7f, 0x40, 0x00, // 49 '1'
  0x42, 0x61, 0x51, 0x49, 0x46, // 50 '2'
  0x21, 0x41, 0x45, 0x4b, 0x31, // 51 '3'
  0x18, 0x14, 0x12, 0x7f, 0x10, // 52 '4'
  0x27, 0x45, 0x45, 0x45, 0x39, // 53 '5'
  0x3c, 0x4a, 0x49, 0x49, 0x30, // 54 '6'
  0x01, 0x71, 0x09, 0x05, 0x03, // 55 '7'
  0x36, 0x49, 0x49, 0x49, 0x36, // 56 '8'
  0x06, 0x49, 0x49, 0x29, 0x1e, // 57 '9'
  0x00, 0x36, 0x36, 0x00, 0x00, // 58 ':'
  0x00, 0x56, 0x36, 0x00, 0x00, // 59 ';'
  0x08, 0x14, 0x22, 0x41, 0x00, // 60 '<'
  0x14, 0x14, 0x14, 0x14, 0x14, // 61 '='
  0x00, 0x41, 0x22, 0x14, 0x08, // 62 '>'
  0x02, 0x01, 0x51, 0x09, 0x06, // 63 '?'
  0x32, 0x49, 0x79, 0x41, 0x3e, // 64 '@'
  0x7e, 0x11, 0x11, 0x11, 0x7e, // 65 'A'
  0x7f, 0x49, 0x49, 0x49, 0x36, // 66 'B'
  0x3e, 0x41, 0x41, 0x41, 0x22, // 67 'C'
  0x7f, 0x41, 0x41, 0x22, 0x1c, // 68 'D'
  0x7f, 0x49, 0x49, 0x49, 0x41, // 69 'E'
  0x7f, 0x09, 0x09, 0x09, 0x01, // 70 'F'
  0x3e, 0x41, 0x49, 0x49, 0x7a, // 71 'G'
  0x7f, 0x08, 0x08, 0x08, 0x7f, // 72 'H'
  0x00, 0x41, 0x7f, 0x41, 0x00, // 73 'I'
  0x20, 0x40, 0x41, 0x3f, 0x01, // 74 'J'
  0x7f, 0x08, 0x14, 0x22, 0x41, // 75 'K'
  0x7f, 0x40, 0x40, 0x40, 0x40, // 76 'L'
  0x7f, 0x02, 0x0c, 0x02, 0x7f, // 77 'M'
  0x7f, 0x04, 0x08, 0x10, 0x7f, // 78 'N'
  0x3e, 0x41, 0x41, 0x41, 0x3e, // 79 'O'
  0x7f, 0x09, 0x09, 0x09, 0x06, // 80 'P'
  0x3e, 0x41, 0x51, 0x21, 0x5e, // 81 'Q'
  0x7f, 0x09, 0x19, 0x29, 0x46, // 82 'R'
  0x46, 0x49, 0x49, 0x49, 0x31, // 83 'S'
  0x01, 0x01, 0x7f, 0x01, 0x01, // 84 'T'
  0x3f, 0x40, 0x40, 0x40, 0x3f, // 85 'U'
  0x1f, 0x20, 0x40, 0x20, 0x1f, // 86 'V'
  0x3f, 0x40, 0x38, 0x40, 0x3f, // 87 'W'
  0x63, 0x14, 0x08, 0x14, 0x63, // 88 'X'
  0x07, 0x08, 0x70, 0x08, 0x07, // 89 'Y'
  0x61, 0x51, 0x49, 0x45, 0x43, // 90 'Z'
  0x00, 0x7f, 0x41, 0x41, 0x00, // 91 '['
  0x02, 0x04, 0x08, 0x10, 0x20, // 92 '\\'
  0x00, 0x41, 0x41, 0x7f, 0x00, // 93 ']'
  0x04, 0x02, 0x01, 0x02, 0x04, // 94 '^'
  0x40, 0x40, 0x40, 0x40, 0x40, // 95 '_'
  0x00, 0x01, 0x02, 0x04, 0x00, // 96 '`'
  0x20, 0x54, 0x54, 0x54, 0x78, // 97 'a'
  0x7f, 0x48, 0x44, 0x44, 0x38, // 98 'b'
  0x38, 0x44, 0x44, 0x44, 0x20, // 99 'c'
  0x38, 0x44, 0x44, 0x48, 0x7f, // 100 'd'
  0x38, 0x54, 0x54, 0x54, 0x18, // 101 'e'
  0x08, 0x7e, 0x09, 0x01, 0x02, // 102 'f'
  0x0c, 0x52, 0x52, 0x52, 0x3e, // 103 'g'
  0x7f, 0x08, 0x04, 0x04, 0x78, // 104 'h'
  0x00, 0x44, 0x7d, 0x40, 0x00, // 105 'i'
  0x20, 0x40, 0x44, 0x3d, 0x00, // 106 'j'
  0x7f, 0x10, 0x28, 0x44, 0x00, // 107 'k'
  0x00, 0x41, 0x7f, 0x40, 0x00, // 108 'l'
  0x7c, 0x04, 0x18, 0x04, 0x78, // 109 'm'
  0x7c, 0x08, 0x04, 0x04, 0x78, // 110 'n'
  0x38, 0x44, 0x44, 0x44, 0x38, // 111 'o'
  0x7c, 0x14, 0x14, 0x14, 0x08, // 112 'p'
  0x08, 0x14, 0x14, 0x18, 0x7c, // 113 'q'
  0x7c, 0x08, 0x04, 0x04, 0x08, // 114 'r'
  0x48, 0x54, 0x54, 0x54, 0x20, // 115 's'
  0x04, 0x3f, 0x44, 0x40, 0x20, // 116 't'
  0x3c, 0x40, 0x40, 0x20, 0x7c, // 117 'u'
  0x1c, 0x20, 0x40, 0x20, 0x1c, // 118 'v'
  0x3c, 0x40, 0x30, 0x40, 0x3c, // 119 'w'
  0x44, 0x28, 0x10, 0x28, 0x44, // 120 'x'
  0x0c, 0x50, 0x50, 0x50, 0x3c, // 121 'y'
  0x44, 0x64, 0x54, 0x4c, 0x44, // 122 'z'
  0x00, 0x08, 0x36, 0x41, 0x00, // 123 '{'
  0x00, 0x00, 0x7f, 0x00, 0x00, // 124 '|'
  0x00, 0x41, 0x36, 0x08, 0x00, // 125 '}'
  0x10, 0x08, 0x08, 0x10, 0x08  // 126 '~'
]);

/**
 * Fallback mapping for characters outside ASCII 32 to 126.
 * Normalizes diacritics, unicode dashes, and smart quotes.
 */
function sanitizeChar(char) {
  if (!char) return ' ';

  // Unicode dashes to regular hyphen
  if (char === '\u2014' || char === '\u2013' || char === '\u2212') return '-';
  // Unicode single quotes to standard apostrophe
  if (char === '\u2018' || char === '\u2019' || char === '\u201A' || char === '\u0060') return '\'';
  // Unicode double quotes to standard quote
  if (char === '\u201C' || char === '\u201D' || char === '\u201E') return '"';
  // Bullets and degrees
  if (char === '\u2022' || char === '\u00B7') return '*';
  if (char === '\u00B0') return '*';

  // Normalize accented characters (e.g. e with acute -> e)
  const normalized = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const code = normalized.charCodeAt(0);
  if (code >= 32 && code <= 126) {
    return normalized;
  }
  return '?';
}

/**
 * Measures the pixel width of a single line of text.
 */
function measureSingleLine(line, scale = 1, charSpacing = DEFAULT_CHAR_SPACING) {
  if (!line || line.length === 0) return 0;
  return (line.length * GLYPH_WIDTH + (line.length - 1) * charSpacing) * scale;
}

/**
 * Breaks a word into chunks that do not exceed maxWidth.
 */
function breakWord(word, scale, maxWidth, charSpacing) {
  const chunks = [];
  let currentChunk = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const testChunk = currentChunk + ch;
    if (currentChunk && measureSingleLine(testChunk, scale, charSpacing) > maxWidth) {
      chunks.push(currentChunk);
      currentChunk = ch;
    } else {
      currentChunk = testChunk;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  return chunks;
}

/**
 * Wraps text into lines honoring explicit newlines and optional maxWidth.
 */
function wrapText(text, scale = 1, maxWidth = 0, charSpacing = DEFAULT_CHAR_SPACING) {
  if (text == null || text === '') return [];

  const rawParagraphs = String(text).split(/\r\n|\r|\n/);
  if (!maxWidth || maxWidth <= 0) {
    return rawParagraphs;
  }

  const lines = [];

  for (let p = 0; p < rawParagraphs.length; p++) {
    const paragraph = rawParagraphs[p];
    if (paragraph === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const wordWidth = measureSingleLine(word, scale, charSpacing);

      if (!currentLine) {
        if (wordWidth > maxWidth) {
          const chunks = breakWord(word, scale, maxWidth, charSpacing);
          for (let c = 0; c < chunks.length - 1; c++) {
            lines.push(chunks[c]);
          }
          currentLine = chunks[chunks.length - 1] || '';
        } else {
          currentLine = word;
        }
      } else {
        const testLine = currentLine + ' ' + word;
        if (measureSingleLine(testLine, scale, charSpacing) <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          if (wordWidth > maxWidth) {
            const chunks = breakWord(word, scale, maxWidth, charSpacing);
            for (let c = 0; c < chunks.length - 1; c++) {
              lines.push(chunks[c]);
            }
            currentLine = chunks[chunks.length - 1] || '';
          } else {
            currentLine = word;
          }
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Measures text bounding box dimensions.
 * @param {string} text - Text to measure
 * @param {number} scale - Pixel scaling factor (default: 1)
 * @param {number} maxWidth - Optional maximum width for word wrapping
 * @param {number} lineSpacing - Spacing in pixels between lines (default: 2)
 * @returns {{ width: number, height: number, lines: string[] }}
 */
export function measureText(text, scale = 1, maxWidth = 0, lineSpacing = DEFAULT_LINE_SPACING) {
  if (text == null || text === '') {
    return { width: 0, height: 0, lines: [] };
  }

  const lines = wrapText(text, scale, maxWidth, DEFAULT_CHAR_SPACING);
  if (lines.length === 0) {
    return { width: 0, height: 0, lines: [] };
  }

  let maxWidthFound = 0;
  for (let i = 0; i < lines.length; i++) {
    const w = measureSingleLine(lines[i], scale, DEFAULT_CHAR_SPACING);
    if (w > maxWidthFound) maxWidthFound = w;
  }

  const height = lines.length * GLYPH_HEIGHT * scale + (lines.length - 1) * lineSpacing * scale;
  return {
    width: maxWidthFound,
    height,
    lines
  };
}

/**
 * Draws a single 5x7 glyph into an RGBA buffer with clipping and alpha compositing.
 */
function drawGlyph(buffer, width, height, glyphIndex, cursorX, cursorY, scale, color) {
  const [r, g, b, a = 255] = color;
  if (a <= 0) return;

  const fontOffset = glyphIndex * GLYPH_WIDTH;
  const isOpaque = a === 255;
  const normAlpha = a / 255;
  const invAlpha = 1 - normAlpha;

  for (let col = 0; col < GLYPH_WIDTH; col++) {
    const colBits = FONT_DATA[fontOffset + col];
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      if ((colBits >> row) & 1) {
        const pxStart = cursorX + col * scale;
        const pyStart = cursorY + row * scale;

        for (let sy = 0; sy < scale; sy++) {
          const py = pyStart + sy;
          if (py < 0 || py >= height) continue;

          const rowOffset = py * width;
          for (let sx = 0; sx < scale; sx++) {
            const px = pxStart + sx;
            if (px < 0 || px >= width) continue;

            const idx = (rowOffset + px) * 4;
            if (isOpaque) {
              buffer[idx] = r;
              buffer[idx + 1] = g;
              buffer[idx + 2] = b;
              buffer[idx + 3] = 255;
            } else {
              buffer[idx] = Math.round(r * normAlpha + buffer[idx] * invAlpha);
              buffer[idx + 1] = Math.round(g * normAlpha + buffer[idx + 1] * invAlpha);
              buffer[idx + 2] = Math.round(b * normAlpha + buffer[idx + 2] * invAlpha);
              buffer[idx + 3] = Math.min(255, Math.round(a + buffer[idx + 3] * invAlpha));
            }
          }
        }
      }
    }
  }
}

/**
 * Draws text onto a raw Uint8Array RGBA image buffer.
 * @param {Uint8Array} rgbaBuffer - Image buffer formatted as RGBA (4 bytes per pixel)
 * @param {number} imgWidth - Target image width in pixels
 * @param {number} imgHeight - Target image height in pixels
 * @param {string} text - Text to draw
 * @param {number} startX - Left starting coordinate
 * @param {number} startY - Top starting coordinate
 * @param {object} options - Options: { scale: 1, color: [r, g, b, a], maxWidth: 0, lineSpacing: 2, charSpacing: 1 }
 * @returns {{ nextY: number, textWidth: number, lines: string[] }}
 */
export function drawText(rgbaBuffer, imgWidth, imgHeight, text, startX, startY, options = {}) {
  const scale = options.scale || 1;
  const color = options.color || [255, 255, 255, 255];
  const maxWidth = options.maxWidth || 0;
  const lineSpacing = options.lineSpacing !== undefined ? options.lineSpacing : DEFAULT_LINE_SPACING;
  const charSpacing = options.charSpacing !== undefined ? options.charSpacing : DEFAULT_CHAR_SPACING;

  if (text == null || text === '') {
    return { nextY: startY, textWidth: 0, lines: [] };
  }

  const lines = wrapText(text, scale, maxWidth, charSpacing);
  if (lines.length === 0) {
    return { nextY: startY, textWidth: 0, lines: [] };
  }

  let currentY = startY;
  let maxLineWidth = 0;
  const lineStep = (GLYPH_HEIGHT + lineSpacing) * scale;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const lineWidth = measureSingleLine(line, scale, charSpacing);
    if (lineWidth > maxLineWidth) {
      maxLineWidth = lineWidth;
    }

    let cursorX = startX;
    for (let c = 0; c < line.length; c++) {
      const sanitized = sanitizeChar(line[c]);
      const code = sanitized.charCodeAt(0);
      const glyphIndex = (code >= 32 && code <= 126) ? (code - 32) : (63 - 32); // 63 is '?'

      drawGlyph(rgbaBuffer, imgWidth, imgHeight, glyphIndex, cursorX, currentY, scale, color);
      cursorX += (GLYPH_WIDTH + charSpacing) * scale;
    }

    currentY += lineStep;
  }

  return {
    nextY: currentY,
    textWidth: maxLineWidth,
    lines
  };
}

export default {
  GLYPH_WIDTH,
  GLYPH_HEIGHT,
  DEFAULT_CHAR_SPACING,
  DEFAULT_LINE_SPACING,
  measureText,
  drawText
};
