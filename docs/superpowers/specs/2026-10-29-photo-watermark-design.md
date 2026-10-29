# Desain Fitur: Watermark Bukti Foto Otomatis (Geo-Timestamp)

Tanggal: 2026-10-29
Proyek: SyncIn YEKA (Yayasan Elang Katulistiwa Adipavitra)
Cakupan Platform: Aplikasi Android (`apps/mobile`), Web App iOS GitHub Pages (`apps/mobile` web), dan Web Apps Google Apps Script (`apps/backend-gas`)

---

## 1. Tujuan dan Latar Belakang (Intent & Why)

Saat ini, foto dokumentasi absensi dan logbook kegiatan yang diambil melalui Aplikasi Android (`NativeCamera.js`), Web App iOS (`WebCamera.js`), maupun Web Apps GAS (`Index.html`) dikirim ke backend `Code.gs` (`simpanFotoKeDrive_`) sebagai file JPEG polos tanpa keterangan visual di dalam gambar. Ketika manajemen, HRD, atau auditor donor membuka tautan `FotoURL` di Google Spreadsheet, melihat file langsung di folder Google Drive, atau mengunduh foto untuk lampiran Laporan Pertanggungjawaban (LPJ), foto tersebut tidak memuat bukti identitas, waktu, dan lokasi secara mandiri.

Fitur ini menyematkan cap **Geo-Timestamp Watermark** secara permanen langsung ke dalam piksel gambar JPEG di sisi perangkat sesaat setelah foto diambil (sebelum foto masuk ke antrean *offline* maupun dikirim ke Google Drive). Dengan demikian, setiap tautan foto di Google Drive otomatis menampilkan informasi personel, waktu, koordinat GPS, dan wilayah secara permanen tanpa mengubah tata letak atau desain antarmuka aplikasi yang sudah ada.

---

## 2. Sasaran, Batasan Ruang Lingkup, dan Kegagalan yang Harus Dihindari

### Goals (Sasaran Utama)
1. Membakar (*burn-in*) cap watermark langsung ke piksel JPEG pada ketiga platform: Android, Web App iOS, dan Web Apps GAS.
2. Memastikan watermark langsung tampil permanen saat file dibuka melalui link `FotoURL` di Google Drive, Google Spreadsheet, panel Admin, maupun saat file `.jpg` diunduh.
3. Menyematkan watermark pada **waktu pemotretan** (*capture time*), bukan waktu unggah ke server, sehingga foto yang diambil secara *offline* di pelosok tetap mencatat jam dan titik GPS aktual saat foto dipotret walaupun baru tersinkronisasi beberapa jam kemudian.
4. Menjaga kompatibilitas penuh dengan mekanisme **OTA Update (`eas update`)** pada Android sehingga pembaruan dapat dikirim langsung tanpa meminta staf menginstal ulang file APK.

### Non-Goals (Di Luar Cakupan)
1. Mengubah tema warna, tata letak kartu, navigasi, atau desain visual layar aplikasi yang sudah berjalan saat ini.
2. Menambahkan watermark secara surut (*retroactive*) pada foto-foto lama yang sudah terlanjur tersimpan di Google Drive.
3. Mengubah skema kolom pada Google Spreadsheet `Absensi` atau menggantikan validasi keamanan backend yang sudah ada (deteksi Fake GPS, Root, anti-foto gelap, dan anti-duplikat).

### Anti-Goals (Kondisi Gagal Walaupun Fitur Berjalan)
1. **Memutus OTA Android:** Menambahkan modul *native* React Native baru (seperti `react-native-view-shot`, `react-native-image-marker`, `react-native-webview`, atau `@shopify/react-native-skia`) yang memaksa *rebuild* dan instal ulang APK.
2. **Hanya Overlay UI:** Menampilkan teks watermark hanya sebagai komponen layar di atas `<Image>` atau `<img>` tanpa menyatukannya ke dalam file JPEG yang diunggah ke Google Drive.
3. **Gagal Saat Offline:** Memblokir pemotretan atau menyebabkan *error* ketika staf berada di lapangan tanpa sinyal internet untuk *reverse geocoding* nama desa.
4. **Menutupi Objek Utama atau Tidak Terbaca:** Ukuran pita watermark terlalu besar hingga menutupi objek kegiatan di tengah foto, atau teks tidak terbaca saat latar foto sangat terang maupun sangat gelap.
5. **Memperlambat Kamera Secara Ekstrem:** Proses pembakaran piksel di Android Hermes membuat kamera membeku lebih dari ~1 detik pada foto lebar 1000px.

---

## 3. Keputusan Desain yang Telah Disepakati Bersama Pengguna

1. **Penyatuan Permanen Sebelum Upload ke Google Drive:**
   Watermark digambar ke piksel JPEG di sisi klien (`NativeCamera.js`, `WebCamera.js`, dan `handleFotoInputChange` di `Index.html`) sebelum dikirim ke `simpanFotoKeDrive_` di `Code.gs`. Pratinjau foto di form absensi juga langsung menampilkan hasil foto yang sudah ber-watermark.
2. **Tata Letak Visual Watermark:**
   - Posisi: Pita gelap semi-transparan di sepanjang tepi bawah foto dengan bilah aksen vertikal warna emas khas YEKA (`#d4af37`) di sisi kiri teks.
   - Kontras: Latar pita gelap semi-transparan (`rgba(15, 23, 42, 0.76)`) menjamin teks putih dan emas tetap tajam pada kondisi foto siang terik maupun malam hari, tanpa menutupi area tengah foto.
3. **Susunan Baris Informasi pada Cap Watermark:**
   - **Baris 1 (Header Instansi):** `YAYASAN ELANG KATULISTIWA ADIPAVITRA` (warna emas `#d4af37`, huruf kapital tebal).
   - **Baris 2 (Identitas Staf):** `<Nama Personel> | <Divisi>` (warna putih `#ffffff`; jika kolom divisi kosong atau `-`, gunakan `<Jabatan>`).
   - **Baris 3 (Waktu Pemotretan):** `<Hari>, <DD MMM YYYY> | <HH:MM:SS> WIB` (diformat konsisten ke zona waktu `Asia/Jakarta` / `UTC+7`).
   - **Baris 4 (Koordinat & Wilayah):**
     - Sub-baris koordinat: `GPS: <latitude 6 desimal>, <longitude 6 desimal>`
     - Sub-baris wilayah (jika tersedia): `<Desa/Kelurahan>, <Kecamatan>, <Kabupaten>`
     - Jika perangkat sedang *offline* di lapangan dan nama wilayah belum tersedia, sub-baris wilayah dilewati dengan rapi dan tetap mencetak titik koordinat GPS akurat.
4. **Kompatibilitas Pembaruan Android:**
   Pemrosesan gambar di Android dijalankan murni di level JavaScript tanpa modul *native* tambahan agar bisa langsung dirilis lewat `update-semua.bat` / `eas update`.

---

## 4. Batasan Teknis Sistem Saat Ini (Constraints)

1. **Urutan Validasi Anti-Foto Hitam (`Anti-Blank Check`):**
   Saat ini `NativeCamera.js` menolak foto dengan `base64.length < 6000`, `WebCamera.js` dan `Index.html` memeriksa sampel kecerahan piksel tengah, serta `Code.gs` menolak `cleanB64.length < 5500`. Validasi anti-foto hitam di klien **wajib dijalankan sebelum** watermark digambar, agar tangkapan lensa yang hitam/tertutup tidak lolos validasi hanya karena ketambahan piksel teks watermark.
2. **Kompatibilitas Deteksi Foto Duplikat di `Code.gs`:**
   `Code.gs` (baris 634) memeriksa 200 karakter terakhir base64 (`data.foto.substring(data.foto.length - 200)`). Karena watermark berada di tepi bawah gambar JPEG dan memuat detik waktu pemotretan (`HH:MM:SS`), blok piksel bawah setiap foto baru akan selalu unik sehingga aman terhadap filter anti-duplikat.
3. **Ketiadaan Global `Buffer` di Hermes React Native:**
   Paket `jpeg-js` (sudah tersedia di `node_modules` melalui dependensi `jimp`) memanggil `Buffer.from(byteout)` pada `lib/encoder.js:732` ketika `typeof module !== 'undefined'`, sedangkan `node_modules/buffer` tidak terpasang dan runtime Hermes Android tidak menyediakan `globalThis.Buffer` secara bawaan. Modul watermark wajib menyertakan *shim* ringan berbasis `Uint8Array` untuk `globalThis.Buffer` (atau memanggil encoder dengan aman) serta menggunakan opsi `{ useTArray: true, formatAsRGBA: true }` saat *decode*.
4. **Batas Ukuran Payload Google Apps Script:**
   Lebar maksimum foto dipertahankan `1000px` pada aplikasi mobile (`NativeCamera.js`, dan diseragamkan maksimal `1000px` pada `WebCamera.js` agar ukuran teks proporsional di semua resolusi kamera iPhone) serta `1024px` pada `Index.html`. Kualitas kompresi JPEG akhir dijaga pada `0.7` (Android & Web GAS) dan `0.55` (Web iOS, dinaikkan sedikit dari `0.4` agar teks kecil watermark tidak pecah akibat artefak kompresi, dengan ukuran payload tetap ringan di kisaran 60-140 KB).
5. **Aturan Teks:**
   Dilarang menggunakan karakter *em dash* pada seluruh teks watermark maupun pesan UI; gunakan pemisah `|`, `:`, `,`, atau tanda hubung biasa `-`.

---

## 5. Keputusan Teknis Pembangun (`[Builder Calls]`)

Keputusan di bawah ini ditetapkan sebagai perilaku teknis bawaan yang wajar agar implementasi konsisten di ketiga platform:

1. **`[Builder Call]` Cakupan Mode Absensi yang Diberi Watermark:**
   Watermark diterapkan secara seragam pada **setiap foto** yang diambil/dilampirkan di form absensi (`Mode Hadir`, `Mode Izin - WFH`, maupun foto bukti opsional pada `Mode Izin`), sehingga setiap tautan `FotoURL` yang tercatat di Google Spreadsheet memiliki standar bukti visual yang konsisten ketika dibuka dari Google Drive.
2. **`[Builder Call]` Penanganan GPS Saat Kamera Dibuka:**
   - Pada `DashboardScreen.js`, metadata `{ user, location, wilayah }` diteruskan secara reaktif ke `NativeCamera` dan `WebCamera`. Saat pengguna membuka modal kamera, aplikasi juga memicu penyegaran lokasi GPS di latar belakang sehingga selama pengguna mengarahkan kamera (1-3 detik), titik koordinat terbaru sudah terkunci tepat saat tombol potret ditekan.
   - Pada `Index.html`, `getGPSLocation()` sudah berjalan otomatis saat halaman dibuka. Jika staf memilih/memotret foto ketika kolom `#absen-gps` masih kosong atau belum selesai mengunci, `handleFotoInputChange` akan mencoba mengambil koordinat GPS cepat (batas waktu 4 detik) sebelum menggambar watermark. Jika sinyal GPS benar-benar belum terkunci saat foto diambil, baris lokasi menulis `GPS: Belum terkunci` (form pengiriman jurnal tetap mewajibkan GPS terkunci sebelum data bisa dikirim).
3. **`[Builder Call]` Strategi Reverse Geocoding Wilayah (`Desa, Kecamatan, Kabupaten`) yang Hemat Kuota & Tahan Offline:**
   - Menambahkan *action* ringan `reverseGeocode` pada `doPost` di `Code.gs` serta fungsi pembungkus `getWilayahClient(gpsStr)` untuk `google.script.run` di `Index.html`, yang memanfaatkan fungsi [`getWilayahDariGPS_`](../../apps/backend-gas/Code.gs) yang sudah ada, dilengkapi cache `CacheService.getScriptCache()` berbasis grid koordinat 3 desimal (`~110 meter`, TTL 6 jam) agar hemat kuota harian `Maps` Apps Script.
   - Di **Android**: memanggil `Location.reverseGeocodeAsync` bawaan `expo-location` terlebih dahulu (cepat, tanpa kuota server), lalu *fallback* ke *action* `reverseGeocode` jika hasil OS kurang lengkap.
   - Di **Web iOS**: memanggil *action* `reverseGeocode` ke `API_URL` saat GPS terkunci di `DashboardScreen.js` (menghindari keterbatasan `expo-location` reverse geocode di browser tanpa API key).
   - Di **Android & Web iOS**: menyimpan cache wilayah terakhir `{ latitude, longitude, wilayahText }` di `AsyncStorage` (`@last_known_wilayah`). Jika saat memotret perangkat sedang *offline* namun jarak dari titik cache terakhir masih `<= 500 meter`, nama wilayah dari cache tetap dapat dipakai; jika di luar radius tersebut dan *offline*, hanya koordinat GPS yang dicetak.
   - Di **Web GAS (`Index.html`)**: memanggil `gsRun('getWilayahClient', gpsStr)` segera setelah `getGPSLocation()` berhasil mengunci koordinat, lalu menyimpannya di variabel memori `currentWilayahText` sehingga proses cap foto berlangsung instan tanpa jeda jaringan tambahan.
4. **`[Builder Call]` Mesin Render Watermark Murni JS di Android vs HTML5 Canvas di Web:**
   - **Web App iOS (`WebCamera.js`) & Web Apps GAS (`Index.html`):** Menggambar pita semi-transparan, aksen emas, dan teks menggunakan API standar HTML5 Canvas 2D (`ctx.fillRect`, `ctx.font`, `ctx.fillText` dengan pembungkusan baris otomatis jika nama staf atau nama wilayah panjang) tepat sebelum `canvas.toDataURL('image/jpeg', ...)`.
   - **Android (`NativeCamera.js` + `apps/mobile/src/utils/watermark.js`):** Mendekode base64 JPEG hasil `expo-image-manipulator` (lebar 1000px) ke buffer piksel RGBA menggunakan `jpeg-js`, membaurkan (*alpha-blend*) pita gelap hanya pada baris piksel bagian bawah gambar, menggambar aksen emas `#d4af37`, merender teks tajam menggunakan tabel *bitmap font* ASCII tertanam di kode JS (mendukung penskalaan dan *word-wrap* tanpa bergantung pada file `.ttf`/`.fnt` eksternal maupun modul `fs` Node.js), lalu mengenkode kembali ke JPEG base64 dan mengembalikan `{ uri: 'data:image/jpeg;base64,' + base64, base64 }`. Karakter non-ASCII pada nama/wilayah dinormalisasi ke padanan ASCII Latin terdekat agar tidak pernah muncul kotak kosong.

---

## 6. Hal yang Diserahkan kepada Pembangun (Left to Builder)

- Detail ukuran piksel font, tinggi baris (*line-height*), dan *padding* proporsional terhadap lebar gambar (`width = 1000px` atau `1024px`), selama pita bawah tidak melebihi ~18% tinggi foto dan seluruh teks memenuhi kontras baca yang jelas.
- Struktur pembagian file utilitas di `apps/mobile/src/utils/` (misalnya memisahkan tabel *glyph bitmap* dan logika komposisi piksel/canvas agar rapi dan mudah diuji dengan unit test Node.js).
- Penanganan pemotongan atau pembungkusan baris (*word wrapping* maksimal 2 baris untuk alamat wilayah yang sangat panjang) agar teks tidak pernah terpotong keluar batas kanan foto.

