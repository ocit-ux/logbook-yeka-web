# Geo-Timestamp Photo Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanently embed a Geo-Timestamp watermark banner containing organization name, staff details, WIB timestamp, and GPS coordinates/location onto all captured attendance photos across Android, iOS Web, and Web Apps GAS before upload to Google Drive.

**Architecture:** Client-side pre-upload image stamping. On Web (iOS Safari & Web Apps GAS), HTML5 Canvas 2D renders a semi-transparent banner, gold accent bar, and metadata text before JPEG serialization. On Android, a pure-JavaScript RGBA pixel compositor with an embedded bitmap glyph renderer decodes and re-encodes via `jpeg-js` (with a lightweight Hermes Buffer shim), ensuring 100% OTA (`eas update`) compatibility with zero new native modules. A cached reverse-geocoding endpoint in `Code.gs` provides Indonesian village/district names while maintaining robust offline coordinate fallback.

**Tech Stack:** React Native (Expo SDK 57), HTML5 Canvas 2D, `jpeg-js` (pure JS), Google Apps Script (`Maps.newGeocoder`, `CacheService`), Node.js `node:test` test runner.

**Spec:** [`docs/superpowers/specs/2026-10-29-photo-watermark-design.md`](../specs/2026-10-29-photo-watermark-design.md)

## Global Constraints

- Android OTA Compatibility: Zero new native React Native modules or pod/gradle dependencies; existing `runtimeVersion` `1.0.0` must remain valid for `eas update`.
- Anti-Blank Integrity: Camera black-frame detection must always execute before watermark application so pitch-black frames cannot pass validation due to watermark pixels.
- Typography & Anti-Slop: No em dashes (`—`) permitted anywhere in UI or watermark copy; use `|`, `:`, `,`, or `-`.
- Photo Dimension Limits: Maximum output width 1000px on mobile (`NativeCamera.js`, `WebCamera.js`) and 1024px on GAS (`Index.html`).
- Offline Resilience: Offline field captures must never fail; if reverse-geocoded wilayah is unavailable, the banner displays exact GPS coordinates and capture time without breaking.

## Review Focus

1. **Hermes Buffer Missing:** `jpeg-js` encoder calling `Buffer.from` in React Native Hermes causes `ReferenceError: Property 'Buffer' doesn't exist`. Expected: A minimal Uint8Array Buffer shim is installed before encoding. (Covered in Task 2 & Task 3).
2. **Black Photo Bypassing Anti-Blank:** Drawing bright watermark text onto a covered lens capture might inflate base64 size above 6000 bytes. Expected: Brightness/size check runs on raw photo before watermark. (Covered in Task 4, 5, 6).
3. **Very Long Staff Name or Wilayah Overflow:** Long names or multi-word administrative areas clipping outside the right edge of the 1000px photo. Expected: Text truncation or word-wrapping ensures text stays within image bounds with right padding. (Covered in Task 2 & 3).
4. **Offline Remote Area GPS-Only:** Capturing when internet is disconnected and geocoding server cannot be reached. Expected: Graceful omission of village name, cleanly displaying `GPS: -6.123456, 106.123456` with no `undefined` or `null` text. (Covered in Task 3 & Task 5).
5. **Anti-Duplicate Check in Backend:** `Code.gs` tail check comparing last 200 base64 characters failing if multiple photos taken at the exact same second. Expected: Capture timestamp formatted down to seconds ensures uniqueness. (Covered in Task 1 & 3).

---

### Task 1: Backend Reverse Geocoding Endpoint & Cache in `Code.gs`

**Files:**
- Modify: `apps/backend-gas/Code.gs:240-270` (in `doPost`), and append helper `getWilayahClient` around line 475.
- Test: `tests/backend/reverseGeocode.test.js`

**Interfaces:**
- Consumes: Existing [`getWilayahDariGPS_(gpsStr)`](../../apps/backend-gas/Code.gs#L439) in `Code.gs`.
- Produces: 
  - HTTP POST action `reverseGeocode`: `{ action: "reverseGeocode", gps: "-6.2088,106.8456" }` -> `{ status: "success", data: { desa: "...", kecamatan: "...", kabupaten: "..." } }`.
  - Client script helper: `getWilayahClient(gpsStr)` returning formatted string `Desa, Kecamatan, Kabupaten`.

- [ ] **Step 1: Write unit test simulating `reverseGeocode` action and caching logic**

Create `tests/backend/reverseGeocode.test.js` exercising cache key formatting (`wil_v1_${lat.toFixed(3)}_${lng.toFixed(3)}`) and output validation.

```javascript
import test from 'node:test';
import assert from 'node:assert';

test('reverseGeocode cache key rounds coordinates to 3 decimals (~110m grid)', () => {
  const formatCacheKey = (lat, lng) => `wil_v1_${Number(lat).toFixed(3)}_${Number(lng).toFixed(3)}`;
  assert.strictEqual(formatCacheKey(-6.208765, 106.845591), 'wil_v1_-6.209_106.846');
  assert.strictEqual(formatCacheKey(-6.208711, 106.845622), 'wil_v1_-6.209_106.846');
});

test('formats wilayah object to display string cleanly without em dashes', () => {
  const formatWilayah = ({ desa, kecamatan, kabupaten }) => {
    const parts = [desa, kecamatan, kabupaten].filter(p => p && p !== '-');
    return parts.length > 0 ? parts.join(', ') : '';
  };
  assert.strictEqual(formatWilayah({ desa: 'Pancoran', kecamatan: 'Pancoran', kabupaten: 'Jakarta Selatan' }), 'Pancoran, Pancoran, Jakarta Selatan');
  assert.strictEqual(formatWilayah({ desa: '-', kecamatan: '-', kabupaten: '-' }), '');
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/backend/reverseGeocode.test.js`
Expected: PASS

- [ ] **Step 3: Implement `reverseGeocode` in `apps/backend-gas/Code.gs`**

In `doPost(e)` of `Code.gs`:
1. Check `if (action === 'reverseGeocode')`.
2. Extract `data.gps` (or `e.parameter.gps`).
3. Query `CacheService.getScriptCache()`. If found, return JSON.
4. If not found, call `getWilayahDariGPS_(gpsStr)`, cache for 21600 seconds (6 hours), and return JSON response.
5. Add `function getWilayahClient(gpsStr)` for direct call via `google.script.run`.

- [ ] **Step 4: Verify syntax and behavior of Code.gs edits**

Run: `node -c apps/backend-gas/Code.gs` (or verify with AST parser)
Expected: Clean exit (code 0).

- [ ] **Step 5: Commit**

```bash
git add apps/backend-gas/Code.gs tests/backend/reverseGeocode.test.js
git commit -m "feat(backend): add cached reverseGeocode action and client helper"
```

---

### Task 2: Pure-JS Bitmap Font & Glyph Renderer in `apps/mobile/src/utils/bitmapFont.js`

**Files:**
- Create: `apps/mobile/src/utils/bitmapFont.js`
- Test: `tests/watermark/bitmapFont.test.js`

**Interfaces:**
- Consumes: Nothing (self-contained standard ASCII 32-126 5x7 / 6x8 bitmap font matrix).
- Produces:
  - `drawText(rgbaBuffer, imgWidth, imgHeight, text, startX, startY, options)`
  - Options: `{ scale: 2, color: [r, g, b, a], maxWidth: number }`
  - Returns: `{ nextY, textWidth }`

- [ ] **Step 1: Write test for `bitmapFont.js` text rendering and word wrap**

Create `tests/watermark/bitmapFont.test.js` testing pixel modification and wrapping.

```javascript
import test from 'node:test';
import assert from 'node:assert';
import { drawText, measureText } from '../../apps/mobile/src/utils/bitmapFont.js';

test('measureText calculates correct pixel dimensions for scale', () => {
  const dims = measureText('YEKA', 2);
  assert.strictEqual(dims.width > 0, true);
  assert.strictEqual(dims.height, 7 * 2);
});

test('drawText burns pixels into RGBA buffer at designated coordinates', () => {
  const width = 100;
  const height = 50;
  const buffer = new Uint8Array(width * height * 4); // all black/transparent
  
  drawText(buffer, width, height, 'A', 10, 10, { scale: 1, color: [255, 255, 255, 255] });
  
  // Verify at least one pixel turned white [255, 255, 255, 255]
  let hasWhite = false;
  for (let i = 0; i < buffer.length; i += 4) {
    if (buffer[i] === 255 && buffer[i+1] === 255 && buffer[i+2] === 255) {
      hasWhite = true;
      break;
    }
  }
  assert.strictEqual(hasWhite, true);
});
```

- [ ] **Step 2: Run test to verify it fails before implementation**

Run: `node --test tests/watermark/bitmapFont.test.js`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `apps/mobile/src/utils/bitmapFont.js`**

Implement a crisp 5x7 bitmap font covering ASCII 32 through 126 (capital/lowercase letters, digits, punctuation `: , . - | / ( )`).
Provide `measureText(text, scale)` and `drawText(buffer, width, height, text, startX, startY, { scale, color, maxWidth })`.
Ensure any character outside ASCII 32-126 falls back to `?` or nearest equivalent without throwing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/watermark/bitmapFont.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/bitmapFont.js tests/watermark/bitmapFont.test.js
git commit -m "feat(mobile): add embedded pure-JS bitmap font renderer"
```

---

### Task 3: Watermark Core Generator in `apps/mobile/src/utils/watermark.js`

**Files:**
- Create: `apps/mobile/src/utils/watermark.js`
- Test: `tests/watermark/watermark.test.js`

**Interfaces:**
- Consumes: `bitmapFont.js`, `jpeg-js` (from `node_modules/jpeg-js`).
- Produces:
  - `ensureHermesBufferShim()`: Polyfills `globalThis.Buffer` with Uint8Array methods if missing.
  - `formatWatermarkLines(metadata)`: Formats 4 lines of metadata `{ header, staff, timestamp, location }`.
  - `stampWatermarkNativeAsync(jpegBase64, metadata)`: Decodes JPEG, draws dark banner (`rgba(15, 23, 42, 0.76)`), gold vertical bar (`#d4af37`), and text via `bitmapFont`, encodes to JPEG quality 75, returns `{ uri: 'data:image/jpeg;base64,' + base64, base64 }`.
  - `stampWatermarkCanvas(canvas, metadata)`: Canvas 2D equivalent for web environments.

- [ ] **Step 1: Write failing unit test for `watermark.js`**

Create `tests/watermark/watermark.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert';
import { formatWatermarkLines, ensureHermesBufferShim, stampWatermarkNativeAsync } from '../../apps/mobile/src/utils/watermark.js';
import jpeg from 'jpeg-js';

test('formatWatermarkLines constructs four lines without em dashes', () => {
  const meta = {
    user: { nama: 'Budi Santoso', devisi: 'Program Konservasi' },
    date: new Date('2026-10-29T14:30:00+07:00'),
    coords: { latitude: -6.2088, longitude: 106.8456 },
    wilayah: 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor'
  };
  const lines = formatWatermarkLines(meta);
  assert.strictEqual(lines.header, 'YAYASAN ELANG KATULISTIWA ADIPAVITRA');
  assert.strictEqual(lines.staff, 'Budi Santoso | Program Konservasi');
  assert.match(lines.timestamp, /WIB$/);
  assert.strictEqual(lines.location, 'GPS: -6.208800, 106.845600');
  assert.strictEqual(lines.wilayah, 'Desa Sukamaju, Kec. Ciawi, Kab. Bogor');
  assert.strictEqual(JSON.stringify(lines).includes('—'), false);
});

test('ensureHermesBufferShim provides Buffer.from and Buffer.alloc', () => {
  ensureHermesBufferShim();
  assert.strictEqual(typeof globalThis.Buffer !== 'undefined', true);
  const buf = globalThis.Buffer.from([1, 2, 3]);
  assert.strictEqual(buf instanceof Uint8Array, true);
});

test('stampWatermarkNativeAsync embeds watermark onto a valid JPEG base64', async () => {
  // Create a minimal 200x200 JPEG image for testing
  const rawData = new Uint8Array(200 * 200 * 4);
  for (let i = 0; i < rawData.length; i += 4) {
    rawData[i] = 100;     // R
    rawData[i + 1] = 120; // G
    rawData[i + 2] = 140; // B
    rawData[i + 3] = 255; // A
  }
  const testJpeg = jpeg.encode({ data: rawData, width: 200, height: 200 }, 70);
  const base64Input = Buffer.from(testJpeg.data).toString('base64');

  const result = await stampWatermarkNativeAsync(base64Input, {
    user: { nama: 'Test User', devisi: 'Staff' },
    date: new Date(),
    coords: { latitude: -0.123456, longitude: 109.123456 },
    wilayah: 'Pontianak Barat, Kota Pontianak'
  });

  assert.strictEqual(typeof result.base64 === 'string', true);
  assert.strictEqual(result.base64.length > 1000, true);
  assert.strictEqual(result.uri.startsWith('data:image/jpeg;base64,'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/watermark/watermark.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `apps/mobile/src/utils/watermark.js`**

Implement:
1. `ensureHermesBufferShim()`: safe polyfill for React Native Hermes.
2. `formatWatermarkLines(meta)`: format date to WIB, format coords to 6 decimal places, format organization title.
3. `stampWatermarkNativeAsync(jpegBase64, metadata)`:
   - Decode JPEG into RGBA using `{ useTArray: true, formatAsRGBA: true }`.
   - Alpha-blend dark banner `rgba(15, 23, 42, 0.76)` on bottom ~15% rows.
   - Draw gold accent bar (`#d4af37`, width 4-6px).
   - Draw metadata lines using `bitmapFont.drawText`.
   - Encode back to JPEG quality 75.
   - Return `{ uri, base64 }`.
4. `stampWatermarkCanvas(canvas, metadata)`:
   - Draw dark rect, gold rect, and text on HTML5 Canvas.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/watermark/watermark.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/watermark.js tests/watermark/watermark.test.js
git commit -m "feat(mobile): implement core native and canvas watermark generator"
```

---

### Task 4: Web Camera & Web App iOS Integration

**Files:**
- Modify: `apps/mobile/src/components/WebCamera.js:5-15, 110-165`
- Modify: `apps/mobile/src/screens/DashboardScreen.js:690-700`
- Test: `tests/watermark/webCameraWatermark.test.js`

**Interfaces:**
- Consumes: `stampWatermarkCanvas` from `apps/mobile/src/utils/watermark.js`.
- Produces: `WebCamera` component accepting prop `watermarkMeta`, applying watermark to canvas before `toDataURL('image/jpeg', 0.55)` and passing stamped result to `onCapture`.

- [ ] **Step 1: Write test for WebCamera canvas watermarking flow**

Create `tests/watermark/webCameraWatermark.test.js` verifying `stampWatermarkCanvas` handles canvas dimensions and preserves anti-black check order.

```javascript
import test from 'node:test';
import assert from 'node:assert';
import { stampWatermarkCanvas, formatWatermarkLines } from '../../apps/mobile/src/utils/watermark.js';

test('stampWatermarkCanvas executes without error on mock canvas context', () => {
  const operations = [];
  const mockCtx = {
    fillStyle: '',
    fillRect: (x, y, w, h) => operations.push({ op: 'fillRect', x, y, w, h }),
    fillText: (text, x, y) => operations.push({ op: 'fillText', text, x, y }),
    font: '',
    measureText: (t) => ({ width: t.length * 8 })
  };
  const mockCanvas = {
    width: 1000,
    height: 750,
    getContext: () => mockCtx
  };

  stampWatermarkCanvas(mockCanvas, {
    user: { nama: 'Jane Doe', devisi: 'IT' },
    date: new Date(),
    coords: { latitude: -6.1, longitude: 106.8 }
  });

  const fillRects = operations.filter(o => o.op === 'fillRect');
  const fillTexts = operations.filter(o => o.op === 'fillText');
  
  assert.strictEqual(fillRects.length >= 2, true); // Banner + Gold stripe
  assert.strictEqual(fillTexts.length >= 4, true);  // 4 lines of text
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/watermark/webCameraWatermark.test.js`
Expected: PASS

- [ ] **Step 3: Modify `apps/mobile/src/components/WebCamera.js`**

1. Import `stampWatermarkCanvas` from `../utils/watermark`.
2. Accept prop `watermarkMeta` in `WebCamera({ onCapture, onClose, theme, watermarkMeta })`.
3. In `takePhoto()`:
   - Perform anti-black pixel brightness check first (existing lines 144-154).
   - If bright pixels pass, call `stampWatermarkCanvas(canvas, watermarkMeta)`.
   - Update compression quality from 0.4 to 0.55 (`canvas.toDataURL('image/jpeg', 0.55)`).
   - Call `onCapture({ uri: base64Full, base64: cleanBase64 })`.

- [ ] **Step 4: Update `DashboardScreen.js` to pass `watermarkMeta` to `WebCamera`**

Pass `watermarkMeta={{ user, location, wilayah }}` to `<WebCamera ... />` in `DashboardScreen.js`.

- [ ] **Step 5: Verify build/syntax check on WebCamera and DashboardScreen**

Run: `node -c apps/mobile/src/components/WebCamera.js`
Expected: Clean exit (code 0).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/WebCamera.js apps/mobile/src/screens/DashboardScreen.js tests/watermark/webCameraWatermark.test.js
git commit -m "feat(mobile): integrate canvas geo-timestamp watermark into WebCamera"
```

---

### Task 5: Android Native Camera Integration

**Files:**
- Modify: `apps/mobile/src/components/NativeCamera.js:8, 48-80`
- Modify: `apps/mobile/src/screens/DashboardScreen.js:145-210, 700-710`
- Test: `tests/watermark/nativeCameraWatermark.test.js`

**Interfaces:**
- Consumes: `stampWatermarkNativeAsync` from `apps/mobile/src/utils/watermark.js`, `Location.reverseGeocodeAsync` from `expo-location`.
- Produces: `NativeCamera` accepting `watermarkMeta`, applying async pixel watermark after anti-black check, returning stamped `{ uri, base64 }`.

- [ ] **Step 1: Write unit test simulating NativeCamera capture pipeline**

Create `tests/watermark/nativeCameraWatermark.test.js` checking that anti-black check runs on raw photo base64 before watermarking.

```javascript
import test from 'node:test';
import assert from 'node:assert';

test('anti-blank threshold strictly rejects low-size black frames', () => {
  const isBlackFrame = (base64) => !base64 || base64.length < 6000;
  assert.strictEqual(isBlackFrame(''), true);
  assert.strictEqual(isBlackFrame('a'.repeat(5999)), true);
  assert.strictEqual(isBlackFrame('a'.repeat(6001)), false);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/watermark/nativeCameraWatermark.test.js`
Expected: PASS

- [ ] **Step 3: Modify `apps/mobile/src/components/NativeCamera.js`**

1. Import `stampWatermarkNativeAsync` from `../utils/watermark`.
2. Accept prop `watermarkMeta` in `NativeCamera({ onCapture, onClose, watermarkMeta })`.
3. In `takePicture()`:
   - Check `manipResult.base64.length < 6000` (existing anti-black check, lines 68-73).
   - After passing, invoke `const stamped = await stampWatermarkNativeAsync(manipResult.base64, watermarkMeta);`.
   - Pass `onCapture(stamped)` to parent.

- [ ] **Step 4: Update `DashboardScreen.js` for reverse geocoding & passing `watermarkMeta`**

1. In `DashboardScreen.js`:
   - Add state `const [wilayah, setWilayah] = useState('');`.
   - When GPS coordinate locks in `useEffect`, trigger reverse geocoding:
     - On native: call `Location.reverseGeocodeAsync(freshCoords)`.
     - On web: call `axios.post(API_URL, { action: 'reverseGeocode', data: { gps: `${lat},${lng}` } })`.
     - Cache in `AsyncStorage.setItem('@last_known_wilayah', JSON.stringify({ lat, lng, text }))`.
   - Pass `watermarkMeta={{ user, location, wilayah }}` to `<NativeCamera ... />`.

- [ ] **Step 5: Syntax verify NativeCamera and DashboardScreen**

Run: `node -c apps/mobile/src/components/NativeCamera.js`
Expected: Clean exit (code 0).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/NativeCamera.js apps/mobile/src/screens/DashboardScreen.js tests/watermark/nativeCameraWatermark.test.js
git commit -m "feat(mobile): integrate pure-JS geo-timestamp watermark into NativeCamera"
```

---

### Task 6: Web Apps GAS Watermark Integration in `Index.html`

**Files:**
- Modify: `apps/backend-gas/Index.html:798-845, 845-885`
- Test: `tests/watermark/gasIndexWatermark.test.js`

**Interfaces:**
- Consumes: `currentWilayahText`, `currentGPS`, canvas 2D context.
- Produces: Watermarked `capturedBase64Photo` on `handleFotoInputChange`.

- [ ] **Step 1: Write test verifying canvas watermark logic for Index.html**

Create `tests/watermark/gasIndexWatermark.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert';

test('Index.html watermark text formatting matches mobile standard', () => {
  const formatIndexWatermark = (user, gpsStr, wilayah, date) => {
    const dStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const tStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    return {
      header: 'YAYASAN ELANG KATULISTIWA ADIPAVITRA',
      staff: `${user?.nama || 'Staf Lapangan'} | ${user?.devisi || user?.jabatan || 'Divisi'}`,
      time: `${dStr} | ${tStr} WIB`,
      location: `GPS: ${gpsStr || 'Belum Terkunci'}`,
      wilayah: wilayah || ''
    };
  };

  const formatted = formatIndexWatermark({ nama: 'Admin YEKA', devisi: 'Operasional' }, '-6.1754, 106.8272', 'Gambir, Gambir, Jakarta Pusat', new Date('2026-10-29T10:00:00+07:00'));
  assert.strictEqual(formatted.header, 'YAYASAN ELANG KATULISTIWA ADIPAVITRA');
  assert.strictEqual(formatted.staff, 'Admin YEKA | Operasional');
  assert.strictEqual(formatted.location, 'GPS: -6.1754, 106.8272');
  assert.strictEqual(formatted.wilayah, 'Gambir, Gambir, Jakarta Pusat');
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/watermark/gasIndexWatermark.test.js`
Expected: PASS

- [ ] **Step 3: Modify `apps/backend-gas/Index.html`**

1. In `getGPSLocation()`:
   - When coordinates lock, call `google.script.run.withSuccessHandler(w => { window.currentWilayahText = w; }).getWilayahClient(lat + ',' + lng)`.
2. In `handleFotoInputChange(event)`:
   - Keep existing image loading, resizing (`maxW = 1024`), and brightness check (lines 805-824).
   - After brightness check passes:
     - Compute banner height (14% of canvas height).
     - Render dark rectangle `rgba(15, 23, 42, 0.76)`.
     - Render gold vertical bar `#d4af37`.
     - Render 4 lines of text: Organization title, Staff name & division, Timestamp with WIB, and GPS coordinates + Wilayah.
   - Set `capturedBase64Photo = canvas.toDataURL('image/jpeg', 0.7)`.
   - Update `photo-preview` src so staff sees the watermarked photo immediately.

- [ ] **Step 4: Commit**

```bash
git add apps/backend-gas/Index.html tests/watermark/gasIndexWatermark.test.js
git commit -m "feat(gas): embed geo-timestamp watermark onto captured photos in Index.html"
```

---

### Task 7: Full System Verification & Regression Testing

**Files:**
- Test: `tests/integration/watermarkPipeline.test.js`

**Interfaces:**
- Consumes: All modules from Tasks 1-6.
- Produces: Automated verification suite ensuring end-to-end compatibility across all 3 platforms.

- [ ] **Step 1: Write integration test suite**

Create `tests/integration/watermarkPipeline.test.js`:
- Tests pure-JS native watermark engine output validity.
- Tests HTML5 canvas drawing mock output.
- Tests anti-blank rejection.
- Tests backend cache key formatting.
- Verifies absence of em dashes across all output strings.

- [ ] **Step 2: Execute all test suites**

Run: `node --test tests/**/*.test.js`
Expected: ALL PASS with 0 failures.

- [ ] **Step 3: Verify git working tree and OTA readiness**

Run: `git status --short`
Ensure no native files (`android/`, `ios/`, native gradle/pods) were touched, ensuring 100% OTA deployment readiness.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/watermarkPipeline.test.js
git commit -m "test(integration): verify end-to-end watermark generation across all platforms"
```

