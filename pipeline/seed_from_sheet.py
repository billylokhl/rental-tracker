"""
One-Time Google Sheets Migration Script for 2026 Relocation Data.
Fetches all tabs from the public spreadsheet, parses, cleans, and generates
the native JSON datasets for the '2026-south-bay' campaign.
"""

import json
import os
import urllib.request
import csv
import io
import re
from datetime import datetime

SPREADSHEET_ID = "13TjRkgdvZNhq9HOfQ8_kBEqQXmiYVXyFqa41-C7bqDk"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMPAIGN_DIR = os.path.join(BASE_DIR, "campaigns", "2026-south-bay")

def fetch_csv(gid: str):
    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid={gid}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8")

def parse_price(val: str):
    if not val:
        return None
    # e.g. "$3,248" or "$3,248 - $3,400"
    nums = [int(n.replace(",", "").replace("$", "")) for n in re.findall(r"\$([0-9,]+)", val)]
    if not nums:
        return None
    return min(nums)

def parse_bool(val: str):
    if not val:
        return False
    val = val.strip().upper()
    return val in ["TRUE", "Y", "YES", "1"]

def parse_int(val: str):
    if not val:
        return None
    m = re.search(r"\d+", val)
    return int(m.group(0)) if m else None

def parse_float(val: str):
    if not val:
        return None
    m = re.search(r"[-+]?\d*\.?\d+", val)
    return float(m.group(0)) if m else None

def run_migration():
    os.makedirs(os.path.join(CAMPAIGN_DIR, "raw"), exist_ok=True)
    os.makedirs(os.path.join(CAMPAIGN_DIR, "reference"), exist_ok=True)

    print("Step 1: Fetching _ref_destinations (gid 931706093)...")
    dest_csv = fetch_csv("931706093")
    dest_reader = csv.DictReader(io.StringIO(dest_csv))
    destinations = []
    for row in dest_reader:
        if row.get("label"):
            destinations.append({
                "id": row.get("key", "intel_sc2"),
                "name": row.get("label"),
                "address": row.get("address"),
                "lat": float(row["lat"]) if row.get("lat") else 37.3888,
                "lng": float(row["lng"]) if row.get("lng") else -121.9644,
                "arrival_iso": row.get("arrival_iso", "2026-08-12T09:00:00-07:00"),
                "icon": "star"
            })
    if not destinations:
        destinations = [{
            "id": "intel_sc2",
            "name": "Intel SC2",
            "address": "3065 Bowers Ave, Santa Clara, CA 95054",
            "lat": 37.388849,
            "lng": -121.964448,
            "arrival_iso": "2026-08-12T09:00:00-07:00",
            "icon": "star"
        }]
    with open(os.path.join(CAMPAIGN_DIR, "reference", "destinations.json"), "w") as f:
        json.dump(destinations, f, indent=2)

    print("Step 2: Fetching _ref_superfund (gid 1414986548)...")
    superfund_csv = fetch_csv("1414986548")
    sf_reader = csv.DictReader(io.StringIO(superfund_csv))
    hazards = []
    for i, row in enumerate(sf_reader):
        if row.get("label") and row.get("lat") and row.get("lng"):
            hazards.append({
                "id": f"sf_{i+1}",
                "name": row["label"],
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "precision": row.get("precision", "EPA SEMS"),
                "type": "superfund"
            })
    with open(os.path.join(CAMPAIGN_DIR, "reference", "hazards.json"), "w") as f:
        json.dump(hazards, f, indent=2)

    print("Step 3: Fetching _map_listings (gid 568080050)...")
    map_csv = fetch_csv("568080050")
    map_reader = csv.DictReader(io.StringIO(map_csv))
    geocodes = {}
    for row in map_reader:
        addr = row.get("address", "").strip()
        if addr and row.get("latitude") and row.get("longitude"):
            geocodes[addr] = {
                "lat": float(row["latitude"]),
                "lng": float(row["longitude"])
            }

    print("Step 4: Fetching POIs / Transit reference data...")
    pois = [
        {"id": "caltrain_santa_clara", "name": "Santa Clara Caltrain Station", "category": "transit", "lat": 37.3531, "lng": -121.9366, "icon": "train"},
        {"id": "caltrain_sunnyvale", "name": "Sunnyvale Caltrain Station", "category": "transit", "lat": 37.3784, "lng": -122.0307, "icon": "train"},
        {"id": "caltrain_mountain_view", "name": "Mountain View Caltrain / Transit Center", "category": "transit", "lat": 37.3944, "lng": -122.0763, "icon": "train"},
        {"id": "vta_great_america", "name": "Great America Station (VTA Light Rail)", "category": "transit", "lat": 37.4042, "lng": -121.9760, "icon": "train"},
        {"id": "vta_tasman", "name": "Tasman VTA Station", "category": "transit", "lat": 37.4124, "lng": -121.9680, "icon": "train"},
        {"id": "tj_sunnyvale", "name": "Trader Joe's (Sunnyvale)", "category": "grocery", "lat": 37.3621, "lng": -122.0322, "icon": "shopping-cart"},
        {"id": "tj_mountain_view", "name": "Trader Joe's (Mountain View)", "category": "grocery", "lat": 37.3792, "lng": -122.0621, "icon": "shopping-cart"},
        {"id": "whole_foods_santa_clara", "name": "Whole Foods Market (Santa Clara Square)", "category": "grocery", "lat": 37.3916, "lng": -121.9691, "icon": "shopping-cart"},
        {"id": "costco_sunnyvale", "name": "Costco Wholesale (Sunnyvale)", "category": "grocery", "lat": 37.3719, "lng": -121.9961, "icon": "shopping-bag"},
        {"id": "ranch99_mountain_view", "name": "99 Ranch Market (Mountain View)", "category": "grocery", "lat": 37.3986, "lng": -122.1092, "icon": "shopping-cart"}
    ]
    with open(os.path.join(CAMPAIGN_DIR, "reference", "pois.json"), "w") as f:
        json.dump(pois, f, indent=2)

    print("Step 5: Fetching Listings tab (gid 0)...")
    listings_csv = fetch_csv("0")
    listings_reader = csv.DictReader(io.StringIO(listings_csv))
    
    listings = []
    annotations = {}

    for idx, row in enumerate(listings_reader):
        raw_address = row.get("Address", "").strip()
        if not raw_address:
            continue

        # Extract title and street
        # Format usually: "515 Lincoln Ave — The Standard (Unit 422)"
        parts = raw_address.split(" — ")
        street_address = parts[0].strip()
        property_name = parts[1].strip() if len(parts) > 1 else street_address

        # Check geocodes lookup
        geo = None
        # Try finding exact or matching prefix
        for g_addr, g_coords in geocodes.items():
            if street_address.lower() in g_addr.lower() or g_addr.lower() in street_address.lower():
                geo = g_coords
                break
        
        # Fallback default coords if not found
        if not geo:
            geo = {"lat": 37.3688, "lng": -121.996}

        listing_id = f"prop_{idx+1}"

        # Clean rent
        rent_str = row.get("rent", "").strip()
        rent_val = parse_price(rent_str)

        # Commute
        commute_avg = parse_int(row.get("Intel SC2 avg", ""))
        commute_bound = row.get("bound", "").strip()

        # Superfund dist
        sf_dist = parse_float(row.get("Distance to Superfund (mi)", ""))

        listing_item = {
            "id": listing_id,
            "title": raw_address,
            "property_name": property_name,
            "street_address": street_address,
            "city": row.get("city", "").strip(),
            "zip": row.get("zip", "").strip(),
            "source": row.get("listing", "Zillow").strip(),
            "type": row.get("type", "Apartment").strip(),
            "status": row.get("status", "available").strip() or "available",
            "rent_display": rent_str or "Contact for price",
            "rent_min": rent_val,
            "rent_max": rent_val,
            "bedrooms": parse_float(row.get("bedrooms", "1")),
            "bathrooms": parse_float(row.get("bathrooms", "1")),
            "sqft": parse_int(row.get("sqft", "")),
            "lease_length": row.get("lease length", "").strip(),
            "location": geo,
            "commute": {
                "intel_sc2": {
                    "avg_min": commute_avg,
                    "range": commute_bound
                }
            },
            "hazard_proximity": {
                "superfund_mi": sf_dist
            },
            "amenities": {
                "laundry": row.get("laundry", "").strip(),
                "laundry_note": row.get("laundry note", "").strip(),
                "parking": row.get("parking", "").strip(),
                "heating": row.get("heating", "").strip(),
                "cooling": row.get("cooling", "").strip(),
                "fenced_yard": parse_bool(row.get("fenced yard", "")),
                "appliances": {
                    "dishwasher": parse_bool(row.get("dishwasher", "")),
                    "microwave": parse_bool(row.get("microwave", "")),
                    "oven": parse_bool(row.get("oven", "")),
                    "refrigerator": parse_bool(row.get("refrigerator", ""))
                },
                "utilities_included": {
                    "water": parse_bool(row.get("water", "")),
                    "garbage": parse_bool(row.get("garbage", "")),
                    "electricity": parse_bool(row.get("electricity", "")),
                    "gas": parse_bool(row.get("gas", "")),
                    "internet": parse_bool(row.get("internet", "")),
                    "gardening": parse_bool(row.get("gardening", ""))
                }
            },
            "pets": {
                "allowed": parse_bool(row.get("pet?", "")),
                "note": row.get("pet note", "").strip(),
                "deposit": row.get("pet deposit", "").strip(),
                "monthly_fee": row.get("pet fee/mo", "").strip()
            },
            "application": {
                "method": row.get("Application method", "").strip(),
                "fee": row.get("App fee", "").strip()
            },
            "created_at": "2026-08-12T00:00:00Z",
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
        listings.append(listing_item)

        # Store user curation separately in annotations
        annotations[listing_id] = {
            "rating": row.get("R", "").strip(),
            "visit_status": row.get("visit", "").strip() or "unvisited",
            "highlights": row.get("highlights", "").strip(),
            "lowlights": row.get("lowlights", "").strip(),
            "user_notes": ""
        }

    with open(os.path.join(CAMPAIGN_DIR, "listings.json"), "w") as f:
        json.dump(listings, f, indent=2)

    with open(os.path.join(CAMPAIGN_DIR, "annotations.json"), "w") as f:
        json.dump(annotations, f, indent=2)

    # Write campaign config
    campaign_config = {
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
    with open(os.path.join(CAMPAIGN_DIR, "campaign.json"), "w") as f:
        json.dump(campaign_config, f, indent=2)

    print(f"Migration completed successfully! Imported {len(listings)} listings into {CAMPAIGN_DIR}")

if __name__ == "__main__":
    run_migration()
