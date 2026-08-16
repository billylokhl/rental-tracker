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

def normalize_url(u: str) -> str:
    """Strips scheme, www, trailing slashes, and query params for robust URL deduplication."""
    if not u:
        return ""
    cleaned = re.sub(r"^https?://(www\.)?", "", u.strip()).split("?")[0].rstrip("/")
    return cleaned.lower()

def clean_and_format_title(street: str, prop_name: str, unit_number: str = "") -> str:
    """Formats a clean title without redundant bed/bath/sqft snippets and includes unit number."""
    cleaned_prop = re.sub(r"\s*\(\s*(?:\d+x\d+|\d+\s*bed|\d+\s*bath|studio)[^)]*\)", "", prop_name or "", flags=re.I).strip()
    cleaned_prop = re.sub(r"\s*\(Unit\s+[^)]+\)", "", cleaned_prop, flags=re.I).strip()
    cleaned_street = re.sub(r"\s+APT\s+\S+", "", street or "", flags=re.I).strip()
    
    if cleaned_street and cleaned_prop and cleaned_prop.lower() != cleaned_street.lower():
        base = f"{cleaned_street} — {cleaned_prop}"
    elif cleaned_street:
        base = cleaned_street
    else:
        base = cleaned_prop or "Rental Listing"
        
    if unit_number:
        unit_str = unit_number.strip()
        if not unit_str.lower().startswith("unit") and not unit_str.lower().startswith("apt") and not unit_str.lower().startswith("plan") and not unit_str.lower().startswith("#"):
            unit_str = f"Unit {unit_str}"
        return f"{base} ({unit_str})"
    return base

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

        # 1. Check for duplicates before creating
        incoming_url = normalize_url(raw_data.get("url", ""))
        incoming_street = raw_data.get("street_address", "").strip().lower()
        incoming_city = raw_data.get("city", "").strip().lower()
        incoming_beds = float(raw_data.get("bedrooms") or 1.0)
        incoming_sqft = raw_data.get("sqft")

        for existing in listings:
            # Check A: URL match
            if incoming_url and normalize_url(existing.get("url", "")) == incoming_url:
                print(f"✓ Listing already exists by URL match: #{existing['id']} ({existing['title']}). Skipped duplicate creation.")
                existing["_is_duplicate"] = True
                return existing
            
            # Check B: Exact Address & Unit/Bed match
            ext_street = existing.get("street_address", "").strip().lower()
            ext_city = existing.get("city", "").strip().lower()
            ext_beds = float(existing.get("bedrooms") or 1.0)
            ext_sqft = existing.get("sqft")
            
            if incoming_street and ext_street and incoming_street == ext_street and (not incoming_city or not ext_city or incoming_city == ext_city):
                if abs(incoming_beds - ext_beds) < 0.1:
                    if not incoming_sqft or not ext_sqft or abs(int(incoming_sqft) - int(ext_sqft)) < 15:
                        print(f"✓ Listing already exists by address & unit match: #{existing['id']} ({existing['title']}). Skipped duplicate creation.")
                        existing["_is_duplicate"] = True
                        return existing

        # Generate unique listing ID safely
        max_id = 0
        for l in listings:
            m = re.match(r"prop_(\d+)", l.get("id", ""))
            if m:
                max_id = max(max_id, int(m.group(1)))
        listing_id = f"prop_{max_id + 1}"
        
        street = raw_data.get("street_address", "").strip()
        prop_name = raw_data.get("property_name", "").strip() or street
        unit_num = raw_data.get("unit_number", "").strip()
        
        # Check if unit in street address like APT 419 or #204
        if not unit_num:
            m_apt = re.search(r"APT\s+([0-9A-Za-z]+)", street, re.I)
            if m_apt:
                unit_num = f"Apt {m_apt.group(1)}"
            else:
                m_hash = re.search(r"#\s*([0-9A-Za-z]+)", street)
                if m_hash:
                    unit_num = f"#{m_hash.group(1)}"

        title = clean_and_format_title(street, prop_name, unit_num)

        r_min = raw_data.get("rent_min")
        r_max = raw_data.get("rent_max")
        if r_min and r_max and r_min != r_max:
            rent_display = f"${r_min:,} - ${r_max:,}"
        elif r_min:
            rent_display = f"${r_min:,}"
        else:
            rent_display = "Contact for price"

        photos_list = raw_data.get("photos", [])

        # Check for multi-unit payload
        multi_units = raw_data.get("units", [])
        if multi_units and len(multi_units) > 1:
            created_listings = []
            for u in multi_units:
                max_id += 1
                sub_id = f"prop_{max_id}"
                sub_unit_num = u.get("unit_number") or u.get("name") or ""
                sub_title = clean_and_format_title(street, prop_name, sub_unit_num)
                sub_r_min = u.get("rent_min", r_min)
                sub_r_max = u.get("rent_max", r_max)
                if sub_r_min and sub_r_max and sub_r_min != sub_r_max:
                    sub_rent_display = f"${sub_r_min:,} - ${sub_r_max:,}"
                elif sub_r_min:
                    sub_rent_display = f"${sub_r_min:,}"
                else:
                    sub_rent_display = "Contact for price"

                sub_listing = {
                    "id": sub_id,
                    "title": sub_title,
                    "property_name": re.sub(r"\s*\(\s*(?:\d+x\d+|\d+\s*bed|\d+\s*bath|studio)[^)]*\)", "", prop_name or "", flags=re.I).strip(),
                    "unit_number": sub_unit_num,
                    "street_address": street,
                    "city": raw_data.get("city", ""),
                    "zip": raw_data.get("zip", ""),
                    "source": "Zillow",
                    "type": "Apartment",
                    "status": "available",
                    "rent_display": sub_rent_display,
                    "rent_min": sub_r_min,
                    "rent_max": sub_r_max,
                    "bedrooms": u.get("bedrooms", raw_data.get("bedrooms", 1.0)),
                    "bathrooms": u.get("bathrooms", raw_data.get("bathrooms", 1.0)),
                    "sqft": u.get("sqft", raw_data.get("sqft")),
                    "available_date": u.get("available_date", "Available Now"),
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
                    "photos": photos_list,
                    "cover_photo": photos_list[0] if photos_list else "",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                sub_listing = self.enrich_listing(sub_listing)
                listings.append(sub_listing)
                annotations[sub_id] = {
                    "rating": "",
                    "visit_status": "unvisited",
                    "highlights": "",
                    "lowlights": "",
                    "user_notes": "",
                    "custom_tags": []
                }
                created_listings.append(sub_listing)
            self.save_all(listings, annotations)
            return created_listings[0]

        new_listing = {
            "id": listing_id,
            "title": title,
            "property_name": re.sub(r"\s*\(\s*(?:\d+x\d+|\d+\s*bed|\d+\s*bath|studio)[^)]*\)", "", prop_name or "", flags=re.I).strip(),
            "unit_number": unit_num,
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
            "photos": photos_list,
            "cover_photo": photos_list[0] if photos_list else "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # Enrich with commute, hazards, and geocodes
        new_listing = self.enrich_listing(new_listing)

        # Append to listings
        listings.append(new_listing)
        self.save_all(listings, annotations)

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

    def refresh_all_listings(self) -> Dict[str, Any]:
        """
        Refreshes all listings from their upstream source URLs while strictly
        protecting any fields manually entered or overridden by the user.
        """
        from .scraper import parse_listing_page
        listings = self.load_listings()
        annotations = self.load_annotations()
        
        updated_count = 0
        protected_count = 0
        skipped_count = 0

        for item in listings:
            url = item.get("url")
            if not url or not url.startswith("http"):
                skipped_count += 1
                continue
                
            print(f"Refreshing #{item['id']}: {item['title']} ...")
            raw = parse_listing_page(url)

            # Check for off-market / 404 status
            if raw.get("status") == "off-market" or (raw.get("error") and "404" in raw.get("error", "")):
                print(f"  ↳ Listing is OFF MARKET (404/delisted). Marking as off-market.")
                item["status"] = "off-market"
                item["updated_at"] = datetime.now(timezone.utc).isoformat()
                updated_count += 1
                continue

            if raw.get("error"):
                print(f"  ↳ Warning: {raw['error']}. Retaining existing data.")
                skipped_count += 1
                continue

            ann = annotations.get(item["id"], {})
            overrides = ann.get("custom_overrides", {})

            # 1. Rent protection
            if "rent_min" in overrides or "rent_max" in overrides or "rent_display" in overrides:
                protected_count += 1
            else:
                new_min = raw.get("rent_min")
                new_max = raw.get("rent_max")
                if new_min:
                    item["rent_min"] = new_min
                    item["rent_max"] = new_max or new_min
                    item["rent_display"] = f"${new_min:,} - ${new_max:,}" if new_max and new_min != new_max else f"${new_min:,}"
                    updated_count += 1

            # 2. Available Date protection
            if "available_date" in overrides:
                protected_count += 1
            else:
                new_avail = raw.get("available_date")
                if new_avail:
                    item["available_date"] = new_avail
                    updated_count += 1

            # 3. Sqft protection
            if "sqft" in overrides:
                protected_count += 1
            else:
                new_sqft = raw.get("sqft")
                if new_sqft:
                    item["sqft"] = new_sqft
                    updated_count += 1

            # 4. Bedrooms / Bathrooms protection
            if "bedrooms" not in overrides and raw.get("bedrooms"):
                item["bedrooms"] = raw.get("bedrooms")
            if "bathrooms" not in overrides and raw.get("bathrooms"):
                item["bathrooms"] = raw.get("bathrooms")

            # 5. Photos & Cover photo
            fresh_photos = raw.get("photos", [])
            if fresh_photos and (not item.get("photos") or len(fresh_photos) > len(item.get("photos", []))):
                item["photos"] = fresh_photos
                if not item.get("cover_photo"):
                    item["cover_photo"] = fresh_photos[0]

            # 6. Parking & Amenities
            if "parking" not in overrides:
                parking_val = raw.get("amenities", {}).get("parking")
                if parking_val and parking_val != "unspecified":
                    if "amenities" not in item: item["amenities"] = {}
                    item["amenities"]["parking"] = parking_val

            # 7. Fees
            if "application_fee" not in overrides:
                fee_val = raw.get("application", {}).get("fee")
                if fee_val:
                    if "application" not in item: item["application"] = {}
                    item["application"]["fee"] = fee_val

            item["updated_at"] = datetime.now(timezone.utc).isoformat()

        self.save_all(listings, annotations)
        return {
            "total": len(listings),
            "updated": updated_count,
            "protected_fields": protected_count,
            "skipped": skipped_count
        }

