# Android Gesture Responsiveness & Smooth Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan delay, stutter, dan frame-drop saat navigasi gesture Android (usap ke Home Screen, perpindahan aplikasi, dan buka-tutup aplikasi), serta meningkatkan responsivitas antarmuka melalui penundaan teardown sensor, optimasi izin lokasi, memorisasi stylesheet, dan konfigurasi native edge-to-edge.

**Architecture:** Menerapkan deferred AppState teardown (jeda 350ms) agar animasi window manager Android selesai mulus pada 60/120fps sebelum pemutusan sensor native, mengeliminasi pemanggilan permission dialog berulang saat resume aplikasi, memoisasi objek stylesheet di DashboardScreen, serta mengonfigurasi androidNavigationBar di app.json untuk transisi inset yang stabil.

**Tech Stack:** React Native 0.86, Expo SDK 57, Expo Location, Node.js unit tests.

**Spec:** Analisis dan kesepakatan solusi optimasi gesture navigation pada sesi 2026-10-30.

## Global Constraints

- Larangan em dash: Seluruh kode, komentar, tes, dokumen, dan pesan antarmuka dilarang memuat karakter em dash (\u2014). Gunakan tanda titik, koma, titik dua, atau kurung.
- Integritas OTA: runtimeVersion tetap {"policy": "appVersion"} dan versi "1.0.0". Dilarang menambahkan pustaka native baru yang membutuhkan rebuild binary APK.
- Keamanan Secret: Dilarang menyertakan token atau kunci rahasia dalam commit git.
- Kelancaran GPS: Koordinat GPS tetap terkunci akurat untuk kebutuhan absensi dan watermark.

## Review Focus

- Penundaan teardown AppState tidak boleh menyebabkan kebocoran listener jika komponen di-unmount permanen saat berada di latar belakang.
- Jika pengguna mengusap gesture lalu kembali dengan cepat (quick resume), timer teardown harus dibatalkan seketika tanpa me-restart watcher atau meminta ulang izin.
- Memorisasi styles tidak boleh mengorbankan fungsionalitas tema terang/gelap (theme switching).
- Konfigurasi androidNavigationBar di app.json harus valid sesuai skema Expo SDK 57 tanpa memicu peringatan build.

---

### Task 1: Konfigurasi Native Android Navigation Bar & Window Insets di `app.json`

**Files:**
- Modify: `apps/mobile/app.json`
- Test: `tests/unit/gestureResponsiveness.test.mjs`

**Interfaces:**
- Consumes: `app.json` configuration.
- Produces: Smooth edge-to-edge window inset handling on Android navigation bar gesture.

- [ ] **Step 1: Tulis tes unit di `tests/unit/gestureResponsiveness.test.mjs`**
  Memverifikasi bahwa `app.json` memuat konfigurasi `androidNavigationBar` dengan latar belakang transparan atau stabil dan `barStyle` yang sesuai.

- [ ] **Step 2: Jalankan tes unit untuk memastikan deteksi awal (FAIL)**
  Jalankan: `node --test tests/unit/gestureResponsiveness.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Tambahkan konfigurasi `androidNavigationBar` pada `apps/mobile/app.json`**
  Tambahkan konfigurasi `androidNavigationBar`:
  ```json
  "androidNavigationBar": {
    "barStyle": "dark-content",
    "backgroundColor": "#00000000"
  }
  ```
  Serta pastikan hardware acceleration aktif pada container utama.

- [ ] **Step 4: Jalankan tes unit untuk memastikan lulus (PASS)**
  Jalankan: `node --test tests/unit/gestureResponsiveness.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit perubahan Task 1**
  ```bash
  git add apps/mobile/app.json tests/unit/gestureResponsiveness.test.mjs
  git commit -m "perf(mobile): configure smooth edge-to-edge android navigation bar"
  ```

---

### Task 2: Deferred AppState Teardown & Optimasi Izin Sensor di `DashboardScreen.js`

**Files:**
- Modify: `apps/mobile/src/screens/DashboardScreen.js`
- Test: `tests/unit/gestureResponsiveness.test.mjs`

**Interfaces:**
- Consumes: `AppState` event listener, `Location.watchPositionAsync`.
- Produces: Smooth swipe-to-home gesture without main-thread freeze, deferred native teardown (350ms), and permission check caching on resume.

- [ ] **Step 1: Tulis tes unit di `tests/unit/gestureResponsiveness.test.mjs`**
  Menguji logika deferred cleanup:
  1. Transisi ke latar belakang menunda penonaktifan watcher selama 350ms.
  2. Transisi kembali ke aktif dalam jendela 350ms membatalkan penundaan tanpa mengganggu watcher.
  3. Pengecekan izin lokasi menggunakan izin yang sudah ada tanpa memanggil request dialog berulang kali pada resume.

- [ ] **Step 2: Jalankan tes unit untuk memastikan kegagalan terdeteksi**
  Jalankan: `node --test tests/unit/gestureResponsiveness.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Implementasikan deferred AppState teardown dan permission guard di `DashboardScreen.js`**
  - Buat `appStateTeardownTimeoutRef` untuk menampung timer 350ms saat berpindah ke `inactive` / `background`.
  - Pada saat status menjadi `active`, batalkan timer teardown yang sedang berjalan (`clearTimeout`). Jika watcher masih hidup, lanjutkan tanpa inisialisasi ulang.
  - Di dalam `startGnssWatcher`, gunakan `Location.getForegroundPermissionsAsync()` terlebih dahulu sebelum `requestForegroundPermissionsAsync()`.
  - Naikkan efisiensi watcher dari `timeInterval: 3000, distanceInterval: 1` menjadi `timeInterval: 4500, distanceInterval: 2` untuk mengurangi beban CPU render saat ponsel diam.

- [ ] **Step 4: Jalankan tes unit untuk memastikan lulus**
  Jalankan: `node --test tests/unit/gestureResponsiveness.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit perubahan Task 2**
  ```bash
  git add apps/mobile/src/screens/DashboardScreen.js tests/unit/gestureResponsiveness.test.mjs
  git commit -m "perf(mobile): defer appstate teardown and optimize gnss watcher transitions"
  ```

---

### Task 3: Memorisasi Stylesheet & GPU Texture Layering di `DashboardScreen.js`

**Files:**
- Modify: `apps/mobile/src/screens/DashboardScreen.js`
- Test: `tests/unit/gestureResponsiveness.test.mjs`

**Interfaces:**
- Consumes: `useTheme()`, `theme` object.
- Produces: Memoized `styles` via `useMemo` preventing mass object allocation during window resize animations, and hardware texture rasterization on root container.

- [ ] **Step 1: Tulis tes unit di `tests/unit/gestureResponsiveness.test.mjs`**
  Menguji bahwa `getStyles` di-memoize dengan dependensi `theme`, dan root view mengaktifkan `renderToHardwareTextureAndroid`.

- [ ] **Step 2: Jalankan tes unit untuk memastikan kegagalan terdeteksi**
  Jalankan: `node --test tests/unit/gestureResponsiveness.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Implementasikan `useMemo` untuk styles dan properti GPU di `DashboardScreen.js`**
  - Ganti `const styles = getStyles(theme);` dengan `const styles = useMemo(() => getStyles(theme), [theme]);`.
  - Pasang `renderToHardwareTextureAndroid={true}` pada container utama `DashboardScreen`.

- [ ] **Step 4: Jalankan tes unit untuk memastikan lulus**
  Jalankan: `node --test tests/unit/gestureResponsiveness.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit perubahan Task 3**
  ```bash
  git add apps/mobile/src/screens/DashboardScreen.js tests/unit/gestureResponsiveness.test.mjs
  git commit -m "perf(mobile): memoize styles and enable gpu texture rasterization"
  ```

---

### Task 4: Verifikasi Menyeluruh Test Suite & Bebas Em Dash

**Files:**
- Test: Seluruh unit test suite (`tests/**/*.test.mjs`)
- Verify: Pemindaian karakter em dash pada seluruh berkas yang dimodifikasi.

- [ ] **Step 1: Jalankan seluruh test suite monorepo**
  Jalankan: `npm.cmd test`
  Expected: 100% tes lulus (104+ tes).

- [ ] **Step 2: Verifikasi nihil karakter em dash pada seluruh file yang diubah**
  Jalankan verifikasi regex anti-slop R-02.
  Expected: Zero em dash verified!

- [ ] **Step 3: Dorong commit ke GitHub master**
  Unggah commit pembaruan performa ke repositori remote.

