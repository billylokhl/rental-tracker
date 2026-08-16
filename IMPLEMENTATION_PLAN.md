# 🛠️ Implementation Plan: Rental Listing Tracker & GitHub Pages Dashboard

**Project**: Rental Listing Tracker  
**Target Environment**: GitHub Pages + Local Python CLI (`uv`)  
**Repository Location**: `~/sandbox/rental-tracker`  
**Status**: Executed & Verified  

---

## 1. Objectives & Scope

1. **One-Time Google Sheets Migration**: Fully migrate all ~40 properties, commute data, 28 EPA Superfund sites, and Intel SC2 office coordinates into native JSON files under `campaigns/2026-south-bay/`, completely retiring the legacy Google Sheet and Apps Script.
2. **Pluggable Campaign Architecture**: Structure data schemas so future housing searches (e.g. 2028 Seattle, 2029 Austin) can be created and swapped without touching core application code.
3. **Automated Pipeline Engine**: Build Python CLI with `uv` and `pyproject.toml` for web scraping, floorplan collapsing, commute estimation, and static bundle compilation.
4. **Responsive GitHub Pages Dashboard**: Create a modern, zero-runtime-cost static web app featuring dual-pane layout, Leaflet multi-layer map, view modes, and local-first curation.
5. **Continuous Deployment**: Provide GitHub Actions workflow using `setup-uv` to automatically build active campaign data and publish to GitHub Pages on push.

---

## 2. Architecture & File Layout

```
                                  GIT REPOSITORY
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                 │
 │   ┌─────────────────────────────────────────────────────────────────────────┐   │
 │   │               CAMPAIGN DATA LAYER  (Pluggable & Swappable)               │   │
 │   │                                                                         │   │
 │   │   campaigns/                                                            │   │
 │   │   └── 2026-south-bay/                                                   │   │
 │   │       ├── campaign.json        # Title, map center/zoom, filter presets  │   │
 │   │       ├── listings.json        # Aggregated active floorplans            │   │
 │   │       ├── annotations.json     # Personal ratings, visit notes, status   │   │
 │   │       ├── reference/           # Reference datasets for layers & metrics │   │
 │   │       │   ├── destinations.json    # Work offices (Intel SC2, etc.)      │   │
 │   │       │   ├── hazards.json         # Environmental datasets (Superfund)  │   │
 │   │       │   └── pois.json            # Transit, grocery, custom POIs       │   │
 │   │       └── raw/                 # Historical scrape snapshots             │   │
 │   └────────────────────────────────────┬────────────────────────────────────┘   │
 │                                        │                                        │
 │                                        ▼                                        │
 │   ┌─────────────────────────────────────────────────────────────────────────┐   │
 │   │                   STANDALONE PIPELINE & CLI (Python)                    │   │
 │   │  • Scrapes URLs & collapses floorplans                                  │   │
 │   │  • Dynamically computes commute to any campaign destination             │   │
 │   │  • Dynamically computes distance to any campaign hazard dataset         │   │
 │   │  • Compiles bundle into `web/public/data/`                              │   │
 │   └────────────────────────────────────┬────────────────────────────────────┘   │
 │                                        │                                        │
 └────────────────────────────────────────┼────────────────────────────────────────┘
                                          │
                                GitHub Actions / Local Build
                                          │
                                          ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                     GENERIC GITHUB PAGES WEB APPLICATION                        │
 │                                                                                 │
 │   ┌─────────────────────────────────────────────────────────────────────────┐   │
 │   │  Desktop / Laptop: Split-pane (Filters + Cards/Table | Multi-Layer Map) │   │
 │   │  Mobile / Tablet: Fluid Bottom-Sheet + Tab Switcher (List / Map / Stats)│   │
 │   │  Dynamic Layers: Renders destinations, hazards & POIs from campaign     │   │
 │   │  Local-First Annotations: In-browser notes/status with Git Export       │   │
 │   └─────────────────────────────────────────────────────────────────────────┘   │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Completed Implementation Phases

### Phase 1: Data Model & Seed Migration ✅
- [x] Defined schemas for listings, units, amenities, commute estimates, hazard proximity, and annotations in `pipeline/models.py`.
- [x] Built and executed `pipeline/seed_from_sheet.py` to extract 40 listings, 28 Superfund sites, Intel SC2 coordinates, and Bay Area transit/grocery POIs.
- [x] Verified 100% data integrity and permanently severed runtime dependencies on Google Sheets.

### Phase 2: Pipeline Engine & CLI (`uv` + `pyproject.toml`) ✅
- [x] Implemented `pipeline/scraper.py` with multi-tier parsing (JSON-LD geo coordinates extraction, Next.js hydration state `__NEXT_DATA__`, HTML fallback).
- [x] Implemented `pipeline/enricher.py` with Haversine distance calculator, peak rush-hour commute modeling, and zero-key geocoding.
- [x] Implemented `pipeline/aggregator.py` with floorplan grouping, raw snapshot archiving in `campaigns/<campaign>/raw/`, and user annotation protection.
- [x] Built CLI in `pipeline/cli.py` supporting `init-campaign`, `add`, `update`, `build`, `stats`, and `import-annotations`.
- [x] Configured modern Python packaging via `pyproject.toml` and `uv pip`.

### Phase 3: Responsive GitHub Pages Web Dashboard ✅
- [x] Built CSS design system in `web/src/styles/main.css` supporting HSL dark/light modes, dual-pane desktop workspace, and mobile touch layouts.
- [x] Implemented `web/src/components/Header.js` (campaign branding, metrics ribbon, theme toggle, export/import).
- [x] Implemented `web/src/components/FilterBar.js` (search, commute thresholds, bed counts, amenity toggles, status filters, sort dropdown).
- [x] Implemented `web/src/components/MapEngine.js` with Leaflet.js, commute-speed color-coded price badges, configurable hazard buffer circles reading `warning_radius_mi` from `campaign.json` (1.0 mi), workplace star marker, and layer switch drawer.
- [x] Implemented `web/src/components/ListingCard.js` (card feed) and `web/src/components/TableView.js` (dense spreadsheet grid).
- [x] Implemented `web/src/components/DetailModal.js` (full specs + personal note editor) and `web/src/components/CompareModal.js` (side-by-side comparison).
- [x] Implemented `web/src/components/StatsModal.js` (city distributions, hazard safety tiers).
- [x] Implemented `web/src/components/AnnotationManager.js` with instant `localStorage` persistence and one-click JSON export/import.
- [x] Implemented `web/src/main.js` orchestrating filter/sort state, map synchronization, and mobile bottom navigation.

### Phase 4: CI/CD & Deployment Workflow ✅
- [x] Created `.github/workflows/deploy.yml` utilizing `astral-sh/setup-uv` to compile campaign data and deploy to GitHub Pages on every push.
- [x] Created comprehensive documentation in `README.md`, `DESIGN.md`, `IMPLEMENTATION_PLAN.md`, and addressed all items from `CODE_REVIEW.md`.

---

## 4. Verification & Testing Matrix

| Test Suite / Area | Command / Verification Method | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Data Migration** | `python3 -m pipeline.seed_from_sheet` | ✅ Pass | 40 listings, 28 Superfund sites migrated. |
| **JSON-LD Geo Scrape** | `python3 -m pipeline.scraper` | ✅ Pass | Extracted coordinates preserved in returned location dict. |
| **Dynamic Hazard Radius** | Map rendering in browser | ✅ Pass | Reads `warning_radius_mi` from `campaign.json` (1.0 mi). |
| **Commute Pin Coloring** | Map rendering in browser | ✅ Pass | Price badges color-coded by commute speed (fast/moderate/heavy). |
| **CLI Stats** | `python3 -m pipeline.cli stats` | ✅ Pass | Average rent calculated at $3,238/mo across 40 properties. |
| **Data Compilation** | `python3 -m pipeline.cli build` | ✅ Pass | Compiled payload in `web/public/data/campaign_data.json`. |
| **Campaign Isolation** | `python3 -m pipeline.cli init-campaign test-move` | ✅ Pass | Verified clean scaffolding with default `min_zoom: 9`. |
| **Local Preview** | `cd web && python3 -m http.server 8000` | ✅ Pass | Interactive map, cards, filters, and modals render without errors. |
| **Environment Setup** | `uv venv && uv pip install -e .` | ✅ Pass | Dependency resolution and package installation in < 1 second. |

---

## 5. Operational Playbook

### Adding a New Listing from URL:
```bash
cd ~/sandbox/rental-tracker
source .venv/bin/activate
python3 -m pipeline.cli add "https://www.zillow.com/apartments/san-jose-ca/..." --campaign 2026-south-bay
```

### Syncing User Annotations from Web UI to Repository:
1. In the Web Dashboard, click **"Export Notes"** to download `annotations_YYYY-MM-DD.json`.
2. Merge into the repository:
   ```bash
   python3 -m pipeline.cli import-annotations ~/Downloads/annotations_2026-08-15.json --campaign 2026-south-bay
   ```

### Deploying Updates to GitHub Pages:
```bash
cd ~/sandbox/rental-tracker
git add .
git commit -m "update: Ingest new listings and sync annotations"
git push origin main
```
The GitHub Actions workflow will automatically compile the bundle and publish the new dashboard live.
