const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function deployWebDirect(baseDir = __dirname, customMsg = '') {
  // Baca token dari .env jika ada
  let token = process.env.GITHUB_TOKEN || '';
  const envPath = path.join(baseDir, '.env');
  if (!token && fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(l => {
      const parts = l.trim().split('=');
      if (parts[0].trim() === 'GITHUB_TOKEN' && parts[1]) {
        token = parts.slice(1).join('=').trim();
      }
    });
  }

  const distDir = path.join(baseDir, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('Folder dist tidak ditemukan! Jalankan expo export terlebih dahulu.');
  }

  // 1. Pastikan file .nojekyll ada
  const nojekyllPath = path.join(distDir, '.nojekyll');
  if (!fs.existsSync(nojekyllPath)) {
    fs.writeFileSync(nojekyllPath, '');
  }

  // 2. Bersihkan .git lama di dist jika ada
  const distGit = path.join(distDir, '.git');
  if (fs.existsSync(distGit)) {
    try {
      if (process.platform === 'win32') {
        execSync(`cmd /c rmdir /s /q "${distGit}"`, { stdio: 'ignore' });
      } else {
        execSync(`rm -rf "${distGit}"`, { stdio: 'ignore' });
      }
    } catch (_) {}
  }

  const repoUrl = token
    ? `https://${token}@github.com/ocit-ux/logbook-yeka-web.git`
    : 'https://github.com/ocit-ux/logbook-yeka-web.git';

  const msg = customMsg || 'Updates: Enterprise UI and GPS enhancements';

  console.log('==> Menyiapkan repositori git di folder dist...');
  execSync('git init', { cwd: distDir, stdio: 'ignore' });
  execSync('git config user.name "ocit-ux"', { cwd: distDir, stdio: 'ignore' });
  execSync('git config user.email "76835306+ocit-ux@users.noreply.github.com"', { cwd: distDir, stdio: 'ignore' });
  execSync(`git remote add origin ${repoUrl}`, { cwd: distDir, stdio: 'ignore' });
  execSync('git checkout -B main', { cwd: distDir, stdio: 'ignore' });
  execSync('git add -A', { cwd: distDir, stdio: 'ignore' });

  try {
    execSync(`git commit -m "${msg}"`, { cwd: distDir, stdio: 'ignore' });
  } catch (_) {}

  console.log('==> Mengunggah langsung ke GitHub Pages (branch main)...');
  execSync('git push -u origin main --force', { cwd: distDir, stdio: 'inherit' });
  console.log('[SUKSES] Web App iOS berhasil dipublikasikan ke GitHub Pages!');
}

if (require.main === module) {
  deployWebDirect();
}

module.exports = { deployWebDirect };

