# 📐 System Design Document: Rental Listing Tracker & Dashboard

**Project**: Rental Listing Tracker  
**Target Platform**: GitHub Pages (Zero-Build Native ES Module Static SPA) + Local Python CLI (`uv`)  
**Repository Location**: `~/sandbox/rental-tracker`  
**Status**: Executed & Verified  

---

## 1. Executive Summary & Goals

The **Rental Listing Tracker** is a self-contained, privacy-friendly housing search and decision engine. It replaces traditional spreadsheet-based apartment hunting with:
1. **Automated Ingestion**: Extracts structured property, unit, amenity, and policy data from listing URLs (e.g. Zillow) via multi-tier parsing (JSON-LD, Next.js hydration state, and HTML heuristics).
2. **Floorplan Aggregation**: Collapses multi-unit inventory into distinct floorplan records with rent ranges.
3. **Spatial & Commute Intelligence**: Calculates rush-hour commute metrics to workplace destinations and proximity buffer zones to environmental hazard sites (EPA Superfund).
4. **Interactive Multi-Layer Map**: First-class Leaflet.js mapping with commute-colored price pins, workplace anchors, configurable hazard safety rings, transit stations, and grocery POIs.
5. **Responsive Dual-View UI**: High-density desktop workspace and touch-optimized mobile experience.
6. **Local-First Curation**: Ratings, visit statuses, and notes persist instantly in `localStorage` with Git export capabilities.
7. **Pluggable Architecture**: 100% agnostic to any specific city or year—easily reusable for future moves.

---

## 2. Architectural Principles

* **Zero External DB / No Google Sheets Dependency**: Native Git version-controlled JSON files serve as the single source of truth.
* **Separation of Scraped vs. Curated Data**: Automated scrapers never overwrite user ratings, visit statuses, or personal notes.
* **Pluggable Campaign Data Layer**: Campaign-specific coordinates, destinations, hazards, POIs, and listings live in isolated directories (`campaigns/<campaign_name>/`).
* **Zero-Build Overhead Static Architecture**: The frontend is built as pure, native modern ES Modules and Vanilla CSS with Leaflet loaded from CDN. GitHub Actions only compiles the active campaign JSON bundle and publishes the `web/` assets directly with zero bundler lock-in.

---

## 3. High-Level Architecture

```
                                  GIT REPOSITORY
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                 │
 │   ┌─────────────────────────────────────────────────────────────────────────┐   │
 │   │               CAMPAIGN DATA LAYER  (Pluggable & Swappable)               │   │
 │   │                                                                         │   │
 │   │   campaigns/                                                            │   │
 │   │   └── 2026-south-bay/  <─── (Swappable for 2028-seattle, 2029-austin)   │   │
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

## 4. Component Deep Dives

### 4.1. Extraction & Scraping Engine (`pipeline/scraper.py`)

A 3-tier resilient parser designed to extract rich listing data:
1. **JSON-LD Schema (`application/ld+json`)**: Parses standard Schema.org structured data (`ApartmentComplex`, `SingleFamilyResidence`, `RealEstateListing`) for geo coordinates (`lat`/`lng` preserved in returned `location` object), address, and high-res imagery.
2. **Next.js Hydration State (`__NEXT_DATA__`)**: Extracts full client-side state payloads embedded in modern real estate frontends.
3. **Heuristic HTML Fallback**: Employs targeted regex and DOM patterns to capture price ranges, bed/bath counts, square footage, in-unit laundry markers, A/C, pet policies, and included utilities.

### 4.2. Aggregation & Snapshot Archival (`pipeline/aggregator.py`)

- **Floorplan-Level Grouping**: Groups vacant units of identical floorplans into a single shortlist record with dynamic rent ranges (e.g. `$2,919 - $3,039`), preventing inventory noise.
- **Raw Scrape Archival**: Each scrape is timestamped and stored in `campaigns/<campaign>/raw/<timestamp>_<property>.json` for historical price trend analysis.
- **Annotation Protection**: Merges incoming listing updates while strictly preserving user ratings, visit statuses, and personal comments in `annotations.json`.

### 4.3. Spatial Enrichment Pipeline (`pipeline/enricher.py`)

- **Hazard Distance**: Uses the **Haversine formula** to compute geodesic distance (miles) to all known EPA SEMS Superfund sites in the region.
- **Commute Estimation**: Models peak rush-hour travel times to target workplaces (e.g. Intel SC2 at 9:00 AM arrival) incorporating urban topology multipliers and congestion bounds. Can optionally query the Google Routes / Distance Matrix API if a key is provided.
- **Zero-Key Geocoding**: Automatically resolves latitude/longitude using OpenStreetMap Nominatim with Google Geocoding fallback.

### 4.4. Frontend Web Application (`web/`)

- **Application Controller (`main.js`)**: Orchestrates data loading, filter/sort state changes, map synchronization, and responsive tab navigation.
- **Header & Metric Ribbon (`Header.js`)**: Campaign branding, live dataset summary (properties count, rent range, avg commute, shortlist count), theme toggle, and JSON export/import triggers.
- **Filter & Sort Engine (`FilterBar.js`)**: Real-time keyword search, bedroom pills, commute thresholds (&le;15m, &le;25m), amenity toggles (In-Unit Laundry, A/C, Pets OK, Superfund &gt;1.0 mi), and status filters.
- **Map Engine (`MapEngine.js`)**: Leaflet.js map with custom SVG DivIcons:
  - Commute-colored price badge pins:
    - ⚡ Fast (&le;15 min): Green border/accent (`.commute-fast`).
    - 🚗 Moderate (16–25 min): Amber/yellow border/accent (`.commute-mod`).
    - 🛑 Heavy (&gt;25 min): Coral/red border/accent (`.commute-heavy`).
  - Workplace destination star markers.
  - Superfund hazard caution markers with **configurable warning buffer circles** dynamically reading `warning_radius_mi` from `campaign.json` (e.g. 1.0 mi radius).
  - Transit (Caltrain/VTA) and grocery markers.
  - Floating layer switcher with live item counts.
- **View Modes**:
  - **Card View (`ListingCard.js`)**: High-visual feed with spec tags, notes snippets, and compare checkboxes.
  - **Table View (`TableView.js`)**: High-density spreadsheet-like grid with sortable columns.
- **Interactive Modals**:
  - **Detail & Notes Modal (`DetailModal.js`)**: Full spec sheet + in-browser editable curation form.
  - **Comparison Matrix (`CompareModal.js`)**: Side-by-side spec comparison of 2–4 selected properties.
  - **Analytics & Insights (`StatsModal.js`)**: Breakdown by city, price distributions, and hazard safety tiers.
- **Local-First Persistence (`AnnotationManager.js`)**: Instant `localStorage` synchronization for ratings, visit statuses, and notes with one-click JSON export/import.
- **Responsive System (`main.css`)**:
  - **Desktop (>= 1024px)**: Dual-pane layout (54% listings feed, 46% sticky map).
  - **Mobile (< 768px)**: Bottom navigation bar (`[Listings]`, `[Map]`, `[Filters]`, `[Insights]`) and draggable bottom-sheet card preview on the map.

---

## 5. Data Schemas

### `campaign.json`
```json
{
  "id": "2026-south-bay",
  "title": "2026 South Bay Relocation",
  "year": 2026,
  "region": "South Bay (Santa Clara / San Jose / Sunnyvale / Mountain View)",
  "map": {
    "default_center": [37.3688, -121.996],
    "default_zoom": 11,
    "min_zoom": 9,
    "max_zoom": 18
  },
  "target_destinations": ["intel_sc2"],
  "hazard_layers": [
    {
      "id": "superfund",
      "name": "EPA Superfund Sites",
      "warning_radius_mi": 1.0,
      "file": "reference/hazards.json"
    }
  ],
  "poi_layers": [
    {
      "id": "transit",
      "name": "Transit Stations (Caltrain / VTA)",
      "file": "reference/pois.json",
      "category": "transit"
    },
    {
      "id": "grocery",
      "name": "Supermarkets & Groceries",
      "file": "reference/pois.json",
      "category": "grocery"
    }
  ]
}
```

### `listings.json` (Snippet)
```json
{
  "id": "prop_1",
  "title": "515 Lincoln Ave — The Standard (Unit 422)",
  "property_name": "The Standard",
  "street_address": "515 Lincoln Ave",
  "city": "San Jose",
  "zip": "95126",
  "source": "Zillow",
  "type": "Apartment",
  "status": "available",
  "rent_display": "$3,248",
  "rent_min": 3248,
  "rent_max": 3248,
  "bedrooms": 1.0,
  "bathrooms": 1.0,
  "sqft": 654,
  "lease_length": "9-13 months",
  "location": { "lat": 37.3195052, "lng": -121.9089415 },
  "commute": {
    "intel_sc2": { "avg_min": 24, "range": "16-35" }
  },
  "hazard_proximity": { "superfund_mi": 2.45 },
  "amenities": {
    "laundry": "in-unit",
    "cooling": "A/C",
    "appliances": { "dishwasher": true, "microwave": true, "oven": true, "refrigerator": true }
  },
  "pets": { "allowed": true, "deposit": "$500", "monthly_fee": "$65" }
}
```

---

## 6. Future Extensibility (Multi-Campaign Guide)

To spin up a new search for a different city or year:
```bash
python3 -m pipeline.cli init-campaign 2028-seattle \
  --title "2028 Seattle Relocation" \
  --region "Greater Seattle Area" \
  --lat 47.6062 --lng -122.3321 \
  --destination-name "Amazon HQ" \
  --destination-address "2121 7th Ave, Seattle, WA"
```
This automatically scaffolds `campaigns/2028-seattle/` with isolated reference datasets, ready for ingestion without any code changes.
