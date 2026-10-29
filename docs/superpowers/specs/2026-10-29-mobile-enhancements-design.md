# Mobile Enhancements Design: EAS Update Runner, Enterprise Modal, Fast Submit, & Navitel GNSS

## 1. Intent & Context
Aplikasi mobile SyncIn YEKA membutuhkan empat perbaikan esensial:
1. Kegagalan script deployment `update-semua.bat` akibat perintah `eas` tidak terdeteksi di lingkungan Windows PowerShell/CMD.
2. Waktu tunggu pengiriman jurnal yang lama (~15 detik) ketika terhubung ke WiFi rumah / berada dalam ruangan akibat pemblokiran pencarian GPS akurasi tinggi.
3. Kebutuhan penguncian koordinat satelit murni saat offline / tanpa sinyal seluler (seperti aplikasi navigasi Navitel), dengan visual status satelit di UI.
4. Peningkatan tampilan dialog/pop-up Android agar elegan, bergaya enterprise, dan selaras dengan tema SyncIn YEKA (botol hijau `#1b4d3e` dan aksen emas `#d4af37`), menggantikan dialog default OS yang kaku.

## 2. Goals & Non-Goals
### Goals
- Memperbaiki `update-semua.js` agar secara dinamis mendeteksi binary `eas` (path lokal `node_modules/.bin`, binary global, atau fallback `npx.cmd --yes eas-cli`), serta menambahkan `eas-cli` ke `devDependencies`.
- Menghilangkan delay 15 detik pada `submitAbsensi` di `DashboardScreen.js` dengan memprioritaskan koordinat yang sudah terkunci (dari foto watermark atau watcher GPS aktif) dan menyimpan langsung ke antrean lokal (`@offline_queue`) dalam waktu <500ms.
- Mengaktifkan penangkapan satelit GNSS murni secara terus-menerus menggunakan `Location.watchPositionAsync` sehingga perangkat di lokasi offline tetap mengunci koordinat akurat secara otonom dari chip GPS hardware.
- Menampilkan indikator status satelit real-time di UI Dashboard (misal: "Mencari satelit...", "Satelit terkunci: akurasi ±X m").
- Mengimplementasikan `EnterpriseAlertModal` dan alert manager berbasis event di `src/utils/alert.js` yang menyajikan dialog berpenampilan mewah, modern, dengan ikon status (sukses, peringatan, error, konfirmasi) dan transisi halus.

### Non-Goals
- Tidak mengubah skema data tabel backend Google Apps Script.
- Tidak menambahkan pustaka native baru yang membutuhkan rebuild APK binary (`runtimeVersion: "1.0.0"` tetap dipertahankan).
- Tidak menghapus kompatibilitas web (fallback aman jika dijalankan di browser).

## 3. Constraints
- Larangan em dash: Tidak boleh menggunakan karakter em dash di seluruh kode, komentar, dokumen, maupun antarmuka.
- OTA Compatibility: Seluruh perubahan harus 100% kompatibel dengan Expo OTA Update (`eas update`).
- Backward Compatibility: Fungsi `showAlert(title, message, buttons)` tetap kompatibel dengan pemanggilan yang sudah ada di seluruh codebase.

## 4. Architectural Decisions
1. **Dynamic EAS Execution (`update-semua.js`):**
   Mencari executable `eas` secara berurutan:
   - Cek `apps/mobile/node_modules/.bin/eas(.cmd)`
   - Cek `../../node_modules/.bin/eas(.cmd)`
   - Cek `where eas` (Windows) atau `which eas` (Unix)
   - Fallback otomatis ke `npx.cmd --yes eas-cli` (Windows) atau `npx --yes eas-cli` (Unix).
2. **Instant Attendance Submit (`DashboardScreen.js`):**
   Pada fungsi `submitAbsensi`:
   - Jika `photo?.coords` atau `location` valid dan baru, langsung gunakan tanpa menunggu `Location.getCurrentPositionAsync`.
   - Hanya panggil pencarian cepat jika belum ada koordinat sama sekali (timeout maksimal 2 detik).
   - Masukkan payload ke `@offline_queue` secara instan, bersihkan form, dan tampilkan Enterprise Modal konfirmasi.
   - Sinkronisasi ke backend Google Apps Script berjalan di latar belakang via `processQueue()`.
3. **Navitel-style Hardware GNSS Watcher (`DashboardScreen.js`):**
   - Mengaktifkan `Location.watchPositionAsync` dengan opsi akurasi tertinggi (`Location.Accuracy.Highest`), interval pembaruan 3 detik, dan jarak 1 meter.
   - Menyimpan data lokasi terbaru ke state dan `@last_known_location`.
   - Menampilkan banner status satelit GPS di UI dengan status visual yang jelas.
4. **Enterprise Alert System (`src/utils/alert.js` & `src/components/EnterpriseAlertModal.js`):**
   - Menggunakan event listener sederhana tanpa state global yang rumit.
   - Komponen `EnterpriseAlertModal` dipasang di root `App.js` dalam `ThemeProvider`.
   - Mendukung tipe alert: `success`, `warning`, `error`, `info`, `confirm`.
   - Desain visual: rounded 20px, warna aksen SyncIn YEKA, backdrop overlay semi-transparan, tombol elegan.

