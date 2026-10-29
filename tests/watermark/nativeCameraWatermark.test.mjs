import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { stampWatermarkNativeAsync } from '../../apps/mobile/src/utils/watermark.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('anti-blank threshold strictly rejects low-size black frames', () => {
  const isBlackFrame = (base64) => !base64 || base64.length < 6000;
  assert.strictEqual(isBlackFrame(''), true);
  assert.strictEqual(isBlackFrame(null), true);
  assert.strictEqual(isBlackFrame(undefined), true);
  assert.strictEqual(isBlackFrame('a'.repeat(5999)), true);
  assert.strictEqual(isBlackFrame('a'.repeat(6000)), false);
  assert.strictEqual(isBlackFrame('a'.repeat(6001)), false);
});

test('NativeCamera capture pipeline: rejects dark frames before calling watermark', async () => {
  const events = [];
  let alertMessage = '';
  const mockAlert = (msg) => {
    alertMessage = msg;
    events.push({ op: 'alert', msg });
  };

  let captured = null;
  const mockOnCapture = (data) => {
    captured = data;
    events.push({ op: 'onCapture', data });
  };

  const mockManipResult = {
    uri: 'file:///mock/cache/photo.jpg',
    base64: 'short_dark_b64' // length < 6000
  };

  const watermarkMeta = {
    user: { nama: 'Test Staff', devisi: 'IT' },
    date: new Date('2026-10-29T10:00:00+07:00')
  };

  // Simulate takePicture logic in NativeCamera
  const simulateTakePicture = async (manipResult, meta) => {
    events.push({ op: 'manipulateAsync' });

    // Anti-black frame detection
    if (!manipResult.base64 || manipResult.base64.length < 6000) {
      events.push({ op: 'rejectBlackFrame' });
      mockAlert('Kamera belum siap menangkap cahaya (hasil foto gelap/hitam). Mohon tunggu 1 detik lalu tekan tombol potret lagi.');
      return;
    }

    let finalResult = manipResult;
    try {
      if (meta) {
        events.push({ op: 'stampWatermarkNativeAsync' });
        finalResult = await stampWatermarkNativeAsync(manipResult.base64, meta);
      }
    } catch (wmErr) {
      events.push({ op: 'watermarkFallback', error: wmErr.message });
      finalResult = manipResult;
    }

    mockOnCapture(finalResult);
  };

  await simulateTakePicture(mockManipResult, watermarkMeta);

  assert.strictEqual(alertMessage.includes('gelap/hitam'), true);
  assert.strictEqual(captured, null);
  const watermarkEvents = events.filter(e => e.op === 'stampWatermarkNativeAsync' || e.op === 'onCapture');
  assert.strictEqual(watermarkEvents.length, 0);
  assert.deepStrictEqual(events.map(e => e.op), ['manipulateAsync', 'rejectBlackFrame', 'alert']);
});

test('NativeCamera capture pipeline: stamps watermark after passing anti-black check', async () => {
  const events = [];
  const mockAlert = (msg) => events.push({ op: 'alert', msg });

  let captured = null;
  const mockOnCapture = (data) => {
    captured = data;
    events.push({ op: 'onCapture', data });
  };

  // Create valid JPEG > 6000 characters base64
  const width = 500;
  const height = 500;
  const rawData = new Uint8Array(width * height * 4);
  for (let i = 0; i < rawData.length; i++) {
    rawData[i] = (i * 37) % 256;
  }
  const testJpeg = jpeg.encode({ data: rawData, width, height }, 80);
  const validBase64 = Buffer.from(testJpeg.data).toString('base64');
  assert.strictEqual(validBase64.length >= 6000, true);

  const mockManipResult = {
    uri: 'file:///mock/cache/photo.jpg',
    base64: validBase64
  };

  const watermarkMeta = {
    user: { nama: 'Budi Santoso', devisi: 'Program Konservasi' },
    date: new Date('2026-10-29T11:00:00+07:00'),
    coords: { latitude: -6.2088, longitude: 106.8456 },
    wilayah: 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor'
  };

  const simulateTakePicture = async (manipResult, meta) => {
    events.push({ op: 'manipulateAsync' });

    if (!manipResult.base64 || manipResult.base64.length < 6000) {
      events.push({ op: 'rejectBlackFrame' });
      mockAlert('Kamera belum siap');
      return;
    }

    let finalResult = manipResult;
    try {
      if (meta) {
        events.push({ op: 'stampWatermarkNativeAsync' });
        finalResult = await stampWatermarkNativeAsync(manipResult.base64, meta);
      }
    } catch (wmErr) {
      events.push({ op: 'watermarkFallback', error: wmErr.message });
      finalResult = manipResult;
    }

    mockOnCapture(finalResult);
  };

  await simulateTakePicture(mockManipResult, watermarkMeta);

  assert.notStrictEqual(captured, null);
  assert.strictEqual(typeof captured.base64, 'string');
  assert.strictEqual(captured.uri.startsWith('data:image/jpeg;base64,'), true);

  const opNames = events.map(e => e.op);
  const idxManip = opNames.indexOf('manipulateAsync');
  const idxStamp = opNames.indexOf('stampWatermarkNativeAsync');
  const idxCapture = opNames.indexOf('onCapture');

  assert.strictEqual(idxManip < idxStamp, true, 'manipulateAsync must happen before watermark stamp');
  assert.strictEqual(idxStamp < idxCapture, true, 'watermark stamp must happen before onCapture');
});

test('NativeCamera capture pipeline: falls back to raw manipResult on watermark failure without crashing', async () => {
  const events = [];
  let captured = null;
  const mockOnCapture = (data) => {
    captured = data;
    events.push({ op: 'onCapture', data });
  };

  // Base64 that passes length check but is not a valid JPEG
  const dummyBase64 = 'a'.repeat(7000);
  const rawManipResult = {
    uri: 'file:///mock/cache/photo.jpg',
    base64: dummyBase64
  };

  const watermarkMeta = {
    user: { nama: 'Test User' }
  };

  const simulateTakePicture = async (manipResult, meta) => {
    if (!manipResult.base64 || manipResult.base64.length < 6000) {
      return;
    }

    let finalResult = manipResult;
    try {
      if (meta) {
        events.push({ op: 'stampWatermarkNativeAsync' });
        finalResult = await stampWatermarkNativeAsync(manipResult.base64, meta);
      }
    } catch (wmErr) {
      events.push({ op: 'watermarkFallback', error: wmErr.message });
      finalResult = manipResult;
    }

    mockOnCapture(finalResult);
  };

  await simulateTakePicture(rawManipResult, watermarkMeta);

  // Verifies fallback mechanism caught error and still completed capture
  assert.strictEqual(captured, rawManipResult);
  assert.strictEqual(captured.base64, dummyBase64);
  assert.strictEqual(events.some(e => e.op === 'watermarkFallback'), true);
  assert.strictEqual(events.some(e => e.op === 'onCapture'), true);
});

test('Reverse geocoding logic in DashboardScreen: native geocoding with backend fallback', async () => {
  // Test native success path
  const mockNativeGeocoder = async ({ latitude, longitude }) => {
    return [{
      district: 'Ciawi',
      subregion: 'Bogor',
      city: 'Bogor',
      region: 'Jawa Barat'
    }];
  };

  const formatNativeWilayah = (res) => {
    if (!res || !res.length) return '';
    const item = res[0];
    const parts = [
      item.district || item.subregion,
      item.city || item.region
    ].filter(Boolean);
    return parts.join(', ');
  };

  const nativeResult = formatNativeWilayah(await mockNativeGeocoder({ latitude: -6.6, longitude: 106.8 }));
  assert.strictEqual(nativeResult, 'Ciawi, Bogor');

  // Test native empty / error fallback to backend API
  const mockNativeGeocoderFails = async () => [];
  const mockBackendApi = async ({ action, data }) => {
    assert.strictEqual(action, 'reverseGeocode');
    assert.strictEqual(data.gps, '-6.6,106.8');
    return {
      data: {
        status: 'success',
        data: { desa: 'Bendungan', kecamatan: 'Ciawi', kabupaten: 'Bogor' }
      }
    };
  };

  let wilayahText = formatNativeWilayah(await mockNativeGeocoderFails());
  if (!wilayahText) {
    const apiRes = await mockBackendApi({ action: 'reverseGeocode', data: { gps: '-6.6,106.8' } });
    if (apiRes.data?.status === 'success' && apiRes.data?.data) {
      const d = apiRes.data.data;
      wilayahText = [d.desa, d.kecamatan, d.kabupaten].filter(p => p && p !== '-').join(', ');
    }
  }

  assert.strictEqual(wilayahText, 'Bendungan, Ciawi, Bogor');
});

test('NativeCamera.js source code static integration contract', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/components/NativeCamera.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Verify import of stampWatermarkNativeAsync
  assert.match(content, /import\s+\{\s*stampWatermarkNativeAsync\s*\}\s+from\s+['"]\.\.\/utils\/watermark['"]/);

  // 2. Verify component accepts watermarkMeta prop
  assert.match(content, /function\s+NativeCamera\(\{\s*[^}]*watermarkMeta[^}]*\}\)/);

  // 3. Verify anti-black check executes BEFORE watermark application
  const blackCheckPos = content.indexOf('manipResult.base64.length < 6000');
  const stampPos = content.indexOf('stampWatermarkNativeAsync(manipResult.base64, watermarkMeta)');

  assert.strictEqual(blackCheckPos !== -1, true, 'Anti-black check must exist in NativeCamera.js');
  assert.strictEqual(stampPos !== -1, true, 'stampWatermarkNativeAsync must be called in NativeCamera.js');
  assert.strictEqual(blackCheckPos < stampPos, true, 'Anti-black check must execute before stampWatermarkNativeAsync');

  // 4. Verify watermark error try/catch fallback
  assert.match(content, /try\s*\{[\s\S]*stampWatermarkNativeAsync[\s\S]*\}\s*catch/);

  // 5. Verify zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'NativeCamera.js must contain zero em dashes');
});

test('DashboardScreen.js source code static integration contract for NativeCamera and reverse geocode', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/screens/DashboardScreen.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Verify NativeCamera receives watermarkMeta={{ user, location, wilayah }}
  assert.match(content, /<NativeCamera[\s\S]*?watermarkMeta=\{\{\s*user,\s*location,\s*wilayah\s*\}\}/);

  // 2. Verify reverse geocoding on native via Location.reverseGeocodeAsync
  assert.strictEqual(content.includes('Location.reverseGeocodeAsync'), true, 'DashboardScreen.js must call Location.reverseGeocodeAsync');

  // 3. Verify backend reverseGeocode API action call exists
  assert.match(content, /action:\s*['"]reverseGeocode['"]/);

  // 4. Verify AsyncStorage cache key @last_known_wilayah is stored and retrieved
  assert.strictEqual(content.includes('@last_known_wilayah'), true, 'DashboardScreen.js must use @last_known_wilayah');

  // 5. Verify zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'DashboardScreen.js must contain zero em dashes');
});
