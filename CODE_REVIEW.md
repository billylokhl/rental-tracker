# 🔍 Code Review Verdict: DESIGN.md & IMPLEMENTATION_PLAN.md

**Review target**: `DESIGN.md`, `IMPLEMENTATION_PLAN.md`
**Effort level**: High (recall-focused)
**Reviewed against**: Actual implementation in `pipeline/`, `web/`, `campaigns/`, `.github/`
**Date**: 2026-08-15

---

## Verdict

**Changes requested.** Both documents describe an implementation marked *"Executed & Verified"* / *"Production-Ready"*, but multiple documented capabilities and layouts do **not** match the shipped code. The design is sound overall, but the docs currently overstate what the code does in ways that will mislead a maintainer or anyone spinning up a new campaign.

- **2 defects** are real functional gaps where the docs promise behavior the code does not implement (configurable hazard radius; JSON-LD geo extraction).
- **3 defects** are false or misleading claims / diagrams (static-bundle build, commute-colored pins, reference-file paths).
- **2 defects** are documentation-accuracy / consistency issues (missing component inventory; `min_zoom` default drift).

None are blocking for a personal tool, but #1 and #2 should be fixed before the "pluggable / production-ready" framing is trusted.

---

## Findings (ranked most-severe first)

### 1. Hazard buffer radius is hardcoded; `warning_radius_mi` is ignored — `correctness`
**Where**: [DESIGN.md:107](DESIGN.md:107), schema [DESIGN.md:143](DESIGN.md:143) · code `web/src/components/MapEngine.js:108`

The buffer is documented as configurable via `campaign.json` → `warning_radius_mi` (set to `1.0`), but `MapEngine.js` hardcodes `radius: 1207` (~0.75 mi) and never reads the config. The docs also contradict themselves: the schema says `1.0`, the prose (and `README.md:15`, `IMPLEMENTATION_PLAN.md:36`) say `0.75`.

**Impact**: The rendered buffer is always 0.75 mi regardless of config. A new campaign that sets a different `warning_radius_mi` gets no change — this breaks the stated "pluggable campaign" principle, and the documented 1.0 mi ring is never drawn.

**Fix options**: Make `renderHazards` read `warning_radius_mi` per hazard layer from `campaignConfig`, and reconcile the 1.0-vs-0.75 value across docs + `seed_from_sheet.py:268`.

---

### 2. Docs claim JSON-LD geo-coordinate extraction, but the scraper drops it — `correctness`
**Where**: [DESIGN.md:85](DESIGN.md:85) · code `pipeline/scraper.py:101-103`, `pipeline/scraper.py:134-163`

§4.1 states the JSON-LD tier parses geo coordinates. `scraper.py` assigns `lat`/`lng` from `item.get("geo")` into local variables that are **never included in the returned dict**.

**Impact**: Every `add`ed listing reaches `aggregator.enrich_listing` with no location and falls back to address geocoding — or, on geocode failure, the campaign map center (`aggregator.py:65-66`), stacking pins at the region centroid. The documented capability effectively does not exist.

**Fix options**: Add `"location": {"lat": lat, "lng": lng}` to the scraper's return dict when geo is present.

---

### 3. "Frontend compiles into a static bundle" — CI never builds the frontend — `correctness`
**Where**: [DESIGN.md:28](DESIGN.md:28), [IMPLEMENTATION_PLAN.md:42](IMPLEMENTATION_PLAN.md:42) · code `.github/workflows/deploy.yml`

The docs describe a compiled static bundle deployed via GitHub Actions. `deploy.yml` only runs `pipeline.cli build` (data compilation) and uploads the raw `web/` directory — there is no `npm ci` / `npm run build`. `web/package.json` defines `build: vite build` → `dist/` (`vite.config.js`), which is never invoked.

**Impact**: The Vite tooling is dead config. The app happens to work because it ships raw ES modules + a CDN Leaflet, but any reliance on bundling, env substitution, or Vite's `/public` root mapping would silently not happen in production.

**Fix options**: Either add a real `npm run build` step and upload `web/dist`, or update the docs to state the frontend is served as un-bundled static source and remove/annotate the unused Vite config.

---

### 4. Price pins claimed "color-coded by commute speed" — not implemented — `correctness`
**Where**: [DESIGN.md:106](DESIGN.md:106) · code `web/src/components/MapEngine.js:165-170`

`renderProperties` builds every pin with the same `custom-pin-price` class plus an active/inactive toggle. Nothing reads `item.commute` to vary color.

**Impact**: A reader relying on pin color to gauge commute gets no such signal. Either implement the coloring or drop the claim.

---

### 5. Architecture diagram places reference JSONs at the wrong path — `correctness`
**Where**: [DESIGN.md:44](DESIGN.md:44) · code `pipeline/cli.py:64-66`, `pipeline/aggregator.py:30-32`

The §3 diagram lists `destinations.json`, `hazards.json`, `pois.json` as siblings of `campaign.json` at the campaign root. The real layout, the `campaign.json` `file` fields, and all code read them from a `reference/` subdirectory.

**Impact**: Someone scaffolding a campaign by following the diagram places files at the root; the build loads empty defaults and silently ships a dashboard with no hazards / POIs / destinations.

**Fix**: Correct the diagram to show `reference/`.

---

### 6. Phase 3 component inventory omits shipped core components — `doc-accuracy`
**Where**: [IMPLEMENTATION_PLAN.md:37](IMPLEMENTATION_PLAN.md:37) · code `web/src/main.js:8-14`

The "Executed & Verified" Phase 3 checklist omits `StatsModal.js`, `FilterBar.js`, and `Header.js` — all imported by `main.js` and core to the app (StatsModal is even documented at `DESIGN.md:115`; DESIGN §4.4 omits FilterBar/Header too).

**Impact**: A maintainer auditing "what was built" against the plan may treat these as orphaned and remove or duplicate them.

---

### 7. `init-campaign` scaffolds `min_zoom: 8`, docs/seed use `9` — `conventions`
**Where**: [DESIGN.md:133](DESIGN.md:133) · code `pipeline/cli.py:46`

The documented schema, `seed_from_sheet.py:260`, and the live `campaign.json:12` all use `min_zoom: 9`, but `init-campaign` writes `8`.

**Impact**: A campaign created via the documented command diverges from every example in the docs. Low severity — align the default.

---

## Suggested priority

| Priority | Findings |
| :--- | :--- |
| **Fix before trusting "pluggable/production-ready"** | #1, #2 |
| **Fix docs to match reality** | #3, #4, #5 |
| **Cleanup / consistency** | #6, #7 |
