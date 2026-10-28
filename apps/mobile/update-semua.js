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

  const rawMsg = process.argv[2] || "Update Otomatis";
  const msg = rawMsg.replace(/^["']|["']$/g, '');
  console.log(`\n🚀 MEMULAI UPDATE GHAIB (Pesan: "${msg}")...\n`);

  // ==========================================
  // UPDATE GHOIB KE EXPO (Akun: admin-yeka)
  // ==========================================
  console.log("==> 1. Konfigurasi App.json (admin-yeka)...");
  appConfig.expo.owner = "admin-yeka";
  if (!appConfig.expo.extra) appConfig.expo.extra = {};
  if (!appConfig.expo.extra.eas) appConfig.expo.extra.eas = {};
  appConfig.expo.extra.eas.projectId = "0435be94-6cd0-4d8b-acac-865ae059b930";
  
  if (!appConfig.expo.updates) appConfig.expo.updates = {};
  appConfig.expo.updates.url = "https://u.expo.dev/0435be94-6cd0-4d8b-acac-865ae059b930";
  
  fs.writeFileSync(appJsonPath, JSON.stringify(appConfig, null, 2));

  console.log("==> Mengunggah ke Cloud Expo (Preview)...");
  execSync(`eas update --branch preview --message "${msg}" --environment preview`, {
    cwd: __dirname,
    env: { ...process.env, EXPO_TOKEN: TOKEN_IOS, CI: '1' }, // Pake token iOS karena sekarang satu akun
    stdio: 'inherit'
  });

  console.log("==> Mengunggah ke Cloud Expo (Production)...");
  execSync(`eas update --branch production --message "${msg}" --environment production`, {
    cwd: __dirname,
    env: { ...process.env, EXPO_TOKEN: TOKEN_IOS, CI: '1' },
    stdio: 'inherit'
  });

  // ==========================================
  // UPDATE WEB KE GITHUB PAGES
  // ==========================================
  console.log("\n==> 2. Mengunggah Web ke GitHub Pages...");
  try {
    execSync(`npm run deploy:web`, { cwd: __dirname, stdio: 'inherit' });
    console.log("✅ Update Web Selesai!");
  } catch (webErr) {
    console.error("❌ Gagal mengunggah web:", webErr.message);
  }

  console.log("\n✅ Semua Update Selesai!\n");

} catch (error) {
  console.error("❌ TERJADI KESALAHAN SAAT UPDATE:", error.message);
} finally {
  // ==========================================
  // TAHAP 3: KEMBALIKAN KE KONDISI SEMULA
  // ==========================================
  console.log("==> 3. Mengembalikan konfigurasi app.json...");
  if (originalAppJson) {
    fs.writeFileSync(appJsonPath, originalAppJson);
  }
  console.log("🎉 SEMUA PROSES SELESAI!");
}
