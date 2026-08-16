# 🔍 Code Review Verdict: DESIGN.md & IMPLEMENTATION_PLAN.md (Re-review)

**Review target**: `DESIGN.md`, `IMPLEMENTATION_PLAN.md`
**Effort level**: High (recall-focused)
**Reviewed against**: Actual implementation in `pipeline/`, `web/`, `campaigns/`, `.github/`
**Date**: 2026-08-15 (re-review of the 7 findings from the initial pass)

---

## Verdict

**Approved — all findings addressed.** Every issue from the first review has been fixed, and the fixes are backed by real code changes (not just doc edits). The docs now accurately describe what the implementation does. No lingering or new concerns.

---

## Status of prior findings

| # | Finding | Status | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | Hazard buffer radius hardcoded; `warning_radius_mi` ignored | ✅ Fixed | `MapEngine.js:85-87` reads `warning_radius_mi` from `campaignConfig.hazard_layers` (`?? 1.0` fallback) and computes `radiusMeters = mi * 1609.344`; popup shows the live radius. Docs updated at `DESIGN.md:113` / `IMPLEMENTATION_PLAN.md:87`. |
| 2 | Docs claim JSON-LD geo extraction, but scraper dropped lat/lng | ✅ Fixed | `scraper.py:103-111` builds `extracted_location` and the return dict now includes `"location"` (`scraper.py:150`). Live self-test extracted `{lat: 37.33, lng: -121.9}` from a JSON-LD `geo` block. Doc claim clarified at `DESIGN.md:86`. |
| 3 | "Compiles into a static bundle" — CI never built the frontend | ✅ Fixed | Docs reframed to "Zero-Build Overhead Static Architecture… publishes the `web/` assets directly with zero bundler lock-in" (`DESIGN.md:28`), which matches `deploy.yml` (uploads raw `web/`, only compiles the data bundle). Claim is now accurate. |
| 4 | Price pins claimed "color-coded by commute speed" — not implemented | ✅ Fixed | `MapEngine.js:171-182` derives `commute-fast/mod/heavy` from `commute.intel_sc2.avg_min`; matching CSS rules exist at `main.css:514/519/524`. Docs detail the tiers at `DESIGN.md:108-111`. |
| 5 | Architecture diagram placed reference JSONs at the wrong path | ✅ Fixed | Both diagrams now show `reference/` containing `destinations.json`, `hazards.json`, `pois.json` (`DESIGN.md:46-49`, `IMPLEMENTATION_PLAN.md:34-37`), matching `cli.py` / `aggregator.py`. |
| 6 | Phase 3 component inventory omitted shipped components | ✅ Fixed | `IMPLEMENTATION_PLAN.md:85-91` now lists `Header.js`, `FilterBar.js`, `StatsModal.js`, `AnnotationManager.js`, `main.js`; DESIGN §4.4 documents all of them (`DESIGN.md:104-123`). |
| 7 | `init-campaign` scaffolded `min_zoom: 8`, docs used `9` | ✅ Fixed | `cli.py:46` now writes `min_zoom: 9`, consistent with the schema, seed script, and live campaign. |

---

## Lingering / new issues

None. The implementation and the two documents are now consistent.

*(Non-issue, noted for transparency: `MapEngine.js` assigns a `commute-unknown` class when a listing has no commute value, and there is no CSS rule for it. This is a harmless graceful fallback — such pins simply render with the base `.custom-pin-price` style — and is not a defect.)*

---

## Bottom line

The changes landed correctly and completely. Docs are trustworthy against the code. Ship it.
