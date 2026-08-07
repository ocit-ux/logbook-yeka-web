const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// 1. Ambil Token dari variabel environment (akan kita set lewat file .env nanti)
const TOKEN_ANDROID = process.env.EXPO_TOKEN_ANDROID || '';
const TOKEN_IOS = process.env.EXPO_TOKEN_IOS || '';

if (!TOKEN_ANDROID || !TOKEN_IOS) {
  console.error("❌ ERROR: Token belum dimasukkan! Pastikan Anda sudah mengisi file .env");
  process.exit(1);
}

const appJsonPath = path.join(__dirname, 'app.json');
let originalAppJson = '';

try {
  // Simpan kondisi asli app.json untuk berjaga-jaga
  originalAppJson = fs.readFileSync(appJsonPath, 'utf8');
  const appConfig = JSON.parse(originalAppJson);

  const msg = process.argv[2] || "Update Otomatis";
  console.log(`\n🚀 MEMULAI UPDATE GHAIB (Pesan: "${msg}")...\n`);

  // ==========================================
  // TAHAP 1: UPDATE ANDROID (Akun Asli: rosyid99)
  // ==========================================
  console.log("==> 1. Konfigurasi untuk Android (rosyid99)...");
  appConfig.expo.owner = "rosyid99";
  appConfig.expo.extra.eas.projectId = "2bcc7a9d-77f3-4e2b-805a-5db5582ae283";
  appConfig.expo.updates.url = "https://u.expo.dev/2bcc7a9d-77f3-4e2b-805a-5db5582ae283";
  fs.writeFileSync(appJsonPath, JSON.stringify(appConfig, null, 2));

  console.log("==> Mengunggah ke Cloud Expo (Android)...");
  execSync(`eas update --branch preview --message "${msg}"`, {
    env: { ...process.env, EXPO_TOKEN: TOKEN_ANDROID },
    stdio: 'inherit'
  });
  console.log("✅ Update Android Selesai!\n");

  // ==========================================
  // TAHAP 2: UPDATE IOS (Akun Tumbal: admin-yeka)
  // ==========================================
  console.log("==> 2. Konfigurasi untuk iOS (admin-yeka)...");
  appConfig.expo.owner = "admin-yeka";
  appConfig.expo.extra.eas.projectId = "0435be94-6cd0-4d8b-acac-865ae059b930";
  appConfig.expo.updates.url = "https://u.expo.dev/0435be94-6cd0-4d8b-acac-865ae059b930";
  fs.writeFileSync(appJsonPath, JSON.stringify(appConfig, null, 2));

  console.log("==> Mengunggah ke Cloud Expo (iOS)...");
  execSync(`eas update --branch main --message "${msg}"`, {
    env: { ...process.env, EXPO_TOKEN: TOKEN_IOS },
    stdio: 'inherit'
  });
  console.log("✅ Update iOS Selesai!\n");

} catch (error) {
  console.error("❌ TERJADI KESALAHAN SAAT UPDATE:", error.message);
} finally {
  // ==========================================
  // TAHAP 3: KEMBALIKAN KE KONDISI SEMULA
  // ==========================================
  console.log("==> 3. Mengembalikan konfigurasi app.json...");
  if (originalAppJson) {
    const finalConfig = JSON.parse(originalAppJson);
    finalConfig.expo.owner = "rosyid99";
    finalConfig.expo.extra.eas.projectId = "2bcc7a9d-77f3-4e2b-805a-5db5582ae283";
    finalConfig.expo.updates.url = "https://u.expo.dev/2bcc7a9d-77f3-4e2b-805a-5db5582ae283";
    fs.writeFileSync(appJsonPath, JSON.stringify(finalConfig, null, 2));
  }
  console.log("🎉 SEMUA PROSES SELESAI!");
}
