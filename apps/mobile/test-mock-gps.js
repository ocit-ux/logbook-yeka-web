const assert = require('assert');

const isMockedLocation = (loc) => Boolean(loc?.mocked || loc?.coords?.mocked);

const generateSecurityStatus = (isMocked, isRooted) => {
  if (isMocked && isRooted) return '⚠️ TERDETEKSI FAKE GPS & ROOT';
  if (isMocked) return '⚠️ TERDETEKSI FAKE GPS';
  if (isRooted) return '⚠️ TERDETEKSI HP ROOT';
  return 'AMAN (GPS Asli)';
};

// 1. HP normal, GPS asli
assert.strictEqual(generateSecurityStatus(false, false), 'AMAN (GPS Asli)');

// 2. HP normal, Fake GPS aktif
assert.strictEqual(generateSecurityStatus(true, false), '⚠️ TERDETEKSI FAKE GPS');

// 3. HP Root, GPS asli
assert.strictEqual(generateSecurityStatus(false, true), '⚠️ TERDETEKSI HP ROOT');

// 4. HP Root + Fake GPS aktif
assert.strictEqual(generateSecurityStatus(true, true), '⚠️ TERDETEKSI FAKE GPS & ROOT');

// 5. Mock location detection helper
assert.strictEqual(isMockedLocation({ mocked: true }), true);
assert.strictEqual(isMockedLocation({ coords: { mocked: true } }), true);
assert.strictEqual(isMockedLocation({ mocked: false }), false);
assert.strictEqual(isMockedLocation(null), false);

console.log('Semua pengujian StatusKeamanan spreadsheet lolos!');
