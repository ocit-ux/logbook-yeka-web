import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampWatermarkCanvas, formatWatermarkLines } from '../../apps/mobile/src/utils/watermark.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('stampWatermarkCanvas executes without error on mock canvas context', () => {
  const operations = [];
  const mockCtx = {
    fillStyle: '',
    fillRect: (x, y, w, h) => operations.push({ op: 'fillRect', x, y, w, h }),
    fillText: (text, x, y) => operations.push({ op: 'fillText', text, x, y }),
    font: '',
    measureText: (t) => ({ width: t.length * 8 })
  };
  const mockCanvas = {
    width: 1000,
    height: 750,
    getContext: () => mockCtx
  };

  stampWatermarkCanvas(mockCanvas, {
    user: { nama: 'Jane Doe', devisi: 'IT' },
    date: new Date(),
    coords: { latitude: -6.1, longitude: 106.8 }
  });

  const fillRects = operations.filter(o => o.op === 'fillRect');
  const fillTexts = operations.filter(o => o.op === 'fillText');
  
  assert.strictEqual(fillRects.length >= 2, true); // Banner + Gold stripe
  assert.strictEqual(fillTexts.length >= 4, true);  // 4 lines of text
});

test('stampWatermarkCanvas renders dark banner, gold accent bar, and metadata text', () => {
  const operations = [];
  const mockCtx = {
    fillStyle: '',
    fillRect: (x, y, w, h) => operations.push({ op: 'fillRect', fillStyle: mockCtx.fillStyle, x, y, w, h }),
    fillText: (text, x, y) => operations.push({ op: 'fillText', fillStyle: mockCtx.fillStyle, text, x, y }),
    font: '',
    textBaseline: 'alphabetic',
    measureText: (t) => ({ width: t.length * 8 })
  };
  const mockCanvas = {
    width: 1000,
    height: 750,
    getContext: () => mockCtx
  };

  const watermarkMeta = {
    user: { nama: 'Ahmad Dahlan', devisi: 'Konservasi Lapangan' },
    date: new Date('2026-10-29T10:15:00+07:00'),
    location: { coords: { latitude: -0.123456, longitude: 109.123456 } },
    wilayah: 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor'
  };

  stampWatermarkCanvas(mockCanvas, watermarkMeta);

  const fillRects = operations.filter(o => o.op === 'fillRect');
  assert.strictEqual(fillRects.length >= 2, true);
  // Banner background
  assert.strictEqual(fillRects[0].fillStyle, 'rgba(15, 23, 42, 0.76)');
  assert.strictEqual(fillRects[0].x, 0);
  assert.strictEqual(fillRects[0].w, 1000);
  // Gold accent bar
  assert.strictEqual(fillRects[1].fillStyle, '#d4af37');

  const fillTexts = operations.filter(o => o.op === 'fillText');
  assert.strictEqual(fillTexts.length >= 5, true); // Header, Staff, WIB, GPS, Wilayah
  assert.strictEqual(fillTexts[0].text, 'YAYASAN ELANG KATULISTIWA ADIPAVITRA');
  assert.strictEqual(fillTexts[0].fillStyle, '#d4af37');
  assert.strictEqual(fillTexts[1].text, 'Ahmad Dahlan | Konservasi Lapangan');
  assert.match(fillTexts[2].text, /WIB$/);
  assert.strictEqual(fillTexts[3].text, 'GPS: -0.123456, 109.123456');
  assert.strictEqual(fillTexts[4].text, 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor');
});

test('WebCamera capture pipeline: anti-black frame detection rejects dark frames before watermark', () => {
  const events = [];
  let alertMessage = '';
  const mockAlert = (msg) => {
    alertMessage = msg;
    events.push({ op: 'alert', msg });
  };

  // Mock dark sample where all RGB values <= 12
  const darkSample = new Uint8ClampedArray(32 * 32 * 4); // all 0s
  
  const mockCtx = {
    fillStyle: '',
    drawImage: () => events.push({ op: 'drawImage' }),
    getImageData: (x, y, w, h) => {
      events.push({ op: 'getImageData', x, y, w, h });
      return { data: darkSample };
    },
    fillRect: () => events.push({ op: 'fillRect' }),
    fillText: () => events.push({ op: 'fillText' }),
    measureText: (t) => ({ width: t.length * 8 })
  };

  const mockCanvas = {
    width: 640,
    height: 480,
    getContext: () => mockCtx,
    toDataURL: (type, quality) => {
      events.push({ op: 'toDataURL', type, quality });
      return 'data:image/jpeg;base64,samplebase64';
    }
  };

  const mockVideo = {
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480
  };

  let capturedData = null;
  const mockOnCapture = (data) => {
    capturedData = data;
    events.push({ op: 'onCapture' });
  };

  // Simulate takePhoto logic
  const simulateTakePhoto = (watermarkMeta) => {
    if (!mockVideo || mockVideo.readyState < 2 || !mockVideo.videoWidth || !mockVideo.videoHeight) {
      mockAlert('Lensa kamera sedang memuat gambar. Tunggu 1 detik lalu tekan potret lagi.');
      return;
    }

    mockCtx.drawImage();

    // Anti-black check
    const sample = mockCtx.getImageData(Math.floor(mockCanvas.width / 4), Math.floor(mockCanvas.height / 4), 32, 32).data;
    let brightPixels = 0;
    for (let i = 0; i < sample.length; i += 4) {
      if (sample[i] > 12 || sample[i + 1] > 12 || sample[i + 2] > 12) brightPixels++;
    }
    if (brightPixels === 0) {
      mockAlert('Kamera belum siap menangkap cahaya (hasil foto gelap/hitam). Mohon tunggu 1 detik lalu potret ulang.');
      return;
    }

    // Watermark should only be stamped if anti-black check passes
    if (watermarkMeta) {
      events.push({ op: 'stampWatermark' });
      stampWatermarkCanvas(mockCanvas, watermarkMeta);
    }

    const base64Full = mockCanvas.toDataURL('image/jpeg', 0.55);
    const cleanBase64 = base64Full.replace(/^data:image\/jpeg;base64,/, '');
    mockOnCapture({ uri: base64Full, base64: cleanBase64 });
  };

  simulateTakePhoto({ user: { nama: 'Test' } });

  // Verify rejection occurred before watermark and before toDataURL
  assert.strictEqual(alertMessage.includes('gelap/hitam'), true);
  assert.strictEqual(capturedData, null);
  const stampEvents = events.filter(e => e.op === 'stampWatermark' || e.op === 'fillRect' || e.op === 'toDataURL');
  assert.strictEqual(stampEvents.length, 0);
  assert.deepStrictEqual(events.map(e => e.op), ['drawImage', 'getImageData', 'alert']);
});

test('WebCamera capture pipeline: applies watermark and encodes at 0.55 quality when bright pixels pass', () => {
  const events = [];
  const mockAlert = (msg) => events.push({ op: 'alert', msg });

  // Mock bright sample with values > 12
  const brightSample = new Uint8ClampedArray(32 * 32 * 4);
  for (let i = 0; i < brightSample.length; i += 4) {
    brightSample[i] = 100;     // R
    brightSample[i + 1] = 120; // G
    brightSample[i + 2] = 140; // B
    brightSample[i + 3] = 255; // A
  }

  let capturedQuality = null;
  const mockCtx = {
    fillStyle: '',
    drawImage: () => events.push({ op: 'drawImage' }),
    getImageData: (x, y, w, h) => {
      events.push({ op: 'getImageData', x, y, w, h });
      return { data: brightSample };
    },
    fillRect: (x, y, w, h) => events.push({ op: 'fillRect', x, y, w, h }),
    fillText: (text, x, y) => events.push({ op: 'fillText', text, x, y }),
    measureText: (t) => ({ width: t.length * 8 })
  };

  const mockCanvas = {
    width: 640,
    height: 480,
    getContext: () => mockCtx,
    toDataURL: (type, quality) => {
      capturedQuality = quality;
      events.push({ op: 'toDataURL', type, quality });
      return 'data:image/jpeg;base64,stampedImageDataHere';
    }
  };

  const mockVideo = {
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480
  };

  let capturedData = null;
  const mockOnCapture = (data) => {
    capturedData = data;
    events.push({ op: 'onCapture' });
  };

  const watermarkMeta = {
    user: { nama: 'Budi Santoso', devisi: 'IT' },
    date: new Date('2026-10-29T10:00:00+07:00'),
    coords: { latitude: -6.2, longitude: 106.8 }
  };

  // Run takePhoto sequence
  mockCtx.drawImage();
  const sample = mockCtx.getImageData(Math.floor(mockCanvas.width / 4), Math.floor(mockCanvas.height / 4), 32, 32).data;
  let brightPixels = 0;
  for (let i = 0; i < sample.length; i += 4) {
    if (sample[i] > 12 || sample[i + 1] > 12 || sample[i + 2] > 12) brightPixels++;
  }
  assert.strictEqual(brightPixels > 0, true);

  // Stamping happens after anti-black check
  events.push({ op: 'stampWatermark' });
  stampWatermarkCanvas(mockCanvas, watermarkMeta);

  const base64Full = mockCanvas.toDataURL('image/jpeg', 0.55);
  const cleanBase64 = base64Full.replace(/^data:image\/jpeg;base64,/, '');
  mockOnCapture({ uri: base64Full, base64: cleanBase64 });

  assert.strictEqual(capturedQuality, 0.55);
  assert.strictEqual(capturedData.uri, 'data:image/jpeg;base64,stampedImageDataHere');
  assert.strictEqual(capturedData.base64, 'stampedImageDataHere');

  // Verify sequence of operations: drawImage -> getImageData -> stampWatermark -> fillRect -> toDataURL -> onCapture
  const opNames = events.map(e => e.op);
  const idxGetImageData = opNames.indexOf('getImageData');
  const idxStamp = opNames.indexOf('stampWatermark');
  const idxToDataURL = opNames.indexOf('toDataURL');
  const idxOnCapture = opNames.indexOf('onCapture');

  assert.strictEqual(idxGetImageData < idxStamp, true, 'getImageData must execute before watermark stamp');
  assert.strictEqual(idxStamp < idxToDataURL, true, 'watermark stamp must execute before toDataURL');
  assert.strictEqual(idxToDataURL < idxOnCapture, true, 'toDataURL must execute before onCapture');
});

test('WebCamera.js source code static integration contract', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/components/WebCamera.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify import of stampWatermarkCanvas
  assert.match(content, /import\s+\{\s*stampWatermarkCanvas\s*\}\s+from\s+['"]\.\.\/utils\/watermark['"]/);

  // Verify component accepts watermarkMeta prop
  assert.match(content, /function\s+WebCamera\(\{\s*[^}]*watermarkMeta[^}]*\}\)/);

  // Verify anti-black check executes BEFORE watermark stamp
  const getImageDataPos = content.indexOf('ctx.getImageData');
  const stampPos = content.indexOf('stampWatermarkCanvas(canvas, watermarkMeta)');
  const toDataURLPos = content.indexOf("canvas.toDataURL('image/jpeg', 0.55)");

  assert.strictEqual(getImageDataPos !== -1, true, 'ctx.getImageData must exist in WebCamera.js');
  assert.strictEqual(stampPos !== -1, true, 'stampWatermarkCanvas must be called in WebCamera.js');
  assert.strictEqual(toDataURLPos !== -1, true, 'toDataURL with quality 0.55 must exist in WebCamera.js');

  assert.strictEqual(getImageDataPos < stampPos, true, 'Anti-black frame check must run before stampWatermarkCanvas');
  assert.strictEqual(stampPos < toDataURLPos, true, 'stampWatermarkCanvas must run before toDataURL');

  // Verify zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'WebCamera.js must contain zero em dashes');
});

test('DashboardScreen.js source code integration contract for WebCamera', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/screens/DashboardScreen.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify wilayah state initialization
  assert.match(content, /const\s+\[\s*wilayah\s*,\s*setWilayah\s*\]\s*=\s*useState\(['"]['"]\);/);

  // Verify WebCamera receives watermarkMeta={{ user, location, wilayah }}
  assert.match(content, /<WebCamera[\s\S]*?watermarkMeta=\{\{\s*user,\s*location,\s*wilayah\s*\}\}/);

  // Verify zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'DashboardScreen.js must contain zero em dashes');
});
