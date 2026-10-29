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

test('app.json contract: experiments.baseUrl is removed to prevent native Android asset routing failure', () => {
  const appJsonPath = path.join(rootDir, 'apps/mobile/app.json');
  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  assert.strictEqual(
    appConfig.expo?.experiments?.baseUrl,
    undefined,
    'app.json must NOT define experiments.baseUrl statically'
  );
  assert.strictEqual(
    appConfig.expo?.experiments,
    undefined,
    'app.json must NOT define experiments statically'
  );
  assert.strictEqual(
    appConfig.expo?.runtimeVersion?.policy,
    'appVersion',
    'app.json runtimeVersion must use policy appVersion'
  );
  assert.strictEqual(
    appConfig.expo?.version,
    '1.0.0',
    'app.json version must remain 1.0.0'
  );
});

test('update-semua.js contract: isolates baseUrl by stripping experiments for Android EAS and injecting for web export', async () => {
  const updateScript = await import('../../apps/mobile/update-semua.js');
  const { prepareAndroidConfig, prepareWebConfig } = updateScript.default || updateScript;

  assert.strictEqual(typeof prepareAndroidConfig, 'function', 'prepareAndroidConfig must be exported');
  assert.strictEqual(typeof prepareWebConfig, 'function', 'prepareWebConfig must be exported');

  // Verify Android EAS preparation strips experiments.baseUrl
  const rawSample = {
    expo: {
      name: 'SyncInYEKA',
      experiments: {
        baseUrl: '/logbook-yeka-web'
      }
    }
  };
  const androidConfig = prepareAndroidConfig(rawSample);
  assert.strictEqual(
    androidConfig.expo?.experiments?.baseUrl,
    undefined,
    'prepareAndroidConfig must remove experiments.baseUrl for clean Android EAS bundling'
  );
  assert.strictEqual(
    androidConfig.expo?.experiments,
    undefined,
    'prepareAndroidConfig must remove empty experiments object'
  );
  assert.strictEqual(
    androidConfig.expo?.owner,
    'admin-yeka',
    'prepareAndroidConfig must set owner to admin-yeka'
  );

  // Verify Web export preparation injects baseUrl
  const cleanSample = {
    expo: {
      name: 'SyncInYEKA'
    }
  };
  const webConfig = prepareWebConfig(cleanSample);
  assert.strictEqual(
    webConfig.expo?.experiments?.baseUrl,
    '/logbook-yeka-web',
    'prepareWebConfig must inject experiments.baseUrl for GitHub Pages web export'
  );
});

test('update-semua.js contract: wraps web export with baseUrl injection and finally restoration', () => {
  const scriptPath = path.join(rootDir, 'apps/mobile/update-semua.js');
  const content = fs.readFileSync(scriptPath, 'utf8');

  // Verify dynamic baseUrl injection exists in script
  assert.match(
    content,
    /prepareWebConfig|baseUrl:\s*['"]\/logbook-yeka-web['"]/,
    'update-semua.js must dynamically inject baseUrl before web export'
  );

  // Verify restoration in finally block
  assert.match(
    content,
    /finally\s*\{[\s\S]*?writeFileSync\s*\(\s*appJsonPath/,
    'update-semua.js must restore app.json in finally block during web export'
  );
});

test('update-semua.js contract: uses admin-yeka authorized token for Cloud Expo updates', () => {
  const scriptPath = path.join(rootDir, 'apps/mobile/update-semua.js');
  const content = fs.readFileSync(scriptPath, 'utf8');

  // Verify admin-yeka authorized token (TOKEN_IOS = admin-yeka) is passed to Cloud Expo update commands
  assert.match(
    content,
    /EXPO_TOKEN:\s*EXPO_TOKEN_ADMIN_YEKA/,
    'update-semua.js must use EXPO_TOKEN_ADMIN_YEKA for admin-yeka EAS uploads'
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

test('Silent background download contract: fetches update without automatic reload on background check', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const content = fs.readFileSync(appJsPath, 'utf8');

  const checkAutoUpdateMatch = content.match(/const checkAutoUpdate = async \(\) => {([\s\S]*?)};/);
  assert.ok(checkAutoUpdateMatch, 'checkAutoUpdate function must be defined in App.js');
  const checkBody = checkAutoUpdateMatch[1];

  assert.ok(
    checkBody.includes('Updates.fetchUpdateAsync()'),
    'checkAutoUpdate must call Updates.fetchUpdateAsync to download silently in background'
  );
  assert.ok(
    checkBody.includes('setUpdateReady(true)'),
    'checkAutoUpdate must set updateReady state to true upon download completion'
  );
  assert.strictEqual(
    checkBody.includes('Updates.reloadAsync'),
    false,
    'checkAutoUpdate must NEVER call Updates.reloadAsync automatically during background check'
  );
});

test('Dual-option activation banner contract: Title, Description, Nanti dismiss, and Mulai Ulang triggers', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const content = fs.readFileSync(appJsPath, 'utf8');

  // 1. Banner Title
  assert.ok(
    content.includes('Pembaruan Sistem Siap'),
    'Update banner must display title "Pembaruan Sistem Siap"'
  );

  // 2. Banner Description
  assert.ok(
    content.includes('Versi baru telah diunduh dan akan aktif saat aplikasi dibuka kembali.'),
    'Update banner must explain non-disruptive activation on next launch'
  );

  // 3. Action 1: "Nanti" dismissing the banner
  assert.match(
    content,
    /<TouchableOpacity[\s\S]*?setUpdateReady\(false\)[\s\S]*?>[\s\S]*?Nanti[\s\S]*?<\/TouchableOpacity>/,
    'Update banner must provide "Nanti" action button that dismisses the banner'
  );

  // 4. Action 2: "Mulai Ulang" triggering guarded update restart
  assert.match(
    content,
    /<TouchableOpacity[\s\S]*?handleApplyUpdate[\s\S]*?>[\s\S]*?Mulai Ulang[\s\S]*?<\/TouchableOpacity>/,
    'Update banner must provide "Mulai Ulang" action button that invokes handleApplyUpdate'
  );
});

test('Guarded restart contract: sets isRestarting, unmounts screens, and handles rejection safely', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const content = fs.readFileSync(appJsPath, 'utf8');

  // 1. handleApplyUpdate sets states
  const handleApplyMatch = content.match(/const handleApplyUpdate = async \(\) => {([\s\S]*?)};/);
  assert.ok(handleApplyMatch, 'handleApplyUpdate must be defined');
  const handleApplyBody = handleApplyMatch[1];

  assert.ok(
    handleApplyBody.includes('setIsApplyingUpdate(true)'),
    'handleApplyUpdate must set isApplyingUpdate to true'
  );
  assert.ok(
    handleApplyBody.includes('setIsRestarting(true)'),
    'handleApplyUpdate must set isRestarting to true'
  );
  assert.ok(
    handleApplyBody.includes('setUpdateReady(false)'),
    'handleApplyUpdate must hide banner when restarting'
  );

  // 2. Error handling resets state safely
  assert.match(
    handleApplyBody,
    /try\s*\{[\s\S]*?Updates\.reloadAsync\(\)[\s\S]*?\}\s*catch[\s\S]*?setIsApplyingUpdate\(false\)[\s\S]*?setIsRestarting\(false\)/,
    'handleApplyUpdate must handle reloadAsync rejection safely and reset states'
  );

  // 3. Overlay and clean screen unmount
  assert.ok(
    content.includes('enterpriseRestartOverlay'),
    'App.js must render enterpriseRestartOverlay when isRestarting is true'
  );
  assert.ok(
    content.includes('Memulai Ulang Sistem'),
    'Restart overlay must display "Memulai Ulang Sistem"'
  );
  assert.match(
    content,
    /isRestarting\s*\?\s*\([\s\S]*?enterpriseRestartOverlay[\s\S]*?\)\s*:\s*!user\s*\?/,
    'App.js must unmount screens (Login and MainApp screens) while isRestarting is active'
  );
});

test('Typography Integrity: zero em dashes across updateManager test file', () => {
  const currentFileContent = fs.readFileSync(__filename, 'utf8');
  assert.strictEqual(currentFileContent.includes('\u2014'), false, 'updateManager.test.mjs must contain zero em dashes');
});
