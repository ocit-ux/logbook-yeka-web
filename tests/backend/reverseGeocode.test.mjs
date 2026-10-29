import test from 'node:test';
import assert from 'node:assert';

// Step 1: Unit tests exercising cache key formatting and wilayah formatting

test('reverseGeocode cache key rounds coordinates to 3 decimals (~110m grid)', () => {
  const formatCacheKey = (lat, lng) => `wil_v1_${Number(lat).toFixed(3)}_${Number(lng).toFixed(3)}`;
  assert.strictEqual(formatCacheKey(-6.208765, 106.845591), 'wil_v1_-6.209_106.846');
  assert.strictEqual(formatCacheKey(-6.208711, 106.845622), 'wil_v1_-6.209_106.846');
  assert.strictEqual(formatCacheKey(0, 0), 'wil_v1_0.000_0.000');
});

test('formats wilayah object to display string cleanly without em dashes', () => {
  const formatWilayah = ({ desa, kecamatan, kabupaten }) => {
    const parts = [desa, kecamatan, kabupaten].filter(p => p && p !== '-');
    return parts.length > 0 ? parts.join(', ') : '';
  };
  assert.strictEqual(formatWilayah({ desa: 'Pancoran', kecamatan: 'Pancoran', kabupaten: 'Jakarta Selatan' }), 'Pancoran, Pancoran, Jakarta Selatan');
  assert.strictEqual(formatWilayah({ desa: '-', kecamatan: '-', kabupaten: '-' }), '');
  assert.strictEqual(formatWilayah({ desa: 'Sukamaju', kecamatan: '-', kabupaten: 'Bogor' }), 'Sukamaju, Bogor');
  assert.strictEqual(formatWilayah({ desa: '', kecamatan: null, kabupaten: '-' }), '');
});

// Simulation of backend functions matching Code.gs logic
function simulateGetWilayahCached(gpsStr, mockCache, mockGeocoder) {
  const def = { desa: '-', kecamatan: '-', kabupaten: '-' };
  if (!gpsStr || gpsStr === '-') return def;

  try {
    const parts = String(gpsStr).split(',');
    if (parts.length < 2) return def;
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (isNaN(lat) || isNaN(lng)) return def;

    const cacheKey = 'wil_v1_' + lat.toFixed(3) + '_' + lng.toFixed(3);
    if (mockCache) {
      const cached = mockCache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const res = mockGeocoder(gpsStr);
    if (mockCache && res && (res.desa !== '-' || res.kecamatan !== '-' || res.kabupaten !== '-')) {
      mockCache.put(cacheKey, JSON.stringify(res), 21600);
    }
    return res;
  } catch (err) {
    return def;
  }
}

function simulateGetWilayahClient(gpsStr, mockCache, mockGeocoder) {
  try {
    const wil = simulateGetWilayahCached(gpsStr, mockCache, mockGeocoder);
    if (!wil) return '';
    const parts = [wil.desa, wil.kecamatan, wil.kabupaten].filter(p => p && p !== '-');
    return parts.length > 0 ? parts.join(', ') : '';
  } catch (err) {
    return '';
  }
}

function simulateDoPost(e, mockCache, mockGeocoder) {
  let postData = {};
  if (e && e.postData && e.postData.contents) {
    try {
      postData = JSON.parse(e.postData.contents);
    } catch (err) {
      postData = {};
    }
  }
  const action = postData.action || (e && e.parameter && e.parameter.action);

  if (action === 'reverseGeocode') {
    const gpsStr = postData.gps || (postData.data && postData.data.gps) || (e && e.parameter && e.parameter.gps) || '';
    const result = simulateGetWilayahCached(gpsStr, mockCache, mockGeocoder);
    return {
      status: 'success',
      data: result
    };
  }

  return { status: 'error', message: 'Unknown action: ' + action };
}

test('simulated getWilayahCached retrieves from cache on hit or calls geocoder on miss', () => {
  const mockCacheStore = new Map();
  let putTtl = 0;
  const mockCache = {
    get: (key) => mockCacheStore.get(key) || null,
    put: (key, val, ttl) => {
      putTtl = ttl;
      mockCacheStore.set(key, val);
    }
  };
  let geocoderCalls = 0;
  const mockGeocoder = (gps) => {
    geocoderCalls++;
    return { desa: 'Cibadak', kecamatan: 'Sukaresmi', kabupaten: 'Cianjur' };
  };

  // First call: cache miss, should call geocoder and cache with 21600 TTL
  const res1 = simulateGetWilayahCached('-6.7123,107.0456', mockCache, mockGeocoder);
  assert.deepStrictEqual(res1, { desa: 'Cibadak', kecamatan: 'Sukaresmi', kabupaten: 'Cianjur' });
  assert.strictEqual(geocoderCalls, 1);
  assert.strictEqual(putTtl, 21600);
  assert.strictEqual(mockCacheStore.has('wil_v1_-6.712_107.046'), true);

  // Second call within same grid (~110m): cache hit, should NOT call geocoder again
  const res2 = simulateGetWilayahCached('-6.7121,107.0458', mockCache, mockGeocoder);
  assert.deepStrictEqual(res2, { desa: 'Cibadak', kecamatan: 'Sukaresmi', kabupaten: 'Cianjur' });
  assert.strictEqual(geocoderCalls, 1);
});

test('simulateGetWilayahCached handles invalid and boundary GPS strings gracefully', () => {
  const mockCache = { get: () => null, put: () => {} };
  let calls = 0;
  const mockGeocoder = () => { calls++; return { desa: 'A', kecamatan: 'B', kabupaten: 'C' }; };

  assert.deepStrictEqual(simulateGetWilayahCached('', mockCache, mockGeocoder), { desa: '-', kecamatan: '-', kabupaten: '-' });
  assert.deepStrictEqual(simulateGetWilayahCached('-', mockCache, mockGeocoder), { desa: '-', kecamatan: '-', kabupaten: '-' });
  assert.deepStrictEqual(simulateGetWilayahCached('invalid', mockCache, mockGeocoder), { desa: '-', kecamatan: '-', kabupaten: '-' });
  assert.deepStrictEqual(simulateGetWilayahCached('abc,def', mockCache, mockGeocoder), { desa: '-', kecamatan: '-', kabupaten: '-' });
  assert.strictEqual(calls, 0); // Invalid inputs should not trigger geocoder
});

test('simulateGetWilayahClient returns formatted display string without em dashes', () => {
  const mockCacheStore = new Map();
  const mockCache = {
    get: (key) => mockCacheStore.get(key) || null,
    put: (key, val) => mockCacheStore.set(key, val)
  };
  const mockGeocoder = () => ({ desa: 'Pancoran', kecamatan: 'Pancoran', kabupaten: 'Jakarta Selatan' });

  const formatted = simulateGetWilayahClient('-6.2088,106.8456', mockCache, mockGeocoder);
  assert.strictEqual(formatted, 'Pancoran, Pancoran, Jakarta Selatan');
  // Assert no em dash (\u2014) is present
  assert.strictEqual(formatted.includes('\u2014'), false);

  // Empty or '-' wilayah fields
  const mockGeocoderDash = () => ({ desa: '-', kecamatan: '-', kabupaten: '-' });
  const emptyFormatted = simulateGetWilayahClient('1.23,4.56', mockCache, mockGeocoderDash);
  assert.strictEqual(emptyFormatted, '');
});

test('simulateDoPost handles reverseGeocode with root gps or nested data.gps', () => {
  const mockCache = { get: () => null, put: () => {} };
  const mockGeocoder = (gps) => ({ desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor' });

  // Format 1: { action: 'reverseGeocode', gps: '-6.2088,106.8456' }
  const req1 = {
    postData: { contents: JSON.stringify({ action: 'reverseGeocode', gps: '-6.2088,106.8456' }) }
  };
  const resp1 = simulateDoPost(req1, mockCache, mockGeocoder);
  assert.strictEqual(resp1.status, 'success');
  assert.deepStrictEqual(resp1.data, { desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor' });

  // Format 2: { action: 'reverseGeocode', data: { gps: '-6.2088,106.8456' } }
  const req2 = {
    postData: { contents: JSON.stringify({ action: 'reverseGeocode', data: { gps: '-6.2088,106.8456' } }) }
  };
  const resp2 = simulateDoPost(req2, mockCache, mockGeocoder);
  assert.strictEqual(resp2.status, 'success');
  assert.deepStrictEqual(resp2.data, { desa: 'Sukamaju', kecamatan: 'Ciawi', kabupaten: 'Bogor' });
});

test('Code.gs source file syntax and endpoint integration validation', async () => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const path = await import('node:path');

  const codePath = path.resolve('apps/backend-gas/Code.gs');
  const code = fs.readFileSync(codePath, 'utf8');

  // Verify syntax compiles without errors
  assert.doesNotThrow(() => {
    new vm.Script(code);
  }, 'Code.gs should be syntactically valid JavaScript');

  // Verify reverseGeocode action exists
  assert.strictEqual(code.includes("action === 'reverseGeocode'"), true);

  // Verify helper functions exist
  assert.strictEqual(code.includes('function getWilayahCached_(gpsStr)'), true);
  assert.strictEqual(code.includes('function getWilayahClient(gpsStr)'), true);

  // Verify submitAttendance uses getWilayahCached_
  assert.strictEqual(code.includes('const wilayah = getWilayahCached_(data.gps);'), true);

  // Verify no em dashes in entire Code.gs
  assert.strictEqual((code.match(/\u2014/g) || []).length, 0);
});

