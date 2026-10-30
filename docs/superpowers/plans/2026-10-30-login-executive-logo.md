# Executive Gold Halo Login Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan logo Opsi B (Executive Gold Halo) pada halaman login Android SyncIn YEKA dengan bingkai lingkaran frosted glass beraksen lis emas, penyempurnaan tipografi emas, dan sistem proteksi ganda (dual-layer base64 fallback) agar logo selalu tampil sempurna.

**Architecture:** Mengekstrak konstanta fallback logo ke modul terisolasi `apps/mobile/src/utils/brandLogo.js`, menyematkan wadah halo lingkaran mewah dengan radial ambient glow dan lis emas di `LoginScreen.js`, menerapkan penangan `onError` yang otomatis beralih ke data-URI jika aset native tertunda atau gagal, serta mempercantik subtitel "SISTEM JURNAL CLOUD" dengan nuansa emas korporat.

**Tech Stack:** React Native 0.86, Expo SDK 57, Node.js unit tests.

**Spec:** Persetujuan Opsi B pada diskusi mockup 2026-10-30.

## Global Constraints

- Larangan em dash: Seluruh kode, komentar, tes, dokumen, dan pesan antarmuka dilarang memuat karakter em dash (\u2014). Gunakan tanda titik, koma, titik dua, atau kurung.
- Integritas OTA: runtimeVersion tetap {"policy": "appVersion"} dan versi "1.0.0". Dilarang menambah pustaka native baru yang membutuhkan kompilasi ulang APK.
- Keamanan Secret: Dilarang menyertakan token EXPO_TOKEN atau GITHUB_TOKEN ke commit git; file .env tetap terabaikan.
- Kompatibilitas Lintas Platform: Tampilan harus tampil konsisten dan responsif di Android, Web App iOS, maupun browser.

## Review Focus

- Wadah halo harus berbentuk lingkaran simetris sempurna (`borderRadius` setengah dari dimensi).
- Penanganan `onError` pada komponen Image tidak boleh memicu siklus re-render tanpa henti (*infinite loop*).
- Gambar logo elang kompas harus memiliki resolusi tajam dengan `resizeMode="contain"`.
- Gaya subtitel emas harus memiliki kontras keterbacaan yang memenuhi standar WCAG AA.

---

### Task 1: Modul Utilitas `brandLogo.js` dengan Dual-Layer Fallback Data URI

**Files:**
- Create: `apps/mobile/src/utils/brandLogo.js`
- Test: `tests/unit/loginLogo.test.mjs`

**Interfaces:**
- Produces: `FALLBACK_LOGO_URI` (string base64 data-URI), `getBrandLogoSource(hasError)` returning image source object or require reference.

- [ ] **Step 1: Tulis tes unit di `tests/unit/loginLogo.test.mjs`**
  Memverifikasi bahwa `brandLogo.js` mengekspor `FALLBACK_LOGO_URI` valid bertipe PNG data-URI dan fungsi `getBrandLogoSource`.

- [ ] **Step 2: Jalankan tes unit untuk memastikan kegagalan terdeteksi (FAIL)**
  Jalankan: `node --test tests/unit/loginLogo.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Implementasikan `apps/mobile/src/utils/brandLogo.js`**
  Buat berkas dengan konstanta base64 terkompresi dan helper resolusi gambar.

- [ ] **Step 4: Jalankan tes unit untuk memastikan lulus (PASS)**
  Jalankan: `node --test tests/unit/loginLogo.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit perubahan Task 1**
  ```bash
  git add apps/mobile/src/utils/brandLogo.js tests/unit/loginLogo.test.mjs
  git commit -m "feat(mobile): add brand logo fallback utility module"
  ```

---

### Task 2: Implementasi Tampilan Opsi B (Executive Gold Halo) di `LoginScreen.js`

**Files:**
- Modify: `apps/mobile/src/screens/LoginScreen.js`
- Test: `tests/unit/loginLogo.test.mjs`

**Interfaces:**
- Consumes: `getBrandLogoSource`, `FALLBACK_LOGO_URI` dari `brandLogo.js`.
- Produces: Luxurious circular halo emblem with frosted backdrop, gold accent border, soft drop shadow, gold subtitle, and error recovery in `LoginScreen`.

- [ ] **Step 1: Tulis tes unit di `tests/unit/loginLogo.test.mjs` untuk integrasi LoginScreen**
  Menguji bahwa `LoginScreen.js` mengimpor helper logo, menggunakan state fallback error, memiliki gaya `haloWrapper`, dan gaya subtitel emas.

- [ ] **Step 2: Jalankan tes unit untuk memastikan kegagalan terdeteksi**
  Jalankan: `node --test tests/unit/loginLogo.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Implementasikan Opsi B di `LoginScreen.js`**
  1. Tambahkan state `const [logoError, setLogoError] = useState(false);`.
  2. Bungkus Image di dalam `styles.haloWrapper`:
     ```jsx
     <View style={styles.haloWrapper}>
       <Image 
         source={getBrandLogoSource(logoError)} 
         style={styles.logoImage} 
         resizeMode="contain" 
         onError={() => setLogoError(true)}
       />
     </View>
     ```
  3. Perbarui `styles.haloWrapper`:
     ```javascript
     haloWrapper: {
       width: 94,
       height: 94,
       borderRadius: 47,
       backgroundColor: 'rgba(212, 175, 55, 0.12)',
       borderWidth: 1.5,
       borderColor: 'rgba(212, 175, 55, 0.45)',
       justifyContent: 'center',
       alignItems: 'center',
       marginBottom: 14,
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 6 },
       shadowOpacity: 0.35,
       shadowRadius: 10,
       elevation: 8,
     }
     ```
  4. Perbarui `styles.logoImage`:
     ```javascript
     logoImage: {
       width: 76,
       height: 76,
     }
     ```
  5. Perbarui `styles.appSubtitle` dengan warna emas elegan `#d4af37`.

- [ ] **Step 4: Jalankan tes unit untuk memastikan lulus**
  Jalankan: `node --test tests/unit/loginLogo.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit perubahan Task 2**
  ```bash
  git add apps/mobile/src/screens/LoginScreen.js tests/unit/loginLogo.test.mjs
  git commit -m "feat(mobile): implement executive gold halo logo and subtitle on login screen"
  ```

---

### Task 3: Verifikasi Test Suite Monorepo & Integrasi Bebas Em Dash

**Files:**
- Test: Seluruh unit test suite (`tests/**/*.test.mjs`)
- Verify: Pemindaian karakter em dash pada seluruh berkas yang dimodifikasi.

- [ ] **Step 1: Jalankan seluruh test suite monorepo**
  Jalankan: `npm.cmd test`
  Expected: 100% tes lulus (114+ tes).

- [ ] **Step 2: Verifikasi nihil karakter em dash pada seluruh file yang diubah**
  Jalankan verifikasi regex anti-slop R-02.
  Expected: Zero em dash verified!

- [ ] **Step 3: Unggah commit ke GitHub master**
  Kirimkan pembaruan bersih ke origin master.

