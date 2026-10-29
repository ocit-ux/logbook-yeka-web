import test from 'node:test';
import assert from 'node:assert';
import jpeg from 'jpeg-js';
import {
  formatWatermarkLines,
  formatWibTimestamp,
  ensureHermesBufferShim,
  stampWatermarkNativeAsync,
  stampWatermarkCanvas,
  base64ToUint8Array,
  uint8ArrayToBase64
} from '../../apps/mobile/src/utils/watermark.js';

test('formatWatermarkLines constructs four lines without em dashes', () => {
  const meta = {
    user: { nama: 'Budi Santoso', devisi: 'Program Konservasi' },
    date: new Date('2026-10-29T14:30:00+07:00'),
    coords: { latitude: -6.2088, longitude: 106.8456 },
    wilayah: 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor'
  };
  const lines = formatWatermarkLines(meta);
  assert.strictEqual(lines.header, 'YAYASAN ELANG KATULISTIWA ADIPAVITRA');
  assert.strictEqual(lines.staff, 'Budi Santoso | Program Konservasi');
  assert.match(lines.timestamp, /WIB$/);
  assert.strictEqual(lines.location, 'GPS: -6.208800, 106.845600');
  assert.strictEqual(lines.wilayah, 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor');
  assert.strictEqual(JSON.stringify(lines).includes('\u2014'), false);
});

test('formatWatermarkLines handles role fallbacks and offline coords cleanly', () => {
  // Test fallback to jabatan
  const metaJabatan = {
    user: { nama: 'Siti Rahma', jabatan: 'Koordinator Lapangan' },
    date: new Date('2026-10-29T08:15:00+07:00'),
    coords: { lat: -0.123456, lng: 109.123456 }
  };
  const lines1 = formatWatermarkLines(metaJabatan);
  assert.strictEqual(lines1.staff, 'Siti Rahma | Koordinator Lapangan');
  assert.strictEqual(lines1.location, 'GPS: -0.123456, 109.123456');
  assert.strictEqual(lines1.wilayah, '');

  // Test fallback to default Staff and missing GPS
  const metaEmpty = {};
  const lines2 = formatWatermarkLines(metaEmpty);
  assert.strictEqual(lines2.staff, 'Staff YEKA | Staff');
  assert.strictEqual(lines2.location, 'GPS: Belum terkunci');
  assert.strictEqual(lines2.wilayah, '');

  // Test structured wilayah object
  const metaWilayahObj = {
    user: { nama: 'Ahmad' },
    wilayah: { desa: 'Pancoran', kecamatan: 'Pancoran', kabupaten: 'Jakarta Selatan' }
  };
  const lines3 = formatWatermarkLines(metaWilayahObj);
  assert.strictEqual(lines3.wilayah, 'Pancoran, Pancoran, Jakarta Selatan');
});

test('formatWibTimestamp produces consistent WIB time across timezones', () => {
  const ts = formatWibTimestamp(new Date('2026-10-29T14:30:00+07:00'));
  assert.strictEqual(ts.endsWith('WIB'), true);
  assert.strictEqual(ts.includes('29 Okt 2026'), true);
  assert.strictEqual(ts.includes('14:30:00'), true);
});

test('base64ToUint8Array and uint8ArrayToBase64 perform lossless roundtrip', () => {
  const original = new Uint8Array([0, 15, 23, 42, 212, 175, 55, 255, 128, 64, 32]);
  const b64 = uint8ArrayToBase64(original);
  assert.strictEqual(typeof b64, 'string');
  const decoded = base64ToUint8Array(b64);
  assert.deepStrictEqual(Array.from(decoded), Array.from(original));

  // Test with data URI prefix
  const withPrefix = 'data:image/jpeg;base64,' + b64;
  const decodedPrefix = base64ToUint8Array(withPrefix);
  assert.deepStrictEqual(Array.from(decodedPrefix), Array.from(original));
});

test('ensureHermesBufferShim provides Buffer.from and Buffer.alloc', () => {
  ensureHermesBufferShim();
  assert.strictEqual(typeof globalThis.Buffer !== 'undefined', true);
  const buf = globalThis.Buffer.from([1, 2, 3]);
  assert.strictEqual(buf instanceof Uint8Array, true);
  assert.strictEqual(buf.length, 3);

  const allocBuf = globalThis.Buffer.alloc(5);
  assert.strictEqual(allocBuf instanceof Uint8Array, true);
  assert.strictEqual(allocBuf.length, 5);
});

test('ensureHermesBufferShim creates full Uint8Array shim when Buffer is undefined', () => {
  const originalBuffer = globalThis.Buffer;
  try {
    delete globalThis.Buffer;
    assert.strictEqual(typeof globalThis.Buffer, 'undefined');

    ensureHermesBufferShim();
    assert.strictEqual(typeof globalThis.Buffer, 'function');

    const b = globalThis.Buffer.from([10, 20, 30]);
    assert.strictEqual(b instanceof Uint8Array, true);
    assert.strictEqual(b[0], 10);
    assert.strictEqual(b[1], 20);
    assert.strictEqual(b[2], 30);

    const alloc = globalThis.Buffer.alloc(4, 99);
    assert.strictEqual(alloc.length, 4);
    assert.strictEqual(alloc[0], 99);

    const strBuf = globalThis.Buffer.from('hello');
    assert.strictEqual(typeof strBuf.toString('base64'), 'string');
  } finally {
    globalThis.Buffer = originalBuffer;
  }
});

test('stampWatermarkNativeAsync embeds watermark onto a valid JPEG base64', async () => {
  // Create a minimal 200x200 JPEG image for testing
  const rawData = new Uint8Array(200 * 200 * 4);
  for (let i = 0; i < rawData.length; i += 4) {
    rawData[i] = 100;     // R
    rawData[i + 1] = 120; // G
    rawData[i + 2] = 140; // B
    rawData[i + 3] = 255; // A
  }
  const testJpeg = jpeg.encode({ data: rawData, width: 200, height: 200 }, 70);
  const base64Input = Buffer.from(testJpeg.data).toString('base64');

  const result = await stampWatermarkNativeAsync(base64Input, {
    user: { nama: 'Test User', devisi: 'Staff' },
    date: new Date('2026-10-29T14:30:00+07:00'),
    coords: { latitude: -0.123456, longitude: 109.123456 },
    wilayah: 'Pontianak Barat, Kota Pontianak'
  });

  assert.strictEqual(typeof result.base64 === 'string', true);
  assert.strictEqual(result.base64.length > 1000, true);
  assert.strictEqual(result.uri.startsWith('data:image/jpeg;base64,'), true);

  // Validate that result is decodable as valid JPEG
  const stampedBytes = Buffer.from(result.base64, 'base64');
  const decoded = jpeg.decode(stampedBytes, { useTArray: true, formatAsRGBA: true });
  assert.strictEqual(decoded.width, 200);
  assert.strictEqual(decoded.height, 200);
});

test('stampWatermarkNativeAsync processes standard 1000x750 photo with scale 2', async () => {
  const width = 1000;
  const height = 750;
  const rawData = new Uint8Array(width * height * 4);
  // Fill with neutral grey
  rawData.fill(128);

  const testJpeg = jpeg.encode({ data: rawData, width, height }, 65);
  const base64Input = Buffer.from(testJpeg.data).toString('base64');

  const result = await stampWatermarkNativeAsync(base64Input, {
    user: { nama: 'Budi Santoso', devisi: 'Program Konservasi' },
    date: new Date('2026-10-29T14:30:00+07:00'),
    coords: { latitude: -6.2088, longitude: 106.8456 },
    wilayah: 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor'
  });

  assert.strictEqual(typeof result.base64, 'string');
  assert.strictEqual(result.base64.length > 5000, true);
  assert.strictEqual(result.uri.startsWith('data:image/jpeg;base64,'), true);

  const decoded = jpeg.decode(Buffer.from(result.base64, 'base64'), { useTArray: true, formatAsRGBA: true });
  assert.strictEqual(decoded.width, 1000);
  assert.strictEqual(decoded.height, 750);
});

test('stampWatermarkCanvas executes without error on mock canvas context', () => {
  const operations = [];
  const mockCtx = {
    fillStyle: '',
    fillRect: (x, y, w, h) => operations.push({ op: 'fillRect', x, y, w, h }),
    fillText: (text, x, y) => operations.push({ op: 'fillText', text, x, y }),
    font: '',
    textBaseline: 'alphabetic',
    measureText: (t) => ({ width: t.length * 8 })
  };
  const mockCanvas = {
    width: 1000,
    height: 750,
    getContext: () => mockCtx
  };

  stampWatermarkCanvas(mockCanvas, {
    user: { nama: 'Jane Doe', devisi: 'IT' },
    date: new Date('2026-10-29T14:30:00+07:00'),
    coords: { latitude: -6.1, longitude: 106.8 }
  });

  const fillRects = operations.filter(o => o.op === 'fillRect');
  const fillTexts = operations.filter(o => o.op === 'fillText');

  assert.strictEqual(fillRects.length >= 2, true); // Banner + Gold stripe
  assert.strictEqual(fillTexts.length >= 4, true);  // At least 4 lines of text
});
