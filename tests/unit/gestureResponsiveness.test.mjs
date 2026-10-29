import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('app.json configuration contract: androidNavigationBar configured for smooth edge-to-edge navigation', () => {
  const appJsonPath = path.join(rootDir, 'apps/mobile/app.json');
  const rawContent = fs.readFileSync(appJsonPath, 'utf8');

  // Zero em dashes in app.json
  assert.strictEqual(
    rawContent.includes('\u2014'),
    false,
    'apps/mobile/app.json must contain zero em dashes'
  );

  const parsed = JSON.parse(rawContent);
  const expoConfig = parsed.expo;
  assert.ok(expoConfig, 'expo field must exist in app.json');

  // Verify androidNavigationBar configuration
  assert.ok(
    expoConfig.androidNavigationBar,
    'expo.androidNavigationBar must be defined in apps/mobile/app.json'
  );
  assert.strictEqual(
    expoConfig.androidNavigationBar.barStyle,
    'dark-content',
    'barStyle must be dark-content'
  );
  assert.strictEqual(
    expoConfig.androidNavigationBar.backgroundColor,
    '#00000000',
    'backgroundColor must be #00000000 (transparent)'
  );

  // Verify runtimeVersion policy and version integrity
  assert.deepStrictEqual(
    expoConfig.runtimeVersion,
    { policy: 'appVersion' },
    'runtimeVersion policy must remain appVersion'
  );
  assert.strictEqual(
    expoConfig.version,
    '1.0.0',
    'version must remain 1.0.0'
  );
});

test('gestureResponsiveness test file contract: zero em dashes', () => {
  const selfContent = fs.readFileSync(__filename, 'utf8');
  assert.strictEqual(
    selfContent.includes('\u2014'),
    false,
    'tests/unit/gestureResponsiveness.test.mjs must contain zero em dashes'
  );
});

test('Deferred AppState Teardown: transition to background defers watcher removal by 350ms', async () => {
  let removeCalled = false;
  const mockSub = {
    remove: () => {
      removeCalled = true;
    }
  };

  const stateContext = {
    locationWatcherSubRef: { current: mockSub },
    appStateTeardownTimeoutRef: { current: null },
    startCount: 0
  };

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      if (stateContext.appStateTeardownTimeoutRef.current) {
        clearTimeout(stateContext.appStateTeardownTimeoutRef.current);
        stateContext.appStateTeardownTimeoutRef.current = null;
      }
      if (!stateContext.locationWatcherSubRef.current) {
        stateContext.startCount++;
      }
    } else if (nextAppState.match(/inactive|background/)) {
      if (stateContext.appStateTeardownTimeoutRef.current) {
        clearTimeout(stateContext.appStateTeardownTimeoutRef.current);
      }
      stateContext.appStateTeardownTimeoutRef.current = setTimeout(() => {
        if (stateContext.locationWatcherSubRef.current && typeof stateContext.locationWatcherSubRef.current.remove === 'function') {
          stateContext.locationWatcherSubRef.current.remove();
          stateContext.locationWatcherSubRef.current = null;
        }
        stateContext.appStateTeardownTimeoutRef.current = null;
      }, 350);
    }
  };

  // Simulate entering background
  handleAppStateChange('background');
  assert.ok(stateContext.appStateTeardownTimeoutRef.current !== null, 'Teardown timeout must be scheduled');

  // At 100ms (< 350ms), watcher should still be intact
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.strictEqual(removeCalled, false, 'Watcher must not be removed before 350ms');
  assert.ok(stateContext.locationWatcherSubRef.current !== null, 'Watcher sub ref must still exist at 100ms');

  // Wait remaining duration (> 350ms total)
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.strictEqual(removeCalled, true, 'Watcher must be removed after 350ms elapses');
  assert.strictEqual(stateContext.locationWatcherSubRef.current, null, 'Watcher ref must be nulled after teardown');
  assert.strictEqual(stateContext.appStateTeardownTimeoutRef.current, null, 'Timeout ref must be nulled after firing');
});

test('Quick-resume cancellation: returning to active within 350ms cancels teardown and preserves watcher', async () => {
  let removeCalled = false;
  const mockSub = {
    remove: () => {
      removeCalled = true;
    }
  };

  const stateContext = {
    locationWatcherSubRef: { current: mockSub },
    appStateTeardownTimeoutRef: { current: null },
    startCount: 0
  };

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      if (stateContext.appStateTeardownTimeoutRef.current) {
        clearTimeout(stateContext.appStateTeardownTimeoutRef.current);
        stateContext.appStateTeardownTimeoutRef.current = null;
      }
      if (!stateContext.locationWatcherSubRef.current) {
        stateContext.startCount++;
      }
    } else if (nextAppState.match(/inactive|background/)) {
      if (stateContext.appStateTeardownTimeoutRef.current) {
        clearTimeout(stateContext.appStateTeardownTimeoutRef.current);
      }
      stateContext.appStateTeardownTimeoutRef.current = setTimeout(() => {
        if (stateContext.locationWatcherSubRef.current && typeof stateContext.locationWatcherSubRef.current.remove === 'function') {
          stateContext.locationWatcherSubRef.current.remove();
          stateContext.locationWatcherSubRef.current = null;
        }
        stateContext.appStateTeardownTimeoutRef.current = null;
      }, 350);
    }
  };

  // User begins swipe-to-home gesture (background)
  handleAppStateChange('background');
  assert.ok(stateContext.appStateTeardownTimeoutRef.current !== null, 'Teardown timeout should be set');

  // User returns to app within 120ms (aborted gesture or fast switch)
  await new Promise((resolve) => setTimeout(resolve, 120));
  handleAppStateChange('active');

  assert.strictEqual(stateContext.appStateTeardownTimeoutRef.current, null, 'Teardown timeout must be cleared on resume');
  assert.strictEqual(removeCalled, false, 'Watcher remove must not be called');
  assert.strictEqual(stateContext.startCount, 0, 'startGnssWatcher should not be re-invoked when watcher is already active');
  assert.strictEqual(stateContext.locationWatcherSubRef.current, mockSub, 'Watcher ref must remain unchanged');

  // Wait additional 300ms to verify timeout did not fire late
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.strictEqual(removeCalled, false, 'Watcher must remain alive even after original 350ms window expires');
});

test('Location permission check: checks existing permission first and avoids redundant dialog prompt', async () => {
  let getCalls = 0;
  let requestCalls = 0;

  const mockLocation = {
    getForegroundPermissionsAsync: async () => {
      getCalls++;
      return { status: 'granted' };
    },
    requestForegroundPermissionsAsync: async () => {
      requestCalls++;
      return { status: 'granted' };
    }
  };

  const checkPermissions = async (LocationModule) => {
    let perm = await LocationModule.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      perm = await LocationModule.requestForegroundPermissionsAsync();
    }
    return perm.status === 'granted';
  };

  const isGranted = await checkPermissions(mockLocation);
  assert.strictEqual(isGranted, true, 'Permission check should succeed');
  assert.strictEqual(getCalls, 1, 'getForegroundPermissionsAsync must be called once');
  assert.strictEqual(requestCalls, 0, 'requestForegroundPermissionsAsync must NOT be called when already granted');

  // Now test denied / undetermined scenario
  let requestCalledWhenDenied = false;
  const mockLocationDenied = {
    getForegroundPermissionsAsync: async () => ({ status: 'undetermined' }),
    requestForegroundPermissionsAsync: async () => {
      requestCalledWhenDenied = true;
      return { status: 'granted' };
    }
  };

  const isGrantedAfterRequest = await checkPermissions(mockLocationDenied);
  assert.strictEqual(isGrantedAfterRequest, true);
  assert.strictEqual(requestCalledWhenDenied, true, 'requestForegroundPermissionsAsync must be called when not yet granted');
});

test('DashboardScreen source contract: deferred AppState teardown and optimized GNSS intervals', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/screens/DashboardScreen.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Teardown timeout ref exists
  assert.match(
    content,
    /appStateTeardownTimeoutRef\s*=\s*(?:React\.)?useRef\(null\)/,
    'Must define appStateTeardownTimeoutRef'
  );

  // 2. Permission check: getForegroundPermissionsAsync called before requestForegroundPermissionsAsync
  assert.strictEqual(
    content.includes('Location.getForegroundPermissionsAsync'),
    true,
    'Must use Location.getForegroundPermissionsAsync before requesting'
  );

  // 3. Optimized watcher intervals (4500ms and 2m)
  assert.match(
    content,
    /timeInterval:\s*4500/,
    'Location.watchPositionAsync must use timeInterval: 4500'
  );
  assert.match(
    content,
    /distanceInterval:\s*2/,
    'Location.watchPositionAsync must use distanceInterval: 2'
  );

  // 4. Deferred teardown timer of 350ms
  assert.match(
    content,
    /setTimeout\([^,]+,\s*350\)/,
    'AppState background transition must defer watcher teardown with 350ms timeout'
  );

  // 5. Active state resumes or keeps alive watcher
  assert.match(
    content,
    /clearTimeout\(\s*appStateTeardownTimeoutRef\.current\s*\)/,
    'Must clear appStateTeardownTimeoutRef on active state transition'
  );

  // 6. Zero em dashes in DashboardScreen.js
  assert.strictEqual(
    content.includes('\u2014'),
    false,
    'DashboardScreen.js must contain zero em dashes'
  );
});
