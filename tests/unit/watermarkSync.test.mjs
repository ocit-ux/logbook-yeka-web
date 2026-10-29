import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectSubmissionCoords, isValidCoords } from '../../apps/mobile/src/utils/gnss.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('DashboardScreen source code contract: auto re-stamps photo with locked GPS before submission', () => {
  const dashPath = path.join(rootDir, 'apps/mobile/src/screens/DashboardScreen.js');
  const content = fs.readFileSync(dashPath, 'utf8');

  // Must import stampWatermarkNativeAsync
  assert.strictEqual(
    content.includes('stampWatermarkNativeAsync'),
    true,
    'DashboardScreen must import stampWatermarkNativeAsync'
  );

  // Must check if photo coords are missing/invalid while resolvedCoords is valid, and restamp
  assert.match(
    content,
    /stampWatermarkNativeAsync\s*\(\s*photo\.base64/,
    'submitAbsensi must re-stamp photo.base64 with resolvedCoords if photo was taken before lock'
  );

  // Zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'DashboardScreen.js must contain zero em dashes');
});

test('NativeCamera source code contract: attempts fast pre-capture GPS lookup before stamping', () => {
  const cameraPath = path.join(rootDir, 'apps/mobile/src/components/NativeCamera.js');
  const content = fs.readFileSync(cameraPath, 'utf8');

  // Must check for cached or fast position if watermarkMeta.location is missing
  assert.match(
    content,
    /@last_known_location|getLastKnownPositionAsync/,
    'NativeCamera must attempt fast location resolution if initial location was null'
  );

  // Zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'NativeCamera.js must contain zero em dashes');
});

test('Index.html source code contract: re-stamps canvas photo with locked GPS before cloud upload', () => {
  const indexPath = path.join(rootDir, 'apps/backend-gas/Index.html');
  const content = fs.readFileSync(indexPath, 'utf8');

  // Must preserve raw image source for re-stamping
  assert.match(
    content,
    /rawCapturedImageSource/,
    'Index.html must preserve raw photo source to enable re-stamping with locked GPS'
  );

  // Zero em dashes
  assert.strictEqual(content.includes('\u2014'), false, 'Index.html must contain zero em dashes');
});

test('Typography Integrity: zero em dashes across watermarkSync test file', () => {
  const currentFileContent = fs.readFileSync(__filename, 'utf8');
  assert.strictEqual(currentFileContent.includes('\u2014'), false, 'watermarkSync.test.mjs must contain zero em dashes');
});

