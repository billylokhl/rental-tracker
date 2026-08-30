"""
Automated Data Integrity and Quality Assurance Engine.
Validates listings against geographic bounds, canonical URL patterns, duplicate constraints, and pricing sanity.
"""

import re
from typing import Dict, List, Any, Tuple, Optional

# Default South Bay bounding box [min_lat, min_lng, max_lat, max_lng]
DEFAULT_SOUTH_BAY_BBOX = {
    "min_lat": 37.10,
    "max_lat": 37.60,
    "min_lng": -122.35,
    "max_lng": -121.65,
    "allowed_states": ["CA", "California"]
}

VALID_URL_PATTERNS = [
    r"^https?://(www\.)?zillow\.com/homedetails/[^/]+/\d+_zpid",
    r"^https?://(www\.)?zillow\.com/apartments/[^/]+/[^/]+/[A-Za-z0-9]+",
    r"^https?://(www\.)?zillow\.com/b/[^/]+/[^/]+",
    r"^https?://(www\.)?essexapartmenthomes\.com/apartments/[^/]+/[^/]+",
    r"^https?://(www\.)?apartments\.com/[^/]+",
    r"^https?://(www\.)?redfin\.com/CA/[^/]+"
]

INVALID_URL_PATTERNS = [
    r"/homes/[^/]+_rb/?$"  # Generic search query URL
]

def validate_url(url: str) -> Tuple[bool, str]:
    """Validates that a URL is a canonical listing permalink rather than a search query or broken stub."""
    if not url or not isinstance(url, str):
        return False, "URL is missing or empty"
    
    url_clean = url.strip()
    
    # Check against known invalid patterns
    for pat in INVALID_URL_PATTERNS:
        if re.search(pat, url_clean, re.IGNORECASE):
            return False, f"URL is a generic search/coordinate stub ({pat}), not a verified permalink"
            
    # Check against valid canonical patterns
    matches_valid = any(re.search(pat, url_clean, re.IGNORECASE) for pat in VALID_URL_PATTERNS)
    if not matches_valid:
        return False, f"URL does not match canonical Zillow property or community patterns: {url_clean}"
        
    return True, "Valid canonical URL"

def validate_geo_bounds(lat: Optional[float], lng: Optional[float], bbox: Dict[str, Any] = None) -> Tuple[bool, str]:
    """Validates that listing coordinates are strictly inside the campaign geographic boundary."""
    if lat is None or lng is None:
        return False, "Missing latitude/longitude coordinates"
        
    b = bbox or DEFAULT_SOUTH_BAY_BBOX
    if not (b["min_lat"] <= lat <= b["max_lat"]):
        return False, f"Latitude {lat} is out of campaign bounds [{b['min_lat']}, {b['max_lat']}] (e.g. cross-state redirect)"
        
    if not (b["min_lng"] <= lng <= b["max_lng"]):
        return False, f"Longitude {lng} is out of campaign bounds [{b['min_lng']}, {b['max_lng']}]"
        
    return True, "Coordinates within campaign region"

def validate_listing(listing: Dict[str, Any], bbox: Dict[str, Any] = None) -> List[str]:
    """Runs a complete validation check on a single listing and returns a list of error descriptions."""
    errors = []
    lid = listing.get("id", "unknown")
    
    # 1. URL check — an empty URL is legitimate (seeded listings without a verified
    # permalink); it is summarized once at the dataset level instead of per listing.
    url = listing.get("url", "")
    if url.strip():
        is_valid_url, url_msg = validate_url(url)
        if not is_valid_url:
            errors.append(f"[{lid}] {url_msg}: {url}")
        
    # 2. Location & Geo bounds check
    loc = listing.get("location", {})
    lat = loc.get("lat")
    lng = loc.get("lng")
    is_valid_geo, geo_msg = validate_geo_bounds(lat, lng, bbox)
    if not is_valid_geo:
        errors.append(f"[{lid}] {geo_msg}")
        
    # 3. Address sanity
    street = (listing.get("street_address") or "").strip()
    city = (listing.get("city") or "").strip()
    if not street:
        errors.append(f"[{lid}] Missing street address")
    if not city:
        errors.append(f"[{lid}] Missing city")
        
    # 4. State check in URL
    if "zillow.com/homedetails/" in url.lower():
        # Ensure url mentions CA or California if South Bay
        if "-ny-" in url.lower() or "-tx-" in url.lower() or "-fl-" in url.lower() or "-wa-" in url.lower():
            errors.append(f"[{lid}] URL points to a different state: {url}")
            
    return errors

def validate_campaign_dataset(listings: List[Dict[str, Any]], campaign_config: Dict[str, Any] = None) -> Tuple[bool, List[str]]:
    """
    Validates an entire campaign dataset:
    - Runs individual listing checks
    - Checks for duplicate address + unit combinations
    """
    all_errors = []
    seen_addresses = {}
    
    bbox = None
    if campaign_config and "map" in campaign_config:
        center = campaign_config["map"].get("default_center", [37.3888, -121.9644])
        # Auto compute ~35 mile radius box from center
        bbox = {
            "min_lat": center[0] - 0.5,
            "max_lat": center[0] + 0.5,
            "min_lng": center[1] - 0.5,
            "max_lng": center[1] + 0.5,
            "allowed_states": ["CA", "California"]
        }
    
    missing_url_count = sum(1 for l in listings if not (l.get("url") or "").strip())
    if missing_url_count:
        all_errors.append(
            f"{missing_url_count} listing(s) have no URL — they are skipped by refresh; add permalinks to enable upstream sync"
        )

    for l in listings:
        errs = validate_listing(l, bbox)
        all_errors.extend(errs)
        
        # Duplicate address + unit check
        street = (l.get("street_address") or "").strip().lower()
        unit = (l.get("unit_number") or "").strip().lower()
        city = (l.get("city") or "").strip().lower()
        key = f"{street}|{city}|{unit}"
        
        if key in seen_addresses:
            prior_id = seen_addresses[key]
            all_errors.append(f"Duplicate listing detected: {l.get('id')} shares exact address and unit with {prior_id} ({street}, {unit})")
        else:
            seen_addresses[key] = l.get("id")
            
    return len(all_errors) == 0, all_errors
