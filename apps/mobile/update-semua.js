const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const { deployWebDirect } = require('./deploy-web-runner.js');

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

function resolveGhPagesCommand(baseDir = __dirname, platform = process.platform, deps = {}) {
  const fsImpl = deps.fs || (deps.existsSync ? deps : fs);
  const execSyncImpl = deps.execSync || (typeof deps === 'function' ? deps : execSync);
  const pathImpl = deps.path || (platform === 'win32' ? path.win32 : path.posix);

  const binName = platform === 'win32' ? 'gh-pages.cmd' : 'gh-pages';

  // 1. Periksa node_modules/.bin lokal
  const localBin = pathImpl.join(baseDir, 'node_modules', '.bin', binName);
  if (fsImpl.existsSync && fsImpl.existsSync(localBin)) {
    return `"${localBin}"`;
  }

  // 2. Periksa root monorepo
  const rootBin = pathImpl.resolve(baseDir, '../../node_modules/.bin', binName);
  if (fsImpl.existsSync && fsImpl.existsSync(rootBin)) {
    return `"${rootBin}"`;
  }

  // 3. Periksa PATH sistem
  try {
    const checkCmd = platform === 'win32' ? 'where gh-pages' : 'which gh-pages';
    execSyncImpl(checkCmd, { stdio: 'ignore' });
    return 'gh-pages';
  } catch {
    // tidak di PATH
  }

  // 4. Fallback npx
  return platform === 'win32' ? 'npx.cmd --yes gh-pages' : 'npx --yes gh-pages';
}

function resolveExpoExportCommand(baseDir = __dirname, platform = process.platform, deps = {}) {
  const fsImpl = deps.fs || (deps.existsSync ? deps : fs);
  const pathImpl = deps.path || (platform === 'win32' ? path.win32 : path.posix);

  const localBin = pathImpl.join(baseDir, 'node_modules', '.bin', platform === 'win32' ? 'expo.cmd' : 'expo');
  if (fsImpl.existsSync && fsImpl.existsSync(localBin)) {
    return `"${localBin}" export -p web`;
  }

  const rootBin = pathImpl.resolve(baseDir, '../../node_modules/.bin', platform === 'win32' ? 'expo.cmd' : 'expo');
  if (fsImpl.existsSync && fsImpl.existsSync(rootBin)) {
    return `"${rootBin}" export -p web`;
  }

  return platform === 'win32' ? 'npx.cmd --yes expo export -p web' : 'npx --yes expo export -p web';
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
    console.error("[ERROR] Token belum dimasukkan! Pastikan file .env telah dikonfigurasi.");
    process.exit(1);
  }

  const easCmd = resolveEasCommand(__dirname, process.platform);
  const expoExportCmd = resolveExpoExportCommand(__dirname, process.platform);

  console.log(`==> Executable EAS: ${easCmd}`);
  console.log(`==> Executable Expo Web Export: ${expoExportCmd}`);

  const appJsonPath = path.join(__dirname, 'app.json');
  let originalAppJson = '';

  const rawMsg = process.argv[2] || "Update Otomatis";
  const msg = rawMsg.replace(/^["']|["']$/g, '');
  console.log(`\n[PROSES] Memulai pembaruan sinkronisasi Android & iOS Web App (Pesan: "${msg}")...\n`);

  // ==========================================
  // TAHAP 1: UPDATE CLOUD EXPO (ANDROID)
  // ==========================================
  try {
    originalAppJson = fs.readFileSync(appJsonPath, 'utf8');
    const appConfig = JSON.parse(originalAppJson);

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
      env: { ...process.env, EXPO_TOKEN: TOKEN_ANDROID, CI: '1' },
      stdio: 'inherit'
    });

    console.log("==> Mengunggah ke Cloud Expo (Production)...");
    execSync(`${easCmd} update --branch production --message "${msg}" --environment production`, {
      cwd: __dirname,
      env: { ...process.env, EXPO_TOKEN: TOKEN_ANDROID, CI: '1' },
      stdio: 'inherit'
    });

    console.log("[SUKSES] Pembaruan Android ke Cloud Expo selesai.");
  } catch (error) {
    console.error("[ERROR] Terjadi kesalahan saat update Cloud Expo Android:", error.message);
  } finally {
    if (originalAppJson) {
      fs.writeFileSync(appJsonPath, originalAppJson);
      console.log("==> app.json berhasil dikembalikan ke posisi semula.");
    }
  }

  // ==========================================
  // TAHAP 2: UPDATE WEB APP IOS (GITHUB PAGES)
  // ==========================================
  try {
    console.log("\n==> 2. Membangun bundel Web App iOS (dist)...");
    execSync(expoExportCmd, {
      cwd: __dirname,
      stdio: 'inherit'
    });

    console.log("==> Mengunggah Web App iOS ke GitHub Pages (logbook-yeka-web)...");
    deployWebDirect(__dirname, msg);
    console.log("[SUKSES] Web App iOS berhasil dipublikasikan ke GitHub Pages!");
  } catch (error) {
    console.error("[ERROR] Terjadi kesalahan saat deploy Web App iOS ke GitHub Pages:", error.message);
  }

  console.log("\n[SELESAI] Seluruh rangkaian pembaruan Android & iOS Web App telah diproses.\n");
}

if (require.main === module) {
  runUpdate();
}

module.exports = {
  resolveEasCommand,
  resolveGhPagesCommand,
  resolveExpoExportCommand,
  runUpdate
};
