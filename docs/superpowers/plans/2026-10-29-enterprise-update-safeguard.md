# Enterprise Update Safeguard & Android Force-Close Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan total potensi force close pada aplikasi Android saat pembaruan, mengisolasi konfigurasi baseUrl web dari bundel Android EAS, dan mengimplementasikan mekanisme update enterprise dua opsi (silent cold boot activation atau guarded restart dengan pembersihan listener native).

**Architecture:** Memisahkan baseUrl web dari app.json native saat build Android, mengunduh update sepenuhnya di latar belakang secara hening tanpa pemanggilan reload paksa mendadak, menyediakan banner enterprise dengan opsi terapkan nanti saat aplikasi dibuka kembali atau mulai ulang terisolasi dengan unmount total layar dan listener native.

**Tech Stack:** React Native 0.86, Expo SDK 57, expo-updates, Node.js child_process.

**Spec:** Dokumen analisis forensik dan keputusan arsitektur opsi kombinasi 1 dan 2 pada obrolan tanggal 2026-10-29.

## Global Constraints

- Larangan em dash: Seluruh kode, komentar, tes, dokumen, dan pesan antarmuka dilarang memuat karakter em dash (\u2014). Gunakan tanda titik, koma, titik dua, atau tanda kurung.
- Integritas OTA: runtimeVersion tetap menggunakan kebijakan appVersion ("1.0.0"). Dilarang menambah pustaka native baru yang membutuhkan kompilasi ulang APK.
- Keamanan Secret: Dilarang menyertakan token EXPO_TOKEN atau GITHUB_TOKEN ke commit git; file .env tetap terabaikan.
- Kompatibilitas Lintas Platform: Perubahan pada updater tidak boleh mengganggu fungsi Web App iOS maupun backend GAS.

## Review Focus

- Bundel Android EAS Update tidak boleh memuat base path /logbook-yeka-web.
- Penundaan aktivasi update (opsi nanti) tidak boleh memicu reloadAsync() selama sesi pengguna aktif.
- Penutupan banner update tidak boleh menghambat fungsi absensi, kamera, maupun logbook.
- Jika pengguna menekan Mulai Ulang, seluruh screen (DashboardScreen, watcher GNSS, kamera) harus di-unmount total sebelum reloadAsync() dipanggil.
- Penanganan kegagalan reloadAsync() pada perangkat Android tertentu agar tidak melempar uncaught exception.

---

### Task 1: Isolasi Web BaseUrl dari Android EAS Update

**Files:**
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/update-semua.js`
- Test: `tests/unit/updateManager.test.mjs`

**Interfaces:**
- Consumes: `app.json` configuration, `update-semua.js` build runner.
- Produces: Clean Android EAS updates without `experiments.baseUrl`, and dynamic injection of `baseUrl` only during web export.

- [ ] **Step 1: Tulis tes unit di `tests/unit/updateManager.test.mjs` untuk verifikasi isolasi baseUrl**
  Memastikan konfigurasi app.json untuk Android EAS tidak memiliki `experiments.baseUrl`, dan web export menerima `baseUrl: "/logbook-yeka-web"`.

- [ ] **Step 2: Jalankan tes unit untuk memastikan kegagalan terdeteksi**
  Jalankan: `node --test tests/unit/updateManager.test.mjs`
  Expected: FAIL pada asersi eksperimen baseUrl Android.

- [ ] **Step 3: Hapus `experiments.baseUrl` dari `apps/mobile/app.json` dan suntikkan secara dinamis di `update-semua.js`**
  Hapus blok `experiments` dari `app.json`.
  Pada `update-semua.js`, pastikan saat Tahap 1 (Android EAS Update), `experiments` tidak ada pada konfigurasi. Pada Tahap 2 (Web App iOS Export), suntikkan `"experiments": { "baseUrl": "/logbook-yeka-web" }` sebelum `expo export -p web`, lalu kembalikan ke semula.

- [ ] **Step 4: Jalankan tes unit untuk memastikan lulus**
  Jalankan: `node --test tests/unit/updateManager.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit perubahan Task 1**
  ```bash
  git add apps/mobile/app.json apps/mobile/update-semua.js tests/unit/updateManager.test.mjs
  git commit -m "fix(mobile): isolate web baseUrl from Android EAS update bundle"
  ```

---

### Task 2: Implementasi Silent Background Download & Dual-Option Activation Modal

**Files:**
- Modify: `apps/mobile/App.js`
- Test: `tests/unit/updateManager.test.mjs`

**Interfaces:**
- Consumes: `expo-updates` API (`checkForUpdateAsync`, `fetchUpdateAsync`, `reloadAsync`).
- Produces: Safe enterprise update flow with silent download, non-disruptive banner ("Pembaruan Siap"), "Nanti / Mengerti" button (auto-activate on next cold launch), and "Mulai Ulang Sekarang" button with guarded unmount.

- [ ] **Step 1: Tulis tes unit di `tests/unit/updateManager.test.mjs` untuk alur update enterprise**
  Menguji bahwa:
  1. Unduhan berjalan di latar belakang tanpa memicu reload otomatis.
  2. Menekan tombol tutup / nanti menyembunyikan banner tanpa mengganggu aplikasi.
  3. Menekan tombol mulai ulang mengaktifkan state isRestarting untuk unmount komponen sebelum reload.

- [ ] **Step 2: Jalankan tes unit untuk memastikan deteksi perubahan**
  Jalankan: `node --test tests/unit/updateManager.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Perbarui implementasi di `apps/mobile/App.js`**
  1. Cek update di latar belakang tanpa pernah memanggil `reloadAsync()` secara otomatis.
  2. Saat update siap (`updateReady = true`), tampilkan banner enterprise dengan dua aksi:
     - Tombol "Buka Nanti" / "Mengerti": Menyembunyikan banner (`setUpdateReady(false)`). Aplikasi beroperasi normal; update akan aktif mulus saat cold launch berikutnya.
     - Tombol "Mulai Ulang": Mengeset `isRestarting(true)`, unmount seluruh screen, menampilkan layar transisi "Memulai Ulang Sistem", membersihkan listener, lalu memanggil `Updates.reloadAsync()` dengan try-catch terproteksi.

- [ ] **Step 4: Jalankan tes unit untuk memastikan lulus**
  Jalankan: `node --test tests/unit/updateManager.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit perubahan Task 2**
  ```bash
  git add apps/mobile/App.js tests/unit/updateManager.test.mjs
  git commit -m "feat(mobile): implement non-disruptive enterprise update banner and guarded restart"
  ```

---

### Task 3: Verifikasi Menyeluruh & Uji Bebas Em Dash

**Files:**
- Test: Seluruh unit test suite (`tests/**/*.test.mjs`)
- Verify: Pemindaian karakter em dash pada seluruh berkas yang dimodifikasi.

- [ ] **Step 1: Jalankan seluruh test suite monorepo**
  Jalankan: `npm test`
  Expected: 100% tes lulus (98+ tes).

- [ ] **Step 2: Verifikasi nihil karakter em dash pada seluruh file yang diubah**
  Jalankan: `node -e "const fs = require('fs'); const files = ['apps/mobile/App.js', 'apps/mobile/app.json', 'apps/mobile/update-semua.js', 'tests/unit/updateManager.test.mjs']; files.forEach(f => { const content = fs.readFileSync(f, 'utf8'); if (content.includes('\u2014')) throw new Error('Em dash found in ' + f); }); console.log('Zero em dash verified!');"`
  Expected: Zero em dash verified!

- [ ] **Step 3: Commit akhir dan siap diunggah**
  ```bash
  git status
  ```

