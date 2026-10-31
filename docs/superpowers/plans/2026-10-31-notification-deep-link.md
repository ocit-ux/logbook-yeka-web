# Actionable Fast Deep-Link on Tap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable seamless deep-link routing when users tap a reminder notification (both local device reminder and cloud push notification), immediately navigating to the journal/attendance input screen, while safely preserving navigation intent across authentication if the app was logged out or cold-started.

**Architecture:** Implement a robust notification response event listener and cold-start resolver in `notifications.js` using `expo-notifications`. In `App.js`, hook up response listeners and cold-start inspection to route to the logbook tab (`home`), preserving any pending action if the user has not yet authenticated. Synchronize notification payload data (`{ action: 'open_journal' }`) across both local mobile reminders and Google Apps Script backend cloud push messages.

**Tech Stack:** React Native, Expo Notifications (`expo-notifications`), Node.js test runner (`node:test`).

**Spec:** In-conversation requirements for "Aksi Cepat & Navigasi Langsung (Deep-Link on Tap)" with Rule R-02 compliance (zero em dashes).

## Global Constraints

- Rule R-02 compliance: ZERO em dashes (`\u2014`) allowed in code, comments, documentation, or commit messages.
- OTA Safety: Preserve `version: "1.0.0"` and `runtimeVersion: { policy: "appVersion" }` in `apps/mobile/app.json`. Zero new native dependencies.
- Preservation of existing test contracts: 100% pass rate across the 120+ test suite (`npm.cmd test`).

## Review Focus

- Cold-start tap handling: App launched from a killed state via notification tap must properly retrieve and process the notification response.
- Unauthenticated intent preservation: If a notification is tapped while the user is logged out, the deep-link intent must be preserved and executed immediately after successful login.
- Web browser safety: In web browser or headless testing runtimes, notification response listeners must gracefully no-op without throwing unhandled exceptions.
- Zero em dashes: Automated verification that no em dashes exist in any created or modified files.
- Duplicate payload handling: Ensure both `local_daily_reminder` and `server_daily_reminder` payloads are recognized consistently.

---

### Task 1: Notification Response Handler and Cold-Start Resolver

**Files:**
- Modify: `apps/mobile/src/utils/notifications.js`
- Create: `tests/unit/notificationDeepLink.test.mjs`

- [ ] **Step 1: Write the failing unit test**
  Create `tests/unit/notificationDeepLink.test.mjs` testing:
  - `parseNotificationResponseAction(response)` extracts action `'open_journal'` from either `local_daily_reminder` or `server_daily_reminder` or explicit `action: 'open_journal'`.
  - `setupNotificationResponseReceivedListener(onAction)` registers listener and returns unsubscribe/remove handle.
  - `checkInitialNotificationResponseAsync()` resolves initial cold-start notification response safely.
  - Zero em dashes compliance check.

- [ ] **Step 2: Run test to confirm failure**
  Run `node --test tests/unit/notificationDeepLink.test.mjs` and confirm functions are not yet exported.

- [ ] **Step 3: Implement notification response utilities in `notifications.js`**
  - Export `parseNotificationResponseAction(response)`.
  - Export `setupNotificationResponseReceivedListener(onAction)`.
  - Export `checkInitialNotificationResponseAsync()`.
  - Update `scheduleDailyReminder()` content data to include `action: 'open_journal'`.
  - Ensure zero em dashes in code and comments.

- [ ] **Step 4: Verify tests pass**
  Run `node --test tests/unit/notificationDeepLink.test.mjs`.

- [ ] **Step 5: Commit changes**
  Commit Task 1 changes with message: `feat(mobile): implement notification response listener and action parser`.

---

### Task 2: Root App Navigation Routing and Login Intent Preservation

**Files:**
- Modify: `apps/mobile/App.js`
- Test: `tests/unit/notificationDeepLink.test.mjs`

- [ ] **Step 1: Add unit tests for App.js deep-link integration contract**
  In `tests/unit/notificationDeepLink.test.mjs`, add tests verifying:
  - `App.js` imports `setupNotificationResponseReceivedListener` and `checkInitialNotificationResponseAsync`.
  - `App.js` manages `pendingNotificationAction` state/ref.
  - On login success, `pendingNotificationAction` triggers automatic switch to `'home'` tab.
  - Rule R-02 compliance (zero em dashes in `App.js`).

- [ ] **Step 2: Run test to confirm failure**
  Run `node --test tests/unit/notificationDeepLink.test.mjs`.

- [ ] **Step 3: Implement deep-link handler in `App.js`**
  - Add state/ref for `pendingNotificationAction`.
  - Register `setupNotificationResponseReceivedListener` on mount, triggering immediate switch to `activeTab = 'home'` if user is logged in, or storing into `pendingNotificationAction` if user is logged out.
  - Check cold-start via `checkInitialNotificationResponseAsync` on app mount.
  - In `onLoginSuccess`, if `pendingNotificationAction` is set, navigate to `'home'` tab and clear pending action.

- [ ] **Step 4: Verify tests pass**
  Run `node --test tests/unit/notificationDeepLink.test.mjs`.

- [ ] **Step 5: Commit changes**
  Commit Task 2 changes with message: `feat(mobile): integrate notification tap routing and intent preservation in App.js`.

---

### Task 3: Backend GAS Payload Synchronization and Full Verification

**Files:**
- Modify: `apps/backend-gas/Code.gs:1078-1087`
- Modify: `apps/mobile/src/screens/DashboardScreen.js`
- Test: Full monorepo test suite

- [x] **Step 1: Update `Code.gs` push notification payload**
  In `kirimPushNotifikasiHarian()`, ensure `data: { action: 'open_journal', type: 'server_daily_reminder' }`.

- [x] **Step 2: Add deep-link focus handling in `DashboardScreen.js`**
  Add recognition for `initialAction` or deep-link parameter to ensure form/kamera readiness when launched via notification tap.

- [x] **Step 3: Run full monorepo test suite**
  Run `npm.cmd test` to verify all 120+ tests pass with zero regressions.

- [x] **Step 4: Check zero em dashes across all touched files**
  Verify zero em dashes in `apps/mobile/src/utils/notifications.js`, `apps/mobile/App.js`, `apps/mobile/src/screens/DashboardScreen.js`, `apps/backend-gas/Code.gs`.

- [x] **Step 5: Commit changes**
  Commit Task 3 changes with message: `feat(mobile): sync backend notification payload and dashboard focus handler`.

