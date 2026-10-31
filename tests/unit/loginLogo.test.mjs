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

test('getBrandLogoSource(true) returns fallback data URI even when globalThis.require is defined', async () => {
  const { FALLBACK_LOGO_URI, getBrandLogoSource } = await import('../../apps/mobile/src/utils/brandLogo.js');

  const originalRequire = globalThis.require;
  try {
    globalThis.require = () => 12345;
    const result = getBrandLogoSource(true);
    assert.deepStrictEqual(
      result,
      { uri: FALLBACK_LOGO_URI },
      'getBrandLogoSource(true) must return { uri: FALLBACK_LOGO_URI } even when globalThis.require is defined'
    );
    assert.notStrictEqual(result, 12345, 'Must not return asset ID when hasError is true');
  } finally {
    globalThis.require = originalRequire;
  }
});

test('FALLBACK_LOGO_URI payload matches assets/logo.png binary exactly', async () => {
  const { FALLBACK_LOGO_URI } = await import('../../apps/mobile/src/utils/brandLogo.js');
  const logoPath = path.join(rootDir, 'apps/mobile/assets/logo.png');
  const fileBuf = fs.readFileSync(logoPath);
  const base64Data = FALLBACK_LOGO_URI.replace('data:image/png;base64,', '');
  const decodedBuf = Buffer.from(base64Data, 'base64');
  assert.strictEqual(
    fileBuf.equals(decodedBuf),
    true,
    'Decoded buffer must match apps/mobile/assets/logo.png binary exactly'
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

test('LoginScreen.js imports getBrandLogoSource and implements logo error state', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/screens/LoginScreen.js');
  assert.strictEqual(fs.existsSync(filePath), true, 'LoginScreen.js must exist');

  const content = fs.readFileSync(filePath, 'utf8');

  // Rule R-02
  assert.strictEqual(content.includes('\u2014'), false, 'LoginScreen.js must contain zero em dashes');

  // Import getBrandLogoSource
  assert.ok(
    content.includes("import { getBrandLogoSource } from '../utils/brandLogo';") ||
    content.includes('import { getBrandLogoSource } from "../utils/brandLogo";'),
    'LoginScreen.js must import getBrandLogoSource from ../utils/brandLogo'
  );

  // logoError state
  assert.ok(
    content.includes('const [logoError, setLogoError] = useState(false);'),
    'LoginScreen.js must declare logoError state with useState(false)'
  );
});

test('LoginScreen.js renders Option B Executive Gold Halo structure with error handler', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/screens/LoginScreen.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify haloWrapper wraps logoImage and handles onError
  assert.ok(
    content.includes('styles.haloWrapper'),
    'LoginScreen.js must render element with styles.haloWrapper'
  );
  assert.ok(
    content.includes('source={getBrandLogoSource(logoError)}'),
    'LoginScreen.js Image source must use getBrandLogoSource(logoError)'
  );
  assert.ok(
    content.includes('style={styles.logoImage}'),
    'LoginScreen.js Image must use styles.logoImage'
  );
  assert.ok(
    content.includes('onError={() => setLogoError(true)}'),
    'LoginScreen.js Image must have onError handler setting logoError to true'
  );
  assert.ok(
    content.includes('resizeMode="contain"'),
    'LoginScreen.js Image must have resizeMode="contain"'
  );
});

test('LoginScreen.js defines Executive Gold Halo and subtitle styling contracts', () => {
  const filePath = path.join(rootDir, 'apps/mobile/src/screens/LoginScreen.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // haloWrapper styles
  assert.ok(content.includes('width: 94'), 'haloWrapper must have width: 94');
  assert.ok(content.includes('height: 94'), 'haloWrapper must have height: 94');
  assert.ok(content.includes('borderRadius: 47'), 'haloWrapper must have borderRadius: 47');
  assert.ok(
    content.includes("backgroundColor: 'rgba(212, 175, 55, 0.12)'") ||
    content.includes('backgroundColor: "rgba(212, 175, 55, 0.12)"'),
    'haloWrapper must have golden translucent background'
  );
  assert.ok(content.includes('borderWidth: 1.5'), 'haloWrapper must have borderWidth: 1.5');
  assert.ok(
    content.includes("borderColor: 'rgba(212, 175, 55, 0.45)'") ||
    content.includes('borderColor: "rgba(212, 175, 55, 0.45)"'),
    'haloWrapper must have golden border'
  );
  assert.ok(content.includes('marginBottom: 14'), 'haloWrapper must have marginBottom: 14');
  assert.ok(content.includes('shadowOpacity: 0.35'), 'haloWrapper must have shadowOpacity: 0.35');
  assert.ok(content.includes('shadowRadius: 10'), 'haloWrapper must have shadowRadius: 10');
  assert.ok(content.includes('elevation: 8'), 'haloWrapper must have elevation: 8');

  // logoImage styles
  assert.ok(content.includes('width: 76'), 'logoImage must have width: 76');
  assert.ok(content.includes('height: 76'), 'logoImage must have height: 76');

  // appSubtitle gold styles
  assert.ok(content.includes('fontSize: 11'), 'appSubtitle must have fontSize: 11');
  assert.ok(
    content.includes("color: '#d4af37'") || content.includes('color: "#d4af37"'),
    'appSubtitle must have executive gold color #d4af37'
  );
  assert.ok(content.includes('letterSpacing: 0.8'), 'appSubtitle must have letterSpacing: 0.8');
  assert.ok(
    content.includes("textTransform: 'uppercase'") || content.includes('textTransform: "uppercase"'),
    'appSubtitle must have uppercase transform'
  );
});

test('loginLogo.test.mjs compliance: zero em dashes', () => {
  const testPath = path.join(rootDir, 'tests/unit/loginLogo.test.mjs');
  const content = fs.readFileSync(testPath, 'utf8');
  assert.strictEqual(content.includes('\u2014'), false, 'loginLogo.test.mjs must contain zero em dashes');
});
