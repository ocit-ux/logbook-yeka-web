const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

function resolveEasCommand(baseDir = __dirname, platform = process.platform, deps = {}) {
  const fsImpl = deps.fs || (deps.existsSync ? deps : fs);
  const execSyncImpl = deps.execSync || (typeof deps === 'function' ? deps : execSync);
  const pathImpl = deps.path || (platform === 'win32' ? path.win32 : path.posix);

  const binName = platform === 'win32' ? 'eas.cmd' : 'eas';

  // 1. Periksa node_modules/.bin lokal di direktori apps/mobile
  const localBin = pathImpl.join(baseDir, 'node_modules', '.bin', binName);
  if (fsImpl.existsSync && fsImpl.existsSync(localBin)) {
    return `"${localBin}"`;
  }

  // 2. Periksa root monorepo (../../node_modules/.bin)
  const rootBin = pathImpl.resolve(baseDir, '../../node_modules/.bin', binName);
  if (fsImpl.existsSync && fsImpl.existsSync(rootBin)) {
    return `"${rootBin}"`;
  }

  // 3. Periksa ketersediaan eas di system PATH
  try {
    const checkCmd = platform === 'win32' ? 'where eas' : 'which eas';
    execSyncImpl(checkCmd, { stdio: 'ignore' });
    return 'eas';
  } catch {
    // eas tidak ditemukan di PATH
  }

  // 4. Fallback ke npx runner
  return platform === 'win32' ? 'npx.cmd --yes eas-cli' : 'npx --yes eas-cli';
}

function runUpdate() {
  // 1. Ambil Token dari variabel environment atau file .env
  if (fs.existsSync(path.join(__dirname, '.env'))) {
    const lines = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n');
    lines.forEach(line => {
      const parts = line.trim().split('=');
      if (parts.length >= 2) {
        process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });
  }

  const TOKEN_ANDROID = process.env.EXPO_TOKEN_ANDROID || '';
  const TOKEN_IOS = process.env.EXPO_TOKEN_IOS || '';

  if (!TOKEN_ANDROID || !TOKEN_IOS) {
    console.error("❌ ERROR: Token belum dimasukkan! Pastikan Anda sudah mengisi file .env");
    process.exit(1);
  }

  const easCmd = resolveEasCommand(__dirname, process.platform);
  console.log(`==> Menggunakan executable EAS: ${easCmd}`);

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
    execSync(`${easCmd} update --branch preview --message "${msg}" --environment preview`, {
      cwd: __dirname,
      env: { ...process.env, EXPO_TOKEN: TOKEN_IOS, CI: '1' }, // Pake token iOS karena sekarang satu akun
      stdio: 'inherit'
    });

    console.log("==> Mengunggah ke Cloud Expo (Production)...");
    execSync(`${easCmd} update --branch production --message "${msg}" --environment production`, {
      cwd: __dirname,
      env: { ...process.env, EXPO_TOKEN: TOKEN_IOS, CI: '1' },
      stdio: 'inherit'
    });

    console.log("\n✅ SEMUA UPDATE SELESAI DENGAN SUKSES! Aplikasi pengguna akan otomatis terupdate saat dibuka ulang.\n");

  } catch (error) {
    console.error("\n❌ Terjadi kesalahan saat update:", error.message);
  } finally {
    // Selalu kembalikan app.json ke kondisi semula agar git tetap bersih
    if (originalAppJson) {
      fs.writeFileSync(appJsonPath, originalAppJson);
      console.log("==> app.json berhasil dikembalikan ke posisi semula.");
    }
  }
}

if (require.main === module) {
  runUpdate();
}

module.exports = {
  resolveEasCommand,
  runUpdate
};
