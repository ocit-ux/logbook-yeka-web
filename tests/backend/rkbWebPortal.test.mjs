import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const indexHtmlPath = path.join(rootDir, 'apps/backend-gas/Index.html');

test('Index.html contains #nav-rkb-kpi sidebar navigation button', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(
    html,
    /id=["']nav-rkb-kpi["'][^>]*onclick=["']switchPage\(['"]rkb-kpi['"]\)/,
    'Sidebar nav must contain button #nav-rkb-kpi invoking switchPage("rkb-kpi")'
  );
  assert.match(
    html,
    /fa-(?:chart-line|chart-simple|chart-pie|chart-bar|chart-column)/,
    'Sidebar nav button must have chart icon'
  );
});

test('Index.html contains #page-rkb-kpi section with executive dark theme container', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(
    html,
    /<section\s+id=["']page-rkb-kpi["']/,
    'Section #page-rkb-kpi must exist'
  );
  assert.match(
    html,
    /id=["']rkb-header-subtitle["']/,
    'Subtitle element #rkb-header-subtitle must exist'
  );
  assert.match(
    html,
    /id=["']btn-refresh-rkb["']/,
    'Refresh button #btn-refresh-rkb must exist'
  );
});

test('Index.html contains filter selectors for employee, month, and year', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(
    html,
    /id=["']select-rkb-karyawan["']/,
    'Employee select #select-rkb-karyawan must exist'
  );
  assert.match(
    html,
    /id=["']select-rkb-bulan["']/,
    'Month select #select-rkb-bulan must exist'
  );
  assert.match(
    html,
    /id=["']select-rkb-tahun["']/,
    'Year select #select-rkb-tahun must exist'
  );
});

test('Index.html contains 3 executive metric card containers', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(
    html,
    /id=["']rkb-metric-score["']/,
    'Total KPI score element #rkb-metric-score must exist'
  );
  assert.match(
    html,
    /id=["']rkb-metric-predikat["']/,
    'Predikat badge element #rkb-metric-predikat must exist'
  );
  assert.match(
    html,
    /id=["']rkb-badge-selesai["']/,
    'Selesai status badge #rkb-badge-selesai must exist'
  );
  assert.match(
    html,
    /id=["']rkb-badge-proses["']/,
    'Proses status badge #rkb-badge-proses must exist'
  );
  assert.match(
    html,
    /id=["']rkb-badge-belum["']/,
    'Belum status badge #rkb-badge-belum must exist'
  );
});

test('Index.html contains canvas #chart-rkb-tren for yearly KPI trend curve', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(
    html,
    /<canvas\s+[^>]*id=["']chart-rkb-tren["']/,
    'Canvas #chart-rkb-tren must exist'
  );
});

test('Index.html contains table #table-rkb-kegiatan with required headers', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(
    html,
    /id=["']table-rkb-kegiatan["']/,
    'Table or table body #table-rkb-kegiatan must exist'
  );
  const tableSliceMatch = html.match(/<table[\s\S]*?id=["']table-rkb-kegiatan["'][\s\S]*?<\/table>/i) ||
    html.match(/id=["']table-rkb-kegiatan["'][\s\S]*?<\/table>/i) ||
    html.match(/<table[\s\S]*?<\/table>/i);
  assert.ok(tableSliceMatch, 'Table block must be present');

  const lowerHtml = html.toLowerCase();
  assert.ok(lowerHtml.includes('kode'), 'Table header KODE must be present');
  assert.ok(lowerHtml.includes('kegiatan'), 'Table header KEGIATAN must be present');
  assert.ok(lowerHtml.includes('bobot'), 'Table header BOBOT must be present');
  assert.ok(lowerHtml.includes('status'), 'Table header STATUS must be present');
  assert.ok(lowerHtml.includes('skor'), 'Table header SKOR must be present');
});

test('Index.html switchPage and prosesLoginSukses support rkb-kpi page', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(
    html,
    /switchPage\s*\(\s*pageId\s*\)\s*\{[\s\S]*?page-rkb-kpi/,
    'switchPage must register page-rkb-kpi'
  );
  assert.match(
    html,
    /prosesLoginSukses\s*\([\s\S]*?nav-rkb-kpi/,
    'prosesLoginSukses must show nav-rkb-kpi for users'
  );
});

test('Index.html contains loadRkbDashboard, renderRkbDashboard, and drawRkbTrendChart functions', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(
    html,
    /function\s+loadRkbDashboard\s*\(/,
    'loadRkbDashboard function must exist in Index.html'
  );
  assert.match(
    html,
    /function\s+renderRkbDashboard\s*\(/,
    'renderRkbDashboard function must exist in Index.html'
  );
  assert.match(
    html,
    /function\s+drawRkbTrendChart\s*\(/,
    'drawRkbTrendChart function must exist in Index.html'
  );
  assert.match(
    html,
    /function\s+buildRkbKaryawanDropdown\s*\(/,
    'buildRkbKaryawanDropdown function must exist in Index.html'
  );
});

test('Rule R-02 typography check: zero em dashes and zero en dashes in rkbWebPortal test and Index.html', () => {
  const testFileContent = fs.readFileSync(__filename, 'utf8');
  assert.strictEqual(testFileContent.includes('\u2014'), false, 'Test file must contain zero em dashes');
  assert.strictEqual(testFileContent.includes('\u2013'), false, 'Test file must contain zero en dashes');

  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.strictEqual(html.includes('\u2014'), false, 'Index.html must contain zero em dashes');
  assert.strictEqual(html.includes('\u2013'), false, 'Index.html must contain zero en dashes');
});
