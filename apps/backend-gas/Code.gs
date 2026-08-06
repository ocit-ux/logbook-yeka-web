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
const DRIVE_FOLDER_ID = '1U1boL1KZkfeinLdvNXPvWbRXI0MVG0dS';
const SPREADSHEET_ID = '1_ndmQgr6msg_D-Ne1wd2J3nMa7F1WCdSGBf4we58zVY';

const SHEET_USERS = 'Users';
const SHEET_ABSENSI = 'Absensi';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

const USERS_HEADERS = ['Nama', 'Email', 'Telepon', 'Divisi', 'Jabatan', 'Username', 'Password', 'Role', 'SessionId'];
const ABSENSI_HEADERS = ['Timestamp', 'Nama', 'Email', 'Telepon', 'Jabatan', 'Divisi', 'Status', 'JamMulai', 'JamAkhir', 'Kegiatan', 'HasilKegiatan', 'IzinSakit', 'GPS', 'FotoURL', 'Device', 'Tanggal', 'Bulan', 'Tahun'];

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
  // Tangani request JSON dari React Native (Axios)
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
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
      case 'getPilihanIzin':
        result = { data: getPilihanIzin() };
        break;
      case 'resetPin':
        result = doResetPin(postData.username);
        break;
      case 'checkSessionValid':
        result = { valid: checkSessionValid(postData.rowIndex, postData.sessionId) };
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
  const rows = data.slice(1).filter(row => row.some(cell => cell !== '' && cell !== null));
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date || (val && typeof val.getTime === 'function') || Object.prototype.toString.call(val) === '[object Date]') {
        try {
          if (String(h).toLowerCase().includes('jam')) {
            val = Utilities.formatDate(val, Session.getScriptTimeZone() || 'GMT+7', 'HH:mm:ss');
          } else {
            val = Utilities.formatDate(val, Session.getScriptTimeZone() || 'GMT+7', 'dd-MM-yyyy HH:mm:ss');
          }
        } catch (e) {
          val = String(val);
        }
      }
      obj[h] = val;
    });
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

    sheet.appendRow([nama, email, telepon || '-', devisi, jabatan, username, password, 'pegawai', '']);
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
          rowIndex: i + 1, sessionId: sessionId
        };
      }
    }
    throw new Error('Kombinasi Username/Password salah!');
  } finally {
    lock.releaseLock();
  }
}

// Dipanggil client secara berkala buat cek sesi ganda (pengganti onSnapshot Firestore)
function checkSessionValid(rowIndex, sessionId) {
  if (rowIndex < 0) return true; // admin, tidak pakai sesi
  const sheet = getSheet_(SHEET_USERS);
  if (rowIndex > sheet.getLastRow()) return false; // baris sudah tidak ada
  const sesiCol = headerIndex_(sheet, 'SessionId');
  const dbSessionId = sheet.getRange(rowIndex, sesiCol).getValue();
  return dbSessionId === sessionId;
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

  return 'https://drive.google.com/uc?id=' + file.getId();
}

// ==== SUBMIT ABSENSI ====
function submitAttendance(data) {
  if (!data || !data.nama || !data.email) throw new Error('Data absensi tidak lengkap (nama/email kosong).');

  const sheet = getSheet_(SHEET_ABSENSI);
  const tgl = new Date();
  
  // VALIDASI DUPLIKAT FOTO
  if (data.foto && data.foto.length > 100) {
    const base64Tail = data.foto.substring(data.foto.length - 200); 
    const cache = CacheService.getScriptCache();
    const isDuplicate = cache.get(base64Tail);
    
    if (isDuplicate) {
       throw new Error('upload foto sesuai aktifitas anda hari ini');
    }
    cache.put(base64Tail, 'true', 86400);
  }

  const namaFile = String(data.nama || 'user').replace(/\s+/g, '_') + '_' + tgl.getTime();
  const fotoURL = simpanFotoKeDrive_(data.foto, namaFile);

  const rowBaru = [
    tgl, data.nama, data.email, data.telepon || '-', data.jabatan, data.devisi,
    data.status, data.jamMulai || '-', data.jamAkhir || '-', data.kegiatan || '-',
    data.hasil_kegiatan || '-', data.izin_sakit || '-', data.gps || '-',
    fotoURL, data.device || '-', tgl.getDate(),
    Utilities.formatDate(tgl, Session.getScriptTimeZone() || 'GMT+7', 'MMMM'), tgl.getFullYear()
  ];
  Logger.log('submitAttendance -> menulis ke sheet ' + sheet.getName() + ' di spreadsheet ' + SPREADSHEET_ID + ': ' + JSON.stringify(rowBaru));
  sheet.appendRow(rowBaru);
  SpreadsheetApp.flush();
  Logger.log('submitAttendance -> sukses, lastRow sekarang = ' + sheet.getLastRow());
  return { success: true, fotoURL: fotoURL };
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

    // Simpan PIN baru ke sheet
    const passCol = headers.indexOf('Password') + 1;
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
    if (triggers[i].getHandlerFunction() === 'sendDailyReminder') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('sendDailyReminder')
    .timeBased()
    .atHour(16)
    .everyDays(1)
    .create();
}

function sendDailyReminder() {
  const sheetUsers = getSheet_(SHEET_USERS);
  const users = sheetToObjects_(sheetUsers).filter(u => u.Role !== 'admin');
  
  const sheetAbsensi = getSheet_(SHEET_ABSENSI);
  const absensiAll = sheetToObjects_(sheetAbsensi);
  
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd-MM-yyyy');
  
  users.forEach(user => {
    if (!user.Email) return;
    
    // Cek apakah user ini sudah absen hari ini
    const sudahAbsen = absensiAll.some(a => {
      let tglAbsen = '';
      if (a.Timestamp) {
        // a.Timestamp sudah berbentuk string "dd-MM-yyyy HH:mm:ss" dari sheetToObjects_
        tglAbsen = String(a.Timestamp).substring(0, 10);
      }
      return String(a.Email).trim().toLowerCase() === String(user.Email).trim().toLowerCase() && tglAbsen === todayStr;
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
