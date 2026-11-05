import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('Typography Integrity: zero em dashes across rkbMobile test and implementation files', () => {
  const filesToCheck = [
    __filename,
    path.join(rootDir, 'apps/mobile/src/utils/rkbApi.js'),
    path.join(rootDir, 'apps/mobile/src/screens/RkbScreen.js'),
    path.join(rootDir, 'apps/mobile/App.js'),
    path.join(rootDir, 'apps/mobile/src/screens/DashboardScreen.js')
  ];

  for (const file of filesToCheck) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      assert.strictEqual(
        content.includes('\u2014'),
        false,
        `File ${path.basename(file)} must contain zero em dashes`
      );
    }
  }
});

test('rkbApi: fetchRkbDataMobile dispatches POST request with action getRkbKaryawan', async () => {
  const {
    fetchRkbDataMobile,
    setRkbHttpAdapter,
    setRkbStorageAdapter
  } = await import('../../apps/mobile/src/utils/rkbApi.js');

  let dispatchedPayload = null;
  const mockHttp = {
    post: async (url, data) => {
      dispatchedPayload = typeof data === 'string' ? JSON.parse(data) : data;
      return {
        data: {
          success: true,
          found: true,
          nama: 'Ahmad Rosyid',
          divisi: 'Data & Informasi',
          bulan: 'November',
          tahun: 2026,
          totalKpi: 95.5,
          predikat: 'Sangat Baik',
          statusKegiatan: { selesai: 5, proses: 1, belum: 0, total: 6 },
          trenKpi: [
            { bulan: 'Jan', score: 85 },
            { bulan: 'Feb', score: 90 },
            { bulan: 'Nov', score: 95.5 }
          ],
          activities: [
            { kode: 'KD-01', kegiatan: 'Monitoring RKB', bobot: '20%', status: 'Selesai', skor: 100 }
          ]
        }
      };
    }
  };

  const memoryStore = new Map();
  const mockStorage = {
    getItem: async (key) => memoryStore.get(key) || null,
    setItem: async (key, val) => memoryStore.set(key, String(val)),
    removeItem: async (key) => memoryStore.delete(key)
  };

  setRkbHttpAdapter(mockHttp);
  setRkbStorageAdapter(mockStorage);

  const result = await fetchRkbDataMobile({
    nama: 'Ahmad Rosyid',
    divisi: 'Data & Informasi',
    bulan: 'November',
    tahun: 2026
  });

  assert.ok(dispatchedPayload, 'HTTP POST must be dispatched');
  assert.strictEqual(dispatchedPayload.action, 'getRkbKaryawan');
  assert.strictEqual(dispatchedPayload.nama, 'Ahmad Rosyid');
  assert.strictEqual(dispatchedPayload.divisi, 'Data & Informasi');
  assert.strictEqual(dispatchedPayload.bulan, 'November');
  assert.strictEqual(dispatchedPayload.tahun, 2026);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.totalKpi, 95.5);
  assert.strictEqual(result.predikat, 'Sangat Baik');
  assert.strictEqual(result.fromCache, false);

  // Verify response was cached to storage
  const cacheKey = '@rkb_cache_ahmad rosyid_november_2026';
  assert.ok(memoryStore.has(cacheKey), 'Response must be cached in storage');
});

test('rkbApi: fetchRkbDataMobile falls back to cached data when network fails', async () => {
  const {
    fetchRkbDataMobile,
    setRkbHttpAdapter,
    setRkbStorageAdapter
  } = await import('../../apps/mobile/src/utils/rkbApi.js');

  const cachedData = {
    success: true,
    found: true,
    nama: 'Siti Aminah',
    divisi: 'Keuangan',
    bulan: 'Oktober',
    tahun: 2026,
    totalKpi: 88.0,
    predikat: 'Baik',
    statusKegiatan: { selesai: 4, proses: 1, belum: 0, total: 5 },
    trenKpi: [{ bulan: 'Okt', score: 88.0 }],
    activities: [
      { kode: 'KU-01', kegiatan: 'Rekonsiliasi Kas', bobot: '25%', status: 'Selesai', skor: 100 }
    ]
  };

  const cacheKey = '@rkb_cache_siti aminah_oktober_2026';
  const memoryStore = new Map([
    [cacheKey, JSON.stringify(cachedData)]
  ]);

  const mockStorage = {
    getItem: async (key) => memoryStore.get(key) || null,
    setItem: async (key, val) => memoryStore.set(key, String(val)),
    removeItem: async (key) => memoryStore.delete(key)
  };

  const failingHttp = {
    post: async () => {
      throw new Error('Network Error: offline timeout');
    }
  };

  setRkbHttpAdapter(failingHttp);
  setRkbStorageAdapter(mockStorage);

  const result = await fetchRkbDataMobile({
    nama: 'Siti Aminah',
    divisi: 'Keuangan',
    bulan: 'Oktober',
    tahun: 2026
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.fromCache, true);
  assert.strictEqual(result.totalKpi, 88.0);
  assert.strictEqual(result.predikat, 'Baik');
  assert.strictEqual(result.activities.length, 1);
});

test('rkbApi: fetchAllRkbSummaryMobile dispatches POST request with action getAllRkbSummary', async () => {
  const {
    fetchAllRkbSummaryMobile,
    setRkbHttpAdapter
  } = await import('../../apps/mobile/src/utils/rkbApi.js');

  let dispatched = null;
  const mockHttp = {
    post: async (url, data) => {
      dispatched = typeof data === 'string' ? JSON.parse(data) : data;
      return {
        data: {
          success: true,
          bulan: 'November',
          tahun: 2026,
          summary: [
            { nama: 'Ahmad Rosyid', totalKpi: 95.5, predikat: 'Sangat Baik' }
          ]
        }
      };
    }
  };

  setRkbHttpAdapter(mockHttp);

  const res = await fetchAllRkbSummaryMobile({ bulan: 'November', tahun: 2026 });
  assert.ok(dispatched);
  assert.strictEqual(dispatched.action, 'getAllRkbSummary');
  assert.strictEqual(dispatched.bulan, 'November');
  assert.strictEqual(dispatched.tahun, 2026);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.summary.length, 1);
});

test('RkbScreen source code static contract: executive dark theme and core layout', () => {
  const screenPath = path.join(rootDir, 'apps/mobile/src/screens/RkbScreen.js');
  assert.strictEqual(fs.existsSync(screenPath), true, 'RkbScreen.js must exist');

  const content = fs.readFileSync(screenPath, 'utf8');

  // Must export default component function
  assert.match(
    content,
    /export\s+default\s+function\s+RkbScreen\s*\(/,
    'RkbScreen must export default function component'
  );

  // Executive Dark Theme palette
  assert.ok(content.includes('#0b0f19'), 'Must use executive dark background #0b0f19');
  assert.ok(content.includes('#131b2e'), 'Must use card container background #131b2e');
  assert.ok(content.includes('#1e293b'), 'Must use border color #1e293b');

  // Header and title
  assert.ok(
    content.includes('Dashboard KPI YEKA'),
    'Header must include title Dashboard KPI YEKA'
  );
  assert.ok(
    content.includes('RefreshControl'),
    'Must implement pull to refresh via RefreshControl'
  );

  // 3 Metric Cards
  assert.ok(
    content.includes('TOTAL KPI') || content.includes('TOTAL KPI BULAN INI'),
    'Must include Total KPI metric card'
  );
  assert.ok(
    content.includes('PREDIKAT'),
    'Must include Predikat metric card'
  );
  assert.ok(
    content.includes('STATUS KEGIATAN'),
    'Must include Status Kegiatan metric card'
  );
  assert.ok(content.includes('Selesai'), 'Must include Selesai status badge');
  assert.ok(content.includes('Proses'), 'Must include Proses status badge');
  assert.ok(content.includes('Belum'), 'Must include Belum status badge');

  // Yearly Trend Curve
  assert.ok(
    content.includes('Tren KPI Tahunan'),
    'Must include Tren KPI Tahunan section'
  );
  assert.ok(
    content.includes('Performance Curve'),
    'Must include Performance Curve tag'
  );

  // Activities overview
  assert.ok(
    content.includes('Detail Rencana & Realisasi Kegiatan'),
    'Must include Detail Rencana & Realisasi Kegiatan section'
  );
  assert.ok(
    content.includes('Activities Overview'),
    'Must include Activities Overview tag'
  );
});

test('App.js source code static contract: imports and routes RkbScreen with navigation tab', () => {
  const appPath = path.join(rootDir, 'apps/mobile/App.js');
  const content = fs.readFileSync(appPath, 'utf8');

  // Imports RkbScreen
  assert.match(
    content,
    /import\s+RkbScreen\s+from\s+['"]\.\/src\/screens\/RkbScreen['"]/,
    'App.js must import RkbScreen'
  );

  // Routes 'rkb' in renderScreen()
  assert.match(
    content,
    /case\s+['"]rkb['"]\s*:/,
    'App.js must handle case "rkb" in renderScreen()'
  );
  assert.match(
    content,
    /<RkbScreen\s+user=\{user\}\s+isAdmin=\{isAdmin\}/,
    'App.js must render <RkbScreen user={user} isAdmin={isAdmin} ... />'
  );

  // Custom Bottom Tab Bar includes RKB navigation item
  assert.match(
    content,
    /setActiveTab\(['"]rkb['"]\)/,
    'Bottom nav must contain tab trigger setActiveTab("rkb")'
  );
  assert.ok(
    content.includes('RKB & KPI'),
    'Bottom nav must include label RKB & KPI'
  );
});

test('DashboardScreen.js source code static contract: supports onNavigateTab prop and quick RKB trigger', () => {
  const dashPath = path.join(rootDir, 'apps/mobile/src/screens/DashboardScreen.js');
  const content = fs.readFileSync(dashPath, 'utf8');

  // Supports onNavigateTab in props
  assert.match(
    content,
    /export\s+default\s+function\s+DashboardScreen\s*\(\s*\{[^}]*onNavigateTab[^}]*\}\s*\)/,
    'DashboardScreen must accept onNavigateTab prop'
  );

  // Quick navigation trigger to rkb
  assert.ok(
    content.includes("onNavigateTab('rkb')") || content.includes('onNavigateTab("rkb")'),
    'DashboardScreen must support navigating to rkb'
  );
});
