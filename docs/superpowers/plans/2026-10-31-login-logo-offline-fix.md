# Offline-First High-Resolution Brand Logo Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the Android blank logo issue inside the Executive Gold Halo on the login screen by embedding the authentic high-resolution Base64 Data URI of `apps/mobile/assets/logo.png` directly into `apps/mobile/src/utils/brandLogo.js`, and ensuring `getBrandLogoSource(hasError)` prioritizes the fallback URI whenever `hasError === true` (or whenever asset loading fails), completely immune to EAS CDN 403 Forbidden errors, while preserving 100% of notification and deep link functionality.

**Architecture:** 
1. In `apps/mobile/src/utils/brandLogo.js`, replace `FALLBACK_LOGO_URI` with the authentic, lossless 243,528-character Base64 Data URI from `apps/mobile/assets/logo.png` (verified byte-identical).
2. Fix `getBrandLogoSource(hasError)` so that if `hasError` is truthy, it immediately returns `{ uri: FALLBACK_LOGO_URI }` without calling `globalThis.require('../../assets/logo.png')`.
3. In `tests/unit/loginLogo.test.mjs`, expand unit tests to simulate `globalThis.require` present while `hasError === true` to ensure Metro bundler environments properly fall back to the embedded data URI, and verify the Base64 decodes to the exact bytes of `assets/logo.png`.
4. Maintain 100% test pass rate across all 144+ tests in the monorepo, strictly preserving all notification deep-link code and Rule R-02 typography integrity (zero em dashes).

**Tech Stack:** React Native, Expo, Node.js test runner (`node:test`).

## Global Constraints

- Rule R-02 compliance: ZERO em dashes (`\u2014` or ``) allowed in code, comments, documentation, or commit messages.
- OTA Safety: Preserve `version: "1.0.0"` and `runtimeVersion: { policy: "appVersion" }` in `apps/mobile/app.json`. Zero new native dependencies.
- Preservation of existing test contracts: 100% pass rate across the 144+ test suite (`npm.cmd test`), including all notification deep-link tests.

---

### Task 1: Fix `brandLogo.js` Resolver and Embed Authentic Retina Base64

**Files:**
- Modify: `apps/mobile/src/utils/brandLogo.js`
- Modify: `tests/unit/loginLogo.test.mjs`

- [x] **Step 1: Write failing unit test in `tests/unit/loginLogo.test.mjs`**
  Add unit tests verifying:
  - `getBrandLogoSource(true)` returns `{ uri: FALLBACK_LOGO_URI }` EVEN WHEN `globalThis.require` is defined and functional.
  - `FALLBACK_LOGO_URI` decodes to the exact binary payload matching `apps/mobile/assets/logo.png` (182,646 bytes).
  - Rule R-02 compliance (zero em dashes in `loginLogo.test.mjs`).

- [x] **Step 2: Run test to confirm failure**
  Run `node --test tests/unit/loginLogo.test.mjs`.

- [x] **Step 3: Implement fix in `apps/mobile/src/utils/brandLogo.js`**
  - Update `FALLBACK_LOGO_URI` with authentic Base64 string from `assets/logo.png`.
  - Update `getBrandLogoSource(hasError)`:
    ```javascript
    export function getBrandLogoSource(hasError) {
      if (hasError) {
        return { uri: FALLBACK_LOGO_URI };
      }
      if (typeof globalThis.require === 'function') {
        try {
          return globalThis.require('../../assets/logo.png');
        } catch (_err) {
          // Fall through to embedded URI
        }
      }
      return { uri: FALLBACK_LOGO_URI };
    }
    ```
  - Ensure zero em dashes in comments and code.

- [x] **Step 4: Verify unit tests pass**
  Run `node --test tests/unit/loginLogo.test.mjs`.

- [x] **Step 5: Commit changes**
  Commit Task 1 changes with message: `fix(mobile): embed authentic retina brand logo and enforce error fallback routing` (zero em dashes in commit message).

---

### Task 2: Full Monorepo Regression Verification and Git Sync

**Files:**
- Verify: All test suites (`tests/backend/`, `tests/watermark/`, `tests/integration/`, `tests/unit/`)
- Verify: `apps/mobile/src/utils/notifications.js`, `apps/mobile/App.js`

- [x] **Step 1: Run full test suite**
  Run `npm.cmd test` to verify all 144+ tests pass (100% pass rate).

- [x] **Step 2: Verify notification tests specifically**
  Run `node --test tests/unit/notificationDeepLink.test.mjs` to ensure zero regressions in notification deep-link routing.

- [x] **Step 3: Automated Rule R-02 compliance scan**
  Scan all modified files for zero em dashes (`\u2014` or ``).

- [x] **Step 4: Push to GitHub**
  Push all clean commits to remote master (`git push origin master`).
