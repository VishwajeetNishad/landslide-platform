# Code Review: Riya's Frontend Pull Request (`f1-f2-frontend-integration`)
**Date:** 4 September 2026, 14:30 IST  
**Reviewer:** Vishwajeet (Backend & Project Lead)  
**Branch:** `origin/f1-f2-frontend-integration` (commit `d324798`)  
**Build Status:** ✅ `npm run build` PASSED (22.99s) | ✅ `tsc --noEmit` PASSED (0 errors)

---

## 1. Executive Summary

Riya has done a phenomenal amount of high-quality work in a very short time. The repository contains a complete, working React 19 + TypeScript + Vite + Tailwind v4 + MapLibre GL dashboard (46 files, 14,011 lines).

It compiles cleanly without errors, the UI aesthetics are government-grade and professional, the map colors strictly honor the `risk_level` rule (not probability), and the mandatory demo banner is properly implemented.

There are **5 specific items** that need attention before tomorrow morning's presentation (5 September) to align with our backend contracts, database values, and the demo narrative.

---

## 2. What Riya Did Brilliantly (10/10)

1. **Compilation & Packaging:**
   - Runs on Vite 6 + Tailwind v4 + React 19.
   - `npm run build` and `tsc --noEmit` pass with zero compiler warnings or type errors.
2. **The Map Coloring Rule Honored (`AizawlMap.tsx`):**
   - Slope units are colored strictly by `risk_level` (`HIGH: #ef4444`, `MEDIUM: #f97316`, `LOW: #10b981`, `unassessed: #64748b`).
   - Units are **not** colored by raw probability, preserving the core scientific premise of the platform.
3. **Mandatory Demo Banner (`DemoBanner.tsx`):**
   - Prominently displays the orange/amber disclaimer strip when `meta.is_demo_data === true`.
   - Automatically hides if the backend emits `is_demo_data: false`.
4. **The Golden Proof Case (AZ-1088):**
   - Prominently highlighted in `DecisionCard.tsx` and `SlopeUnitDetail.tsx` with clear notice:
     *"Model failure probability is 0.95, but exposed population is 0. Risk is LOW (SAFE)."*
5. **Separation of Likelihood vs Consequence:**
   - `DecisionCard.tsx` cleanly splits Likelihood (`0.72`) from Consequence (`120 pop`), reinforcing that risk = likelihood × consequence.
6. **Backend Live Feed + Offline Fallback:**
   - `api.ts` connects by default to `http://localhost:8000/api/v1/` and provides a seamless offline fallback toggle if the backend is stopped.

---

## 3. Five Items to Fix Before Demo (Priority Order)

### 🔴 Item 1: Render the Snake-Line Chart Component (Crucial for Demo Beat 2)
- **Finding:** Riya defined `TRAJECTORY_DATA` and `SnakeChartPoint` in `src/data/aizawlSlopeUnits.ts` with observed points (`isObserved: true`) and forecast points (`isObserved: false, crossed: true`), but the visual Snake-Line Chart is not currently rendered on the screen.
- **Impact:** In the demo narrative (`DEMO_PLAN.md` Beat 2), the judges will look for the dashed forecast tail: *"That tail is our lead time."*
- **Action:** Add a `SnakeLineChart` component into `SlopeUnitDetail.tsx` or `AnalyticsView.tsx` using Recharts to plot `shortTermRainfall` (X) vs `longTermSoilWetness` (Y), rendering the solid observed line and dashed forecast tail.

### 🔴 Item 2: Wire Verification and Alert Authorization to Live API Endpoints
- **Finding:** In `src/lib/api.ts`, `updateVerificationStatus` and `authorizeAlert` only update local in-memory overrides (`localOverrides[id]`).
- **Impact:** When clicking "Verify" or "Dispatch", it doesn't hit the backend. In the demo, we want to demonstrate the PostgreSQL safety gate blocking unauthorized dispatch and show the live CAP 1.2 XML and 3-language SMS.
- **Action:** Connect `updateVerificationStatus` to `PATCH /api/v1/predictions/:id/verification` and `authorizeAlert` to `POST /api/v1/alerts/draft` / `POST /api/v1/alerts/:id/authorise`. (We can provide ready-to-paste async helper functions for this).

### 🟡 Item 3: Replace Hardcoded Counter "11,778 slope units" with Real Backend Counts
- **Finding:** In `OverviewDashboard.tsx` line 267 and `AnalyticsView.tsx` line 50, total slope units is hardcoded as `11,778`.
- **Impact:** Per `FRONTEND_REVIEW.md §2.1`, the real database currently has 5 slope units (3 in the active forecast run). Presenting 11,778 creates an immediate discrepancy when clicking on the map.
- **Action:** Change line 267 in `OverviewDashboard.tsx` to:
  ```tsx
  {summary?.total_slope_units ?? slopeUnitsList.length}
  ```

### 🟡 Item 4: Use Dynamic Area & Slope from API in `SlopeUnitDetail.tsx`
- **Finding:** Lines 87–97 in `SlopeUnitDetail.tsx` use a hardcoded ternary:
  ```ts
  const areaHa = isAZ1088 ? 44.8 : isAZ1142 ? 38.2 : 31.4;
  ```
  In the real PostGIS database, AZ-1088 is `9.3 ha` and AZ-1142 is `19.7 ha`.
- **Action:** Use the actual values sent by the API:
  ```ts
  const areaHa = slopeUnit.area_ha ?? (isAZ1088 ? 9.3 : 19.7);
  const meanSlope = slopeUnit.mean_slope_deg ?? (isAZ1088 ? 38.4 : 34.2);
  ```

### 🟡 Item 5: Add "Planned / Illustrative" Badge on `MonitoringView.tsx`
- **Finding:** `MonitoringView.tsx` states "14 Automated Stations Online" and shows live piezometer and inclinometer gauges.
- **Impact:** Per `FRONTEND_REVIEW.md §2.4`, we do not have physical piezometers installed in Aizawl.
- **Action:** Add a prominent header badge in `MonitoringView.tsx`:
  ```tsx
  <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-xl text-xs font-semibold">
    PLANNED SENSOR NETWORK — Illustrative telemetry specification. No physical piezometers deployed in this prototype.
  </div>
  ```

---

## 4. Recommendation & Next Steps

1. Merge Riya's branch into a local review branch or `main`.
2. Help Riya apply these 5 small tweaks (they take ~30 minutes total).
3. Conduct the first timed live rehearsal with the whole team!
