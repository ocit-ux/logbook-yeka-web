import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import of rkbService
const rkbServicePath = path.resolve(__dirname, '../../apps/backend-gas/rkbService.js');
let rkbService;
try {
  const mod = await import(pathToFileURL(rkbServicePath).href);
  rkbService = mod.default || mod;
} catch (e) {
  rkbService = null;
}

test('calculateRkbMetrics computes totalKpi, predikat, and statusKegiatan accurately', () => {
  assert.ok(rkbService, 'rkbService module should be available');
  const { calculateRkbMetrics } = rkbService;

  // Realistic sample data matching employee RKB sheet
  const sampleActivities = [
    { kode: 'DI-01', kegiatan: 'Pengelolaan Database & Backup Rutin', bobot: 0.20, status: 'Selesai', skor: 100 },
    { kode: 'DI-02', kegiatan: 'Integrasi API Dashboard Absensi', bobot: 0.25, status: 'Selesai', skor: 100 },
    { kode: 'DI-03', kegiatan: 'Pemeliharaan Infrastruktur Jaringan', bobot: 0.20, status: 'Proses', skor: 50 },
    { kode: 'DI-04', kegiatan: 'Pengembangan Fitur RKB & KPI Monitoring', bobot: 0.25, status: 'Proses', skor: 50 },
    { kode: 'DI-05', kegiatan: 'Penyusunan Dokumentasi SOP IT', bobot: 0.10, status: 'Belum', skor: 0 }
  ];

  const metrics = calculateRkbMetrics(sampleActivities);

  // 0.20*100 + 0.25*100 + 0.20*50 + 0.25*50 + 0.10*0 = 20 + 25 + 10 + 12.5 + 0 = 67.5
  assert.strictEqual(metrics.totalKpi, 67.5);
  assert.strictEqual(metrics.predikat, 'Kurang');
  assert.deepStrictEqual(metrics.statusKegiatan, {
    selesai: 2,
    proses: 2,
    belum: 1,
    total: 5
  });
});

test('calculateRkbMetrics handles all-completed activities with Sangat Baik predikat', () => {
  assert.ok(rkbService);
  const { calculateRkbMetrics } = rkbService;

  const activities = [
    { kode: 'DI-01', kegiatan: 'Kegiatan A', bobot: 0.5, status: 'Selesai', skor: 100 },
    { kode: 'DI-02', kegiatan: 'Kegiatan B', bobot: 0.5, status: 'Selesai', skor: 100 }
  ];

  const metrics = calculateRkbMetrics(activities);
  assert.strictEqual(metrics.totalKpi, 100);
  assert.strictEqual(metrics.predikat, 'Sangat Baik');
  assert.deepStrictEqual(metrics.statusKegiatan, {
    selesai: 2,
    proses: 0,
    belum: 0,
    total: 2
  });
});

test('calculateRkbMetrics handles empty activities safely with default zeros', () => {
  assert.ok(rkbService);
  const { calculateRkbMetrics } = rkbService;

  const metrics = calculateRkbMetrics([]);
  assert.strictEqual(metrics.totalKpi, 0);
  assert.strictEqual(metrics.predikat, 'Sangat Kurang');
  assert.deepStrictEqual(metrics.statusKegiatan, {
    selesai: 0,
    proses: 0,
    belum: 0,
    total: 0
  });
});

test('calculateRkbMetrics computes skor automatically from status when skor is omitted', () => {
  assert.ok(rkbService);
  const { calculateRkbMetrics } = rkbService;

  const activities = [
    { kode: 'DI-01', kegiatan: 'Tugas 1', bobot: 0.4, status: 'Selesai' },
    { kode: 'DI-02', kegiatan: 'Tugas 2', bobot: 0.4, status: 'Proses' },
    { kode: 'DI-03', kegiatan: 'Tugas 3', bobot: 0.2, status: 'Belum' }
  ];

  const metrics = calculateRkbMetrics(activities);
  // 0.4 * 100 + 0.4 * 50 + 0.2 * 0 = 40 + 20 + 0 = 60
  assert.strictEqual(metrics.totalKpi, 60);
  assert.strictEqual(metrics.predikat, 'Kurang');
  assert.deepStrictEqual(metrics.statusKegiatan, {
    selesai: 1,
    proses: 1,
    belum: 1,
    total: 3
  });
});

test('evaluatePredikat covers all score threshold bands', () => {
  assert.ok(rkbService);
  const { evaluatePredikat } = rkbService;

  assert.strictEqual(evaluatePredikat(95), 'Sangat Baik');
  assert.strictEqual(evaluatePredikat(90), 'Sangat Baik');
  assert.strictEqual(evaluatePredikat(89.9), 'Baik');
  assert.strictEqual(evaluatePredikat(80), 'Baik');
  assert.strictEqual(evaluatePredikat(79.9), 'Cukup');
  assert.strictEqual(evaluatePredikat(70), 'Cukup');
  assert.strictEqual(evaluatePredikat(69.9), 'Kurang');
  assert.strictEqual(evaluatePredikat(60), 'Kurang');
  assert.strictEqual(evaluatePredikat(59.9), 'Sangat Kurang');
  assert.strictEqual(evaluatePredikat(0), 'Sangat Kurang');
  assert.strictEqual(evaluatePredikat(-10), 'Sangat Kurang');
});

test('parseYearlyKpiTrend formats 12 months with default zero fills', () => {
  assert.ok(rkbService);
  const { parseYearlyKpiTrend } = rkbService;

  const monthlyScores = {
    Jan: 75.5,
    Feb: 82.0,
    Mar: 91.5
  };

  const trend = parseYearlyKpiTrend(monthlyScores);
  assert.strictEqual(trend.length, 12);

  assert.strictEqual(trend[0].bulan, 'Jan');
  assert.strictEqual(trend[0].score, 75.5);

  assert.strictEqual(trend[1].bulan, 'Feb');
  assert.strictEqual(trend[1].score, 82.0);

  assert.strictEqual(trend[2].bulan, 'Mar');
  assert.strictEqual(trend[2].score, 91.5);

  assert.strictEqual(trend[3].bulan, 'Apr');
  assert.strictEqual(trend[3].score, 0);

  assert.strictEqual(trend[11].bulan, 'Des');
  assert.strictEqual(trend[11].score, 0);
});

test('matchEmployeeRkbFile matches employee spreadsheet by name and division variations', () => {
  assert.ok(rkbService);
  const { matchEmployeeRkbFile } = rkbService;

  const mockFiles = [
    { id: 'file-1', name: 'RKB_ROSYID_DATA&INFORMASI_YEKA..xlsx' },
    { id: 'file-2', name: 'RKB_AHMAD_KEUANGAN_YEKA.xlsx' },
    { id: 'file-3', name: 'RKB_SITI_PROGRAM_YEKA.xlsx' }
  ];

  // Exact name and division match
  const match1 = matchEmployeeRkbFile(mockFiles, 'Rosyid', 'Data & Informasi');
  assert.ok(match1);
  assert.strictEqual(match1.id, 'file-1');

  // Case insensitive match
  const match2 = matchEmployeeRkbFile(mockFiles, 'rosyid', 'DATA&INFORMASI');
  assert.ok(match2);
  assert.strictEqual(match2.id, 'file-1');

  // String array fallback
  const stringFiles = [
    'RKB_ROSYID_DATA&INFORMASI_YEKA..xlsx',
    'RKB_AHMAD_KEUANGAN_YEKA.xlsx'
  ];
  const match3 = matchEmployeeRkbFile(stringFiles, 'Ahmad', 'Keuangan');
  assert.ok(match3);
  assert.strictEqual(typeof match3 === 'string' ? match3 : match3.name, 'RKB_AHMAD_KEUANGAN_YEKA.xlsx');

  // Non-matching query returns null
  const matchNone = matchEmployeeRkbFile(mockFiles, 'Budi', 'Operasional');
  assert.strictEqual(matchNone, null);

  // Critical disambiguation: Muhammad Abdul Rosyid vs Ainur Rosyidah
  const ambigFiles = [
    { id: 'ainur-1', name: 'RKB_AINUR ROSYIDAH _RND_YEKA .xlsx' },
    { id: 'rosyid-1', name: 'RKB_ROSYID_DATA&INFORMASI_YEKA..xlsx' }
  ];
  const matchRosyid = matchEmployeeRkbFile(ambigFiles, 'Muhammad Abdul Rosyid', 'Operasional');
  assert.ok(matchRosyid);
  assert.strictEqual(matchRosyid.id, 'rosyid-1');

  const matchAinur = matchEmployeeRkbFile(ambigFiles, 'AINUR ROSYIDAH', 'RND');
  assert.ok(matchAinur);
  assert.strictEqual(matchAinur.id, 'ainur-1');
});

test('parseRkbSheetRows extracts activities and converts percentages and status', () => {
  assert.ok(rkbService);
  const { parseRkbSheetRows } = rkbService;

  const rawRows = [
    ['Yayasan Elang Katulistiwa Adipavitra', '', '', '', ''],
    ['Rencana Kerja Bulanan (RKB)', '', '', '', ''],
    ['No', 'Kode', 'Rencana Kegiatan', 'Bobot', 'Status', 'Skor'],
    [1, 'DI-01', 'Pengelolaan Database', '20%', 'Selesai', 100],
    [2, 'DI-02', 'Integrasi API', 0.3, 'Proses', 50],
    [3, 'DI-03', 'Dokumentasi SOP', 0.5, 'Belum', 0],
    ['', '', '', '', '', ''] // Empty row
  ];

  const activities = parseRkbSheetRows(rawRows);
  assert.strictEqual(activities.length, 3);

  assert.strictEqual(activities[0].kode, 'DI-01');
  assert.strictEqual(activities[0].kegiatan, 'Pengelolaan Database');
  assert.strictEqual(activities[0].bobot, 0.2);
  assert.strictEqual(activities[0].status, 'Selesai');
  assert.strictEqual(activities[0].skor, 100);

  assert.strictEqual(activities[1].kode, 'DI-02');
  assert.strictEqual(activities[1].bobot, 0.3);
  assert.strictEqual(activities[1].status, 'Proses');
});

test('parseRkbSheetRows and extractRkbRekapKpi handle authentic YEKA RKB spreadsheet format', () => {
  assert.ok(rkbService);
  const { parseRkbSheetRows, extractRkbRekapKpi, calculateRkbMetrics } = rkbService;

  const yekaSpreadsheetRows = [
    ['SISTEM RKB (RENCANA KERJA BULANAN) TIM', '', '', '', ''],
    ['', '', '', '', ''],
    ['A.1. IDENTITAS PEGAWAI', '', '', 'A.2. DAFTAR KODE TUGAS', ''],
    ['Nama Pegawai', '', 'M. Abdud Rosyid', '', ''],
    ['Kode Grade', '', 'OP-2A', '', ''],
    ['Divisi', '', 'Data & Informasi', '', ''],
    ['Proyek', '', '-', '', ''],
    ['Jabatan', '', 'Anggota', '', ''],
    ['Bulan / Tahun', '', 'Oktober 2026', '', ''],
    ['Total HOK', '', '20', '', ''],
    ['', '', '', '', ''],
    ['B. TABEL KEGIATAN', '', '', '', ''],
    ['IDENTITAS KEGIATAN', '', '', 'RENCANA', 'TIMELINE'],
    ['No', 'Kode', 'Kegiatan', 'Jenis', 'Output / Indikator', 'Estimasi HOK', 'Bobot %', 'M1', 'M2', 'M3', 'M4', 'Tanggal Realisasi', 'Status Pelaksanaan', 'Eviden', 'Komplain', 'Skor Pelaksanaan', 'Skor Eviden', 'Skor Komplain', 'Skor Gabungan', 'Bobot x Skor (KPI)'],
    ['A. KEGIATAN UTAMA (80%)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['1', 'DI-01', 'Backup Program Smelting & Cargill', '* Utama', 'Thn 25-26', '2', '10,00%', 'X', 'X', 'X', 'X', '1-31 Agt', 'Terlaksana', 'Ada', 'Tidak Ada', '1,00', '1,00', '1,00', '1,00', '10,00%'],
    ['2', 'DI-02', 'Dummy Aplikasi Project Managemen YEKA', '* Utama', 'Menu Aplikasi Status Clear', '4', '20,00%', 'X', 'X', 'X', 'X', '10-20 Agt', 'Terlaksana', 'Ada', 'Tidak Ada', '1,00', '1,00', '1,00', '1,00', '20,00%'],
    ['3', 'DI-02', 'Dummy Aplikasi EkoWacth', '* Utama', 'Menu Aplikasi Status Clear', '4', '20,00%', 'X', 'X', 'X', 'X', '15-30 Agt', 'Proses', 'Ada', 'Tidak Ada', '0,50', '1,00', '1,00', '0,65', '13,00%'],
    ['4', 'DI-03', 'Flayer & Short Video', '* Utama', 'Hari Besar dan Video Story', '1', '5,00%', 'X', 'X', 'X', 'X', '', 'Belum', 'Tidak Ada', 'Ada', '0,00', '0,00', '0,00', '0,00', '0,00%'],
    ['Subtotal Utama', '', '', '', '', '16', '80,00%', '', '', '', '', '', '', '', '', '', '', '', '', '62,00%'],
    ['B. TUGAS MANAJEMEN (20%)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['5', 'TM-01', 'Belajar Drone', 'Manajemen', 'Bisa Terbang dan Ambil Gambar Jarak 20m', '2', '10,00%', 'X', 'X', 'X', 'X', 'Mingguan', 'Terlaksana', 'Tidak Ada', 'Tidak Ada', '1,00', '0,00', '1,00', '0,80', '8,00%'],
    ['Subtotal Manajemen', '', '', '', '', '4', '20,00%', '', '', '', '', '', '', '', '', '', '', '', '', '18,00%'],
    ['TOTAL', '', '', '', '', '20', '100,00%', '', '', '', '', '', '', '', '', '', '', '', '', '80,00%'],
    ['', '', '', '', ''],
    ['D. REKAP KPI BULANAN', '', '', '', ''],
    ['TOTAL KPI', '', '', '', '', '', '', '', '100%', '80,00'],
    ['Predikat', '', '', '', '', '', '', '', '', 'Cukup']
  ];

  const activities = parseRkbSheetRows(yekaSpreadsheetRows);
  assert.strictEqual(activities.length, 5);
  assert.strictEqual(activities[0].kode, 'DI-01');
  assert.strictEqual(activities[0].status, 'Selesai');
  assert.strictEqual(activities[0].output, 'Thn 25-26');
  assert.strictEqual(activities[2].status, 'Proses');
  assert.strictEqual(activities[3].status, 'Belum');

  const rekap = extractRkbRekapKpi(yekaSpreadsheetRows);
  assert.ok(rekap);
  assert.strictEqual(rekap.totalKpi, 80);
  assert.strictEqual(rekap.predikat, 'Cukup');

  const metrics = calculateRkbMetrics(activities, rekap);
  assert.strictEqual(metrics.totalKpi, 80);
  assert.strictEqual(metrics.predikat, 'Cukup');
  assert.strictEqual(metrics.statusKegiatan.selesai, 3);
  assert.strictEqual(metrics.statusKegiatan.proses, 1);
  assert.strictEqual(metrics.statusKegiatan.belum, 1);
});

test('Code.gs source code integration contract for RKB service', () => {
  const codePath = path.resolve(__dirname, '../../apps/backend-gas/Code.gs');
  assert.strictEqual(fs.existsSync(codePath), true);
  const code = fs.readFileSync(codePath, 'utf8');

  // Verify syntax compiles without errors
  assert.doesNotThrow(() => {
    new vm.Script(code);
  }, 'Code.gs should be syntactically valid JavaScript');

  // Verify DRIVE_FOLDER_RKB_ID definition
  assert.strictEqual(code.includes("DRIVE_FOLDER_RKB_ID = '14C_sXl9X0L3RAPCFFRKWmWf_qrwoDf2i'"), true);

  // Verify getRkbKaryawan and getAllRkbSummary function definitions
  assert.strictEqual(code.includes('function getRkbKaryawan('), true);
  assert.strictEqual(code.includes('function getAllRkbSummary('), true);

  // Verify doPost switch actions
  assert.strictEqual(code.includes("case 'getRkbKaryawan':"), true);
  assert.strictEqual(code.includes("case 'getAllRkbSummary':"), true);

  // Verify zero em dashes in entire Code.gs
  assert.strictEqual((code.match(/\u2014/g) || []).length, 0);
});

test('Rule R-02 typography check: zero em dashes across backend files', () => {
  const filesToCheck = [
    path.resolve(__dirname, 'rkbService.test.mjs'),
    path.resolve(__dirname, '../../apps/backend-gas/rkbService.js'),
    path.resolve(__dirname, '../../apps/backend-gas/Code.gs')
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const emDashCount = (content.match(/\u2014/g) || []).length;
      assert.strictEqual(emDashCount, 0, `Rule R-02 violation: em dash found in ${filePath}`);
    }
  }
});
