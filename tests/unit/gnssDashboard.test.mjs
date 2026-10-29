import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  selectSubmissionCoords,
  formatGnssStatus,
  formatAccuracy,
  isValidCoords
} from '../../apps/mobile/src/utils/gnss.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('selectSubmissionCoords: uses photoCoords when available regardless of currentLocation and cachedLocation', () => {
  const photoCoords = { latitude: -6.200001, longitude: 106.816666, accuracy: 4.2 };
  const currentLocation = { latitude: -6.100000, longitude: 106.900000, accuracy: 12.0 };
  const cachedLocation = { latitude: -6.000000, longitude: 106.700000, accuracy: 20.0, timestamp: Date.now() };

  const selected = selectSubmissionCoords({ photoCoords, currentLocation, cachedLocation });
  assert.ok(selected, 'Selected coordinates must not be null');
  assert.strictEqual(selected.latitude, -6.200001);
  assert.strictEqual(selected.longitude, 106.816666);
  assert.strictEqual(selected.accuracy, 4.2);
  assert.strictEqual(selected.source, 'photo');
});

test('selectSubmissionCoords: falls back to currentLocation when photoCoords is missing or invalid', () => {
  const currentLocation = { latitude: -6.123456, longitude: 106.789012, accuracy: 8.5 };
  const cachedLocation = { latitude: -6.000000, longitude: 106.700000, timestamp: Date.now() };

  // Null photoCoords
  const res1 = selectSubmissionCoords({ photoCoords: null, currentLocation, cachedLocation });
  assert.ok(res1);
  assert.strictEqual(res1.latitude, -6.123456);
  assert.strictEqual(res1.longitude, 106.789012);
  assert.strictEqual(res1.source, 'watcher');

  // Invalid photoCoords with non-numeric fields
  const res2 = selectSubmissionCoords({
    photoCoords: { latitude: 'invalid', longitude: null },
    currentLocation,
    cachedLocation
  });
  assert.ok(res2);
  assert.strictEqual(res2.latitude, -6.123456);
  assert.strictEqual(res2.longitude, 106.789012);
  assert.strictEqual(res2.source, 'watcher');
});

test('selectSubmissionCoords: falls back to cachedLocation when photoCoords and currentLocation are missing', () => {
  const cachedLocation = {
    latitude: -6.300000,
    longitude: 106.600000,
    accuracy: 15.0,
    timestamp: Date.now() - 60000 // 1 minute old
  };

  const res = selectSubmissionCoords({ photoCoords: null, currentLocation: null, cachedLocation });
  assert.ok(res, 'Cached location should be selected');
  assert.strictEqual(res.latitude, -6.300000);
  assert.strictEqual(res.longitude, 106.600000);
  assert.strictEqual(res.accuracy, 15.0);
  assert.strictEqual(res.source, 'cache');
});

test('selectSubmissionCoords: rejects expired cachedLocation (> 5 minutes)', () => {
  const expiredCachedLocation = {
    latitude: -6.300000,
    longitude: 106.600000,
    timestamp: Date.now() - 360000 // 6 minutes old
  };

  const res = selectSubmissionCoords({
    photoCoords: null,
    currentLocation: null,
    cachedLocation: expiredCachedLocation
  });
  assert.strictEqual(res, null, 'Expired cache must return null');
});

test('selectSubmissionCoords: returns null when all coordinate sources are missing or invalid', () => {
  assert.strictEqual(selectSubmissionCoords({}), null);
  assert.strictEqual(selectSubmissionCoords({ photoCoords: null, currentLocation: null, cachedLocation: null }), null);
  assert.strictEqual(
    selectSubmissionCoords({
      photoCoords: { latitude: NaN, longitude: NaN },
      currentLocation: undefined,
      cachedLocation: { latitude: 'none', longitude: null }
    }),
    null
  );
});

test('selectSubmissionCoords: handles object wrapping { coords: { latitude, longitude } } seamlessly', () => {
  const photo = {
    coords: { latitude: -6.200001, longitude: 106.816666, accuracy: 3.5 }
  };
  const res = selectSubmissionCoords({ photoCoords: photo });
  assert.ok(res);
  assert.strictEqual(res.latitude, -6.200001);
  assert.strictEqual(res.longitude, 106.816666);
  assert.strictEqual(res.accuracy, 3.5);
  assert.strictEqual(res.source, 'photo');
});

test('formatGnssStatus: formats status message for rooted device', () => {
  const status = formatGnssStatus({
    isRooted: true,
    isMocked: false,
    location: { latitude: -6.2, longitude: 106.8, accuracy: 5 }
  });
  assert.strictEqual(status, 'Peringatan: Integritas sistem perangkat tidak memenuhi standar.');
});

test('formatGnssStatus: formats status message for mocked/fake GPS', () => {
  const status = formatGnssStatus({
    isRooted: false,
    isMocked: true,
    location: { latitude: -6.2, longitude: 106.8, accuracy: 5 }
  });
  assert.strictEqual(status, 'Peringatan: Lokasi tiruan (Mock Location) terdeteksi.');
});

test('formatGnssStatus: formats locked status with 5 decimals and rounded accuracy in meters', () => {
  const status = formatGnssStatus({
    isRooted: false,
    isMocked: false,
    location: { latitude: -6.2087654, longitude: 106.8456789, accuracy: 8.7 }
  });
  assert.strictEqual(status, 'GPS Terkunci: -6.20877, 106.84568 (Akurasi ±9 m)');
});

test('formatGnssStatus: formats searching status when location is null or searching', () => {
  const status = formatGnssStatus({
    isRooted: false,
    isMocked: false,
    location: null
  });
  assert.strictEqual(
    status,
    'Mencari sinyal GPS...'
  );
});

test('formatAccuracy: rounds numeric accuracy or defaults to 5 meters', () => {
  assert.strictEqual(formatAccuracy(3.4), 3);
  assert.strictEqual(formatAccuracy(12.8), 13);
  assert.strictEqual(formatAccuracy(null), 5);
  assert.strictEqual(formatAccuracy(undefined), 5);
  assert.strictEqual(formatAccuracy(NaN), 5);
});

test('isValidCoords: validates valid latitude and longitude numbers', () => {
  assert.strictEqual(isValidCoords({ latitude: -6.2, longitude: 106.8 }), true);
  assert.strictEqual(isValidCoords({ latitude: 0, longitude: 0 }), true);
  assert.strictEqual(isValidCoords({ latitude: '0', longitude: 0 }), false);
  assert.strictEqual(isValidCoords({ latitude: null, longitude: 106.8 }), false);
  assert.strictEqual(isValidCoords({ latitude: NaN, longitude: 106.8 }), false);
  assert.strictEqual(isValidCoords(null), false);
  assert.strictEqual(isValidCoords(undefined), false);
});

test('DashboardScreen source code static integration contract: uses continuous watcher and fast submission', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/screens/DashboardScreen.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Continuous GNSS watcher
  assert.strictEqual(content.includes('Location.watchPositionAsync'), true, 'Must use Location.watchPositionAsync');
  assert.match(content, /timeInterval:\s*3000/, 'Must specify timeInterval 3000ms');
  assert.match(content, /distanceInterval:\s*1/, 'Must specify distanceInterval 1m');

  // 2. AppState lifecycle management
  assert.strictEqual(content.includes('AppState'), true, 'Must handle AppState pause/resume');

  // 3. Fast coordinate hierarchy helper
  assert.strictEqual(content.includes('selectSubmissionCoords'), true, 'Must use selectSubmissionCoords helper');

  // 4. GNSS status badge
  assert.strictEqual(content.includes('formatGnssStatus'), true, 'Must use formatGnssStatus helper');
  const gnssContent = fs.readFileSync(path.join(rootDir, 'apps/mobile/src/utils/gnss.js'), 'utf8');
  assert.strictEqual(gnssContent.includes('GPS Terkunci:'), true, 'gnss.js must format GPS badge cleanly');
  assert.strictEqual(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u.test(gnssContent), false, 'gnss.js must contain zero emojis');

  // 5. Must NOT have 15-second blocking timeout in submitAbsensi
  assert.strictEqual(content.includes('timeout: 15000'), false, 'Must eliminate 15s timeout in submitAbsensi');

  // 6. Zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'DashboardScreen.js must contain zero em dashes');
});

test('Typography Integrity: zero em dashes across all GNSS implementation and test files', () => {
  const filesToCheck = [
    path.join(rootDir, 'apps/mobile/src/utils/gnss.js'),
    path.join(rootDir, 'apps/mobile/src/screens/DashboardScreen.js'),
    path.join(rootDir, 'tests/unit/gnssDashboard.test.mjs')
  ];

  for (const file of filesToCheck) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      assert.strictEqual(content.includes('\u2014'), false, `${file} must contain zero em dashes`);
    }
  }
});
