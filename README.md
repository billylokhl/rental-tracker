# 🏠 Rental Listing Tracker & Interactive Relocation Dashboard

A modern, standalone housing search and decision engine designed for first-class deployment to **GitHub Pages**. Features an interactive multi-layer spatial map (rentals, work offices, EPA Superfund hazard zones, transit, POIs), flexible filtering, local-first user curation, and an automated data enrichment pipeline.

Completely self-contained on native Git/JSON storage with **zero ongoing dependency on Google Sheets**.

---

## ✨ Features

- **🚀 GitHub Pages First-Class Hosting**: Instant static web deployment with zero backend maintenance cost.
- **🗺️ Interactive Multi-Layer Spatial Map (Leaflet.js)**:
  - **Candidate Properties**: Dynamic price badge markers (`$2.9k`, color-coded by commute score).
  - **Workplace Destination**: Star marker for your office (e.g. `Intel SC2` with 9:00 AM rush-hour arrival target).
  - **EPA Superfund Hazard Zones**: Caution markers with **0.75 mi danger buffer circles** from Santa Clara County EPA SEMS data.
  - **Transit & Groceries**: Caltrain/VTA stations, Trader Joe's, Whole Foods, 99 Ranch, Costco.
  - **Layer Switcher Drawer**: Toggle individual layers with live counts.
- **📱 Fully Responsive Design (Mobile, Tablet, Desktop)**:
  - **Desktop/Laptop**: Dual-pane workspace (Filters + Cards/Table on Left; Full-height interactive map on Right).
  - **Mobile (iPhone/Android)**: Touch-optimized bottom navigation (`[Listings]`, `[Map]`, `[Filters]`, `[Insights]`) and draggable bottom-sheet card preview on the map.
- **⚡ Dual View Modes**: Instant toggle between **Visual Property Cards** and **Dense Spreadsheet Data Table**.
- **⚖️ Side-by-Side Comparison**: Select 2–4 candidate properties to compare specs, commute, policies, and pros/cons.
- **📝 Local-First Curation**: Ratings, visit status (Unvisited, Scheduled, Visited, Applied, Rejected), and personal notes persist instantly in `localStorage` with a 1-click **"Export Notes to JSON"** feature.
- **🔄 Pluggable Campaign Architecture**: Easily reusable for future moves (e.g. `2028-seattle`, `2029-austin`) without changing code.

---

## 📂 Project Structure

```
rental-tracker/
├── campaigns/                       # Pluggable Campaign Data Layer
│   └── 2026-south-bay/              # Active 2026 relocation search (40 listings)
│       ├── campaign.json            # Campaign title, map center, layers config
│       ├── listings.json            # Master shortlist with rent, layout, amenities
│       ├── annotations.json         # User ratings, visit notes, highlights/lowlights
│       ├── reference/
│       │   ├── destinations.json    # Work destinations (Intel SC2, etc.)
│       │   ├── hazards.json         # EPA Superfund site reference coordinates
│       │   └── pois.json            # Transit stations, grocery stores
│       └── raw/                     # Historical scrape snapshots archive
├── pipeline/                        # Standalone Pipeline & Scraper Engine (Python)
│   ├── cli.py                       # CLI entry point (add, update, build, stats)
│   ├── models.py                    # Data schemas
│   ├── scraper.py                   # Multi-strategy web extractor (JSON-LD, Next.js)
│   ├── enricher.py                  # Haversine distance, commute & geocoding
│   ├── aggregator.py                # Floorplan grouping & raw snapshot manager
│   └── seed_from_sheet.py           # One-time migration script (already executed)
├── web/                             # Web Application (GitHub Pages distribution)
│   ├── index.html                   # HTML entry point
│   ├── src/
│   │   ├── main.js                  # Master application orchestrator
│   │   ├── styles/main.css          # Design system & responsive styles
│   │   └── components/              # Modular UI components
│   └── public/data/
│       └── campaign_data.json       # Compiled distribution bundle
└── .github/workflows/
    └── deploy.yml                   # Automated GitHub Actions deployment
```

---

## 🛠️ Environment Setup & CLI Quick Start (using `uv`)

### 1. Python Environment Setup
Using `uv` and `pyproject.toml`:
```bash
cd ~/sandbox/rental-tracker

# Create virtual environment and install dependencies
uv venv
uv pip install -e .

# Activate environment
source .venv/bin/activate
```

### 2. Ingest a New Listing from URL
```bash
python3 -m pipeline.cli add "https://www.zillow.com/apartments/san-jose-ca/..." --campaign 2026-south-bay
```

### 2. View Campaign Summary Statistics
```bash
python3 -m pipeline.cli stats --campaign 2026-south-bay
```

### 3. Re-enrich & Rebuild Data Bundle
```bash
python3 -m pipeline.cli build --campaign 2026-south-bay
```

### 4. Import User Notes Exported from Web UI
```bash
python3 -m pipeline.cli import-annotations path/to/annotations_2026-08-15.json --campaign 2026-south-bay
```

### 5. Spin Up a Future Relocation Campaign (e.g. 2028 Seattle)
```bash
python3 -m pipeline.cli init-campaign 2028-seattle \
  --title "2028 Seattle Relocation" \
  --region "Greater Seattle Area" \
  --lat 47.6062 --lng -122.3321 \
  --destination-name "Amazon HQ" \
  --destination-address "2121 7th Ave, Seattle, WA"
```

---

## 🌐 Deploying to GitHub Pages

1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Initialize Rental Tracker with GitHub Pages deployment"
   git push origin main
   ```
2. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. The included workflow `.github/workflows/deploy.yml` will automatically build and publish your dashboard live!

---

## 💻 Local Preview

You can test and preview the web dashboard locally with Python's built-in web server:

```bash
cd web
python3 -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.
