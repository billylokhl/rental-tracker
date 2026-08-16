"""
Aggregator engine: merges raw scrapes into floorplan-level shortlist entries,
calculates enrichment metrics, preserves scrape history, and protects user annotations.
"""

import json
import os
import re
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from .models import Listing, GeoLocation, CommuteEstimate, Amenities, PetPolicy, ApplicationInfo
from .enricher import geocode_address, calculate_nearest_hazard, estimate_commute_minutes

def load_json(filepath: str, default: Any = None) -> Any:
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return json.load(f)
    return default if default is not None else {}

def save_json(filepath: str, data: Any):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

class CampaignAggregator:
    def __init__(self, campaign_dir: str):
        self.campaign_dir = campaign_dir
        self.campaign_config = load_json(os.path.join(campaign_dir, "campaign.json"), {})
        self.destinations = load_json(os.path.join(campaign_dir, "reference", "destinations.json"), [])
        self.hazards = load_json(os.path.join(campaign_dir, "reference", "hazards.json"), [])
        self.pois = load_json(os.path.join(campaign_dir, "reference", "pois.json"), [])
        self.listings_file = os.path.join(campaign_dir, "listings.json")
        self.annotations_file = os.path.join(campaign_dir, "annotations.json")
        self.raw_dir = os.path.join(campaign_dir, "raw")
        os.makedirs(self.raw_dir, exist_ok=True)

    def load_listings(self) -> List[Dict[str, Any]]:
        return load_json(self.listings_file, [])

    def load_annotations(self) -> Dict[str, Any]:
        return load_json(self.annotations_file, {})

    def save_all(self, listings: List[Dict[str, Any]], annotations: Dict[str, Any]):
        save_json(self.listings_file, listings)
        save_json(self.annotations_file, annotations)

    def archive_raw_scrape(self, raw_data: Dict[str, Any]) -> str:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", raw_data.get("property_name", "listing"))[:30]
        filename = f"{ts}_{safe_name}.json"
        filepath = os.path.join(self.raw_dir, filename)
        save_json(filepath, raw_data)
        return filename

    def enrich_listing(self, listing_data: Dict[str, Any]) -> Dict[str, Any]:
        # 1. Geocode if missing lat/lng
        loc = listing_data.get("location")
        if not loc or not loc.get("lat") or not loc.get("lng"):
            full_addr = f"{listing_data.get('street_address', '')}, {listing_data.get('city', '')}, {listing_data.get('zip', '')}"
            coords = geocode_address(full_addr)
            if coords:
                listing_data["location"] = {"lat": coords[0], "lng": coords[1]}
            else:
                def_center = self.campaign_config.get("map", {}).get("default_center", [37.3688, -121.996])
                listing_data["location"] = {"lat": def_center[0], "lng": def_center[1]}

        lat = listing_data["location"]["lat"]
        lng = listing_data["location"]["lng"]

        # 2. Hazard Proximity Calculation
        if self.hazards:
            dist_sf, nearest_sf = calculate_nearest_hazard(lat, lng, self.hazards)
            if "hazard_proximity" not in listing_data:
                listing_data["hazard_proximity"] = {}
            listing_data["hazard_proximity"]["superfund_mi"] = dist_sf

        # 3. Commute Calculation to all target destinations
        if "commute" not in listing_data:
            listing_data["commute"] = {}
            
        for dest in self.destinations:
            dest_id = dest.get("id", "destination")
            d_lat = dest.get("lat")
            d_lng = dest.get("lng")
            if d_lat is not None and d_lng is not None:
                est = estimate_commute_minutes(lat, lng, d_lat, d_lng)
                listing_data["commute"][dest_id] = est

        return listing_data

    def ingest_scraped_listing(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        # Save raw scrape archive
        self.archive_raw_scrape(raw_data)

        listings = self.load_listings()
        annotations = self.load_annotations()

        # Generate unique listing ID
        listing_id = f"prop_{len(listings) + 1}"
        
        street = raw_data.get("street_address", "").strip()
        prop_name = raw_data.get("property_name", "").strip() or street
        title = f"{street} — {prop_name}" if street and prop_name != street else (street or prop_name)

        r_min = raw_data.get("rent_min")
        r_max = raw_data.get("rent_max")
        if r_min and r_max and r_min != r_max:
            rent_display = f"${r_min:,} - ${r_max:,}"
        elif r_min:
            rent_display = f"${r_min:,}"
        else:
            rent_display = "Contact for price"

        new_listing = {
            "id": listing_id,
            "title": title,
            "property_name": prop_name,
            "street_address": street,
            "city": raw_data.get("city", ""),
            "zip": raw_data.get("zip", ""),
            "source": "Zillow",
            "type": "Apartment",
            "status": "available",
            "rent_display": rent_display,
            "rent_min": r_min,
            "rent_max": r_max,
            "bedrooms": raw_data.get("bedrooms", 1.0),
            "bathrooms": raw_data.get("bathrooms", 1.0),
            "sqft": raw_data.get("sqft"),
            "lease_length": raw_data.get("lease_length", "12 months"),
            "location": raw_data.get("location", {}),
            "amenities": raw_data.get("amenities", {
                "laundry": "in-unit",
                "appliances": {"dishwasher": True, "refrigerator": True, "oven": True, "microwave": True},
                "utilities_included": {}
            }),
            "pets": raw_data.get("pets", {"allowed": True, "note": "Pet friendly"}),
            "application": {"method": "Online", "fee": ""},
            "url": raw_data.get("url", ""),
            "photos": raw_data.get("photos", []),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # Enrich with commute, hazards, and geocodes
        new_listing = self.enrich_listing(new_listing)

        # Append to listings
        listings.append(new_listing)

        # Initialize annotation entry
        annotations[listing_id] = {
            "rating": "",
            "visit_status": "unvisited",
            "highlights": "",
            "lowlights": "",
            "user_notes": "",
            "custom_tags": []
        }

        self.save_all(listings, annotations)
        return new_listing
