import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inferAlertType,
  subscribeAlert,
  unsubscribeAlert,
  getAlertSubscribersCount,
  showAlert,
  setFallbackAdapter
} from '../../apps/mobile/src/utils/alert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('inferAlertType correctly classifies error keywords case-insensitively', () => {
  assert.strictEqual(inferAlertType('Error Sistem', 'Terjadi masalah pada server'), 'error');
  assert.strictEqual(inferAlertType('GAGAL', 'Unggah data tidak berhasil'), 'error');
  assert.strictEqual(inferAlertType('Izin Ditolak', 'Akses lokasi kamera ditolak pengguna'), 'error');
  assert.strictEqual(inferAlertType('Batal', 'Proses dibatalkan oleh user'), 'error');
  assert.strictEqual(inferAlertType('Pemberitahuan', 'Koneksi gagal terhubung'), 'error');
});

test('inferAlertType correctly classifies success keywords case-insensitively', () => {
  assert.strictEqual(inferAlertType('Sukses', 'Data berhasil diperbarui'), 'success');
  assert.strictEqual(inferAlertType('BERHASIL', 'PIN baru telah terkirim'), 'success');
  assert.strictEqual(inferAlertType('Jurnal Tersimpan', 'Tersimpan dalam memori offline'), 'success');
  assert.strictEqual(inferAlertType('Masuk Antrean', 'Data masuk antrean sinkronisasi'), 'success');
  assert.strictEqual(inferAlertType('Status', 'Sedang dalam antri sinkron'), 'success');
});

test('inferAlertType correctly classifies warning keywords case-insensitively', () => {
  assert.strictEqual(inferAlertType('Inkomplit', 'Field kegiatan belum diisi'), 'warning');
  assert.strictEqual(inferAlertType('Wajib Foto', 'Foto selfie wajib dilampirkan'), 'warning');
  assert.strictEqual(inferAlertType('Tunggu', 'Sedang mengunci sinyal GPS'), 'warning');
  assert.strictEqual(inferAlertType('Perhatian', 'Jarak presensi di luar radius kantor'), 'warning');
  assert.strictEqual(inferAlertType('Peringatan', 'Deteksi perangkat tidak lazim'), 'warning');
  assert.strictEqual(inferAlertType('Integritas', 'Terdeteksi Fake GPS pada perangkat'), 'warning');
  assert.strictEqual(inferAlertType('Keamanan', 'Aplikasi mendeteksi binary root'), 'warning');
});

test('inferAlertType classifies confirm when buttons > 1 and no error/success/warning match', () => {
  const buttons = [
    { text: 'Batal', style: 'cancel' },
    { text: 'Lanjutkan', onPress: () => {} }
  ];
  // Note: if title/message contains 'Batal', it triggers error by keyword rule.
  // When title/message is neutral, buttons > 1 resolves to 'confirm'.
  assert.strictEqual(inferAlertType('Konfirmasi Pengajuan', 'Apakah Anda yakin ingin mengirim form ini?', buttons), 'confirm');
});

test('inferAlertType defaults to info when no keywords match and buttons <= 1', () => {
  assert.strictEqual(inferAlertType('Informasi Akun', 'Silakan periksa profil Anda'), 'info');
  assert.strictEqual(inferAlertType('Info', 'Aplikasi versi 1.0.0', [{ text: 'OK' }]), 'info');
  assert.strictEqual(inferAlertType('', ''), 'info');
});

test('subscribeAlert, unsubscribeAlert, and getAlertSubscribersCount manage listeners cleanly', () => {
  const initialCount = getAlertSubscribersCount();
  const listenerA = () => {};
  const listenerB = () => {};

  const unsubA = subscribeAlert(listenerA);
  assert.strictEqual(getAlertSubscribersCount(), initialCount + 1);

  subscribeAlert(listenerB);
  assert.strictEqual(getAlertSubscribersCount(), initialCount + 2);

  // Calling returned unsubscribe function
  unsubA();
  assert.strictEqual(getAlertSubscribersCount(), initialCount + 1);

  // Calling explicit unsubscribeAlert
  unsubscribeAlert(listenerB);
  assert.strictEqual(getAlertSubscribersCount(), initialCount);
});

test('showAlert dispatches payload to active subscribers with inferred or explicit type', () => {
  const received = [];
  const listener = (payload) => received.push(payload);
  const unsubscribe = subscribeAlert(listener);

  try {
    showAlert('Sukses', 'Jurnal tersimpan');
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].title, 'Sukses');
    assert.strictEqual(received[0].message, 'Jurnal tersimpan');
    assert.strictEqual(received[0].type, 'success');
    assert.strictEqual(typeof received[0].id, 'number');

    // Explicit type override in options
    showAlert('Informasi', 'Harap waspada', null, { type: 'warning' });
    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[1].type, 'warning');
  } finally {
    unsubscribe();
  }
});

test('showAlert falls back safely when zero subscribers are active', () => {
  assert.strictEqual(getAlertSubscribersCount(), 0);

  let nativeAlertCalled = false;
  let nativeAlertArgs = null;

  setFallbackAdapter({
    Alert: {
      alert: (title, message, buttons) => {
        nativeAlertCalled = true;
        nativeAlertArgs = { title, message, buttons };
      }
    },
    Platform: { OS: 'android' }
  });

  const buttons = [{ text: 'Mengerti' }];
  const payload = showAlert('Headless Notice', 'Pesan saat tidak ada modal aktif', buttons);

  assert.strictEqual(nativeAlertCalled, true);
  assert.strictEqual(nativeAlertArgs.title, 'Headless Notice');
  assert.strictEqual(nativeAlertArgs.message, 'Pesan saat tidak ada modal aktif');
  assert.strictEqual(payload.type, 'info');
});

test('EnterpriseAlertModal.js source code integration contract', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/components/EnterpriseAlertModal.js');
  assert.strictEqual(fs.existsSync(filePath), true, 'EnterpriseAlertModal.js must exist');

  const content = fs.readFileSync(filePath, 'utf8');

  // Verify core React Native & Expo imports
  assert.match(content, /Modal/, 'Must import Modal');
  assert.match(content, /View/, 'Must import View');
  assert.match(content, /Text/, 'Must import Text');
  assert.match(content, /TouchableOpacity/, 'Must import TouchableOpacity');
  assert.match(content, /Animated/, 'Must import Animated');
  assert.match(content, /Ionicons/, 'Must import Ionicons');

  // Verify bus subscription
  assert.match(content, /subscribeAlert/, 'Must use subscribeAlert');
  assert.match(content, /unsubscribeAlert/, 'Must use unsubscribeAlert');

  // Verify visual styling constants
  assert.match(content, /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.55\s*\)/, 'Must have 0.55 opacity backdrop overlay');
  assert.match(content, /#d4af37/, 'Must have gold accent color #d4af37');
  assert.match(content, /#1b4d3e/, 'Must have bottle green color #1b4d3e');
  assert.match(content, /#10b981/, 'Must have emerald success color #10b981');
  assert.match(content, /#f59e0b/, 'Must have amber warning color #f59e0b');
  assert.match(content, /#ef4444/, 'Must have rose error color #ef4444');

  // Verify badges light/dark pairs
  assert.match(content, /#ecfdf5/, 'Must include success light badge');
  assert.match(content, /#064e3b/, 'Must include success dark badge');
  assert.match(content, /#fffbeb/, 'Must include warning light badge');
  assert.match(content, /#78350f/, 'Must include warning dark badge');
  assert.match(content, /#fef2f2/, 'Must include error light badge');
  assert.match(content, /#7f1d1d/, 'Must include error dark badge');
  assert.match(content, /#e6f4ea/, 'Must include info light badge');
  assert.match(content, /#134e4a/, 'Must include info dark badge');
});

test('Typography Integrity: zero em dashes across all alert implementation source files', () => {
  const alertUtilPath = path.join(rootDir, 'apps/mobile/src/utils/alert.js');
  const alertModalPath = path.join(rootDir, 'apps/mobile/src/components/EnterpriseAlertModal.js');
  const alertTestPath = path.join(rootDir, 'tests/unit/alertManager.test.mjs');

  const filesToCheck = [alertUtilPath, alertTestPath];
  if (fs.existsSync(alertModalPath)) {
    filesToCheck.push(alertModalPath);
  }

  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf8');
    assert.strictEqual(
      content.includes('\u2014'),
      false,
      `File ${path.basename(file)} must contain zero em dashes`
    );
  }
});
