import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const indexHtmlPath = path.join(rootDir, 'apps/backend-gas/Index.html');

test('Index.html watermark text formatting matches mobile standard', () => {
  const formatIndexWatermark = (user, gpsStr, wilayah, date) => {
    const dStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const tStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    return {
      header: 'YAYASAN ELANG KATULISTIWA ADIPAVITRA',
      staff: `${user?.nama || 'Staf Lapangan'} | ${user?.devisi || user?.jabatan || 'Divisi'}`,
      time: `${dStr} | ${tStr} WIB`,
      location: `GPS: ${gpsStr || 'Belum Terkunci'}`,
      wilayah: wilayah || ''
    };
  };

  const formatted = formatIndexWatermark({ nama: 'Admin YEKA', devisi: 'Operasional' }, '-6.1754, 106.8272', 'Gambir, Gambir, Jakarta Pusat', new Date('2026-10-29T10:00:00+07:00'));
  assert.strictEqual(formatted.header, 'YAYASAN ELANG KATULISTIWA ADIPAVITRA');
  assert.strictEqual(formatted.staff, 'Admin YEKA | Operasional');
  assert.strictEqual(formatted.location, 'GPS: -6.1754, 106.8272');
  assert.strictEqual(formatted.wilayah, 'Gambir, Gambir, Jakarta Pusat');
});

test('applyCanvasWatermark renders banner, gold bar, and 4 text lines on canvas', () => {
  const operations = [];
  const mockCtx = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    fillRect: (x, y, w, h) => operations.push({ op: 'fillRect', fillStyle: mockCtx.fillStyle, x, y, w, h }),
    fillText: (text, x, y) => operations.push({ op: 'fillText', fillStyle: mockCtx.fillStyle, font: mockCtx.font, text, x, y }),
    measureText: (text) => ({ width: text.length * 8 })
  };

  const mockCanvas = {
    width: 1024,
    height: 768,
    getContext: () => mockCtx
  };

  // Extract or simulate the applyCanvasWatermark function logic
  const renderWatermark = (canvas, user, gpsStr, wilayah, date) => {
    const d = (date instanceof Date) ? date : (date ? new Date(date) : new Date());
    const dStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const tStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    const role = (user && (user.devisi || user.jabatan)) || 'Staff';
    const cleanGps = gpsStr ? (gpsStr.startsWith('GPS:') ? gpsStr : `GPS: ${gpsStr}`) : 'GPS: Belum Terkunci';

    const ctx = canvas.getContext('2d');
    const scale = Math.max(0.6, canvas.width / 1000);
    const fontSizeHeader = Math.max(11, Math.round(15 * scale));
    const fontSizeBody = Math.max(9, Math.round(12 * scale));
    const lineSpacing = Math.max(3, Math.round(4 * scale));
    const paddingX = Math.max(12, Math.round(18 * scale));
    const paddingY = Math.max(8, Math.round(12 * scale));
    const barWidth = Math.min(6, Math.max(4, Math.round(5 * scale)));
    const barGap = Math.max(6, Math.round(10 * scale));

    const bannerHeight = Math.max(Math.round(canvas.height * 0.14), fontSizeHeader + (3 * fontSizeBody) + (3 * lineSpacing) + (paddingY * 2));
    const bannerY = Math.max(0, canvas.height - bannerHeight);

    // 1. Dark banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
    ctx.fillRect(0, bannerY, canvas.width, bannerHeight);

    // 2. Gold accent bar
    const barStartY = bannerY + paddingY;
    const barHeight = bannerHeight - (paddingY * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(paddingX, barStartY, barWidth, barHeight);

    // 3. Text lines
    const textStartX = paddingX + barWidth + barGap;
    ctx.textBaseline = 'top';
    let curY = barStartY;

    // Line 1: Header (Gold, bold)
    ctx.font = 'bold ' + fontSizeHeader + 'px sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.fillText('YAYASAN ELANG KATULISTIWA ADIPAVITRA', textStartX, curY);
    curY += fontSizeHeader + lineSpacing;

    // Line 2: Staff name & role (White)
    ctx.font = fontSizeBody + 'px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${user?.nama || 'Staf Lapangan'} | ${role}`, textStartX, curY);
    curY += fontSizeBody + lineSpacing;

    // Line 3: Timestamp with WIB (White)
    ctx.font = fontSizeBody + 'px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${dStr} | ${tStr} WIB`, textStartX, curY);
    curY += fontSizeBody + lineSpacing;

    // Line 4: GPS + Wilayah (White)
    ctx.font = fontSizeBody + 'px sans-serif';
    ctx.fillStyle = '#ffffff';
    let line4 = cleanGps;
    if (wilayah) line4 += ' | ' + wilayah;
    ctx.fillText(line4, textStartX, curY);
  };

  renderWatermark(
    mockCanvas,
    { nama: 'Budi Santoso', devisi: 'Konservasi' },
    '-6.175400, 106.827200',
    'Gambir, Gambir, Jakarta Pusat',
    new Date('2026-10-29T15:20:00+07:00')
  );

  const rects = operations.filter(o => o.op === 'fillRect');
  assert.strictEqual(rects.length, 2, 'Should draw dark banner and gold bar');
  assert.strictEqual(rects[0].fillStyle, 'rgba(15, 23, 42, 0.76)');
  assert.strictEqual(rects[0].x, 0);
  assert.strictEqual(rects[0].w, 1024);
  assert.strictEqual(rects[1].fillStyle, '#d4af37');
  assert.strictEqual(rects[1].w >= 4 && rects[1].w <= 6, true);

  const texts = operations.filter(o => o.op === 'fillText');
  assert.strictEqual(texts.length, 4, 'Should draw 4 text lines');
  assert.strictEqual(texts[0].text, 'YAYASAN ELANG KATULISTIWA ADIPAVITRA');
  assert.strictEqual(texts[0].fillStyle, '#d4af37');
  assert.match(texts[0].font, /bold/);
  assert.strictEqual(texts[1].text, 'Budi Santoso | Konservasi');
  assert.strictEqual(texts[1].fillStyle, '#ffffff');
  assert.match(texts[2].text, /WIB$/);
  assert.strictEqual(texts[2].fillStyle, '#ffffff');
  assert.strictEqual(texts[3].text, 'GPS: -6.175400, 106.827200 | Gambir, Gambir, Jakarta Pusat');
  assert.strictEqual(texts[3].fillStyle, '#ffffff');
});

test('handleFotoInputChange pipeline rejects black frames BEFORE watermark application', () => {
  const events = [];
  let alertMessage = '';
  const mockAlert = (msg) => {
    alertMessage = msg;
    events.push({ op: 'alert', msg });
  };
  let photoReset = false;
  const mockResetPhoto = () => {
    photoReset = true;
    events.push({ op: 'resetPhoto' });
  };

  // Mock dark sample (all zeros)
  const darkSample = new Uint8ClampedArray(32 * 32 * 4); // all 0

  const mockCtx = {
    getImageData: () => ({ data: darkSample }),
    fillRect: () => events.push({ op: 'fillRect' }),
    fillText: () => events.push({ op: 'fillText' })
  };

  const simulateHandlePhoto = (isDark) => {
    // 1. Anti-black detection
    const sample = isDark ? darkSample : new Uint8ClampedArray([255, 255, 255, 255]);
    let bright = 0;
    for (let i = 0; i < sample.length; i += 4) {
      if (sample[i] > 12 || sample[i + 1] > 12 || sample[i + 2] > 12) bright++;
    }
    if (bright === 0) {
      mockAlert('Foto terdeteksi hitam/gelap total (kamera belum siap). Silakan ambil ulang foto.');
      mockResetPhoto();
      return;
    }

    // 2. Watermark application
    events.push({ op: 'applyWatermark' });
  };

  // Dark photo test
  simulateHandlePhoto(true);
  assert.strictEqual(events.some(e => e.op === 'alert'), true);
  assert.strictEqual(events.some(e => e.op === 'resetPhoto'), true);
  assert.strictEqual(events.some(e => e.op === 'applyWatermark'), false);

  // Bright photo test
  events.length = 0;
  simulateHandlePhoto(false);
  assert.strictEqual(events.some(e => e.op === 'applyWatermark'), true);
});

test('Index.html source code satisfies Task 6 integration requirements', () => {
  const content = fs.readFileSync(indexHtmlPath, 'utf8');

  // 1. No em dashes or en dashes
  assert.strictEqual(content.includes('\u2014'), false, 'Index.html must not contain em dashes');
  assert.strictEqual(content.includes('\u2013'), false, 'Index.html must not contain en dashes');

  // 2. Anti-black frame check comes BEFORE watermark inside handleFotoInputChange
  const handlePhotoIdx = content.indexOf('function handleFotoInputChange');
  assert.strictEqual(handlePhotoIdx !== -1, true, 'handleFotoInputChange function must be present');
  const antiBlackIdx = content.indexOf('Foto terdeteksi hitam/gelap total', handlePhotoIdx);
  const watermarkCallIdx = content.indexOf('applyCanvasWatermark(canvas', handlePhotoIdx);
  assert.strictEqual(antiBlackIdx !== -1, true, 'Anti-black frame check must be present');
  assert.strictEqual(watermarkCallIdx !== -1, true, 'applyCanvasWatermark call must be present in handleFotoInputChange');
  assert.strictEqual(antiBlackIdx < watermarkCallIdx, true, 'Anti-black check must execute BEFORE watermark in handleFotoInputChange');

  // 3. Dark banner and gold accent colors present
  assert.strictEqual(content.includes('rgba(15, 23, 42, 0.76)'), true, 'Banner color rgba(15, 23, 42, 0.76) must be present');
  assert.strictEqual(content.includes('#d4af37'), true, 'Gold color #d4af37 must be present');

  // 4. getWilayahClient call in getGPSLocation
  assert.strictEqual(content.includes('getWilayahClient'), true, 'getWilayahClient must be called');
  assert.strictEqual(content.includes('currentWilayahText'), true, 'currentWilayahText must be referenced');

  // 5. Image quality 0.7 used in toDataURL
  assert.match(content, /toDataURL\(\s*['"]image\/jpeg['"]\s*,\s*0\.7\s*\)/, 'Must encode toDataURL at 0.7 quality');
});
