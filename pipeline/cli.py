"""
CLI Entry Point for Rental Tracker.
Manages campaigns, ingests URLs, updates listings, and builds static payloads for GitHub Pages.
"""

import sys
import os
import argparse
import json
import shutil
from datetime import datetime, timezone

from .models import Listing, Annotation
from .scraper import parse_listing_page
from .aggregator import CampaignAggregator, load_json, save_json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMPAIGNS_DIR = os.path.join(BASE_DIR, "campaigns")
WEB_PUBLIC_DATA = os.path.join(BASE_DIR, "web", "public", "data")

def get_campaign_dir(campaign_name: str = "2026-south-bay") -> str:
    cdir = os.path.join(CAMPAIGNS_DIR, campaign_name)
    if not os.path.exists(cdir):
        print(f"Error: Campaign '{campaign_name}' not found at {cdir}")
        sys.exit(1)
    return cdir

def cmd_init_campaign(args):
    name = args.name.strip().lower().replace(" ", "-")
    target_dir = os.path.join(CAMPAIGNS_DIR, name)
    if os.path.exists(target_dir):
        print(f"Error: Campaign directory '{name}' already exists.")
        return

    os.makedirs(os.path.join(target_dir, "raw"), exist_ok=True)
    os.makedirs(os.path.join(target_dir, "reference"), exist_ok=True)

    config = {
        "id": name,
        "title": args.title or name.replace("-", " ").title(),
        "year": datetime.now().year,
        "region": args.region or "Target Search Area",
        "map": {
            "default_center": [args.lat, args.lng],
            "default_zoom": 11,
            "min_zoom": 9,
            "max_zoom": 18
        },
        "target_destinations": ["work_office"],
        "hazard_layers": [],
        "poi_layers": []
    }
    save_json(os.path.join(target_dir, "campaign.json"), config)

    destinations = [{
        "id": "work_office",
        "name": args.destination_name or "Workplace / Office",
        "address": args.destination_address or "",
        "lat": args.lat,
        "lng": args.lng,
        "arrival_iso": "2026-09-01T09:00:00-07:00",
        "icon": "star"
    }]
    save_json(os.path.join(target_dir, "reference", "destinations.json"), destinations)
    save_json(os.path.join(target_dir, "reference", "hazards.json"), [])
    save_json(os.path.join(target_dir, "reference", "pois.json"), [])
    save_json(os.path.join(target_dir, "listings.json"), [])
    save_json(os.path.join(target_dir, "annotations.json"), {})

    print(f"Successfully initialized campaign '{name}' at {target_dir}")

def cmd_add(args):
    cdir = get_campaign_dir(args.campaign)
    agg = CampaignAggregator(cdir)
    print(f"Scraping listing URL: {args.url} ...")
    raw_data = parse_listing_page(args.url)
    
    # Apply optional manual inputs/overrides if supplied
    if getattr(args, "unit", None):
        raw_data["unit_number"] = str(args.unit).strip()
    if getattr(args, "rent", None) and str(args.rent).strip():
        try:
            r = int(re.sub(r"[^\d]", "", str(args.rent)))
            raw_data["rent_min"] = r
            raw_data["rent_max"] = r
            raw_data["rent_display"] = f"${r:,}"
        except Exception:
            pass
    if getattr(args, "beds", None) is not None and str(args.beds).strip() != "":
        try:
            raw_data["bedrooms"] = float(args.beds)
        except Exception:
            pass
    if getattr(args, "address", None) and str(args.address).strip():
        raw_data["street_address"] = str(args.address).strip()

    if raw_data.get("error"):
        print(f"Scrape warning: {raw_data['error']}. Creating template entry.")
    
    item = agg.ingest_scraped_listing(raw_data)
    print(f"Added listing #{item['id']}: {item['title']} (${item['rent_display']})")
    
    # Auto rebuild web data
    cmd_build(args)

def cmd_update(args):
    cdir = get_campaign_dir(args.campaign)
    agg = CampaignAggregator(cdir)
    listings = agg.load_listings()
    print(f"Re-enriching {len(listings)} listings in '{args.campaign}'...")
    for idx, item in enumerate(listings):
        listings[idx] = agg.enrich_listing(item)
    save_json(agg.listings_file, listings)
    print("Re-enrichment complete.")
    cmd_build(args)

def cmd_refresh(args):
    cdir = get_campaign_dir(args.campaign)
    agg = CampaignAggregator(cdir)
    print(f"Refreshing active listings for campaign '{args.campaign}'...")
    stats = agg.refresh_all_listings()
    print(f"✓ Refresh complete: {stats['updated']} updated, {stats['protected_fields']} user manual overrides preserved, {stats['skipped']} skipped/unmodified.")
    cmd_build(args)

def cmd_build(args):
    cdir = get_campaign_dir(args.campaign)
    os.makedirs(WEB_PUBLIC_DATA, exist_ok=True)
    
    # Copy campaign files to web/public/data
    campaign_config = load_json(os.path.join(cdir, "campaign.json"))
    destinations = load_json(os.path.join(cdir, "reference", "destinations.json"))
    hazards = load_json(os.path.join(cdir, "reference", "hazards.json"))
    pois = load_json(os.path.join(cdir, "reference", "pois.json"))
    odor_zones = load_json(os.path.join(cdir, "reference", "odor_zones.json"), {})
    crime_data = load_json(os.path.join(cdir, "reference", "crime_data.json"), {})
    listings = load_json(os.path.join(cdir, "listings.json"))
    annotations = load_json(os.path.join(cdir, "annotations.json"))

    from pipeline.enricher import extract_google_photos_media
    for item in listings:
        ann = annotations.get(item["id"], {})
        media_url = ann.get("media_album_url") or item.get("media_album_url")
        if media_url:
            item["media_album_url"] = media_url
            if not item.get("photos") or len(item.get("photos", [])) == 0:
                extracted = extract_google_photos_media(media_url)
                if extracted:
                    item["photos"] = extracted
            if item.get("photos"):
                item["cover_photo"] = item["photos"][0]

    # 2. Automated Quality Assurance & Data Integrity Validation
    from .validator import validate_campaign_dataset
    is_valid, validation_errors = validate_campaign_dataset(listings, campaign_config)
    if not is_valid:
        print(f"\n⚠️  DATA QUALITY WARNING: {len(validation_errors)} integrity issue(s) detected during build:")
        for err in validation_errors:
            print(f"  ❌ {err}")
        print("Please resolve these data errors or review listing links.\n")

    # Bundle into a unified distribution payload
    bundle = {
        "campaign": campaign_config,
        "destinations": destinations,
        "hazards": hazards,
        "pois": pois,
        "odor_zones": odor_zones,
        "crime_data": crime_data,
        "listings": listings,
        "annotations": annotations,
        "built_at": datetime.now(timezone.utc).isoformat()
    }
    
    bundle_path = os.path.join(WEB_PUBLIC_DATA, "campaign_data.json")
    save_json(bundle_path, bundle)
    print(f"Compiled bundle ({len(listings)} listings) to {bundle_path}")

def cmd_stats(args):
    cdir = get_campaign_dir(args.campaign)
    agg = CampaignAggregator(cdir)
    listings = agg.load_listings()
    annotations = agg.load_annotations()
    
    total = len(listings)
    rents = [l["rent_min"] for l in listings if l.get("rent_min")]
    avg_rent = sum(rents) // len(rents) if rents else 0
    min_rent = min(rents) if rents else 0
    max_rent = max(rents) if rents else 0
    
    visited = sum(1 for a in annotations.values() if a.get("visit_status") == "visited")
    shortlisted = sum(1 for a in annotations.values() if a.get("rating") in ["1", "2", "3", "Top", "Yes"])

    print("\n" + "="*45)
    print(f" Campaign Summary: {args.campaign}")
    print("="*45)
    print(f" Total Properties Monitored : {total}")
    print(f" Rent Range                 : ${min_rent:,} - ${max_rent:,} (Avg: ${avg_rent:,})")
    print(f" Properties Visited         : {visited}")
    print(f" Rated / Shortlisted        : {shortlisted}")
    print("="*45 + "\n")

def cmd_import_annotations(args):
    cdir = get_campaign_dir(args.campaign)
    agg = CampaignAggregator(cdir)
    if not os.path.exists(args.file):
        print(f"Error: Annotations file '{args.file}' not found.")
        return
    incoming = load_json(args.file)
    existing = agg.load_annotations()
    existing.update(incoming)
    save_json(agg.annotations_file, existing)
    print(f"Successfully merged annotations from {args.file} into campaign '{args.campaign}'")
    cmd_build(args)

def main():
    parser = argparse.ArgumentParser(description="Rental Tracker CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init-campaign
    p_init = subparsers.add_parser("init-campaign", help="Initialize a new search campaign")
    p_init.add_argument("name", help="Campaign slug (e.g. 2028-seattle)")
    p_init.add_argument("--title", help="Display title")
    p_init.add_argument("--region", help="Region name")
    p_init.add_argument("--lat", type=float, default=37.3888, help="Default center latitude")
    p_init.add_argument("--lng", type=float, default=-121.9644, help="Default center longitude")
    p_init.add_argument("--destination-name", help="Workplace/Destination name")
    p_init.add_argument("--destination-address", help="Workplace/Destination address")
    p_init.set_defaults(func=cmd_init_campaign)

    # add
    p_add = subparsers.add_parser("add", help="Add listing from URL")
    p_add.add_argument("url", help="Listing URL (e.g. Zillow)")
    p_add.add_argument("--campaign", default="2026-south-bay", help="Target campaign")
    p_add.add_argument("--unit", help="Optional unit number or floorplan (e.g. Unit 101)")
    p_add.add_argument("--rent", help="Optional rent price override (e.g. 2950)")
    p_add.add_argument("--beds", help="Optional bedrooms count override (e.g. 1 or 0 for Studio)")
    p_add.add_argument("--address", help="Optional street address override")
    p_add.set_defaults(func=cmd_add)

    # update
    p_update = subparsers.add_parser("update", help="Re-enrich and refresh listings")
    p_update.add_argument("--campaign", default="2026-south-bay", help="Target campaign")
    p_update.set_defaults(func=cmd_update)

    # refresh
    p_refresh = subparsers.add_parser("refresh", help="Sync and refresh all listings from upstream sources while preserving user edits")
    p_refresh.add_argument("--campaign", default="2026-south-bay", help="Target campaign")
    p_refresh.set_defaults(func=cmd_refresh)

    # build
    p_build = subparsers.add_parser("build", help="Build and export web public data")
    p_build.add_argument("--campaign", default="2026-south-bay", help="Target campaign")
    p_build.set_defaults(func=cmd_build)

    # stats
    p_stats = subparsers.add_parser("stats", help="Display campaign statistics")
    p_stats.add_argument("--campaign", default="2026-south-bay", help="Target campaign")
    p_stats.set_defaults(func=cmd_stats)

    # import-annotations
    p_import = subparsers.add_parser("import-annotations", help="Import user notes/annotations exported from UI")
    p_import.add_argument("file", help="Path to exported annotations JSON")
    p_import.add_argument("--campaign", default="2026-south-bay", help="Target campaign")
    p_import.set_defaults(func=cmd_import_annotations)

    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
