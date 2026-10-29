# Mobile Enhancements Implementation Plan: EAS Runner, Enterprise Modal, Fast Submit, & Navitel GNSS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan kegagalan update EAS pada Windows, mempercepat pengiriman absensi (<500ms) tanpa jeda 15 detik pada WiFi, mengaktifkan penangkapan satelit GNSS murni offline ala Navitel dengan status visual, dan mengganti pop-up Android default dengan Enterprise Modal berdesain mewah.

**Architecture:** Menggunakan dynamic command resolver untuk eksekusi EAS CLI, listener event bus ringan untuk modal enterprise global di root aplikasi, continuous GNSS watching via Expo Location untuk satelit otonom, dan offline-first instant persistence ke AsyncStorage sebelum proses sinkronisasi background.

**Tech Stack:** React Native 0.86, Expo SDK 57, Ionicons, Node.js child_process, AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-10-29-mobile-enhancements-design.md`

## Global Constraints

- Larangan em dash: Seluruh kode, komentar, tes, dokumen, dan pesan antarmuka tidak boleh memuat karakter em dash. Gunakan tanda koma, titik, titik dua, atau kurung.
- OTA Safety: Tidak menambahkan pustaka native baru yang membutuhkan kompilasi ulang APK/IPA. runtimeVersion tetap "1.0.0".
- Keamanan Secret: Tidak menambahkan API key atau token rahasia ke commit git; file .env tetap terabaikan.
- Kompatibilitas Alert: Seluruh pemanggilan `showAlert(title, message, buttons)` yang ada tetap berjalan tanpa perubahan signature.

## Review Focus

- Eksekusi EAS di Windows jika `eas` belum diinstal global (harus otomatis memanggil `npx.cmd --yes eas-cli` atau binary lokal).
- Penyimpanan absensi instan saat jaringan lambat atau sinyal GPS lemah di dalam ruangan (harus langsung masuk `@offline_queue` tanpa timeout 15 detik).
- Penghentian watcher GPS GNSS saat screen unmount untuk mencegah kebocoran memori atau konsumsi baterai berlebih.
- Deteksi fake GPS tetap aktif pada koordinat yang diterima dari watcher satelit berkelanjutan.
- Fallback modal ke `Alert.alert` atau `window.alert` jika komponen `EnterpriseAlertModal` belum terpasang.

---

### Task 1: Dynamic EAS Runner & Dependency Caching

**Files:**
- Modify: `apps/mobile/update-semua.js`
- Modify: `apps/mobile/package.json`
- Test: `tests/unit/easRunner.test.mjs`

**Interfaces:**
- Produces: `resolveEasCommand(baseDir, platform)` function returning string command.

- [ ] **Step 1: Write failing test in `tests/unit/easRunner.test.mjs`**
  Membuat pengujian unit untuk logika resolusi perintah EAS pada platform Windows dan non-Windows.

- [ ] **Step 2: Run test to verify it fails**
  Jalankan: `node --test tests/unit/easRunner.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Implement `resolveEasCommand` and update `update-semua.js`**
  Ekstrak logika resolusi executable EAS ke fungsi teruji dan panggil dalam `update-semua.js`.
  Tambahkan `"eas-cli": "^27.1.0"` pada `devDependencies` di `apps/mobile/package.json`.

- [ ] **Step 4: Run test to verify it passes**
  Jalankan: `node --test tests/unit/easRunner.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  `git add apps/mobile/update-semua.js apps/mobile/package.json tests/unit/easRunner.test.mjs`
  `git commit -m "fix(mobile): dynamic eas cli command resolution for cross-platform OTA updates"`

---

### Task 2: Enterprise Alert System & Event Bus

**Files:**
- Create: `apps/mobile/src/components/EnterpriseAlertModal.js`
- Modify: `apps/mobile/src/utils/alert.js`
- Test: `tests/unit/alertManager.test.mjs`

**Interfaces:**
- Produces: `showAlert(title, message, buttons, options)`, `subscribeAlert(listener)`, `unsubscribeAlert(listener)`
- Component: `EnterpriseAlertModal({ theme })`

- [ ] **Step 1: Write failing test in `tests/unit/alertManager.test.mjs`**
  Membuat pengujian unit untuk event bus alert: pendaftaran listener, pengiriman event, pembersihan listener, dan deteksi tipe status (success, warning, error, info).

- [ ] **Step 2: Run test to verify it fails**
  Jalankan: `node --test tests/unit/alertManager.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Implement event bus in `alert.js` and build `EnterpriseAlertModal.js`**
  Desain dialog modal mewah dengan border radius 20, palet SyncIn YEKA (`#1b4d3e`, `#d4af37`), badge icon sesuai kategori, tombol aksi tegas, dan transisi halus.

- [ ] **Step 4: Run test to verify it passes**
  Jalankan: `node --test tests/unit/alertManager.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  `git add apps/mobile/src/components/EnterpriseAlertModal.js apps/mobile/src/utils/alert.js tests/unit/alertManager.test.mjs`
  `git commit -m "feat(mobile): enterprise modal dialog and alert event bus"`

---

### Task 3: Root App Integration for Enterprise Modal

**Files:**
- Modify: `apps/mobile/App.js`

**Interfaces:**
- Consumes: `<EnterpriseAlertModal />` mounted inside `ThemeProvider`.

- [ ] **Step 1: Mount `EnterpriseAlertModal` inside `App.js`**
  Letakkan komponen di dalam `SafeAreaProvider` dan `ThemeProvider` agar modal selalu tampil di atas seluruh layer dengan tema yang sesuai (gelap / terang).

- [ ] **Step 2: Verify App.js syntax and integrity**
  Jalankan: `npm.cmd test`
  Expected: PASS

- [ ] **Step 3: Commit**
  `git add apps/mobile/App.js`
  `git commit -m "feat(mobile): integrate enterprise alert modal at application root"`

---

### Task 4: Fast Attendance Submit & Navitel-style GNSS Watcher

**Files:**
- Modify: `apps/mobile/src/screens/DashboardScreen.js`
- Test: `tests/unit/gnssDashboard.test.mjs`

**Interfaces:**
- Produces: Continuous satellite watcher, real-time satellite status badge, instant submission logic without 15s delay.

- [ ] **Step 1: Write unit test in `tests/unit/gnssDashboard.test.mjs`**
  Pengujian logika seleksi koordinat: jika koordinat foto atau lokasi terkunci tersedia, gunakan instan tanpa blocking.

- [ ] **Step 2: Run test to verify it fails**
  Jalankan: `node --test tests/unit/gnssDashboard.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Update `DashboardScreen.js`**
  - Pasang `Location.watchPositionAsync` dengan opsi akurasi tertinggi dan listener real-time untuk penangkapan satelit murni offline.
  - Tampilkan banner status satelit GPS (misal: "Mencari satelit GNSS...", "Satelit terkunci: akurasi ±X m") di atas tombol atau kartu absensi.
  - Hilangkan delay 15 detik pada `submitAbsensi`: jika koordinat sudah ada dari watermark foto atau watcher aktif, langsung masukkan ke `@offline_queue` dalam <500ms dan reset form.
  - Lakukan pembersihan `subscription.remove()` pada unmount.

- [ ] **Step 4: Run test to verify it passes**
  Jalankan: `node --test tests/unit/gnssDashboard.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  `git add apps/mobile/src/screens/DashboardScreen.js tests/unit/gnssDashboard.test.mjs`
  `git commit -m "feat(mobile): fast attendance submission and continuous offline gnss satellite tracking"`

---

### Task 5: Full Regression Testing & Verification

**Files:**
- Test: All tests in `tests/` directory

- [ ] **Step 1: Run comprehensive test suite**
  Jalankan: `npm.cmd test`
  Expected: All 53+ tests PASS cleanly.

- [ ] **Step 2: Anti-slop verification**
  Periksa seluruh commit baru agar tidak ada karakter em dash (Unicode \u2014).

- [ ] **Step 3: Dry-run EAS command check**
  Jalankan pengecekan resolusi perintah EAS untuk memastikan Windows command prompt siap menjalankan update tanpa error.

