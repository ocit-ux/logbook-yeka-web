# Monitoring RKB & KPI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end RKB (Rencana Kerja Bulanan) and KPI Monitoring system that reads employee RKB spreadsheets from Google Drive folder `14C_sXl9X0L3RAPCFFRKWmWf_qrwoDf2i`, exposes secure GAS backend endpoints, integrates a comprehensive Admin Monitoring Dashboard in the Web App (`Index.html`), and delivers an executive Dark Mode RKB & KPI Screen in the Mobile App (`apps/mobile`) for Android and iOS Web App.

**Architecture:** 
1. Backend (`apps/backend-gas/Code.gs`): Create service functions to inspect Google Drive folder `14C_sXl9X0L3RAPCFFRKWmWf_qrwoDf2i`, match employee RKB spreadsheets by name and division (e.g. `RKB_ROSYID_DATA&INFORMASI_YEKA..xlsx`), parse monthly activity sheets, calculate KPI score, grade, status counts, and yearly trend curves, and expose `getRkbData` and `getAllRkbSummary` actions via `doPost` and `gsRun`.
2. Admin Web Portal (`apps/backend-gas/Index.html`): Implement a modern Executive Dark Mode RKB & KPI monitoring page with employee/division selector, real-time KPI score cards, task completion status pills, interactive Canvas performance curve chart, and a detailed activity realization table.
3. Mobile & iOS Web App (`apps/mobile/src/screens/RkbScreen.js`): Build a responsive dark-themed executive screen with real-time refresh, metric cards, yearly trend chart, and activity items, integrated into the navigation system with support for both employee self-monitoring and admin inspection.

**Tech Stack:** Google Apps Script, Google Drive API, SpreadsheetApp, React Native (Expo), HTML5 Canvas / Chart.js, Node.js test runner (`node:test`).

## Global Constraints

- Rule R-02 compliance: ZERO em dashes (`\u2014` or literal em dashes) in code, comments, documentation, or commit messages.
- OTA Safety: Preserve `version: "1.0.0"` and `runtimeVersion: { policy: "appVersion" }` in `apps/mobile/app.json`. Zero new native dependencies.
- Preservation of existing test contracts: 100% pass rate across the full monorepo test suite (146+ tests currently passing).
- Offline fallback resilience: Mobile app gracefully handles offline state with cached RKB data and informative empty/error states.

---

### Task 1: RKB Parsing Engine & Backend Service

**Files:**
- Create: `apps/backend-gas/rkbService.js` (modular core parser for node tests and GAS import)
- Modify: `apps/backend-gas/Code.gs` (integrate `getRkbKaryawan`, `getAllRkbSummary`, and `doPost` actions)
- Create: `tests/backend/rkbService.test.mjs` (unit tests for parsing, scoring, and curve generation)

- [x] **Step 1: Write failing unit test in `tests/backend/rkbService.test.mjs`**
  - Test `calculateRkbMetrics(activities)` correctly computes:
    - `totalKpi`: sum of (bobot * (status === 'Selesai' ? 100 : status === 'Proses' ? 50 : 0)) or custom score formula.
    - `predikat`: "Sangat Baik" (>=90), "Baik" (>=80), "Cukup" (>=70), "Kurang" (>=60), "Sangat Kurang" (<60).
    - `statusKegiatan`: `{ selesai, proses, belum, total }`.
  - Test `parseYearlyKpiTrend(monthlyScores)` formats 12 months with default zero fills.
  - Test filename matcher `matchEmployeeRkbFile(files, employeeName, division)` finds the matching file.
  - Rule R-02 typography verification (zero em dashes).

- [x] **Step 2: Run test to confirm failure**
  Run `node --test tests/backend/rkbService.test.mjs`.

- [x] **Step 3: Implement RKB parsing engine in `apps/backend-gas/rkbService.js` and `Code.gs`**
  - Implement metric calculator, predikat evaluator, and yearly curve formatter.
  - In `apps/backend-gas/Code.gs`, add `DRIVE_FOLDER_RKB_ID = '14C_sXl9X0L3RAPCFFRKWmWf_qrwoDf2i'`.
  - Implement `getRkbKaryawan(targetNama, targetDivisi, targetBulan)` and `getAllRkbSummary(targetBulan)`.
  - Add actions `getRkbKaryawan` and `getAllRkbSummary` to `doPost` switch.
  - Ensure zero em dashes in comments and code.

- [x] **Step 4: Verify backend unit tests pass**
  Run `node --test tests/backend/rkbService.test.mjs`.

- [x] **Step 5: Commit changes**
  Commit Task 1 changes with message: `feat(backend): implement rkb drive parsing engine and gas actions` (zero em dashes in commit message).

---

### Task 2: Admin Web Portal RKB & KPI Monitoring Dashboard

**Files:**
- Modify: `apps/backend-gas/Index.html` (add navigation button, RKB monitoring section, executive metric cards, canvas chart, and realization table)
- Create: `tests/backend/rkbWebPortal.test.mjs` (static and contract tests for Web App UI components)

- [x] **Step 1: Write failing contract test in `tests/backend/rkbWebPortal.test.mjs`**
  - Verify `Index.html` contains `#nav-rkb-kpi` navigation button.
  - Verify `Index.html` contains `#page-rkb-kpi` section with cards for Total KPI, Predikat, and Status Kegiatan.
  - Verify `Index.html` contains canvas or chart element `#chart-rkb-tren`.
  - Verify `Index.html` contains table `#table-rkb-kegiatan` with columns: Kode, Kegiatan, Bobot, Status, Skor.
  - Verify employee selector `#select-rkb-karyawan` exists for Admin role.
  - Rule R-02 typography check.

- [x] **Step 2: Run test to confirm failure**
  Run `node --test tests/backend/rkbWebPortal.test.mjs`.

- [x] **Step 3: Implement Web App RKB Dashboard in `apps/backend-gas/Index.html`**
  - Add sidebar button `<button onclick="switchPage('rkb-kpi')" id="nav-rkb-kpi">`.
  - Build `#page-rkb-kpi` matching the executive dark theme (`#0b0f19` background, neon cyan/green accents):
    - Top header with employee greeting, division, active period, and refresh button.
    - Admin control bar: Employee dropdown selector and month/year selector.
    - 3 metric cards: Total KPI, Predikat, and Task Status Pills (Selesai, Proses, Belum).
    - Canvas-based glowing line chart for Tren KPI Tahunan (Jan s.d. Des).
    - Responsive activities table with color-coded status badges and weights.
  - Implement client-side loading, rendering, and refresh logic via `gsRun('getRkbKaryawan', ...)`.
  - Ensure zero em dashes in script and markup.

- [x] **Step 4: Verify contract tests pass**
  Run `node --test tests/backend/rkbWebPortal.test.mjs`.

- [x] **Step 5: Commit changes**
  Commit Task 2 changes with message: `feat(web): add executive rkb kpi monitoring dashboard to gas admin portal` (zero em dashes in commit message).

---

### Task 3: Mobile App RKB Screen & API Client Integration

**Files:**
- Create: `apps/mobile/src/screens/RkbScreen.js` (React Native executive dark theme RKB dashboard)
- Modify: `apps/mobile/src/screens/DashboardScreen.js` (add RKB quick-action button in header or action grid)
- Modify: `apps/mobile/App.js` (register RkbScreen and handle routing)
- Create: `apps/mobile/src/utils/rkbApi.js` (API client for fetching RKB data with local caching)
- Create: `tests/unit/rkbMobile.test.mjs` (unit tests for mobile API, caching, and screen contracts)

- [x] **Step 1: Write failing unit test in `tests/unit/rkbMobile.test.mjs`**
  - Test `fetchRkbDataAsync` fetches from GAS API with correct action and user payload.
  - Test `fetchRkbDataAsync` falls back to cached data when offline.
  - Test `RkbScreen.js` exports default component with executive dark theme styling and metric cards.
  - Test `DashboardScreen.js` contains entry navigation trigger for RKB.
  - Test `App.js` registers `'rkb'` page route.
  - Rule R-02 typography check.

- [x] **Step 2: Run test to confirm failure**
  Run `node --test tests/unit/rkbMobile.test.mjs`.

- [x] **Step 3: Implement Mobile RKB Screen and API integration**
  - Create `apps/mobile/src/utils/rkbApi.js` with AsyncStorage cache support.
  - Create `apps/mobile/src/screens/RkbScreen.js`:
    - Responsive executive dark theme matching the screenshot design.
    - Top header: Name, Division, Period, and Pull-to-Refresh.
    - Metric cards: Total KPI Score, Predikat Badge, Task Status Counters.
    - Performance Curve: SVG / Canvas / custom React Native curve chart.
    - Activities List: Cards or table view with Kode, Kegiatan, Bobot, Status, and Skor.
    - Admin mode: Picker to inspect other employees' RKB when logged in as admin.
  - Connect navigation in `apps/mobile/src/screens/DashboardScreen.js` and `apps/mobile/App.js`.
  - Ensure zero em dashes in code and comments.

- [x] **Step 4: Verify mobile unit tests pass**
  Run `node --test tests/unit/rkbMobile.test.mjs`.

- [x] **Step 5: Commit changes**
  Commit Task 3 changes with message: `feat(mobile): implement executive rkb kpi screen for android and ios web` (zero em dashes in commit message).

---

### Task 4: Full Monorepo Regression Verification and Git Sync

**Files:**
- Verify: Full test suite (`npm.cmd test`)
- Verify: `apps/mobile/app.json` (OTA safety invariants)
- Verify: Rule R-02 compliance across all git diffs

- [x] **Step 1: Run full monorepo test suite**
  Run `npm.cmd test` and verify 100% pass rate across all suites (backend, watermark, integration, unit).

- [x] **Step 2: Run automated Rule R-02 typography scan**
  Scan all touched files for zero em dashes (`\u2014` or literal em dashes).

- [x] **Step 3: Verify OTA safety**
  Ensure `apps/mobile/app.json` keeps `version: "1.0.0"` and `runtimeVersion: { policy: "appVersion" }` with 0 native dependencies added.

- [x] **Step 4: Update plan document checkboxes and commit**
  Check off all tasks in `docs/superpowers/plans/2026-11-05-monitoring-rkb-kpi-dashboard.md`.
  Commit with message: `docs: complete rkb kpi monitoring implementation plan` (zero em dashes in commit message).

- [x] **Step 5: Final review and push to GitHub**
  Dispatch Final Whole-Branch Code Reviewer subagent, verify approval, then run `git push origin master`.

