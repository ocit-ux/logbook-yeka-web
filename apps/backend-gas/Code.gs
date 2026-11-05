/**
 * KODE SERVER - Sistem Absensi & Jurnal Kegiatan
 * Elang Katulistiwa Adipavitra
 * Backend: Google Apps Script + Google Sheets + Google Drive
 *
 * PERBAIKAN vs versi awal:
 * - LockService dipasang di doRegister & doLogin -> cegah race condition
 *   (dua orang daftar/login barengan, dua tulis ke SessionId barengan).
 * - Validasi input server-side (nama/email/username/password wajib,
 *   username tidak boleh sama dengan "admin", email duplikat ditolak).
 * - headerIndex_() dipakai supaya kalau kolom SessionId/dst tidak ketemu,
 *   error jelas -- bukan nulis ke kolom 0 / crash diam-diam.
 * - getSheet_() memasang ulang header kalau sheet ada tapi kosong total.
 * - sheetToObjects_() membuang baris yang 100% kosong (baris sampah).
 * - checkSessionValid/doLogoutUser dijaga dari rowIndex di luar jangkauan.
 * - getRiwayatUser pakai perbandingan email case-insensitive.
 */

// ==== KONFIGURASI ====
const DRIVE_FOLDER_ID = '151sdXGAKkiG-2vwZNuLjycDJUX-Xwpf3';
const DRIVE_FOLDER_PROFIL_ID = '1ePLRV24KwGL8bK0pSfVwhdxoMM9NlJPh';
const DRIVE_FOLDER_RKB_ID = '14C_sXl9X0L3RAPCFFRKWmWf_qrwoDf2i';
const SPREADSHEET_ID = '1GqZcbopZQchw0EpO-nN5OL6hwXvznw-Irj8QxzQmQQM';

const SHEET_USERS = 'Users';
const SHEET_ABSENSI = 'Absensi';

const ADMIN_USERNAME = 'admin.yeka@mail.or.id';
const ADMIN_PASSWORD = '@AdminYeka2026#';

const USERS_HEADERS = ['Nama', 'Email', 'Telepon', 'Divisi', 'Jabatan', 'Username', 'Password', 'Role', 'SessionId', 'FotoProfil', 'ExpoPushToken'];
const ABSENSI_HEADERS = ['Timestamp', 'Nama', 'Email', 'Telepon', 'Jabatan', 'Divisi', 'Status', 'JamMulai', 'JamAkhir', 'Kegiatan', 'HasilKegiatan', 'IzinSakit', 'GPS', 'FotoURL', 'Device', 'Tanggal', 'Bulan', 'Tahun', 'StatusKeamanan', 'SubmissionId', 'Desa', 'Kecamatan', 'Kabupaten'];

// ==== DIAGNOSTIK ====
// Jalankan manual dari editor (pilih fungsi ini di dropdown -> Run), lihat di
// View > Executions atau View > Logs. Cara paling cepat cek apakah data
// SUNGGUH masuk ke SPREADSHEET_ID yang benar, dan apakah header cocok.
function testKoneksi() {
  Logger.log('SPREADSHEET_ID yang dipakai: ' + SPREADSHEET_ID);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Nama spreadsheet ketemu: ' + ss.getName());
  Logger.log('URL spreadsheet: ' + ss.getUrl());

  const sheetUsers = getSheet_(SHEET_USERS);
  const sheetAbsensi = getSheet_(SHEET_ABSENSI);
  Logger.log('Sheet Users -> lastRow=' + sheetUsers.getLastRow() + ' lastCol=' + sheetUsers.getLastColumn());
  Logger.log('Sheet Absensi -> lastRow=' + sheetAbsensi.getLastRow() + ' lastCol=' + sheetAbsensi.getLastColumn());

  const headerUsers = sheetUsers.getRange(1, 1, 1, sheetUsers.getLastColumn()).getValues()[0];
  const headerAbsensi = sheetAbsensi.getRange(1, 1, 1, sheetAbsensi.getLastColumn()).getValues()[0];
  Logger.log('Header Users di sheet   : ' + JSON.stringify(headerUsers));
  Logger.log('Header Users di kode    : ' + JSON.stringify(USERS_HEADERS));
  Logger.log('Header Absensi di sheet : ' + JSON.stringify(headerAbsensi));
  Logger.log('Header Absensi di kode  : ' + JSON.stringify(ABSENSI_HEADERS));

  const dataAbsensi = sheetToObjects_(sheetAbsensi);
  Logger.log('Jumlah baris Absensi terbaca: ' + dataAbsensi.length);
  Logger.log('Isi Absensi (terbaca lewat kode): ' + JSON.stringify(dataAbsensi));

  const kosongFoto = dataAbsensi.filter(r => !r.FotoURL).length;
  Logger.log('Baris dengan FotoURL kosong: ' + kosongFoto + ' dari ' + dataAbsensi.length);
}

// ==== ENTRY POINT WEB APP ====
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sistem Logbook - Yayasan Elang Katulistiwa Adipavitra')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  // Tangani request JSON dari React Native (Axios) atau Web
  let postData = {};
  if (e && e.postData && e.postData.contents) {
    try {
      postData = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: parseErr.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  const action = postData.action || (e && e.parameter && e.parameter.action);

  // Endpoint reverseGeocode tidak memerlukan lock sheet karena hanya mengakses cache atau Maps Geocoder
  if (action === 'reverseGeocode') {
    try {
      const gpsStr = postData.gps || (postData.data && postData.data.gps) || (e && e.parameter && e.parameter.gps) || '';
      const result = getWilayahCached_(gpsStr);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        data: result
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: error.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    let result = {};

    switch(action) {
      case 'login':
        result = doLogin(postData.username, postData.password);
        break;
      case 'register':
        result = doRegister(postData.data);
        break;
      case 'submitAttendance':
        result = submitAttendance(postData.data);
        break;
      case 'getRiwayatUser':
        result = { data: getRiwayatUser(postData.email) };
        break;
      case 'getAllAbsensi':
        result = { data: getAllAbsensi() };
        break;
      case 'getAllKaryawan':
        result = { data: getAllKaryawan() };
        break;
      case 'logoutUser':
        result = doLogoutUser(postData.rowIndex);
        break;
      case 'uploadProfilePhoto':
        result = uploadProfilePhoto(postData.rowIndex, postData.base64);
        break;
      case 'getPilihanIzin':
        result = { data: getPilihanIzin() };
        break;
      case 'resetPin':
      case 'forgotPassword': // alias dari LoginScreen
        result = doResetPin(postData.username);
        break;
      case 'checkSessionValid':
        result = { valid: checkSessionValid(postData.username, postData.sessionId) };
        break;
      case 'simpanPushToken':
        result = simpanPushToken(postData.rowIndex, postData.token, postData.email, postData.username);
        break;
      case 'updateProfile':
        result = updateProfile(postData.rowIndex, postData.data);
        break;
      case 'getUserProfile':
        result = getUserProfile(postData.rowIndex);
        break;
      case 'getRkbKaryawan':
        result = getRkbKaryawan(
          postData.targetNama || postData.nama,
          postData.targetDivisi || postData.divisi,
          postData.targetBulan || postData.bulan,
          postData.targetTahun || postData.tahun
        );
        break;
      case 'getAllRkbSummary':
        result = getAllRkbSummary(
          postData.targetBulan || postData.bulan,
          postData.targetTahun || postData.tahun
        );
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ==== HELPER SHEET ====
function getSheet_(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  const headers = name === SHEET_USERS ? USERS_HEADERS : ABSENSI_HEADERS;

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    // Sheet ada tapi benar-benar kosong (mis. pernah dihapus manual) -> pasang header lagi
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function headerIndex_(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const idx = headers.indexOf(headerName);
  if (idx === -1) throw new Error('Kolom "' + headerName + '" tidak ditemukan di sheet ' + sheet.getName() + '. Cek header baris 1.');
  return idx + 1; // 1-based utk getRange
}

function sheetToObjects_(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  const isJamCol = headers.map(h => h.toLowerCase().includes('jam'));
  const tz = Session.getScriptTimeZone() || 'GMT+7';
  const rows = data.slice(1).filter(row => row.some(cell => cell !== '' && cell !== null));
  return rows.map(row => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      let val = row[i];
      if (val instanceof Date || (val && typeof val.getTime === 'function') || Object.prototype.toString.call(val) === '[object Date]') {
        try {
          val = Utilities.formatDate(val, tz, isJamCol[i] ? 'HH:mm:ss' : 'dd-MM-yyyy HH:mm:ss');
        } catch (e) {
          val = String(val);
        }
      }
      obj[headers[i]] = val;
    }
    return obj;
  });
}

// ==== AUTH ====
function doRegister(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const nama = String((data && data.nama) || '').trim();
    const email = String((data && data.email) || '').trim();
    const telepon = String((data && data.telepon) || '').trim();
    const devisi = String((data && data.devisi) || '').trim();
    const jabatan = String((data && data.jabatan) || '').trim();
    const username = String((data && data.username) || '').trim().toLowerCase();
    const password = String((data && data.password) || '');

    if (!nama || !email || !username || !password) throw new Error('Semua field wajib diisi!');
    if (username === ADMIN_USERNAME) throw new Error('Username tidak boleh sama dengan akun admin!');

    const sheet = getSheet_(SHEET_USERS);
    const users = sheetToObjects_(sheet);

    const usernameTaken = users.some(u => String(u.Username).toLowerCase() === username);
    if (usernameTaken) throw new Error('Username sudah terpakai!');

    const emailTaken = users.some(u => String(u.Email).toLowerCase() === email.toLowerCase());
    if (emailTaken) throw new Error('Email sudah terdaftar, silahkan login.');

    // Pastikan 11 kolom lengkap sesuai USERS_HEADERS (Nama, Email, Telepon, Divisi, Jabatan, Username, Password, Role, SessionId, FotoProfil, ExpoPushToken)
    sheet.appendRow([nama, email, telepon ? "'" + telepon : '-', devisi, jabatan, username, password, 'pegawai', '', '', '']);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function doLogin(usernameEmail, password) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const input = String(usernameEmail || '').trim().toLowerCase();
    const pass = String(password || '');

    if (input === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
      return {
        nama: 'Super Admin', email: 'admin@company.com', devisi: 'HQ',
        jabatan: 'Director', telepon: '-', role: 'admin', username: 'admin', rowIndex: -1
      };
    }

    const sheet = getSheet_(SHEET_USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const sesiCol = headers.indexOf('SessionId') + 1;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      headers.forEach((h, idx) => obj[h] = row[idx]);
      if (!obj.Username && !obj.Email) continue;

      const matchUsername = String(obj.Username).toLowerCase() === input;
      const matchEmail = String(obj.Email).toLowerCase() === input;
      if ((matchUsername || matchEmail) && String(obj.Password) === pass) {
        const sessionId = 'sess_' + new Date().getTime() + '_' + Math.floor(Math.random() * 100000);
        if (sesiCol > 0) sheet.getRange(i + 1, sesiCol).setValue(sessionId);
        return {
          nama: obj.Nama, email: obj.Email, telepon: obj.Telepon || '-', devisi: obj.Divisi,
          jabatan: obj.Jabatan, role: obj.Role || 'pegawai', username: obj.Username,
          rowIndex: i + 1, sessionId: sessionId, izinPC: String(obj['Izin PC'] || obj.IzinPC || 'TIDAK').toUpperCase(),
          fotoProfil: obj.FotoProfil || ''
        };
      }
    }
    throw new Error('Kombinasi Username/Password salah!');
  } finally {
    lock.releaseLock();
  }
}

// Dipanggil client secara berkala buat cek sesi ganda (pengganti onSnapshot Firestore)
function checkSessionValid(userOrRow, sessionId) {
  if (!userOrRow) return true;
  if (userOrRow === ADMIN_USERNAME || userOrRow === -1 || userOrRow === '-1') return true;
  
  const sheet = getSheet_(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return false;
  
  const headers = data[0].map(h => String(h).trim());
  const userCol = headers.indexOf('Username');
  const sesiCol = headers.indexOf('SessionId');
  
  if (userCol < 0 || sesiCol < 0) return true; // Fail-safe

  const asRow = Number(userOrRow);
  if (Number.isInteger(asRow) && asRow >= 2 && asRow <= data.length) {
    return String(data[asRow - 1][sesiCol]) === String(sessionId);
  }
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userCol]).toLowerCase() === String(userOrRow).toLowerCase()) {
      return String(data[i][sesiCol]) === String(sessionId);
    }
  }
  return false;
}

function doLogoutUser(rowIndex) {
  if (rowIndex > 0) {
    const sheet = getSheet_(SHEET_USERS);
    if (rowIndex <= sheet.getLastRow()) {
      const sesiCol = headerIndex_(sheet, 'SessionId');
      sheet.getRange(rowIndex, sesiCol).setValue('');
    }
  }
  return { success: true };
}

function uploadProfilePhoto(rowIndex, base64) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet_(SHEET_USERS);
    let fotoCol;
    try {
      fotoCol = headerIndex_(sheet, 'FotoProfil');
    } catch(e) {
      fotoCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, fotoCol).setValue('FotoProfil');
    }
    const namaUser = sheet.getRange(rowIndex, headerIndex_(sheet, 'Nama')).getValue() || 'user';
    const namaFile = 'PROFIL_' + String(namaUser).replace(/\s+/g, '_') + '_' + new Date().getTime();
    
    const fotoURL = simpanFotoKeDriveProfil_(base64, namaFile);
    if(fotoURL) {
      sheet.getRange(rowIndex, fotoCol).setValue(fotoURL);
      SpreadsheetApp.flush();
    }
    return { success: true, fotoURL: fotoURL };
  } catch(e) {
    throw new Error('Gagal upload foto profil: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function updateProfile(rowIndex, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!rowIndex || rowIndex < 2) throw new Error('Akses ditolak.');
    if (!data.nama || !data.telepon || !data.jabatan || !data.devisi) {
      throw new Error('Data tidak lengkap.');
    }
    const sheet = getSheet_(SHEET_USERS);
    if (rowIndex > sheet.getLastRow()) throw new Error('Data user tidak ditemukan.');
    
    const namaCol = headerIndex_(sheet, 'Nama');
    const telpCol = headerIndex_(sheet, 'Telepon');
    const divCol = headerIndex_(sheet, 'Divisi');
    const jabCol = headerIndex_(sheet, 'Jabatan');

    sheet.getRange(rowIndex, namaCol).setValue(data.nama);
    sheet.getRange(rowIndex, telpCol).setValue("'" + data.telepon);
    sheet.getRange(rowIndex, divCol).setValue(data.devisi);
    sheet.getRange(rowIndex, jabCol).setValue(data.jabatan);

    SpreadsheetApp.flush();
    return { success: true };
  } catch(e) {
    throw new Error('Gagal update: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function getUserProfile(rowIndex) {
  if (!rowIndex || rowIndex < 2) throw new Error('Invalid row');
  const sheet = getSheet_(SHEET_USERS);
  const users = sheetToObjects_(sheet);
  const userData = users[rowIndex - 2];
  if (!userData) throw new Error('User tidak ditemukan');
  return { 
    nama: userData.Nama,
    email: userData.Email,
    telepon: userData.Telepon,
    devisi: userData.Divisi,
    jabatan: userData.Jabatan,
    username: userData.Username,
    role: userData.Role,
    fotoProfil: userData.FotoProfil,
    rowIndex: rowIndex
  };
}

// ==== FOTO KE DRIVE ====
// PENTING: file dulu dibuat, baru sharing di-set BELAKANGAN, dipisah try/catch-nya.
// Root cause "FotoURL kosong padahal file ADA di Drive": file.setSharing() bisa
// throw error (mis. kebijakan Workspace/org melarang "Anyone with link"), dan
// karena sebelumnya createFile + setSharing ada di SATU try/catch, error di
// setSharing bikin seluruh fungsi masuk catch -> return '' walau file sudah
// kepalang terbuat. Sekarang: kalau setSharing gagal, link tetap dikembalikan.
function simpanFotoKeDrive_(base64Data, namaFile) {
  if (!base64Data) return '';

  let file;
  try {
    const cleanBase64 = base64Data.indexOf(',') > -1 ? base64Data.split(',')[1] : base64Data;
    const bytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(bytes, 'image/jpeg', namaFile + '.jpg');
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    file = folder.createFile(blob);
  } catch (e) {
    Logger.log('Gagal BUAT file foto di Drive: ' + e.message);
    return ''; // memang gagal total, wajar kosong
  }

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // File SUDAH ada di Drive, cuma sharing-nya gagal (mis. dibatasi admin Workspace).
    // Jangan buang link-nya -- tetap kembalikan biar kolom FotoURL terisi.
  }

  return 'https://lh3.googleusercontent.com/d/' + file.getId();
}

function simpanFotoKeDriveProfil_(base64Data, namaFile) {
  if (!base64Data) return '';
  let file;
  try {
    const cleanBase64 = base64Data.indexOf(',') > -1 ? base64Data.split(',')[1] : base64Data;
    const bytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(bytes, 'image/jpeg', namaFile + '.jpg');
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_PROFIL_ID);
    file = folder.createFile(blob);
  } catch (e) {
    return '';
  }
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { }
  return 'https://lh3.googleusercontent.com/d/' + file.getId();
}


// Reverse geocode koordinat GPS menjadi Desa, Kecamatan, Kabupaten
function getWilayahDariGPS_(gpsStr) {
  const def = { desa: '-', kecamatan: '-', kabupaten: '-' };
  if (!gpsStr || gpsStr === '-') return def;
  try {
    const parts = String(gpsStr).split(',');
    if (parts.length < 2) return def;
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (isNaN(lat) || isNaN(lng)) return def;

    const res = Maps.newGeocoder().setLanguage('id').reverseGeocode(lat, lng);
    if (!res || !res.results || !res.results.length) return def;

    let desa = '-', kecamatan = '-', kabupaten = '-';
    for (let i = 0; i < res.results.length; i++) {
      const comps = res.results[i].address_components || [];
      for (let j = 0; j < comps.length; j++) {
        const c = comps[j];
        const t = c.types || [];
        if (desa === '-' && (t.indexOf('administrative_area_level_4') !== -1 || t.indexOf('sublocality_level_1') !== -1)) {
          desa = c.long_name;
        }
        if (kecamatan === '-' && (t.indexOf('administrative_area_level_3') !== -1 || t.indexOf('locality') !== -1)) {
          kecamatan = c.long_name;
        }
        if (kabupaten === '-' && t.indexOf('administrative_area_level_2') !== -1) {
          kabupaten = c.long_name;
        }
      }
      if (desa !== '-' && kecamatan !== '-' && kabupaten !== '-') break;
    }
    return { desa: desa, kecamatan: kecamatan, kabupaten: kabupaten };
  } catch (e) {
    Logger.log('getWilayahDariGPS_ error: ' + e.message);
    return def;
  }
}

// Mengambil wilayah dengan cache ScriptCache (TTL 6 jam / 21600 detik) berbasis grid ~110m (3 desimal)
function getWilayahCached_(gpsStr) {
  const def = { desa: '-', kecamatan: '-', kabupaten: '-' };
  if (!gpsStr || gpsStr === '-') return def;

  try {
    const parts = String(gpsStr).split(',');
    if (parts.length < 2) return def;
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (isNaN(lat) || isNaN(lng)) return def;

    const cacheKey = 'wil_v1_' + lat.toFixed(3) + '_' + lng.toFixed(3);
    const cache = CacheService.getScriptCache();
    if (cache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const res = getWilayahDariGPS_(gpsStr);
    if (cache && res && (res.desa !== '-' || res.kecamatan !== '-' || res.kabupaten !== '-')) {
      cache.put(cacheKey, JSON.stringify(res), 21600);
    }
    return res;
  } catch (e) {
    Logger.log('getWilayahCached_ error: ' + e.message);
    return getWilayahDariGPS_(gpsStr);
  }
}

// Dipanggil client Web App (google.script.run) untuk watermark foto
function getWilayahClient(gpsStr) {
  try {
    const wil = getWilayahCached_(gpsStr);
    if (!wil) return '';
    const parts = [wil.desa, wil.kecamatan, wil.kabupaten].filter(function(p) {
      return p && p !== '-';
    });
    return parts.length > 0 ? parts.join(', ') : '';
  } catch (e) {
    Logger.log('getWilayahClient error: ' + e.message);
    return '';
  }
}

// Jalankan manual dari editor Apps Script untuk mengisi Desa, Kecamatan, Kabupaten pada baris data lama
function isiWilayahDataLama() {
  const startTime = Date.now();
  const sheet = getSheet_(SHEET_ABSENSI);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('Tidak ada baris data untuk diproses.');
    return;
  }

  const extraCols = ['StatusKeamanan', 'SubmissionId', 'Desa', 'Kecamatan', 'Kabupaten'];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  extraCols.forEach(col => {
    if (headers.indexOf(col) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });

  const idxGps = headers.indexOf('GPS');
  const idxDesa = headers.indexOf('Desa');
  const idxKec = headers.indexOf('Kecamatan');
  const idxKab = headers.indexOf('Kabupaten');

  if (idxGps === -1 || idxDesa === -1 || idxKec === -1 || idxKab === -1) {
    throw new Error('Kolom GPS atau Desa/Kecamatan/Kabupaten tidak ditemukan.');
  }

  const numRows = lastRow - 1;
  const totalCols = headers.length;
  const dataRange = sheet.getRange(2, 1, numRows, totalCols);
  const values = dataRange.getValues();

  const coordCache = {};
  let updatedCount = 0;

  for (let i = 0; i < values.length; i++) {
    // Berhenti aman jika waktu jalan mendekati 4.5 menit (batas GAS 6 menit)
    if (Date.now() - startTime > 270000) {
      Logger.log('Batas waktu eksekusi mendekati penuh. Menyimpan progres sementara...');
      break;
    }

    const row = values[i];
    const existingDesa = String(row[idxDesa] || '').trim();
    const existingKec = String(row[idxKec] || '').trim();
    const existingKab = String(row[idxKab] || '').trim();

    if (existingDesa !== '' && existingDesa !== '-' && existingKec !== '' && existingKab !== '') {
      continue;
    }

    const gpsStr = String(row[idxGps] || '').trim();
    if (!gpsStr || gpsStr === '-') {
      row[idxDesa] = '-';
      row[idxKec] = '-';
      row[idxKab] = '-';
      continue;
    }

    const parts = gpsStr.split(',');
    const cacheKey = parts.length >= 2
      ? parseFloat(parts[0]).toFixed(4) + ',' + parseFloat(parts[1]).toFixed(4)
      : gpsStr;

    let wilayah = coordCache[cacheKey];
    if (!wilayah) {
      wilayah = getWilayahDariGPS_(gpsStr);
      coordCache[cacheKey] = wilayah;
      Utilities.sleep(150); // Jeda ringan agar aman dari kuota per detik Google Maps
    }

    row[idxDesa] = wilayah.desa;
    row[idxKec] = wilayah.kecamatan;
    row[idxKab] = wilayah.kabupaten;
    updatedCount++;
  }

  if (updatedCount > 0) {
    dataRange.setValues(values);
    SpreadsheetApp.flush();
  }
  Logger.log('isiWilayahDataLama selesai. Baris berhasil dilengkapi: ' + updatedCount);
}

// Fungsi utilitas sekali klik untuk merapikan nama perangkat "Aplikasi Expo" lama pada Google Sheet
function bersihkanNamaPerangkatLama() {
  const sheet = getSheet_(SHEET_ABSENSI);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length < 2) return;
  const headers = values[0];
  let idxDev = -1;
  headers.forEach((h, idx) => {
    if (String(h).trim().toLowerCase() === 'device') idxDev = idx;
  });
  if (idxDev === -1) return;
  let updatedCount = 0;
  for (let i = 1; i < values.length; i++) {
    const devStr = String(values[i][idxDev] || '');
    if (/expo/i.test(devStr)) {
      values[i][idxDev] = devStr
        .replace(/Aplikasi Expo \(Mobile\)/gi, 'Aplikasi Mobile YEKA')
        .replace(/Aplikasi Expo/gi, 'Aplikasi Mobile YEKA');
      updatedCount++;
    }
  }
  if (updatedCount > 0) {
    dataRange.setValues(values);
    SpreadsheetApp.flush();
  }
  Logger.log('bersihkanNamaPerangkatLama selesai. Diperbarui: ' + updatedCount + ' baris.');
}

// ==== SUBMIT ABSENSI ====
function submitAttendance(data) {
  if (!data || !data.nama || !data.email) throw new Error('Data absensi tidak lengkap (nama/email kosong).');

  const sheet = getSheet_(SHEET_ABSENSI);
  const tgl = new Date();

  // Validasi idempotensi: cegah duplikat sebelum upload foto atau insert baris
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const startRow = Math.max(2, lastRow - 50);
    const numRows = lastRow - startRow + 1;
    const lastCols = sheet.getLastColumn();
    const recentRows = sheet.getRange(startRow, 1, numRows, lastCols).getValues();

    const tglHariIni = tgl.getDate();
    const blnHariIni = Utilities.formatDate(tgl, Session.getScriptTimeZone() || 'GMT+7', 'MMMM');
    const thnHariIni = tgl.getFullYear();

    const isDuplicate = recentRows.some(r => {
      if (data.submissionId && r.some(cell => String(cell).trim() === String(data.submissionId).trim())) {
        return true;
      }
      const emailCocok = String(r[2] || '').trim().toLowerCase() === String(data.email || '').trim().toLowerCase();
      const jamCocok = String(r[7] || '').trim() === String(data.jamMulai || '').trim();
      const kegiatanCocok = String(r[9] || '').trim() === String(data.kegiatan || '').trim();
      const tglCocok = Number(r[15]) === tglHariIni && String(r[16] || '').trim() === blnHariIni && Number(r[17]) === thnHariIni;
      return emailCocok && jamCocok && kegiatanCocok && tglCocok;
    });

    if (isDuplicate) {
      Logger.log('submitAttendance -> Duplikat terdeteksi, abaikan insert: ' + (data.submissionId || data.kegiatan));
      return { success: true, duplicate: true };
    }
  }
  
  // VALIDASI FOTO BLANK HITAM / DUPLIKAT FOTO
  if (data.foto && data.foto.length > 100) {
    const cleanB64 = data.foto.indexOf(',') > -1 ? data.foto.split(',')[1] : data.foto;
    // Foto 1000px hitam pekat murni menghasilkan JPEG < 5.500 karakter base64 karena blok DCT bernilai nol seragam
    if (cleanB64.length < 5500) {
      throw new Error('Foto terdeteksi hitam/gelap total (kamera belum siap). Silakan ambil ulang foto kegiatan.');
    }
    const base64Tail = data.foto.substring(data.foto.length - 200); 
    const cache = CacheService.getScriptCache();
    const isDuplicate = cache.get(base64Tail);
    
    if (isDuplicate) {
       throw new Error('upload foto sesuai aktifitas anda hari ini');
    }
    cache.put(base64Tail, 'true', 86400);
  }

  const extraCols = ['StatusKeamanan', 'SubmissionId', 'Desa', 'Kecamatan', 'Kabupaten'];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  extraCols.forEach(col => {
    if (headers.indexOf(col) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });

  const namaFile = String(data.nama || 'user').replace(/\s+/g, '_') + '_' + tgl.getTime();
  const fotoURL = simpanFotoKeDrive_(data.foto, namaFile);

  const statusKeamanan = String(data.statusKeamanan || 'AMAN (GPS Asli)').trim();
  const wilayah = getWilayahCached_(data.gps);

  const rowBaru = [
    tgl, data.nama, data.email, data.telepon ? "'" + String(data.telepon).trim() : '-', data.jabatan, data.devisi,
    data.status, data.jamMulai || '-', data.jamAkhir || '-', data.kegiatan || '-',
    data.hasil_kegiatan || '-', data.izin_sakit || '-', data.gps || '-',
    fotoURL, data.device || '-', tgl.getDate(),
    Utilities.formatDate(tgl, Session.getScriptTimeZone() || 'GMT+7', 'MMMM'), tgl.getFullYear(),
    statusKeamanan,
    String(data.submissionId || '').trim(),
    wilayah.desa,
    wilayah.kecamatan,
    wilayah.kabupaten
  ];

  Logger.log('submitAttendance -> menulis ke sheet ' + sheet.getName() + ' di spreadsheet ' + SPREADSHEET_ID + ': ' + JSON.stringify(rowBaru));
  sheet.appendRow(rowBaru);
  SpreadsheetApp.flush();
  Logger.log('submitAttendance -> sukses, lastRow sekarang = ' + sheet.getLastRow());
  return { success: true, fotoURL: fotoURL, statusKeamanan: statusKeamanan };
}

// ==== AMBIL DATA ====
function getRiwayatUser(email) {
  try {
    const sheet = getSheet_(SHEET_ABSENSI);
    const all = sheetToObjects_(sheet);
    const emailLower = String(email || '').trim().toLowerCase();
    
    return all.filter(r => {
      let emailVal = '';
      for (const key in r) {
        if (key.toLowerCase().includes('email')) {
          emailVal = r[key];
          break;
        }
      }
      return String(emailVal || '').trim().toLowerCase() === emailLower;
    }).reverse();
  } catch (e) {
    Logger.log('getRiwayatUser error: ' + e.message);
    throw new Error('getRiwayatUser gagal: ' + e.message);
  }
}

function getAllAbsensi() {
  try {
    const sheet = getSheet_(SHEET_ABSENSI);
    return sheetToObjects_(sheet).reverse();
  } catch (e) {
    Logger.log('getAllAbsensi error: ' + e.message);
    throw new Error('getAllAbsensi gagal: ' + e.message);
  }
}

function getAllKaryawan() {
  try {
    const sheet = getSheet_(SHEET_USERS);
    return sheetToObjects_(sheet).filter(u => u.Role !== 'admin');
  } catch (e) {
    Logger.log('getAllKaryawan error: ' + e.message);
    throw new Error('getAllKaryawan gagal: ' + e.message);
  }
}

function getPilihanIzin() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const namaSheet = 'KategoriIzin';
    let sheet = ss.getSheetByName(namaSheet);
    if (!sheet) {
      sheet = ss.insertSheet(namaSheet);
      sheet.appendRow(['Pilihan Izin / Sakit']);
      sheet.appendRow(['Sakit']);
      sheet.appendRow(['Izin Keperluan Keluarga']);
      sheet.appendRow(['Dinas Luar']);
      sheet.appendRow(['Cuti Tahunan']);
      sheet.setFrozenRows(1);
    }
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    return data.slice(1).map(row => String(row[0]).trim()).filter(val => val !== '');
  } catch (e) {
    Logger.log('getPilihanIzin error: ' + e.message);
    return ['Sakit', 'Izin', 'Lainnya'];
  }
}
// RKB & KPI Service Integration

/**
 * Mengambil data RKB dan metrik KPI karyawan dari Google Drive folder.
 *
 * @param {string} targetNama Nama karyawan yang dicari
 * @param {string} targetDivisi Divisi karyawan
 * @param {string|number} targetBulan Bulan (1-12 atau nama bulan)
 * @param {string|number} targetTahun Tahun kegiatan
 * @returns {Object} Data RKB lengkap termasuk totalKpi, predikat, statusKegiatan, trenKpi, dan activities
 */
function getRkbKaryawan(targetNama, targetDivisi, targetBulan, targetTahun) {
  const defaultYear = targetTahun || new Date().getFullYear();
  const emptyTrend = typeof parseYearlyKpiTrend === 'function' ? parseYearlyKpiTrend([]) : [];

  const emptyResponse = {
    success: true,
    found: false,
    message: 'File RKB tidak ditemukan untuk ' + (targetNama || '-'),
    nama: targetNama || '',
    divisi: targetDivisi || '',
    bulan: targetBulan || '',
    tahun: defaultYear,
    totalKpi: 0,
    predikat: 'Sangat Kurang',
    statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 },
    trenKpi: emptyTrend,
    activities: []
  };

  if (!targetNama) return emptyResponse;

  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_RKB_ID);
    const filesIter = folder.getFiles();
    const filesList = [];
    while (filesIter.hasNext()) {
      filesList.push(filesIter.next());
    }

    const matcher = typeof matchEmployeeRkbFile === 'function' ? matchEmployeeRkbFile : null;
    const matchedFile = matcher ? matcher(filesList, targetNama, targetDivisi) : null;
    if (!matchedFile) {
      return emptyResponse;
    }

    const fileId = typeof matchedFile.getId === 'function' ? matchedFile.getId() : (matchedFile.id || '');
    const fileName = typeof matchedFile.getName === 'function' ? matchedFile.getName() : (matchedFile.name || '');

    let ss = null;
    try {
      ss = SpreadsheetApp.openById(fileId);
    } catch (openErr) {
      Logger.log('Tidak dapat membuka spreadsheet langsung: ' + openErr.message);
    }

    if (!ss) {
      return {
        success: true,
        found: true,
        fileId: fileId,
        fileName: fileName,
        nama: targetNama,
        divisi: targetDivisi || '',
        bulan: targetBulan || '',
        tahun: defaultYear,
        totalKpi: 0,
        predikat: 'Sangat Kurang',
        statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 },
        trenKpi: emptyTrend,
        activities: [],
        message: 'File RKB ditemukan namun tidak dapat dibaca sebagai spreadsheet'
      };
    }

    const sheets = ss.getSheets();
    if (!sheets || sheets.length === 0) {
      return {
        success: true,
        found: true,
        fileId: fileId,
        fileName: fileName,
        nama: targetNama,
        divisi: targetDivisi || '',
        bulan: targetBulan || '',
        tahun: defaultYear,
        totalKpi: 0,
        predikat: 'Sangat Kurang',
        statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 },
        trenKpi: emptyTrend,
        activities: [],
        message: 'Spreadsheet tidak memiliki lembar kerja'
      };
    }

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    let targetBulanName = '';
    let targetBulanShort = '';
    if (typeof targetBulan === 'number' || (!isNaN(Number(targetBulan)) && Number(targetBulan) >= 1 && Number(targetBulan) <= 12)) {
      const idx = Number(targetBulan) - 1;
      targetBulanName = monthNames[idx];
      targetBulanShort = monthShorts[idx];
    } else if (typeof targetBulan === 'string' && targetBulan.trim() !== '') {
      const tbClean = targetBulan.trim().toLowerCase();
      for (let m = 0; m < 12; m++) {
        if (monthNames[m].toLowerCase() === tbClean || monthShorts[m].toLowerCase() === tbClean || tbClean.indexOf(monthNames[m].toLowerCase()) !== -1) {
          targetBulanName = monthNames[m];
          targetBulanShort = monthShorts[m];
          break;
        }
      }
      if (!targetBulanName) {
        targetBulanName = targetBulan.trim();
        targetBulanShort = targetBulan.trim().substring(0, 3);
      }
    }

    let activeSheet = null;
    const monthlyScores = {};

    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      const sheetName = sheet.getName().trim();
      const sNameLower = sheetName.toLowerCase();

      for (let m = 0; m < 12; m++) {
        const fullM = monthNames[m].toLowerCase();
        const shortM = monthShorts[m].toLowerCase();
        if (sNameLower === fullM || sNameLower === shortM || sNameLower.indexOf(fullM) !== -1 || sNameLower.indexOf(shortM) !== -1) {
          try {
            const mRows = sheet.getDataRange().getValues();
            const mRekap = typeof extractRkbRekapKpi === 'function' ? extractRkbRekapKpi(mRows) : null;
            const mActivities = typeof parseRkbSheetRows === 'function' ? parseRkbSheetRows(mRows) : [];
            const mMetrics = typeof calculateRkbMetrics === 'function' ? calculateRkbMetrics(mActivities, mRekap) : { totalKpi: 0 };
            monthlyScores[monthShorts[m]] = mMetrics.totalKpi;
          } catch (e) {
            // Abaikan kesalahan parsial per sheet bulanan
          }
          break;
        }
      }

      if (!activeSheet && targetBulanName) {
        if (sNameLower === targetBulanName.toLowerCase() || sNameLower === targetBulanShort.toLowerCase() ||
            sNameLower.indexOf(targetBulanName.toLowerCase()) !== -1 || sNameLower.indexOf(targetBulanShort.toLowerCase()) !== -1) {
          activeSheet = sheet;
        }
      }
    }

    if (!activeSheet) {
      activeSheet = sheets[0];
    }

    const activeRows = activeSheet.getDataRange().getValues();
    const activeRekap = typeof extractRkbRekapKpi === 'function' ? extractRkbRekapKpi(activeRows) : null;
    const activities = typeof parseRkbSheetRows === 'function' ? parseRkbSheetRows(activeRows) : [];
    const metrics = typeof calculateRkbMetrics === 'function' ? calculateRkbMetrics(activities, activeRekap) : {
      totalKpi: (activeRekap && activeRekap.totalKpi) || 0,
      predikat: (activeRekap && activeRekap.predikat) || 'Sangat Kurang',
      statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: activities.length }
    };
    const yearlyTrend = typeof parseYearlyKpiTrend === 'function' ? parseYearlyKpiTrend(monthlyScores) : [];

    return {
      success: true,
      found: true,
      fileId: fileId,
      fileName: fileName,
      sheetName: activeSheet.getName(),
      nama: targetNama,
      divisi: targetDivisi || '',
      bulan: targetBulan || activeSheet.getName(),
      tahun: defaultYear,
      totalKpi: metrics.totalKpi,
      predikat: metrics.predikat,
      statusKegiatan: metrics.statusKegiatan,
      trenKpi: yearlyTrend,
      activities: activities
    };

  } catch (err) {
    Logger.log('Error getRkbKaryawan: ' + err.message);
    return {
      ...emptyResponse,
      message: 'Gagal memuat RKB: ' + err.message
    };
  }
}

/**
 * Mengambil ringkasan RKB untuk seluruh karyawan terdaftar.
 *
 * @param {string|number} targetBulan Bulan yang diminta
 * @param {string|number} targetTahun Tahun yang diminta
 * @returns {Array<Object>} List ringkasan RKB per karyawan
 */
function getAllRkbSummary(targetBulan, targetTahun) {
  try {
    const users = getAllKaryawan();
    if (!users || !Array.isArray(users) || users.length === 0) {
      return [];
    }

    let filesList = [];
    try {
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_RKB_ID);
      const filesIter = folder.getFiles();
      while (filesIter.hasNext()) {
        filesList.push(filesIter.next());
      }
    } catch (driveErr) {
      Logger.log('Gagal mengakses folder RKB: ' + driveErr.message);
    }

    const summaryList = [];
    const matcher = typeof matchEmployeeRkbFile === 'function' ? matchEmployeeRkbFile : null;

    for (let u = 0; u < users.length; u++) {
      const user = users[u];
      const nama = user.Nama || user.nama || '';
      const divisi = user.Divisi || user.divisi || '';
      const role = String(user.Role || user.role || '').toLowerCase();

      if (!nama || role === 'admin') continue;

      const matchedFile = matcher ? matcher(filesList, nama, divisi) : null;
      if (!matchedFile) {
        summaryList.push({
          nama: nama,
          divisi: divisi,
          hasFile: false,
          fileName: null,
          totalKpi: 0,
          predikat: 'Sangat Kurang',
          statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 }
        });
        continue;
      }

      const fileName = typeof matchedFile.getName === 'function' ? matchedFile.getName() : (matchedFile.name || '');

      try {
        const detail = getRkbKaryawan(nama, divisi, targetBulan, targetTahun);
        summaryList.push({
          nama: nama,
          divisi: divisi,
          hasFile: true,
          fileName: fileName,
          totalKpi: detail.totalKpi,
          predikat: detail.predikat,
          statusKegiatan: detail.statusKegiatan
        });
      } catch (itemErr) {
        summaryList.push({
          nama: nama,
          divisi: divisi,
          hasFile: true,
          fileName: fileName,
          totalKpi: 0,
          predikat: 'Sangat Kurang',
          statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 }
        });
      }
    }

    return summaryList;
  } catch (err) {
    Logger.log('Error getAllRkbSummary: ' + err.message);
    return [];
  }
}

// ==== RESET PIN ====
function doResetPin(username) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const input = String(username || '').trim().toLowerCase();
    if (!input) throw new Error('Username wajib diisi!');
    if (input === ADMIN_USERNAME) throw new Error('Akun admin tidak dapat direset dari sini.');

    const sheet = getSheet_(SHEET_USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    let userRow = -1;
    let userEmail = '';
    let userName = '';

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      headers.forEach((h, idx) => obj[h] = row[idx]);
      if (!obj.Username) continue;
      if (String(obj.Username).toLowerCase() === input) {
        userRow = i + 1;
        userEmail = String(obj.Email || '').trim();
        userName = String(obj.Nama || 'Pengguna');
        break;
      }
    }

    if (userRow < 0) throw new Error('Username tidak ditemukan. Periksa kembali.');
    if (!userEmail) throw new Error('Email tidak terdaftar pada akun ini, hubungi admin.');

    // Generate PIN baru 6 digit
    const newPin = String(Math.floor(100000 + Math.random() * 900000));

    // Simpan PIN baru ke sheet (pencarian case-insensitive)
    let passCol = -1;
    headers.forEach((h, idx) => {
      if (String(h).trim().toLowerCase() === 'password') {
        passCol = idx + 1;
      }
    });
    if (passCol < 1) throw new Error('Kolom Password tidak ditemukan di sheet.');
    sheet.getRange(userRow, passCol).setValue(newPin);
    SpreadsheetApp.flush();

    // Kirim email
    MailApp.sendEmail({
      to: userEmail,
      subject: 'Reset PIN - Sistem Logbook Yayasan Elang Katulistiwa Adipavitra',
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #1b4d3e; padding: 24px; text-align: center;">
            <h1 style="color: #d4af37; margin: 0; font-size: 20px;">Sistem Absensi</h1>
            <p style="color: #fff; margin: 4px 0 0; font-size: 13px;">Elang Katulistiwa Adipavitra</p>
          </div>
          <div style="padding: 24px;">
            <p style="color: #374151;">Halo, <strong>${userName}</strong></p>
            <p style="color: #374151;">Permintaan reset PIN Anda telah diterima. Berikut PIN baru Anda:</p>
            <div style="background: #f0f7f4; border: 2px dashed #1b4d3e; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">PIN Baru Anda</p>
              <p style="margin: 8px 0 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1b4d3e;">${newPin}</p>
            </div>
            <p style="color: #ef4444; font-size: 12px;">⚠️ Segera login dan ganti PIN ini setelah masuk ke aplikasi.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Jika Anda tidak melakukan permintaan ini, hubungi admin segera.</p>
          </div>
        </div>
      `
    });

    return { success: true, maskedEmail: userEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') };
  } finally {
    lock.releaseLock();
  }
}

// ==== FITUR PENGINGAT 16.00 WIB ====
function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    const handler = triggers[i].getHandlerFunction();
    if (handler === 'sendDailyReminder' || handler === 'kirimPushNotifikasiHarian' || handler === 'pengingatHarianOtomatis') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Daftarkan fungsi induk yang mengeksekusi push notification dan email
  ScriptApp.newTrigger('pengingatHarianOtomatis')
    .timeBased()
    .atHour(16)
    .everyDays(1)
    .create();
}

function pengingatHarianOtomatis() {
  try {
    kirimPushNotifikasiHarian();
  } catch (e) {
    Logger.log('Error kirimPushNotifikasiHarian: ' + e.message);
  }
  try {
    sendDailyReminder();
  } catch (e) {
    Logger.log('Error sendDailyReminder: ' + e.message);
  }
}

function sendDailyReminder() {
  const sheetUsers = getSheet_(SHEET_USERS);
  const users = sheetToObjects_(sheetUsers).filter(u => u.Role !== 'admin');
  
  const sheetAbsensi = getSheet_(SHEET_ABSENSI);
  const absensiAll = sheetToObjects_(sheetAbsensi);
  
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd-MM-yyyy');
  const todayDate = new Date().getDate();
  const todayMonthName = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'MMMM');
  const todayYear = new Date().getFullYear();
  
  users.forEach(user => {
    if (!user.Email) return;
    
    // Cek apakah user ini sudah absen hari ini (cek via Timestamp string atau kombinasi Tanggal-Bulan-Tahun)
    const sudahAbsen = absensiAll.some(a => {
      const emailCocok = String(a.Email || '').trim().toLowerCase() === String(user.Email).trim().toLowerCase();
      if (!emailCocok) return false;

      let tglAbsen = '';
      if (a.Timestamp) {
        tglAbsen = String(a.Timestamp).substring(0, 10);
      }
      const tglCocok = tglAbsen === todayStr || (String(a.Tanggal) === String(todayDate) && String(a.Bulan) === String(todayMonthName) && String(a.Tahun) === String(todayYear));
      return tglCocok;
    });
    
    if (!sudahAbsen) {
      try {
        MailApp.sendEmail({
          to: user.Email,
          subject: 'PENGINGAT: Anda Belum Melakukan Submit Logbook Hari Ini',
          body: 'Halo ' + user.Nama + ',\n\nKami mendeteksi bahwa Anda belum melakukan submit absensi dan jurnal kegiatan hari ini pada sistem Elang Katulistiwa Adipavitra.\n\nMohon segera melakukan pengisian melalui aplikasi sebelum jam kerja berakhir.\n\nTerima kasih.'
        });
      } catch (e) {
        Logger.log('Gagal kirim email ke ' + user.Email + ': ' + e.message);
      }
    }
  });
}

// ==== PUSH NOTIFICATION ====

function simpanPushToken(rowIndex, token, email, username) {
  if (!token) return { success: false, message: 'Token kosong' };
  try {
    const sheet = getSheet_(SHEET_USERS);
    const data = sheet.getDataRange().getValues();
    if (data.length < 1) return { success: false, message: 'Sheet Users kosong' };

    const headers = data[0].map(h => String(h).trim());
    
    // Cari kolom ExpoPushToken secara fleksibel (case-insensitive & abaikan spasi/simbol)
    let tokenCol = -1;
    for (let c = 0; c < headers.length; c++) {
      const cleanH = headers[c].toLowerCase().replace(/[\s_-]/g, '');
      if (cleanH === 'expopushtoken' || cleanH === 'pushtoken') {
        tokenCol = c + 1;
        break;
      }
    }

    if (tokenCol === -1) {
      // Jika belum ada kolom ExpoPushToken, tambahkan di kolom paling akhir
      tokenCol = headers.length + 1;
      sheet.getRange(1, tokenCol).setValue('ExpoPushToken');
    }

    // Tentukan baris target
    let targetRow = parseInt(rowIndex, 10);
    const lastRow = sheet.getLastRow();

    // Validasi apakah targetRow valid
    let rowValid = targetRow > 1 && targetRow <= lastRow;
    
    if (!rowValid && (email || username)) {
      // Cari baris berdasarkan Email atau Username
      const emailCol = headers.findIndex(h => h.toLowerCase() === 'email');
      const userCol = headers.findIndex(h => h.toLowerCase() === 'username');
      
      const targetEmail = String(email || '').trim().toLowerCase();
      const targetUser = String(username || '').trim().toLowerCase();

      for (let r = 1; r < data.length; r++) {
        const rowEmail = emailCol >= 0 ? String(data[r][emailCol] || '').trim().toLowerCase() : '';
        const rowUser = userCol >= 0 ? String(data[r][userCol] || '').trim().toLowerCase() : '';
        
        if ((targetEmail && rowEmail === targetEmail) || (targetUser && rowUser === targetUser)) {
          targetRow = r + 1;
          rowValid = true;
          break;
        }
      }
    }

    if (rowValid && targetRow > 1) {
      sheet.getRange(targetRow, tokenCol).setValue(String(token).trim());
      SpreadsheetApp.flush();
      return { success: true, row: targetRow, col: tokenCol };
    }

    return { success: false, message: 'Baris user tidak ditemukan' };
  } catch (e) {
    Logger.log('simpanPushToken error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// Jalankan otomatis via Time-based Trigger jam 16:00 setiap hari
function kirimPushNotifikasiHarian() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetUsers = ss.getSheetByName(SHEET_USERS);
  const sheetAbsensi = ss.getSheetByName(SHEET_ABSENSI);

  if (!sheetUsers || !sheetAbsensi) return;

  const users = sheetToObjects_(sheetUsers);
  const absensi = sheetToObjects_(sheetAbsensi);

  // Ambil daftar email yang sudah absen hari ini
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd-MM-yyyy');
  const todayDate = new Date().getDate();
  const todayMonthName = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'MMMM');
  const todayYear = new Date().getFullYear();

  const sudahAbsenHariIni = new Set(
    absensi
      .filter(row => {
        let tglAbsen = '';
        if (row.Timestamp) {
          tglAbsen = String(row.Timestamp).substring(0, 10);
        }
        return tglAbsen === todayStr || (String(row.Tanggal) === String(todayDate) && String(row.Bulan) === String(todayMonthName) && String(row.Tahun) === String(todayYear));
      })
      .map(row => String(row['Email'] || '').toLowerCase().trim())
  );

  // Filter karyawan yang belum absen dan punya token
  const targetUsers = users.filter(u => {
    const role = String(u['Role'] || '').toLowerCase().trim();
    const token = String(u['ExpoPushToken'] || '').trim();
    const email = String(u['Email'] || '').toLowerCase().trim();
    return role !== 'admin' && (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) && !sudahAbsenHariIni.has(email);
  });

  if (targetUsers.length === 0) {
    Logger.log('Semua karyawan sudah absen hari ini.');
    return;
  }

  // Kirim push notification via Expo Push API (batch, max 100 per request)
  const messages = targetUsers.map(u => ({
    to: String(u['ExpoPushToken']).trim(),
    title: '📋 Waktunya Kirim Logbook!',
    body: 'Halo ' + u['Nama'] + ', jangan lupa isi jurnal kegiatan hari ini ya.',
    data: { action: 'open_journal', type: 'server_daily_reminder' },
    sound: 'notif.wav',
    channelId: 'daily-reminder-v2', // Sesuai dengan channelId di mobile app
    priority: 'high'
  }));

  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    try {
      const response = UrlFetchApp.fetch('https://exp.host/--/api/v2/push/send', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(chunk),
        muteHttpExceptions: true
      });
      Logger.log('Expo Push response: ' + response.getContentText());
    } catch(e) {
      Logger.log('Gagal kirim push notification: ' + e.message);
    }
  }

  Logger.log('Push notification terkirim ke ' + targetUsers.length + ' karyawan.');
}

// Logika layanan dan perhitungan RKB dan KPI terintegrasi
/**
 * RKB (Rencana Kerja Bulanan) and KPI Service
 * Business logic for parsing employee RKB spreadsheets, calculating metrics,
 * evaluating predikat, and formatting performance trends.
 *
 * Compatible with Node.js and Google Apps Script runtime.
 */

/**
 * Evaluates predikat based on KPI score.
 * Thresholds:
 * - >= 90: Sangat Baik
 * - >= 80: Baik
 * - >= 70: Cukup
 * - >= 60: Kurang
 * - < 60: Sangat Kurang
 *
 * @param {number} score
 * @returns {string}
 */
function evaluatePredikat(score) {
  var num = Number(score);
  if (isNaN(num)) return 'Sangat Kurang';
  if (num >= 90) return 'Sangat Baik';
  if (num >= 80) return 'Baik';
  if (num >= 70) return 'Cukup';
  if (num >= 60) return 'Kurang';
  return 'Sangat Kurang';
}

/**
 * Calculates RKB metrics from a list of activities.
 *
 * @param {Array<Object>} activities
 * @returns {Object} { totalKpi, predikat, statusKegiatan: { selesai, proses, belum, total } }
 */
function calculateRkbMetrics(activities, precalculatedKpi) {
  var emptyResult = {
    totalKpi: 0,
    predikat: 'Sangat Kurang',
    statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 }
  };

  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    if (precalculatedKpi && precalculatedKpi.totalKpi !== undefined) {
      return {
        totalKpi: precalculatedKpi.totalKpi,
        predikat: precalculatedKpi.predikat || evaluatePredikat(precalculatedKpi.totalKpi),
        statusKegiatan: { selesai: 0, proses: 0, belum: 0, total: 0 }
      };
    }
    return emptyResult;
  }

  var selesaiCount = 0;
  var prosesCount = 0;
  var belumCount = 0;

  var totalWeight = 0;
  var weightedScoreSum = 0;
  var rawScoreSum = 0;

  for (var i = 0; i < activities.length; i++) {
    var item = activities[i];
    var statusRaw = String(item.status || '').trim().toLowerCase();

    var status = 'Belum';
    if (statusRaw === 'selesai' || statusRaw === 'terlaksana' || statusRaw === 'done' || statusRaw === '100%') {
      status = 'Selesai';
      selesaiCount++;
    } else if (statusRaw === 'proses' || statusRaw === 'progress' || statusRaw === 'sedang berjalan' || statusRaw === '50%') {
      status = 'Proses';
      prosesCount++;
    } else {
      status = 'Belum';
      belumCount++;
    }

    // Determine individual activity score
    var itemScore = 0;
    if (item.skor !== undefined && item.skor !== null && item.skor !== '' && !isNaN(Number(item.skor))) {
      itemScore = Number(item.skor);
    } else {
      if (status === 'Selesai') itemScore = 100;
      else if (status === 'Proses') itemScore = 50;
      else itemScore = 0;
    }
    rawScoreSum += itemScore;

    // Parse weight (bobot)
    var bobot = 0;
    if (typeof item.bobot === 'string' && item.bobot.indexOf('%') !== -1) {
      bobot = parseFloat(item.bobot) / 100;
    } else if (item.bobot !== undefined && item.bobot !== null) {
      bobot = parseFloat(item.bobot) || 0;
    }

    totalWeight += bobot;
    weightedScoreSum += bobot * itemScore;
  }

  var totalKpi = 0;
  if (precalculatedKpi && precalculatedKpi.totalKpi !== undefined && !isNaN(Number(precalculatedKpi.totalKpi))) {
    totalKpi = Number(precalculatedKpi.totalKpi);
  } else if (totalWeight > 0) {
    if (totalWeight > 1.5) {
      // Bobot was expressed in percentage points (e.g. sum is ~100)
      totalKpi = weightedScoreSum / 100;
    } else {
      // Bobot was expressed as decimal fractions (e.g. sum is ~1.0)
      totalKpi = weightedScoreSum;
    }
  } else if (activities.length > 0) {
    // Fallback to simple unweighted average
    totalKpi = rawScoreSum / activities.length;
  }

  // Round to two decimal places
  totalKpi = Math.round(totalKpi * 100) / 100;

  var finalPredikat = (precalculatedKpi && precalculatedKpi.predikat)
    ? precalculatedKpi.predikat
    : evaluatePredikat(totalKpi);

  return {
    totalKpi: totalKpi,
    predikat: finalPredikat,
    statusKegiatan: {
      selesai: selesaiCount,
      proses: prosesCount,
      belum: belumCount,
      total: activities.length
    }
  };
}

/**
 * Formats a 12-month KPI trend array (Jan s.d. Des).
 *
 * @param {Object|Array} monthlyScores
 * @returns {Array<Object>} 12 items with { bulan, month, namaBulan, score }
 */
function parseYearlyKpiTrend(monthlyScores) {
  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var FULL_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  var trend = [];

  for (var i = 0; i < 12; i++) {
    var shortLabel = MONTH_LABELS[i];
    var fullLabel = FULL_MONTHS[i];
    var monthNum = i + 1;
    var score = 0;

    if (monthlyScores) {
      if (Array.isArray(monthlyScores)) {
        if (i < monthlyScores.length) {
          var arrItem = monthlyScores[i];
          if (typeof arrItem === 'number') {
            score = arrItem;
          } else if (arrItem && typeof arrItem.score === 'number') {
            score = arrItem.score;
          }
        }
      } else if (typeof monthlyScores === 'object') {
        if (monthlyScores[shortLabel] !== undefined) {
          score = Number(monthlyScores[shortLabel]) || 0;
        } else if (monthlyScores[fullLabel] !== undefined) {
          score = Number(monthlyScores[fullLabel]) || 0;
        } else if (monthlyScores[String(monthNum)] !== undefined) {
          score = Number(monthlyScores[String(monthNum)]) || 0;
        } else if (monthlyScores[monthNum] !== undefined) {
          score = Number(monthlyScores[monthNum]) || 0;
        }
      }
    }

    trend.push({
      bulan: shortLabel,
      month: monthNum,
      namaBulan: fullLabel,
      score: Math.round(score * 100) / 100
    });
  }

  return trend;
}

/**
 * Matches an employee RKB file from Google Drive file list.
 *
 * @param {Array} files Array of file objects or filenames
 * @param {string} employeeName Employee name to match
 * @param {string} division Division name to match
 * @returns {Object|string|null}
 */
function matchEmployeeRkbFile(files, employeeName, division) {
  if (!files || !Array.isArray(files) || files.length === 0) return null;
  if (!employeeName) return null;

  function norm(str) {
    return String(str || '').toUpperCase()
      .replace(/DD/g, 'D')
      .replace(/LL/g, 'L')
      .replace(/MM/g, 'M')
      .replace(/SS/g, 'S');
  }

  var cleanEmp = String(employeeName || '').toUpperCase().trim();
  var empTokens = cleanEmp.split(/[^A-Z0-9]+/).filter(function(t) { return t.length >= 2; });
  var normEmpTokens = empTokens.map(norm);

  var cleanDiv = String(division || '').toUpperCase().trim();
  var divTokens = cleanDiv.split(/[^A-Z0-9]+/).filter(function(t) { return t.length >= 2; });

  var genericTokens = ['NUR', 'AHMAD', 'MUHAMMAD', 'ADI', 'AL'];

  var bestMatch = null;
  var bestScore = 0;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var name = '';

    if (typeof file === 'string') {
      name = file;
    } else if (file && typeof file.getName === 'function') {
      name = file.getName();
    } else if (file && file.name) {
      name = file.name;
    } else if (file && file.title) {
      name = file.title;
    }

    if (!name) continue;

    var upperName = name.toUpperCase();
    var fileTokens = upperName.split(/[^A-Z0-9]+/).filter(function(t) { return t.length >= 2; });
    var normFileTokens = fileTokens.map(norm);

    var matchScore = 0;
    var exactEmpTokenMatches = 0;
    var distinctiveMatch = false;

    for (var e = 0; e < empTokens.length; e++) {
      var token = empTokens[e];
      var nToken = normEmpTokens[e];

      var idx = fileTokens.indexOf(token);
      if (idx === -1) idx = normFileTokens.indexOf(nToken);

      if (idx !== -1) {
        exactEmpTokenMatches++;
        var isGeneric = genericTokens.indexOf(token) !== -1;
        if (!isGeneric) {
          distinctiveMatch = true;
          matchScore += 100 + (token.length * 5);
        } else {
          matchScore += 30;
        }
      }
    }

    if (exactEmpTokenMatches === 0) {
      continue;
    }

    if (!distinctiveMatch && exactEmpTokenMatches < 2 && empTokens.length > 1) {
      continue;
    }

    for (var d = 0; d < divTokens.length; d++) {
      if (fileTokens.indexOf(divTokens[d]) !== -1) {
        matchScore += 40;
      }
    }

    if (upperName.indexOf('RKB') === 0) {
      matchScore += 10;
    }

    if (fileTokens.indexOf('AINUR') !== -1 && empTokens.indexOf('AINUR') === -1) {
      matchScore -= 150;
    }
    if ((fileTokens.indexOf('SIROJUDIN') !== -1 || normFileTokens.indexOf('SIROJUDIN') !== -1) &&
        normEmpTokens.indexOf('SIROJUDIN') === -1) {
      matchScore -= 150;
    }
    if (fileTokens.indexOf('VYAS') !== -1 && empTokens.indexOf('VYAS') === -1) {
      matchScore -= 150;
    }
    if (fileTokens.indexOf('ADIYAKSA') !== -1 && empTokens.indexOf('ADIYAKSA') === -1) {
      matchScore -= 150;
    }

    if (matchScore > bestScore && matchScore >= 40) {
      bestScore = matchScore;
      bestMatch = file;
    }
  }

  return bestMatch;
}

function extractRkbRekapKpi(rows) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
  var totalKpi = null;
  var predikat = null;

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!Array.isArray(row)) continue;
    var firstCol = String(row[0] || '').trim().toUpperCase();

    if (firstCol.indexOf('TOTAL KPI') !== -1) {
      for (var c = row.length - 1; c >= 1; c--) {
        var val = String(row[c] || '').replace(/["%]/g, '').replace(',', '.').trim();
        var num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
          totalKpi = num;
          break;
        }
      }
    }

    if (firstCol.indexOf('PREDIKAT') !== -1) {
      for (var c = row.length - 1; c >= 1; c--) {
        var str = String(row[c] || '').replace(/"/g, '').trim();
        if (str && str.length >= 4 && isNaN(Number(str))) {
          predikat = str;
          break;
        }
      }
    }
  }

  if (totalKpi !== null) {
    return {
      totalKpi: totalKpi,
      predikat: predikat || evaluatePredikat(totalKpi)
    };
  }
  return null;
}

/**
 * Parses 2D array of rows from an RKB sheet.
 *
 * @param {Array<Array>} rows 2D array from sheet.getDataRange().getValues()
 * @param {Array<string>} [headers] Optional explicit headers
 * @returns {Array<Object>} List of activity items
 */
function parseRkbSheetRows(rows, headers) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];

  var headerRowIdx = -1;
  var resolvedHeaders = null;

  if (headers && Array.isArray(headers) && headers.length > 0) {
    resolvedHeaders = headers;
    headerRowIdx = -1;
  } else {
    // Scan up to first 30 rows to detect exact header row
    var maxScan = Math.min(rows.length, 30);
    for (var r = 0; r < maxScan; r++) {
      var candidate = rows[r];
      if (!Array.isArray(candidate)) continue;

      var lineTokens = candidate.map(function(c) { return String(c || '').toLowerCase().trim(); });
      var hasExactKode = lineTokens.some(function(c) { return c === 'kode' || c === 'no kode'; });
      var hasExactKegiatan = lineTokens.some(function(c) { return c === 'kegiatan'; });
      var hasExactBobot = lineTokens.some(function(c) { return c.indexOf('bobot') !== -1; });
      var hasExactStatus = lineTokens.some(function(c) { return c.indexOf('status') !== -1; });

      if (hasExactKode && hasExactKegiatan && (hasExactBobot || hasExactStatus)) {
        headerRowIdx = r;
        resolvedHeaders = candidate;
        break;
      }

      var lineText = lineTokens.join(' ');
      var hasKegiatan = lineText.indexOf('kegiatan') !== -1 || lineText.indexOf('rencana') !== -1 || lineText.indexOf('uraian') !== -1 || lineText.indexOf('program') !== -1;
      var hasOther = lineText.indexOf('bobot') !== -1 || lineText.indexOf('status') !== -1 || lineText.indexOf('kode') !== -1 || lineText.indexOf('skor') !== -1;

      if (hasKegiatan && hasOther && headerRowIdx === -1) {
        headerRowIdx = r;
        resolvedHeaders = candidate;
      }
    }
  }

  var dataRows = [];
  if (headerRowIdx !== -1) {
    dataRows = rows.slice(headerRowIdx + 1);
  } else if (resolvedHeaders) {
    dataRows = rows;
  } else {
    // Default fallback row 0 as headers
    resolvedHeaders = rows[0];
    dataRows = rows.slice(1);
  }

  // Identify column indices
  var kodeIdx = -1;
  var kegiatanIdx = -1;
  var outputIdx = -1;
  var bobotIdx = -1;
  var statusIdx = -1;
  var skorIdx = -1;

  for (var c = 0; c < resolvedHeaders.length; c++) {
    var h = String(resolvedHeaders[c] || '').trim().toLowerCase();
    if (kodeIdx === -1 && (h === 'kode' || h === 'no kode' || h === 'id' || h === 'kd')) {
      kodeIdx = c;
    } else if (kegiatanIdx === -1 && (h === 'kegiatan' || h.indexOf('kegiatan') !== -1 || h.indexOf('rencana') !== -1 || h.indexOf('uraian') !== -1 || h.indexOf('program') !== -1)) {
      kegiatanIdx = c;
    } else if (outputIdx === -1 && (h.indexOf('output') !== -1 || h.indexOf('indikator') !== -1 || h.indexOf('hasil') !== -1)) {
      outputIdx = c;
    } else if (bobotIdx === -1 && (h.indexOf('bobot') !== -1 || h.indexOf('weight') !== -1 || h === '%' || h.indexOf('persen') !== -1)) {
      bobotIdx = c;
    } else if (statusIdx === -1 && (h.indexOf('status') !== -1 || h.indexOf('kondisi') !== -1)) {
      statusIdx = c;
    } else if (skorIdx === -1 && (h.indexOf('skor') !== -1 || h.indexOf('score') !== -1 || h.indexOf('nilai') !== -1 || h.indexOf('capaian') !== -1)) {
      skorIdx = c;
    }
  }

  // Fallback default index positions if columns not explicitly matched
  if (kegiatanIdx === -1) kegiatanIdx = 2;
  if (bobotIdx === -1) bobotIdx = 3;
  if (statusIdx === -1) statusIdx = 4;
  if (skorIdx === -1) skorIdx = 5;

  var activities = [];

  for (var i = 0; i < dataRows.length; i++) {
    var row = dataRows[i];
    if (!Array.isArray(row)) continue;

    var kegiatan = String(row[kegiatanIdx] !== undefined ? row[kegiatanIdx] : '').trim();
    if (!kegiatan) continue;

    var rawKode = kodeIdx !== -1 && row[kodeIdx] ? String(row[kodeIdx]).trim() : '';
    // Skip section headers and summary rows
    if (/^(subtotal|total|a\.|b\.|c\.|d\.|e\.)/i.test(kegiatan)) continue;
    if (/^(subtotal|total|a\.|b\.|c\.|d\.|e\.)/i.test(rawKode)) continue;
    if (!rawKode && (row[bobotIdx] === undefined || row[bobotIdx] === '')) continue;

    var kode = rawKode || ('ACT-' + (activities.length + 1));
    var output = outputIdx !== -1 && row[outputIdx] ? String(row[outputIdx]).replace(/"/g, '').trim() : '';

    // Parse bobot
    var rawBobot = row[bobotIdx];
    var bobot = 0;
    if (typeof rawBobot === 'string' && rawBobot.indexOf('%') !== -1) {
      bobot = parseFloat(rawBobot.replace(/,/g, '.')) / 100;
    } else if (rawBobot !== undefined && rawBobot !== null && rawBobot !== '') {
      var parsedNum = parseFloat(String(rawBobot).replace(/,/g, '.'));
      bobot = isNaN(parsedNum) ? 0 : parsedNum;
    }

    // Normalize status
    var rawStatus = String(row[statusIdx] !== undefined ? row[statusIdx] : '').trim().toLowerCase();
    var status = 'Belum';
    if (rawStatus === 'selesai' || rawStatus === 'terlaksana' || rawStatus === 'done' || rawStatus === '100%') {
      status = 'Selesai';
    } else if (rawStatus === 'proses' || rawStatus === 'progress' || rawStatus === '50%') {
      status = 'Proses';
    } else {
      status = 'Belum';
    }

    // Parse skor
    var rawSkor = row[skorIdx];
    var skor = 0;
    if (rawSkor !== undefined && rawSkor !== null && rawSkor !== '' && !isNaN(Number(String(rawSkor).replace(/,/g, '.')))) {
      skor = Number(String(rawSkor).replace(/,/g, '.'));
    } else {
      skor = status === 'Selesai' ? 100 : (status === 'Proses' ? 50 : 0);
    }

    activities.push({
      kode: kode,
      kegiatan: kegiatan,
      output: output,
      bobot: bobot,
      status: status,
      skor: skor
    });
  }

  return activities;
}

// Module export for Node.js test environment while remaining global in GAS
