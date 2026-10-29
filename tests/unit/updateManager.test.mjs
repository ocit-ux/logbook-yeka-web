import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('App.json configuration contract: checkAutomatically NEVER to prevent SQLite database lock crash', () => {
  const appJsonPath = path.join(rootDir, 'apps/mobile/app.json');
  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  assert.strictEqual(
    appConfig.expo?.updates?.checkAutomatically,
    'NEVER',
    'app.json must set checkAutomatically to NEVER to eliminate native splash loader vs JS SQLite lock race'
  );
});

test('update-semua.js contract: uses TOKEN_ANDROID for Android cloud updates', () => {
  const scriptPath = path.join(rootDir, 'apps/mobile/update-semua.js');
  const content = fs.readFileSync(scriptPath, 'utf8');

  // Verify TOKEN_ANDROID is passed to Android update commands
  assert.match(
    content,
    /EXPO_TOKEN:\s*TOKEN_ANDROID/,
    'update-semua.js must use TOKEN_ANDROID for Android EAS uploads'
  );
});

test('App.js source code integration contract: safe enterprise auto-update without unannounced reload', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const content = fs.readFileSync(appJsPath, 'utf8');

  // 1. Must check and fetch in background
  assert.strictEqual(content.includes('Updates.checkForUpdateAsync'), true, 'Must check for updates');
  assert.strictEqual(content.includes('Updates.fetchUpdateAsync'), true, 'Must fetch updates in background');

  // 2. Must NOT call Updates.reloadAsync immediately after fetchUpdateAsync in checkAutoUpdate
  const checkAutoUpdateMatch = content.match(/const checkAutoUpdate = async \(\) => {([\s\S]*?)};/);
  assert.ok(checkAutoUpdateMatch, 'checkAutoUpdate must be defined');
  const checkBody = checkAutoUpdateMatch[1];
  assert.strictEqual(
    checkBody.includes('Updates.reloadAsync'),
    false,
    'checkAutoUpdate must NOT execute unannounced reloadAsync (causes force close)'
  );

  // 3. Must set update ready state and provide explicit apply handler
  assert.strictEqual(content.includes('setUpdateReady'), true, 'Must set updateReady state');
  assert.strictEqual(content.includes('handleApplyUpdate'), true, 'Must provide handleApplyUpdate user trigger');
  assert.strictEqual(content.includes('updateCard'), true, 'Must render enterprise updateCard banner');

  // 4. Must support dismiss/nanti action for seamless next-launch activation
  assert.strictEqual(content.includes('setUpdateReady(false)'), true, 'Must allow dismissing banner');

  // 5. Must provide enterprise restarting sequence overlay (no abrupt black screen / force close)
  assert.strictEqual(content.includes('isRestarting'), true, 'App.js must track isRestarting state');
  assert.strictEqual(content.includes('Memulai Ulang Sistem'), true, 'App.js must render Memulai Ulang Sistem enterprise screen');

  // 6. Must unmount active screens during isRestarting to teardown location watchers and camera
  assert.match(
    content,
    /isRestarting\s*\?\s*\(/,
    'App.js must unmount active screens during isRestarting to trigger native listener cleanup'
  );

  // 7. Zero emojis in update banner and restart screen
  assert.strictEqual(
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u.test(content),
    false,
    'App.js must contain zero emojis'
  );

  // 8. Zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'App.js must contain zero em dashes');
});

test('Typography Integrity: zero em dashes across updateManager test file', () => {
  const currentFileContent = fs.readFileSync(__filename, 'utf8');
  assert.strictEqual(currentFileContent.includes('\u2014'), false, 'updateManager.test.mjs must contain zero em dashes');
});
