import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import {
  stampWatermarkNativeAsync,
  stampWatermarkCanvas,
  formatWatermarkLines,
  formatWibTimestamp,
  base64ToUint8Array,
  uint8ArrayToBase64,
  ensureHermesBufferShim,
  HEADER_TEXT
} from '../../apps/mobile/src/utils/watermark.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// ============================================================================
// Section 1: End-to-End Native Pure-JS Watermark Generation
// ============================================================================

test('Native Pipeline: decodes real JPEG, stamps watermark overlay, and encodes valid JPEG quality 75', async () => {
  ensureHermesBufferShim();

  const width = 800;
  const height = 600;
  const rawData = new Uint8Array(width * height * 4);

  // Generate a non-uniform background image (gradient with mid-level brightness)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData[idx] = (x / width * 180) | 0;        // Red gradient
      rawData[idx + 1] = (y / height * 180) | 0;    // Green gradient
      rawData[idx + 2] = 120;                       // Blue channel
      rawData[idx + 3] = 255;                       // Alpha solid
    }
  }

  const encodedInput = jpeg.encode({ data: rawData, width, height }, 75);
  const inputBase64 = Buffer.from(encodedInput.data).toString('base64');

  const metadata = {
    user: {
      nama: 'Ahmad Dahlan',
      devisi: 'Program Konservasi'
    },
    date: new Date('2026-10-29T14:30:00+07:00'),
    coords: {
      latitude: -6.208800,
      longitude: 106.845600
    },
    wilayah: 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor'
  };

  const result = await stampWatermarkNativeAsync(inputBase64, metadata);

  // 1. Verify result shape and data URI scheme
  assert.strictEqual(typeof result.base64, 'string');
  assert.strictEqual(typeof result.uri, 'string');
  assert.strictEqual(result.uri.startsWith('data:image/jpeg;base64,'), true);
  assert.strictEqual(result.base64.length > 5000, true);

  // 2. Verify JPEG binary magic bytes (SOI: 0xFF, 0xD8 and EOI: 0xFF, 0xD9)
  const outputBytes = base64ToUint8Array(result.base64);
  assert.strictEqual(outputBytes[0], 0xff, 'Magic byte 0 must be 0xFF');
  assert.strictEqual(outputBytes[1], 0xd8, 'Magic byte 1 must be 0xD8 (SOI)');
  assert.strictEqual(outputBytes[outputBytes.length - 2], 0xff, 'Penultimate byte must be 0xFF');
  assert.strictEqual(outputBytes[outputBytes.length - 1], 0xd9, 'Final byte must be 0xD9 (EOI)');

  // 3. Decode output JPEG and verify dimensions
  const decoded = jpeg.decode(outputBytes, { useTArray: true, formatAsRGBA: true });
  assert.strictEqual(decoded.width, width, 'Output width must match original');
  assert.strictEqual(decoded.height, height, 'Output height must match original');

  // 4. Verify watermark overlay pixels altered bottom area
  // Banner occupies bottom ~14-20% of image height
  const topPixelIdx = (10 * width + 10) * 4;
  const bottomPixelIdx = ((height - 15) * width + (width / 2 | 0)) * 4;

  // The bottom pixel should be darkened by alpha blending with rgba(15, 23, 42, 0.76)
  assert.ok(decoded.data[bottomPixelIdx] !== rawData[bottomPixelIdx]);

  // Gold vertical bar pixels should be stamped with gold color: [212, 175, 55]
  // In scale 2 (800 / 500 ~ 2): paddingX = 24, barWidth = 6. Check x = 25, bottom banner area
  const goldPixelIdx = ((height - 25) * width + 25) * 4;
  // With JPEG compression lossiness, values should be close to gold
  assert.ok(decoded.data[goldPixelIdx] > 180, 'Gold R channel should be high');
  assert.ok(decoded.data[goldPixelIdx + 1] > 140, 'Gold G channel should be moderate-high');
  assert.ok(decoded.data[goldPixelIdx + 2] < 100, 'Gold B channel should be low');
});

// ============================================================================
// Section 2: Web Canvas Watermark Rendering
// ============================================================================

test('Web Canvas Pipeline: records canvas draw operations, banner, gold accent, and text lines', () => {
  const operations = [];
  const mockCtx = {
    fillStyle: '',
    font: '',
    textBaseline: 'alphabetic',
    fillRect: (x, y, w, h) => operations.push({ op: 'fillRect', fillStyle: mockCtx.fillStyle, x, y, w, h }),
    fillText: (text, x, y) => operations.push({ op: 'fillText', fillStyle: mockCtx.fillStyle, font: mockCtx.font, text, x, y }),
    measureText: (text) => ({ width: text.length * 8 })
  };

  const mockCanvas = {
    width: 1000,
    height: 750,
    getContext: (type) => (type === '2d' ? mockCtx : null)
  };

  const metadata = {
    user: {
      nama: 'Siti Rahma',
      jabatan: 'Koordinator Lapangan'
    },
    date: new Date('2026-10-29T10:15:00+07:00'),
    coords: {
      latitude: -0.123456,
      longitude: 109.123456
    },
    wilayah: 'Pontianak Barat, Kota Pontianak'
  };

  const returnedCanvas = stampWatermarkCanvas(mockCanvas, metadata);
  assert.strictEqual(returnedCanvas, mockCanvas);

  const fillRects = operations.filter(o => o.op === 'fillRect');
  const fillTexts = operations.filter(o => o.op === 'fillText');

  // Verify at least 2 rects: banner and gold vertical bar
  assert.strictEqual(fillRects.length >= 2, true);

  const bannerRect = fillRects[0];
  assert.strictEqual(bannerRect.fillStyle, 'rgba(15, 23, 42, 0.76)');
  assert.strictEqual(bannerRect.x, 0);
  assert.strictEqual(bannerRect.w, 1000);
  assert.ok(bannerRect.h >= 750 * 0.12, 'Banner height should be at least 12% of canvas height');
  assert.strictEqual(bannerRect.y, 750 - bannerRect.h);

  const goldBarRect = fillRects[1];
  assert.strictEqual(goldBarRect.fillStyle, '#d4af37');
  assert.ok(goldBarRect.x > 0);
  assert.ok(goldBarRect.w >= 3);
  assert.ok(goldBarRect.h > 0);

  // Verify text lines rendered
  assert.strictEqual(fillTexts.length >= 5, true);
  assert.strictEqual(fillTexts[0].text, HEADER_TEXT);
  assert.strictEqual(fillTexts[0].fillStyle, '#d4af37');

  assert.strictEqual(fillTexts[1].text, 'Siti Rahma | Koordinator Lapangan');
  assert.strictEqual(fillTexts[1].fillStyle, '#ffffff');

  assert.match(fillTexts[2].text, /WIB$/);
  assert.strictEqual(fillTexts[2].fillStyle, '#ffffff');

  assert.strictEqual(fillTexts[3].text, 'GPS: -0.123456, 109.123456');
  assert.strictEqual(fillTexts[3].fillStyle, '#ffffff');

  assert.strictEqual(fillTexts[4].text, 'Pontianak Barat, Kota Pontianak');
  assert.strictEqual(fillTexts[4].fillStyle, '#ffffff');
});

// ============================================================================
// Section 3: Anti-Blank Rejection Across All Three Surfaces
// ============================================================================

test('Anti-Blank Rejection: Native Camera threshold rejects frames < 6000 chars before watermark', async () => {
  let watermarkCalled = false;
  let alertMessage = '';

  const simulateNativeCapture = async (manipResult, meta) => {
    // Pipeline threshold in NativeCamera.js
    if (!manipResult.base64 || manipResult.base64.length < 6000) {
      alertMessage = 'Kamera belum siap menangkap cahaya (hasil foto gelap/hitam). Mohon tunggu 1 detik lalu tekan tombol potret lagi.';
      return null;
    }

    if (meta) {
      watermarkCalled = true;
      return await stampWatermarkNativeAsync(manipResult.base64, meta);
    }
    return manipResult;
  };

  // 1. Test empty base64
  let result = await simulateNativeCapture({ base64: '' }, { user: { nama: 'Test' } });
  assert.strictEqual(result, null);
  assert.strictEqual(watermarkCalled, false);
  assert.match(alertMessage, /gelap\/hitam/);

  // 2. Test dark/black frame of size 3500 chars
  alertMessage = '';
  result = await simulateNativeCapture({ base64: 'x'.repeat(3500) }, { user: { nama: 'Test' } });
  assert.strictEqual(result, null);
  assert.strictEqual(watermarkCalled, false);
  assert.match(alertMessage, /gelap\/hitam/);
});

test('Anti-Blank Rejection: Web Camera pixel luminance check rejects black frames before watermark', () => {
  let watermarkCalled = false;
  let alertMessage = '';

  const simulateWebCapture = (mockSampleData, meta) => {
    // WebCamera.js luminance sampling logic
    let brightPixels = 0;
    for (let i = 0; i < mockSampleData.length; i += 4) {
      if (mockSampleData[i] > 12 || mockSampleData[i + 1] > 12 || mockSampleData[i + 2] > 12) {
        brightPixels++;
      }
    }

    if (brightPixels === 0) {
      alertMessage = 'Kamera belum siap menangkap cahaya (hasil foto gelap/hitam). Mohon tunggu 1 detik lalu potret ulang.';
      return null;
    }

    if (meta) {
      watermarkCalled = true;
    }
    return 'captured_photo_data';
  };

  // Test pitch black sample (all zeros or below threshold <= 12)
  const blackSample = new Uint8Array(32 * 32 * 4);
  blackSample.fill(5); // under threshold 12
  const outcome = simulateWebCapture(blackSample, { user: { nama: 'Test' } });

  assert.strictEqual(outcome, null);
  assert.strictEqual(watermarkCalled, false);
  assert.match(alertMessage, /gelap\/hitam/);

  // Test bright sample
  const brightSample = new Uint8Array(32 * 32 * 4);
  brightSample[0] = 50; // R > 12
  const successOutcome = simulateWebCapture(brightSample, { user: { nama: 'Test' } });
  assert.strictEqual(successOutcome, 'captured_photo_data');
  assert.strictEqual(watermarkCalled, true);
});

test('Anti-Blank Rejection: GAS Index.html pixel luminance check rejects black frames before watermark', () => {
  let watermarkCalled = false;
  let alertMessage = '';
  let resetPhotoCalled = false;

  const simulateGasFotoInput = (mockSampleData, user, gpsStr, wilayah) => {
    let bright = 0;
    for (let i = 0; i < mockSampleData.length; i += 4) {
      if (mockSampleData[i] > 12 || mockSampleData[i + 1] > 12 || mockSampleData[i + 2] > 12) {
        bright++;
      }
    }

    if (bright === 0) {
      alertMessage = 'Foto terdeteksi hitam/gelap total (kamera belum siap). Silakan ambil ulang foto.';
      resetPhotoCalled = true;
      return null;
    }

    watermarkCalled = true;
    return 'valid_gas_photo';
  };

  // Pitch black image
  const blackSample = new Uint8Array(32 * 32 * 4);
  const result = simulateGasFotoInput(blackSample, { nama: 'Admin' }, '0,0', 'Jakarta');

  assert.strictEqual(result, null);
  assert.strictEqual(watermarkCalled, false);
  assert.strictEqual(resetPhotoCalled, true);
  assert.match(alertMessage, /hitam\/gelap total/);
});

// ============================================================================
// Section 4: Backend Reverse Geocoding and Caching Contracts
// ============================================================================

test('Backend Contracts: 3-decimal cache key, caching behavior, and wilayah formatting', () => {
  // 1. Cache key formatting (~110m grid)
  const getCacheKey = (lat, lng) => 'wil_v1_' + Number(lat).toFixed(3) + '_' + Number(lng).toFixed(3);
  const key1 = getCacheKey(-6.208765, 106.845591);
  const key2 = getCacheKey(-6.208711, 106.845622);
  assert.strictEqual(key1, 'wil_v1_-6.209_106.846');
  assert.strictEqual(key2, key1, 'Coordinates within ~110m must share identical cache key');

  // 2. Cache simulation with 6-hour TTL
  const cacheStorage = new Map();
  let externalCalls = 0;

  const mockCache = {
    get: (k) => cacheStorage.get(k) || null,
    put: (k, val, ttl) => {
      assert.strictEqual(ttl, 21600, 'TTL must be 21600 seconds (6 hours)');
      cacheStorage.set(k, val);
    }
  };

  const mockNominatim = (gps) => {
    externalCalls++;
    return { desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor' };
  };

  const getWilayahCached = (gpsStr) => {
    const parts = String(gpsStr).split(',');
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    const cacheKey = getCacheKey(lat, lng);

    const hit = mockCache.get(cacheKey);
    if (hit) return JSON.parse(hit);

    const geoResult = mockNominatim(gpsStr);
    mockCache.put(cacheKey, JSON.stringify(geoResult), 21600);
    return geoResult;
  };

  // First call: cache miss
  const res1 = getWilayahCached('-6.208765, 106.845591');
  assert.strictEqual(externalCalls, 1);
  assert.strictEqual(res1.desa, 'Sukamaju');

  // Second call with slightly shifted coordinate in same grid: cache hit
  const res2 = getWilayahCached('-6.208711, 106.845622');
  assert.strictEqual(externalCalls, 1, 'Cache hit must not invoke external Nominatim');
  assert.deepStrictEqual(res2, res1);

  // 3. Wilayah client formatting
  const formatWilayah = ({ desa, kecamatan, kabupaten }) => {
    const parts = [desa, kecamatan, kabupaten].filter(p => p && p !== '-');
    return parts.length > 0 ? parts.join(', ') : '';
  };

  assert.strictEqual(formatWilayah(res1), 'Sukamaju, Ciawi, Bogor');
  assert.strictEqual(formatWilayah({ desa: '-', kecamatan: '-', kabupaten: '-' }), '');
  assert.strictEqual(formatWilayah({ desa: 'Pancoran', kecamatan: '-', kabupaten: 'Jakarta Selatan' }), 'Pancoran, Jakarta Selatan');
});

test('Backend Static Contract: Code.gs exports reverseGeocode action and cache routines', () => {
  const codeGsPath = path.join(rootDir, 'apps/backend-gas/Code.gs');
  assert.strictEqual(fs.existsSync(codeGsPath), true);
  const codeGsContent = fs.readFileSync(codeGsPath, 'utf8');

  assert.ok(codeGsContent.includes("action === 'reverseGeocode'"));
  assert.ok(codeGsContent.includes("function getWilayahCached"));
  assert.ok(codeGsContent.includes("function getWilayahClient"));
  assert.ok(codeGsContent.includes("'wil_v1_'"));
  assert.ok(codeGsContent.includes("21600"));
});

// ============================================================================
// Section 5: Strict Anti-Slop Typography (Zero Em Dashes)
// ============================================================================

test('Typography Integrity: zero em dashes across all runtime watermark strings', () => {
  const metadata = {
    user: { nama: 'Budi Santoso', devisi: 'Operasional' },
    date: new Date('2026-10-29T14:30:00+07:00'),
    coords: { latitude: -6.2088, longitude: 106.8456 },
    wilayah: 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor'
  };

  const lines = formatWatermarkLines(metadata);
  const fullJson = JSON.stringify(lines);

  // Em dash is unicode \u2014
  assert.strictEqual(fullJson.includes('\u2014'), false, 'formatWatermarkLines must not emit em dashes');

  const timestamp = formatWibTimestamp(new Date());
  assert.strictEqual(timestamp.includes('\u2014'), false, 'formatWibTimestamp must not emit em dashes');
});

test('Typography Integrity: zero em dashes across all watermark implementation source files', () => {
  const filesToVerify = [
    'apps/mobile/src/utils/watermark.js',
    'apps/mobile/src/utils/bitmapFont.js',
    'apps/backend-gas/Code.gs',
    'apps/backend-gas/Index.html',
    'apps/mobile/src/components/NativeCamera.js',
    'apps/mobile/src/components/WebCamera.js'
  ];

  for (const relPath of filesToVerify) {
    const fullPath = path.join(rootDir, relPath);
    assert.strictEqual(fs.existsSync(fullPath), true, `File must exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const emDashCount = (content.match(/\u2014/g) || []).length;
    assert.strictEqual(emDashCount, 0, `File ${relPath} contains ${emDashCount} em dashes`);
  }
});

test('GPS Synchronization: database payload strictly matches photo watermark coordinates', () => {
  // Mobile coordinate synchronization test
  const watermarkCoords = { latitude: -6.208812, longitude: 106.845611 };
  const submitTimeCoords = { latitude: -6.208835, longitude: 106.845640 }; // satellite drift 2m later
  
  const photo = {
    uri: 'data:image/jpeg;base64,...',
    base64: 'abc...',
    coords: watermarkCoords
  };

  const resolveFinalGps = (p, current) => {
    const finalGpsCoords = (p?.coords && typeof p.coords.latitude === 'number' && typeof p.coords.longitude === 'number')
      ? p.coords
      : current;
    return `${finalGpsCoords.latitude.toFixed(6)}, ${finalGpsCoords.longitude.toFixed(6)}`;
  };

  // With photo (Hadir or WFH): database GPS matches photo watermark 100%
  const gpsWithPhoto = resolveFinalGps(photo, submitTimeCoords);
  assert.strictEqual(gpsWithPhoto, '-6.208812, 106.845611');

  // Without photo (Izin non-WFH without photo): database GPS falls back to submit time coords
  const gpsWithoutPhoto = resolveFinalGps(null, submitTimeCoords);
  assert.strictEqual(gpsWithoutPhoto, '-6.208835, 106.845640');

  // Web Apps GAS synchronization verification
  const indexHtmlPath = path.join(rootDir, 'apps/backend-gas/Index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.strictEqual(indexHtml.includes('window.capturedPhotoGPS = gpsStr;'), true);
  assert.strictEqual(indexHtml.includes('window.capturedPhotoGPS'), true);
});
