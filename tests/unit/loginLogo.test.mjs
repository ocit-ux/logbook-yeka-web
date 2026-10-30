import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('brandLogo module exports valid FALLBACK_LOGO_URI data URI', async () => {
  const brandLogoModule = await import('../../apps/mobile/src/utils/brandLogo.js');
  const { FALLBACK_LOGO_URI } = brandLogoModule;

  assert.strictEqual(typeof FALLBACK_LOGO_URI, 'string', 'FALLBACK_LOGO_URI must be a string');
  assert.ok(
    FALLBACK_LOGO_URI.startsWith('data:image/png;base64,'),
    'FALLBACK_LOGO_URI must start with data:image/png;base64,'
  );

  const base64Data = FALLBACK_LOGO_URI.replace('data:image/png;base64,', '');
  assert.ok(base64Data.length > 50000, 'FALLBACK_LOGO_URI payload must be substantial');

  const buffer = Buffer.from(base64Data, 'base64');
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.strictEqual(
    buffer.subarray(0, 8).equals(pngHeader),
    true,
    'Decoded base64 must match valid PNG signature header'
  );
});

test('getBrandLogoSource returns fallback data URI when hasError is true', async () => {
  const { FALLBACK_LOGO_URI, getBrandLogoSource } = await import('../../apps/mobile/src/utils/brandLogo.js');

  const fallbackSource = getBrandLogoSource(true);
  assert.deepStrictEqual(
    fallbackSource,
    { uri: FALLBACK_LOGO_URI },
    'getBrandLogoSource(true) must return { uri: FALLBACK_LOGO_URI }'
  );
});

test('getBrandLogoSource resolves asset require reference when hasError is false', async () => {
  const { getBrandLogoSource } = await import('../../apps/mobile/src/utils/brandLogo.js');

  // In test environment where global.require is mocked
  const originalRequire = globalThis.require;
  try {
    const mockAssetId = 9999;
    globalThis.require = (assetPath) => {
      if (assetPath === '../../assets/logo.png') {
        return mockAssetId;
      }
      throw new Error(`Unexpected require path: ${assetPath}`);
    };

    const sourceWithMock = getBrandLogoSource(false);
    assert.strictEqual(
      sourceWithMock,
      mockAssetId,
      'getBrandLogoSource(false) must return asset reference from require'
    );
  } finally {
    globalThis.require = originalRequire;
  }

  // Without mock require, it returns a valid fallback source object
  const defaultSource = getBrandLogoSource(false);
  assert.ok(defaultSource, 'getBrandLogoSource(false) must return a valid source');
  assert.ok(defaultSource.uri || typeof defaultSource === 'number', 'Source must have uri or be asset ID');
});

test('brandLogo.js source code compliance: zero em dashes and exact require path', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/utils/brandLogo.js');
  assert.strictEqual(fs.existsSync(filePath), true, 'brandLogo.js must exist');

  const content = fs.readFileSync(filePath, 'utf8');

  // Rule R-02
  assert.strictEqual(content.includes('\u2014'), false, 'brandLogo.js must contain zero em dashes');

  // Must reference ../../assets/logo.png
  assert.ok(
    content.includes('../../assets/logo.png'),
    'brandLogo.js must reference ../../assets/logo.png'
  );
});

test('loginLogo.test.mjs compliance: zero em dashes', () => {
  const testPath = path.join(rootDir, 'tests/unit/loginLogo.test.mjs');
  const content = fs.readFileSync(testPath, 'utf8');
  assert.strictEqual(content.includes('\u2014'), false, 'loginLogo.test.mjs must contain zero em dashes');
});
