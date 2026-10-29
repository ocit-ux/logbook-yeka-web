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
